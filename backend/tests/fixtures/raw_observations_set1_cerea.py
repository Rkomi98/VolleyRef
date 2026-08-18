"""Fixture sintetica di RawObservation per il Set 1 della partita
ISUZU CEREA VR vs ROTHOBLAAS VOLANO TN (backend prompt §28, fixture 2 — quella
con text layer utilizzabile, PDF reale in examples/).

Serve a sviluppare e testare `app/volleyball` (parser + validator) SENZA
aspettare che `app/extraction/text` sia pronto: i valori attesi in uscita dal
parser sono esattamente quelli documentati nel prompt, quindi questa fixture
funziona anche da test di non-regressione precoce.

Valori attesi dopo il parsing:
  Cerea:      I=2  II=5  III=3  IV=8  V=14 VI=9
  Rothoblaas: I=14 II=9  III=3  IV=4  V=15 VI=17
  Punteggio Set 1: 25-27

Un valore (Cerea, posizione III) è deliberatamente ambiguo con due candidati a
confidence comparabile, per esercitare la risoluzione di ambiguità del
validator (backend §26).
"""

from __future__ import annotations

from app.domain.raw_observation import ExpectedType, ObservationCandidate, RawObservation
from app.models.common import ExtractionMethod

TEAM_A_ID = "team-a"  # Cerea
TEAM_B_ID = "team-b"  # Rothoblaas

_TEAM_A_VALUES = {"I": "2", "II": "5", "III": "3", "IV": "8", "V": "14", "VI": "9"}
_TEAM_B_VALUES = {"I": "14", "II": "9", "III": "3", "IV": "4", "V": "15", "VI": "17"}


def _observation(obs_id: str, region_id: str, value: str, *, ambiguous_with: str | None = None) -> RawObservation:
    candidates = [ObservationCandidate(value=value, confidence=0.97)]
    if ambiguous_with is not None:
        candidates = [
            ObservationCandidate(value=value, confidence=0.55),
            ObservationCandidate(value=ambiguous_with, confidence=0.52),
        ]
    return RawObservation(
        id=obs_id,
        region_id=region_id,
        expected_type=ExpectedType.PLAYER_NUMBER,
        method=ExtractionMethod.PDF_TEXT,
        candidates=candidates,
    )


def starting_six_observations() -> list[RawObservation]:
    observations: list[RawObservation] = []
    for team_id, values in ((TEAM_A_ID, _TEAM_A_VALUES), (TEAM_B_ID, _TEAM_B_VALUES)):
        for position, value in values.items():
            ambiguous_with = "8" if team_id == TEAM_A_ID and position == "III" else None
            observations.append(
                _observation(
                    obs_id=f"obs-set1-{team_id}-{position}",
                    region_id=f"region-set1-{team_id}-{position}",
                    value=value,
                    ambiguous_with=ambiguous_with,
                )
            )
    return observations


EXPECTED_TEAM_A_STARTING_SIX = _TEAM_A_VALUES
EXPECTED_TEAM_B_STARTING_SIX = _TEAM_B_VALUES
EXPECTED_FINAL_SCORE = (25, 27)
