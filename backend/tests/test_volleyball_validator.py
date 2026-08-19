"""Unit test del Volleyball Validator (backend §25, §26, §36).

Ogni controllo è deterministico e, quando fallisce, deve puntare ai `field_ids`
coinvolti: sono quelli che il frontend usa per navigare all'anomalia (backend §12).
"""

from __future__ import annotations

import pytest

from app.domain.raw_observation import ExpectedType, ObservationCandidate, RawObservation
from app.models.common import CheckStatus, ExtractionMethod
from app.volleyball import constraints as C
from app.volleyball.parser import (
    parse_set,
    service_turn_field_id,
    starting_six_field_id,
)
from app.volleyball.validator import unresolved_ambiguity_field_ids, validate_set
from tests.fixtures import service_turns_set_synthetic as synthetic
from tests.fixtures.raw_observations_set1_cerea import (
    EXPECTED_FINAL_SCORE,
    EXPECTED_TEAM_A_STARTING_SIX,
    TEAM_A_ID,
    TEAM_B_ID,
    starting_six_observations,
)

CEREA_POSITION_III = starting_six_field_id(1, TEAM_A_ID, "III")


def _check(result, check_id):
    return next(check for check in result.checks if check.id == check_id)


def _parse_cerea(observations=None):
    return parse_set(
        observations if observations is not None else starting_six_observations(),
        set_number=1,
        team_a_id=TEAM_A_ID,
        team_b_id=TEAM_B_ID,
        reported_final_score=EXPECTED_FINAL_SCORE,
    )


def _parse_synthetic(observations=None, **kwargs):
    return parse_set(
        observations if observations is not None else synthetic.all_observations(**kwargs),
        set_number=synthetic.SET_NUMBER,
        team_a_id=synthetic.TEAM_A_ID,
        team_b_id=synthetic.TEAM_B_ID,
        reported_final_score=synthetic.FINAL_SCORE,
    )


# ---------------------------------------------------------------------------
# Sestetti iniziali (backend §25.1)
# ---------------------------------------------------------------------------


def test_cerea_starting_sixes_are_structurally_valid():
    result = validate_set(_parse_cerea())

    assert _check(result, "starting-six-complete").status is CheckStatus.VALID
    assert _check(result, "starting-six-distinct").status is CheckStatus.VALID
    assert _check(result, "missing-readings").status is CheckStatus.VALID
    assert _check(result, "domain-compatibility").status is CheckStatus.VALID


def test_resolved_ambiguity_still_reports_a_warning_on_that_field_id():
    """L'ambiguità sulla posizione III di Cerea è stata risolta da un vincolo di
    dominio, ma un'ambiguità reale c'era: il set non può risultare VALID e il
    check deve puntare al field_id della posizione III (backend §26)."""
    parsed = _parse_cerea()
    result = validate_set(parsed)

    ambiguity = _check(result, "ambiguous-reading")
    assert ambiguity.status is CheckStatus.WARNING
    assert CEREA_POSITION_III in ambiguity.field_ids
    assert ambiguity.message is not None
    assert C.Constraint.UNIQUE_JERSEY_IN_STARTING_SIX.value in ambiguity.message
    # Lo stato complessivo del set eredita il WARNING.
    assert result.status is CheckStatus.WARNING
    # …ma l'ambiguità risulta risolta, non aperta.
    assert unresolved_ambiguity_field_ids(parsed) == []


def test_missing_position_makes_the_starting_six_invalid():
    observations = [
        observation
        for observation in starting_six_observations()
        if observation.id != f"obs-set1-{TEAM_B_ID}-V"
    ]
    result = validate_set(_parse_cerea(observations))

    check = _check(result, "starting-six-complete")
    assert check.status is CheckStatus.INVALID
    assert check.field_ids == [starting_six_field_id(1, TEAM_B_ID, "V")]
    assert _check(result, "missing-readings").status is CheckStatus.INVALID
    assert result.status is CheckStatus.INVALID


def test_duplicate_jersey_number_makes_the_starting_six_invalid():
    values = dict(EXPECTED_TEAM_A_STARTING_SIX)
    values["III"] = "8"  # già presente in posizione IV
    observations = [
        RawObservation(
            id=f"obs-set1-{TEAM_A_ID}-{position}",
            region_id=f"region-set1-{TEAM_A_ID}-{position}",
            expected_type=ExpectedType.PLAYER_NUMBER,
            method=ExtractionMethod.PDF_TEXT,
            candidates=[ObservationCandidate(value=value, confidence=0.97)],
        )
        for position, value in values.items()
    ]
    result = validate_set(_parse_cerea(observations))

    check = _check(result, "starting-six-distinct")
    assert check.status is CheckStatus.INVALID
    assert set(check.field_ids) == {
        starting_six_field_id(1, TEAM_A_ID, "III"),
        starting_six_field_id(1, TEAM_A_ID, "IV"),
    }
    # La lettura incompatibile è segnalata, non corretta.
    assert _check(result, "domain-compatibility").status is CheckStatus.WARNING
    assert result.status is CheckStatus.INVALID


# ---------------------------------------------------------------------------
# Set sintetico completo e coerente
# ---------------------------------------------------------------------------


def test_consistent_synthetic_set_passes_every_check():
    result = validate_set(_parse_synthetic())

    failing = [check.id for check in result.checks if check.status is not CheckStatus.VALID]
    assert failing == []
    assert result.status is CheckStatus.VALID
    assert {check.id for check in result.checks} == {
        "starting-six-complete",
        "starting-six-distinct",
        "rotation-order",
        "service-alternation",
        "score-monotonic",
        "score-continuity",
        "rally-increments",
        "points-scored-derived",
        "final-score",
        "server-eligibility",
        "missing-readings",
        "domain-compatibility",
        "ambiguous-reading",
        "low-confidence",
    }


def test_every_service_turn_is_valid_in_a_consistent_set():
    parsed = _parse_synthetic()
    validate_set(parsed)
    assert all(turn.status is CheckStatus.VALID for turn in parsed.service_turns)


# ---------------------------------------------------------------------------
# Incongruenza di punteggio iniettata (backend §25.5-§25.7)
# ---------------------------------------------------------------------------


def test_injected_score_jump_of_two_points_is_detected():
    """Il turno 6 (servizio team-b, 8-7) finisce 10-9 invece di 9-9: team-a
    guadagnerebbe 2 punti in un solo rally. Non deve essere accettato in silenzio."""
    parsed = _parse_synthetic(synthetic.observations_with_score_jump())
    turn = parsed.service_turns[5]
    assert turn.sequence == synthetic.SCORE_JUMP_SEQUENCE
    assert turn.score_end.value == synthetic.SCORE_JUMP_SCORE_END

    result = validate_set(parsed)

    rally = _check(result, "rally-increments")
    assert rally.status is CheckStatus.INVALID
    assert service_turn_field_id(1, 6, "score-end") in rally.field_ids
    assert "2 punti in un solo rally" in rally.message
    # La rottura di continuità col turno successivo è segnalata a sua volta.
    continuity = _check(result, "score-continuity")
    assert continuity.status is CheckStatus.INVALID
    assert service_turn_field_id(1, 7, "score-start") in continuity.field_ids
    # Stato complessivo e stato del singolo turno riflettono l'anomalia.
    assert result.status is CheckStatus.INVALID
    assert turn.status is CheckStatus.INVALID


def test_non_monotonic_score_is_detected():
    parsed = _parse_synthetic(synthetic.all_observations(score_end_overrides={4: (6, 6)}))
    result = validate_set(parsed)

    monotonic = _check(result, "score-monotonic")
    assert monotonic.status is CheckStatus.INVALID
    assert service_turn_field_id(1, 4, "score-end") in monotonic.field_ids
    assert result.status is CheckStatus.INVALID


def test_final_score_mismatch_is_detected():
    parsed = parse_set(
        synthetic.all_observations(),
        set_number=1,
        team_a_id=synthetic.TEAM_A_ID,
        team_b_id=synthetic.TEAM_B_ID,
        reported_final_score=(25, 22),
    )
    result = validate_set(parsed)

    check = _check(result, "final-score")
    assert check.status is CheckStatus.INVALID
    assert check.field_ids == [service_turn_field_id(1, 13, "score-end")]


def test_points_scored_must_stay_consistent_with_the_score():
    """Se qualcuno tocca il punteggio senza ricalcolare il derivato, si vede."""
    parsed = _parse_synthetic()
    parsed.service_turns[0].score_end.value = (4, 1)  # points_scored resta 2

    result = validate_set(parsed)
    check = _check(result, "points-scored-derived")
    assert check.status is CheckStatus.INVALID
    assert service_turn_field_id(1, 1, "score-end") in check.field_ids


# ---------------------------------------------------------------------------
# Rotazione e battitori (backend §25.2-§25.4, §25.8)
# ---------------------------------------------------------------------------


def test_rotation_out_of_cycle_is_detected():
    parsed = _parse_synthetic(synthetic.all_observations(rotation_overrides={5: "V"}))
    result = validate_set(parsed)

    check = _check(result, "rotation-order")
    assert check.status is CheckStatus.INVALID
    assert service_turn_field_id(1, 5, "rotation") in check.field_ids
    assert result.status is CheckStatus.INVALID


def test_service_turns_must_alternate_between_teams():
    parsed = _parse_synthetic()
    # Due turni consecutivi della stessa squadra: chi mantiene il servizio
    # resterebbe nello stesso turno, quindi la sequenza è impossibile.
    parsed.service_turns[1].team_id = synthetic.TEAM_A_ID

    result = validate_set(parsed)
    check = _check(result, "service-alternation")
    assert check.status is CheckStatus.INVALID
    assert "set1-turn-002" in check.field_ids


def test_server_outside_the_starting_six_is_flagged():
    """Battitore incompatibile col sestetto: la lettura viene conservata (nessuna
    correzione silenziosa) ma il check segnala il campo."""
    parsed = _parse_synthetic(synthetic.all_observations(player_overrides={3: "21"}))
    turn = parsed.service_turns[2]
    assert turn.player.value == 21

    result = validate_set(parsed)
    check = _check(result, "server-eligibility")
    assert check.status is CheckStatus.WARNING
    assert service_turn_field_id(1, 3, "player") in check.field_ids

    # Con l'elenco dei sostituti disponibili, un numero estraneo diventa INVALID.
    strict = validate_set(parsed, available_substitutes={synthetic.TEAM_A_ID: {11, 12}})
    assert _check(strict, "server-eligibility").status is CheckStatus.INVALID


def test_low_confidence_values_are_listed_for_review():
    parsed = _parse_synthetic(synthetic.all_observations(player_confidences={2: 0.31}))
    result = validate_set(parsed)

    check = _check(result, "low-confidence")
    assert check.status is CheckStatus.WARNING
    assert service_turn_field_id(1, 2, "player") in check.field_ids


def test_unresolved_ambiguity_on_a_turn_keeps_the_set_in_warning():
    """Due letture del punteggio finale del turno entrambe compatibili con i
    vincoli: l'ambiguità resta aperta e lo stato non può essere VALID."""
    observations = synthetic.all_observations()
    target = service_turn_field_id(1, 1, "score-end")
    for observation in observations:
        if observation.id.endswith("turn-001-score-end"):
            observation.candidates = [
                ObservationCandidate(value="2-1", confidence=0.55),
                ObservationCandidate(value="3-1", confidence=0.50),
            ]
    parsed = _parse_synthetic(observations)
    result = validate_set(parsed)

    assert parsed.service_turns[0].score_end.value == (2, 1)
    assert unresolved_ambiguity_field_ids(parsed) == [target]
    ambiguity = _check(result, "ambiguous-reading")
    assert ambiguity.status is CheckStatus.WARNING
    assert target in ambiguity.field_ids
    assert result.status is CheckStatus.WARNING


def test_validation_result_serializes_with_field_ids():
    result = validate_set(_parse_cerea())
    payload = result.model_dump()

    assert payload["status"] == "WARNING"
    ambiguity = next(check for check in payload["checks"] if check["id"] == "ambiguous-reading")
    assert ambiguity["field_ids"] == [CEREA_POSITION_III]
    assert ambiguity["status"] == "WARNING"


@pytest.mark.parametrize(
    ("statuses", "expected"),
    [
        ([CheckStatus.VALID, CheckStatus.VALID], CheckStatus.VALID),
        ([CheckStatus.VALID, CheckStatus.WARNING], CheckStatus.WARNING),
        ([CheckStatus.WARNING, CheckStatus.INVALID], CheckStatus.INVALID),
    ],
)
def test_status_aggregation_takes_the_worst(statuses, expected):
    from app.volleyball.parser import worst_status

    assert worst_status(statuses) is expected
