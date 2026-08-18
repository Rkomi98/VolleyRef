"""Modello della partita: sestetti, turni di servizio, set, validazione.

Specifica di riferimento: 02_volleyref_backend_prompt.md §10-§12.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel

from app.models.common import CheckStatus, ExtractedValue


class RotationLabel(str, Enum):
    I = "I"
    II = "II"
    III = "III"
    IV = "IV"
    V = "V"
    VI = "VI"


class StartingSix(BaseModel):
    I: ExtractedValue[Optional[int]]
    II: ExtractedValue[Optional[int]]
    III: ExtractedValue[Optional[int]]
    IV: ExtractedValue[Optional[int]]
    V: ExtractedValue[Optional[int]]
    VI: ExtractedValue[Optional[int]]


class ServiceTurn(BaseModel):
    id: str
    sequence: int
    team_id: str
    player: ExtractedValue[Optional[int]]
    rotation: ExtractedValue[Optional[RotationLabel]]
    score_start: ExtractedValue[tuple[int, int]]
    score_end: ExtractedValue[tuple[int, int]]
    points_scored: int
    """Campo derivato (backend §11) — non è ground truth OCR, va ricalcolato
    ogni volta che score_start/score_end cambiano."""
    status: CheckStatus
    source_region_ids: list[str] = []


class ValidationCheck(BaseModel):
    id: str
    label: str
    status: CheckStatus
    message: Optional[str] = None
    field_ids: list[str] = []


class ValidationResult(BaseModel):
    status: CheckStatus
    checks: list[ValidationCheck] = []


class Team(BaseModel):
    id: str
    name: str


class MatchInfo(BaseModel):
    competition: Optional[str] = None
    match_number: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    venue: Optional[str] = None
    team_a: Team
    team_b: Team
    final_result: tuple[int, int]


class SetData(BaseModel):
    number: int
    starting_team_id: str
    team_a_starting_six: StartingSix
    team_b_starting_six: StartingSix
    service_turns: list[ServiceTurn] = []
    final_score: tuple[int, int]
    validation: ValidationResult
