"""Fixture sintetica di un set completo di turni di servizio (25-23, 13 turni).

Serve a esercitare la parte di `app/volleyball` che la fixture Cerea non copre:
ricostruzione della sequenza temporale, ciclicità delle rotazioni, ricalcolo di
`points_scored` come campo derivato (backend §11) e detection delle incongruenze
di punteggio (backend §25.5-§25.7).

Convenzione del referto, rispettata dalla sequenza qui sotto:

- un turno di servizio dura finché la squadra al servizio non perde un rally;
- quindi, alla fine di ogni turno, l'avversario guadagna esattamente 1 punto…
- …tranne nell'ultimo turno del set, che si chiude col punto decisivo della
  squadra al servizio (avversario a +0);
- `points_scored` del turno = punti guadagnati dalla squadra AL SERVIZIO.

Sequenza (punteggio sempre A-B, la squadra A serve per prima e vince 25-23):

    #   squadra  inizio → fine    punti  rot  battitore
    1   A        0-0   →  2-1       2     I      2
    2   B        2-1   →  3-4       3     I     14
    3   A        3-4   →  7-5       4     II     5
    4   B        7-5   →  8-6       1     II     9
    5   A        8-6   →  8-7       0     III    3
    6   B        8-7   →  9-9       2     III    3
    7   A        9-9   → 14-10      5     IV     8
    8   B       14-10  → 15-14      4     IV     4
    9   A       15-14  → 18-15      3     V     14
   10   B       18-15  → 19-19      4     V     15
   11   A       19-19  → 21-20      2     VI     9
   12   B       21-20  → 22-23      3     VI    17
   13   A       22-23  → 25-23      3     I      2
"""

from __future__ import annotations

from app.domain.raw_observation import ExpectedType, ObservationCandidate, RawObservation
from app.models.common import ExtractionMethod

TEAM_A_ID = "team-a"
TEAM_B_ID = "team-b"

SET_NUMBER = 1
FINAL_SCORE = (25, 23)

TEAM_A_STARTING_SIX = {"I": "2", "II": "5", "III": "3", "IV": "8", "V": "14", "VI": "9"}
TEAM_B_STARTING_SIX = {"I": "14", "II": "9", "III": "3", "IV": "4", "V": "15", "VI": "17"}

# (sequenza, squadra, punteggio inizio, punteggio fine, rotazione, battitore)
TURNS: tuple[tuple[int, str, tuple[int, int], tuple[int, int], str, int], ...] = (
    (1, TEAM_A_ID, (0, 0), (2, 1), "I", 2),
    (2, TEAM_B_ID, (2, 1), (3, 4), "I", 14),
    (3, TEAM_A_ID, (3, 4), (7, 5), "II", 5),
    (4, TEAM_B_ID, (7, 5), (8, 6), "II", 9),
    (5, TEAM_A_ID, (8, 6), (8, 7), "III", 3),
    (6, TEAM_B_ID, (8, 7), (9, 9), "III", 3),
    (7, TEAM_A_ID, (9, 9), (14, 10), "IV", 8),
    (8, TEAM_B_ID, (14, 10), (15, 14), "IV", 4),
    (9, TEAM_A_ID, (15, 14), (18, 15), "V", 14),
    (10, TEAM_B_ID, (18, 15), (19, 19), "V", 15),
    (11, TEAM_A_ID, (19, 19), (21, 20), "VI", 9),
    (12, TEAM_B_ID, (21, 20), (22, 23), "VI", 17),
    (13, TEAM_A_ID, (22, 23), (25, 23), "I", 2),
)

EXPECTED_POINTS_SCORED = (2, 3, 4, 1, 0, 2, 5, 4, 3, 4, 2, 3, 3)
EXPECTED_ROTATIONS = tuple(turn[4] for turn in TURNS)
EXPECTED_SERVERS = tuple(turn[5] for turn in TURNS)


def _score(value: tuple[int, int]) -> str:
    return f"{value[0]}-{value[1]}"


def _observation(
    obs_id: str,
    expected_type: ExpectedType,
    value: str,
    *,
    confidence: float = 0.96,
    alternatives: tuple[tuple[str, float], ...] = (),
) -> RawObservation:
    candidates = [ObservationCandidate(value=value, confidence=confidence)]
    candidates.extend(
        ObservationCandidate(value=alt_value, confidence=alt_confidence)
        for alt_value, alt_confidence in alternatives
    )
    return RawObservation(
        id=f"obs-{obs_id}",
        region_id=f"region-{obs_id}",
        expected_type=expected_type,
        method=ExtractionMethod.PDF_TEXT,
        candidates=candidates,
    )


def starting_six_observations() -> list[RawObservation]:
    observations: list[RawObservation] = []
    for team_id, values in ((TEAM_A_ID, TEAM_A_STARTING_SIX), (TEAM_B_ID, TEAM_B_STARTING_SIX)):
        for position, value in values.items():
            observations.append(
                _observation(
                    f"set{SET_NUMBER}-{team_id}-{position}",
                    ExpectedType.PLAYER_NUMBER,
                    value,
                    confidence=0.97,
                )
            )
    return observations


def service_turn_observations(
    *,
    score_end_overrides: dict[int, tuple[int, int]] | None = None,
    rotation_overrides: dict[int, str] | None = None,
    player_overrides: dict[int, str] | None = None,
    player_alternatives: dict[int, tuple[tuple[str, float], ...]] | None = None,
    player_confidences: dict[int, float] | None = None,
) -> list[RawObservation]:
    """Osservazioni grezze dei 13 turni.

    Gli `*_overrides` servono ai test per iniettare deliberatamente un dato
    incoerente e verificare che il validator lo intercetti invece di accettarlo.
    """
    score_end_overrides = score_end_overrides or {}
    rotation_overrides = rotation_overrides or {}
    player_overrides = player_overrides or {}
    player_alternatives = player_alternatives or {}
    player_confidences = player_confidences or {}

    observations: list[RawObservation] = []
    for sequence, team_id, score_start, score_end, rotation, player in TURNS:
        prefix = f"set{SET_NUMBER}-{team_id}-turn-{sequence:03d}"
        observations.append(
            _observation(
                f"{prefix}-player",
                ExpectedType.PLAYER_NUMBER,
                player_overrides.get(sequence, str(player)),
                confidence=player_confidences.get(sequence, 0.96),
                alternatives=player_alternatives.get(sequence, ()),
            )
        )
        observations.append(
            _observation(
                f"{prefix}-rotation",
                ExpectedType.ROTATION_LABEL,
                rotation_overrides.get(sequence, rotation),
            )
        )
        observations.append(
            _observation(f"{prefix}-score-start", ExpectedType.SCORE, _score(score_start))
        )
        observations.append(
            _observation(
                f"{prefix}-score-end",
                ExpectedType.SCORE,
                _score(score_end_overrides.get(sequence, score_end)),
            )
        )
    return observations


def serving_team_indicator() -> RawObservation:
    return _observation(
        f"set{SET_NUMBER}-serving-team",
        ExpectedType.SERVING_TEAM_INDICATOR,
        TEAM_A_ID,
        confidence=0.99,
    )


def all_observations(**kwargs) -> list[RawObservation]:
    """Set completo e coerente: sestetti + indicatore di servizio + 13 turni."""
    return [
        *starting_six_observations(),
        serving_team_indicator(),
        *service_turn_observations(**kwargs),
    ]


SCORE_JUMP_SEQUENCE = 6
SCORE_JUMP_SCORE_END = (10, 9)
"""Incongruenza iniettata: il turno 6 (servizio team-b, 8-7 → 9-9) diventa
8-7 → 10-9, cioè team-a guadagna 2 punti in un solo rally invece di 1."""


def observations_with_score_jump() -> list[RawObservation]:
    return all_observations(score_end_overrides={SCORE_JUMP_SEQUENCE: SCORE_JUMP_SCORE_END})
