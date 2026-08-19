"""Modello di errore uniforme ed exception handler centralizzato.

Specifica di riferimento: 02_volleyref_backend_prompt.md §34 (error model) e
§37 (ogni elaborazione/errore correlabile via `analysis_id`).

Il modello `{code, message, details}` è già definito come Pydantic model in
`app.models.common` (`ErrorCode`/`ErrorDetail`/`ErrorEnvelope`) — questo
modulo lo riusa come *unica* fonte di verità (nessuna ridefinizione) e si
limita ad aggiungere:

- `AppError`: base per gli errori di dominio solllevati dal codice sotto
  `app/core/**` (es. `app.core.security`), con `code`/`http_status` propri;
- `register_exception_handlers(app)`: un singolo punto di aggancio che
  intercetta *qualunque* eccezione su *qualunque* route (errori nostri,
  errori di dominio "esterni" con lo stesso protocollo `code/message/details`
  come `AnalysisServiceError` del servizio Analysis, errori di validazione
  FastAPI/Pydantic, `HTTPException`, e infine un fallback generico) e li
  traduce tutti nella stessa `ErrorEnvelope`.

Gli errori "esterni" (es. `app.services.analysis_service.AnalysisServiceError`
e le sue sottoclassi) sono riconosciuti nel dispatch per *duck typing*
(attributi `code`/`message`/`details`), per non far dipendere la logica di
smistamento da `app/services`. La *registrazione* dell'handler presso
FastAPI, però, richiede comunque una classe concreta importata (vedi nota
sotto): il duck typing da solo protegge il branching interno, non la
capacità di FastAPI/Starlette di individuare l'handler da invocare.

Nota importante su Starlette/FastAPI: NON si può registrare l'handler
unificato sulla classe builtin `Exception` per ottenere un vero catch-all.
`Starlette.build_middleware_stack()` tratta la chiave `Exception` (e lo
status code 500) in modo speciale: la estrae da `exception_handlers` e la
usa come `handler` di `ServerErrorMiddleware`, il livello più esterno, che
dopo aver costruito la risposta **rilancia sempre l'eccezione originale**
("allows test clients to optionally raise the error within the test case" —
commento upstream in `starlette/middleware/errors.py`). Con `TestClient`
(che ha `raise_server_exceptions=True` di default) questo fa fallire ogni
richiesta che passa da quel percorso, anche se la ErrorEnvelope prodotta è
corretta. Per questo l'handler va registrato sulle classi concrete note
(`AppError`, `RequestValidationError`, `HTTPException`,
`AnalysisServiceError`) e non su `Exception`: un'eccezione realmente
imprevista (bug, non un errore di dominio) resta quindi gestita dal
comportamento di default di Starlette, esattamente come accadeva già prima
di questo modulo (il fallback `@app.exception_handler(Exception)` dello
scaffold B1 aveva lo stesso limite, semplicemente non ancora osservato da
nessun test).
"""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import bind_analysis_id, get_logger
from app.models.common import ErrorCode, ErrorDetail, ErrorEnvelope

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Eccezioni di dominio per il codice sotto app/core/** (es. security.py).
# ---------------------------------------------------------------------------


class AppError(Exception):
    """Base per gli errori applicativi con esito diretto in ErrorEnvelope."""

    code: ErrorCode = ErrorCode.INTERNAL_ERROR
    http_status: int = 500

    def __init__(
        self,
        message: str,
        *,
        details: Optional[dict] = None,
        code: Optional[ErrorCode] = None,
        http_status: Optional[int] = None,
    ) -> None:
        self.message = message
        self.details = details or {}
        if code is not None:
            self.code = code
        if http_status is not None:
            self.http_status = http_status
        super().__init__(message)


class InvalidFileError(AppError):
    """File caricato non valido: estensione/Content-Type errati, vuoto,
    troppo grande (backend §34, §40)."""

    code = ErrorCode.INVALID_FILE
    http_status = 400


class UnsupportedPdfError(AppError):
    """Il contenuto non è un vero PDF (signature assente) o non è
    interpretabile (backend §34, §40)."""

    code = ErrorCode.UNSUPPORTED_PDF
    http_status = 400


class SourceFileMissingError(AppError):
    """Il PDF originale registrato per un'analisi non è più disponibile:
    o il path risolto non è contenuto nella storage dir prevista, o il file
    non esiste più su disco (es. storage effimero azzerato tra un deploy e
    l'altro). Le due cause sono deliberatamente indistinguibili dal punto di
    vista del client — vedi `app.core.security.resolve_pdf_within_storage`."""

    code = ErrorCode.SOURCE_PDF_MISSING
    http_status = 404


# ---------------------------------------------------------------------------
# Mappatura ErrorCode -> HTTP status, condivisa fra AppError "nostri" e gli
# errori di dominio esterni riconosciuti per duck typing.
# ---------------------------------------------------------------------------

_STATUS_BY_CODE: dict[ErrorCode, int] = {
    ErrorCode.INVALID_FILE: 400,
    ErrorCode.UNSUPPORTED_PDF: 400,
    ErrorCode.ANALYSIS_NOT_FOUND: 404,
    ErrorCode.ANALYSIS_FAILED: 500,
    ErrorCode.INVALID_FIELD_VALUE: 400,
    ErrorCode.EXPORT_FAILED: 500,
    ErrorCode.INTERNAL_ERROR: 500,
}


def _analysis_id_from_request(request: Request) -> Optional[str]:
    """Estrae `analysis_id` dal path della richiesta, se presente — è così
    che l'handler centralizzato riesce a correlare qualunque errore alla sua
    analysis anche senza che chi solleva l'eccezione lo passi esplicitamente."""

    value = request.path_params.get("analysis_id")
    return value if isinstance(value, str) else None


def _dispatch(exc: Exception) -> tuple[int, ErrorCode, str, dict]:
    """Decide status HTTP / ErrorCode / message / details per qualunque
    eccezione arrivi all'handler centralizzato."""

    if isinstance(exc, RequestValidationError):
        errors = [
            {"loc": list(e.get("loc", [])), "msg": e.get("msg"), "type": e.get("type")}
            for e in exc.errors()
        ]
        return 422, ErrorCode.INVALID_FIELD_VALUE, "Richiesta non valida.", {"errors": errors}

    if isinstance(exc, StarletteHTTPException):
        return exc.status_code, ErrorCode.INTERNAL_ERROR, str(exc.detail), {}

    if isinstance(exc, AppError):
        return exc.http_status, exc.code, exc.message, exc.details

    # Duck typing: eccezioni di dominio "esterne" (es. AnalysisServiceError e
    # sottoclassi in app.services.analysis_service) che seguono lo stesso
    # protocollo code/message/details senza che questo modulo le importi.
    code = getattr(exc, "code", None)
    message = getattr(exc, "message", None)
    if isinstance(code, ErrorCode) and message is not None:
        details = getattr(exc, "details", {}) or {}
        status_code = _STATUS_BY_CODE.get(code, 500)
        return status_code, code, message, details

    return 500, ErrorCode.INTERNAL_ERROR, "Errore interno del server.", {}


def _error_response(status_code: int, code: ErrorCode, message: str, details: dict) -> JSONResponse:
    envelope = ErrorEnvelope(error=ErrorDetail(code=code, message=message, details=details))
    return JSONResponse(status_code=status_code, content=envelope.model_dump(mode="json"))


def register_exception_handlers(app: FastAPI) -> None:
    """Punto unico di registrazione: applica lo stesso handler a tutte le
    classi di eccezione rilevanti, su tutte le route dell'app.

    FastAPI registra di default handler specifici per `RequestValidationError`
    e `HTTPException` (più specifici di un handler su `Exception`), quindi
    vanno sovrascritti esplicitamente. `AnalysisServiceError` (base delle
    eccezioni di dominio del servizio Analysis) è registrata qui per classe
    concreta — non tramite un handler su `Exception` — per il motivo
    spiegato nel docstring del modulo: `Exception` è una chiave speciale per
    Starlette, non un handler "normale". Registrare la classe base è
    sufficiente: la lookup di Starlette risale la MRO, quindi copre anche
    tutte le sue sottoclassi (`InvalidFileError`, `UnsupportedPdfError`,
    `AnalysisNotFoundError`, `InvalidFieldValueError`, `ExportFailedError`, …).
    """

    # Import locale per evitare che app/core dipenda da app/services a
    # livello di modulo — resta comunque necessario importare la classe
    # concreta per poterla registrare come chiave presso FastAPI (il
    # riconoscimento per duck typing dentro `_dispatch` da solo non basta:
    # serve una classe reale per la lookup di Starlette).
    from app.services.analysis_service import AnalysisServiceError

    async def _handle(request: Request, exc: Exception) -> JSONResponse:
        status_code, code, message, details = _dispatch(exc)
        analysis_id = _analysis_id_from_request(request)

        with bind_analysis_id(analysis_id):
            log_extra = {
                "analysis_id": analysis_id,
                "error_code": code.value,
                "status_code": status_code,
                "path": request.url.path,
            }
            if status_code >= 500:
                logger.error(message, extra=log_extra, exc_info=exc)
            else:
                logger.warning(message, extra=log_extra)

        return _error_response(status_code, code, message, details)

    app.add_exception_handler(RequestValidationError, _handle)
    app.add_exception_handler(StarletteHTTPException, _handle)
    app.add_exception_handler(AppError, _handle)
    app.add_exception_handler(AnalysisServiceError, _handle)
