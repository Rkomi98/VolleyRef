"""Tipi condivisi da tutti i modelli di dominio.

Specifica di riferimento: 02_volleyref_backend_prompt.md §8-§9, §34.
Il corrispettivo TypeScript (camelCase) vive in frontend/src/lib/types.ts;
il DTO JSON (snake_case, esattamente questi modelli serializzati) vive in
frontend/src/lib/api/dto.ts. I tre file devono restare in sincrono — è la
regola architetturale principale di entrambi i prompt.
"""

from __future__ import annotations

from enum import Enum
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ExtractionMethod(str, Enum):
    PDF_TEXT = "PDF_TEXT"
    OCR = "OCR"
    DERIVED = "DERIVED"


class CheckStatus(str, Enum):
    VALID = "VALID"
    WARNING = "WARNING"
    INVALID = "INVALID"


class ExtractedValue(BaseModel, Generic[T]):
    """Un valore modificabile con provenienza tracciabile (backend §8)."""

    id: str
    value: T
    original_value: T
    confidence: Optional[float] = None
    manually_confirmed: bool = False
    source_region_id: Optional[str] = None


class SourceRegion(BaseModel):
    """Regione del documento da cui deriva un valore estratto (backend §9)."""

    id: str
    page: int
    x: float
    y: float
    width: float
    height: float
    method: ExtractionMethod
    region_type: Optional[str] = None
    raw_text: Optional[str] = None


class ErrorCode(str, Enum):
    INVALID_FILE = "INVALID_FILE"
    UNSUPPORTED_PDF = "UNSUPPORTED_PDF"
    ANALYSIS_NOT_FOUND = "ANALYSIS_NOT_FOUND"
    ANALYSIS_FAILED = "ANALYSIS_FAILED"
    INVALID_FIELD_VALUE = "INVALID_FIELD_VALUE"
    EXPORT_FAILED = "EXPORT_FAILED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ErrorDetail(BaseModel):
    code: ErrorCode
    message: str
    details: dict = {}


class ErrorEnvelope(BaseModel):
    """Formato uniforme di ogni risposta di errore API (backend §34)."""

    error: ErrorDetail
