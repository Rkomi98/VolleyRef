"""Entry point dell'app FastAPI di VolleyRef backend.

Specifica di riferimento: 02_volleyref_backend_prompt.md §4-§20 (contratto
endpoint), §32 (CORS), §34 (error model), §44 (contratto vivente: prima un
flusso end-to-end con risultati mock, poi il parsing reale — questo file
cablaggia esattamente quel contratto, senza logica di parsing).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analyses import router as analyses_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.repositories.analysis_repository import (
    SqliteAnalysisRepository,
    create_engine_from_url,
    create_session_factory,
    create_tables,
)
from app.services.analysis_service import AnalysisService

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    storage_dir = Path(settings.storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)

    engine = create_engine_from_url(settings.database_url)
    create_tables(engine)
    session_factory = create_session_factory(engine)
    repository = SqliteAnalysisRepository(session_factory)

    service = AnalysisService(repository, storage_dir)
    # Riconciliazione all'avvio: chiude come FAILED le analisi rimaste
    # PROCESSING/UPLOADED da un processo precedente morto a metà (es. OOM su un
    # referto scansionato), così che il polling del frontend non giri all'infinito.
    service.fail_unfinished_analyses()
    app.state.analysis_service = service
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

# Handler centralizzato per tutte le eccezioni note, su tutte le route
# (backend §34): AppError/errori di validazione file (app/core/security.py),
# AnalysisServiceError e sottoclassi (app/services/analysis_service.py),
# RequestValidationError e HTTPException — vedi app/core/errors.py per il
# dettaglio del dispatch e per il motivo per cui non esiste un vero
# catch-all su `Exception` (limite di Starlette, non di questo modulo).
register_exception_handlers(app)


@app.get("/health", include_in_schema=False)
def health_check() -> dict:
    return {"status": "ok"}
