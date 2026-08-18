"""Analysis: risorsa principale esposta dall'API pubblica.

Specifica di riferimento: 02_volleyref_backend_prompt.md §4-§7.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel

from app.models.common import CheckStatus, ErrorDetail, SourceRegion
from app.models.match import MatchInfo, SetData, ValidationResult


class AnalysisGlobalStatus(str, Enum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"


class ProcessingStepId(str, Enum):
    """5 step mostrati in ProcessingState sul frontend (frontend §6, backend §6).
    Le etichette italiane visualizzate all'utente vivono solo nel frontend."""

    READ_DOCUMENT = "READ_DOCUMENT"
    DETECT_SETS = "DETECT_SETS"
    EXTRACT_STARTING_SIX = "EXTRACT_STARTING_SIX"
    EXTRACT_SERVICE_TURNS = "EXTRACT_SERVICE_TURNS"
    VALIDATE = "VALIDATE"


class ProcessingStepStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"


class ProcessingStep(BaseModel):
    id: ProcessingStepId
    status: ProcessingStepStatus


class CreateAnalysisResponse(BaseModel):
    """Risposta di `POST /api/v1/analyses` — 202 Accepted (backend §5)."""

    analysis_id: str
    status: AnalysisGlobalStatus


class AnalysisStatusResponse(BaseModel):
    """Risposta di `GET /api/v1/analyses/{id}/status` (backend §6)."""

    analysis_id: str
    status: AnalysisGlobalStatus
    progress: int
    current_step: Optional[ProcessingStepId] = None
    steps: list[ProcessingStep]
    error: Optional[ErrorDetail] = None


class Analysis(BaseModel):
    """Risposta di `GET /api/v1/analyses/{id}` — modello normalizzato completo
    (backend §7). È l'unica forma che il frontend riceve: mai OCR grezzo, mai
    coordinate/strutture native di PyMuPDF/OpenCV/parser interni (backend §3)."""

    id: str
    status: AnalysisGlobalStatus
    overall_validation: Optional[CheckStatus] = None
    match: MatchInfo
    sets: list[SetData] = []
    source_regions: list[SourceRegion] = []
    validation: ValidationResult
