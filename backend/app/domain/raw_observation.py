"""Contratto intermedio tra estrazione (text-layer/raster) e interpretazione
pallavolistica (parser/validator).

È il secondo contratto di Fase 0 del piano: fissarlo permette di sviluppare in
parallelo `app/extraction/text`, `app/extraction/raster` (che PRODUCONO
RawObservation) e `app/volleyball` (che le CONSUMA) senza aspettarsi a vicenda —
ognuno testa il proprio lato contro fixture di questo tipo.

Non è un modello pubblico: non esce mai dal backend, non è nel contratto API
verso il frontend (backend §3, §23).
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel

from app.models.common import ExtractionMethod


class ExpectedType(str, Enum):
    """Cosa il layout detector si aspetta di trovare in quella regione —
    guida sia l'OCR (quali caratteri sono plausibili) sia il parser
    pallavolistico (backend §21)."""

    PLAYER_NUMBER = "PLAYER_NUMBER"
    ROTATION_LABEL = "ROTATION_LABEL"
    SCORE = "SCORE"
    TEAM_NAME = "TEAM_NAME"
    MATCH_META = "MATCH_META"
    SERVING_TEAM_INDICATOR = "SERVING_TEAM_INDICATOR"


class ObservationCandidate(BaseModel):
    """Una possibile lettura del contenuto della regione, con la sua confidence
    (backend §23). Più candidati con confidence comparabile ⇒ ambiguità che il
    validator pallavolistico dovrà risolvere con vincoli di dominio (backend §26)."""

    value: str
    confidence: float


class RawObservation(BaseModel):
    id: str
    region_id: str
    expected_type: ExpectedType
    method: ExtractionMethod
    candidates: list[ObservationCandidate]
