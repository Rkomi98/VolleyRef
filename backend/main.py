"""Entry point dell'app FastAPI di VolleyRef backend.

Specifica di riferimento: 02_volleyref_backend_prompt.md §4-§20 (contratto
endpoint), §32 (CORS), §34 (error model), §44 (contratto vivente: prima un
flusso end-to-end con risultati mock, poi il parsing reale — questo file
cablaggia esattamente quel contratto, senza logica di parsing).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.analyses import router as analyses_router
from app.core.config import get_settings
from app.models.common import ErrorCode, ErrorDetail, ErrorEnvelope
from app.repositories.analysis_repository import (
    SqliteAnalysisRepository,
    create_engine_from_url,
    create_session_factory,
    create_tables,
)
from app.services.analysis_service import AnalysisService, AnalysisServiceError

# Mappatura ErrorCode -> HTTP status (backend §34).
_ERROR_STATUS_MAP: dict[ErrorCode, int] = {
    ErrorCode.ANALYSIS_NOT_FOUND: 404,
    ErrorCode.INVALID_FILE: 400,
    ErrorCode.UNSUPPORTED_PDF: 400,
    ErrorCode.INVALID_FIELD_VALUE: 400,
    ErrorCode.ANALYSIS_FAILED: 500,
    ErrorCode.EXPORT_FAILED: 500,
    ErrorCode.INTERNAL_ERROR: 500,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    storage_dir = Path(settings.storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)

    engine = create_engine_from_url(settings.database_url)
    create_tables(engine)
    session_factory = create_session_factory(engine)
    repository = SqliteAnalysisRepository(session_factory)

    app.state.analysis_service = AnalysisService(repository, storage_dir)
    yield


app = FastAPI(title="VolleyRef Backend", version="0.1.0", lifespan=lifespan)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyses_router)


@app.exception_handler(AnalysisServiceError)
async def handle_analysis_service_error(
    request: Request, exc: AnalysisServiceError
) -> JSONResponse:
    status_code = _ERROR_STATUS_MAP.get(exc.code, 500)
    envelope = ErrorEnvelope(
        error=ErrorDetail(code=exc.code, message=exc.message, details=exc.details)
    )
    return JSONResponse(status_code=status_code, content=envelope.model_dump(mode="json"))


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    envelope = ErrorEnvelope(
        error=ErrorDetail(
            code=ErrorCode.INTERNAL_ERROR,
            message="Errore interno del server.",
            details={},
        )
    )
    return JSONResponse(status_code=500, content=envelope.model_dump(mode="json"))


@app.get("/health", include_in_schema=False)
def health_check() -> dict:
    return {"status": "ok"}
