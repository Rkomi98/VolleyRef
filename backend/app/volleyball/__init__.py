"""Interpretazione pallavolistica: dalle osservazioni grezze al domain model.

`parser` costruisce (backend §24), `validator` verifica (backend §25),
`constraints` contiene i vincoli di dominio puri che entrambi condividono e con
cui il parser risolve le ambiguità OCR (backend §26).
"""

from app.volleyball.constraints import Constraint, ROTATION_ORDER
from app.volleyball.parser import (
    CandidateResolution,
    ParsedSet,
    RawServiceTurnGroup,
    RejectedCandidate,
    parse_service_turns,
    parse_set,
    parse_starting_six,
    recompute_points_scored,
    starting_six_field_id,
    service_turn_field_id,
    service_turn_id,
    to_set_data,
)
from app.volleyball.validator import validate_set

__all__ = [
    "CandidateResolution",
    "Constraint",
    "ParsedSet",
    "ROTATION_ORDER",
    "RawServiceTurnGroup",
    "RejectedCandidate",
    "parse_service_turns",
    "parse_set",
    "parse_starting_six",
    "recompute_points_scored",
    "service_turn_field_id",
    "service_turn_id",
    "starting_six_field_id",
    "to_set_data",
    "validate_set",
]
