"""Unit test del Volleyball Parser (backend §24, §26, §36).

Girano sulla fixture sintetica del Set 1 Cerea–Rothoblaas (valori attesi presi
dal referto reale, backend §28) e su una fixture sintetica di set completo con
13 turni di servizio.
"""

from __future__ import annotations

import pytest

from app.domain.raw_observation import ExpectedType, ObservationCandidate, RawObservation
from app.models.common import CheckStatus, ExtractionMethod
from app.models.match import RotationLabel
from app.volleyball import constraints as C
from app.volleyball.parser import (
    REASON_AMBIGUITY_UNRESOLVED,
    REASON_DOMAIN_CONSTRAINT,
    REASON_NO_FEASIBLE_CANDIDATE,
    parse_set,
    parse_starting_six,
    recompute_points_scored,
    service_turn_field_id,
    starting_six_field_id,
)
from tests.fixtures import service_turns_set_synthetic as synthetic
from tests.fixtures.raw_observations_set1_cerea import (
    EXPECTED_FINAL_SCORE,
    EXPECTED_TEAM_A_STARTING_SIX,
    EXPECTED_TEAM_B_STARTING_SIX,
    TEAM_A_ID,
    TEAM_B_ID,
    starting_six_observations,
)

CEREA_POSITION_III = starting_six_field_id(1, TEAM_A_ID, "III")


@pytest.fixture
def cerea_set():
    return parse_set(
        starting_six_observations(),
        set_number=1,
        team_a_id=TEAM_A_ID,
        team_b_id=TEAM_B_ID,
        reported_final_score=EXPECTED_FINAL_SCORE,
    )


def _numbers(six) -> dict[str, int | None]:
    return C.starting_six_numbers(six)


# ---------------------------------------------------------------------------
# Sestetti iniziali — valori attesi del referto reale (backend §28)
# ---------------------------------------------------------------------------


def test_starting_sixes_match_expected_values(cerea_set):
    assert _numbers(cerea_set.team_a_starting_six) == {
        position: int(value) for position, value in EXPECTED_TEAM_A_STARTING_SIX.items()
    }
    assert _numbers(cerea_set.team_b_starting_six) == {
        position: int(value) for position, value in EXPECTED_TEAM_B_STARTING_SIX.items()
    }


def test_starting_six_values_carry_provenance(cerea_set):
    position_iv = cerea_set.team_a_starting_six.IV
    assert position_iv.id == starting_six_field_id(1, TEAM_A_ID, "IV")
    assert position_iv.value == 8
    assert position_iv.original_value == 8
    assert position_iv.manually_confirmed is False
    assert position_iv.source_region_id == f"region-set1-{TEAM_A_ID}-IV"


# ---------------------------------------------------------------------------
# Risoluzione dell'ambiguità (backend §26) — Cerea posizione III
# ---------------------------------------------------------------------------


def test_ambiguous_position_iii_resolved_to_three_by_domain_constraint(cerea_set):
    """La posizione III di Cerea ha due candidati OCR a confidence comparabile
    ("3" @0.55 vs "8" @0.52). "8" è impossibile perché la posizione IV dello
    STESSO sestetto è già 8, e un giocatore non può occupare due posizioni:
    il vincolo `unique-jersey-in-starting-six` elimina "8" e resta solo "3"."""
    assert cerea_set.team_a_starting_six.III.value == 3
    assert cerea_set.team_a_starting_six.IV.value == 8

    resolution = cerea_set.resolution_for(CEREA_POSITION_III)
    assert resolution is not None
    assert resolution.selected_value == "3"
    assert resolution.ambiguous is True
    assert resolution.resolved_by_constraint is True
    assert resolution.reason == REASON_DOMAIN_CONSTRAINT
    assert resolution.constraint == C.Constraint.UNIQUE_JERSEY_IN_STARTING_SIX.value
    # Il candidato scartato è conservato insieme al motivo dello scarto.
    assert [(r.value, r.reason) for r in resolution.rejected] == [
        ("8", C.Constraint.UNIQUE_JERSEY_IN_STARTING_SIX.value)
    ]
    # L'ambiguità era reale: la risoluzione resta WARNING anche se risolta.
    assert resolution.status is CheckStatus.WARNING
    # Confidence finale documentata: 0.55 − 0.15 (ambiguità) + 0.20 (vincolo).
    assert resolution.selected_confidence == pytest.approx(0.60)
    assert cerea_set.team_a_starting_six.III.confidence == pytest.approx(0.60)


def test_position_iii_resolved_by_constraint_not_by_confidence():
    """Prova che a decidere è il vincolo, non la fortuna: invertendo le
    confidence (il candidato SBAGLIATO "8" diventa il più probabile), il parser
    deve continuare a scegliere "3" perché "8" resta impossibile."""
    observations = [
        RawObservation(
            id=f"obs-set1-{TEAM_A_ID}-{position}",
            region_id=f"region-set1-{TEAM_A_ID}-{position}",
            expected_type=ExpectedType.PLAYER_NUMBER,
            method=ExtractionMethod.OCR,
            candidates=(
                [
                    ObservationCandidate(value="8", confidence=0.58),
                    ObservationCandidate(value="3", confidence=0.52),
                ]
                if position == "III"
                else [ObservationCandidate(value=value, confidence=0.97)]
            ),
        )
        for position, value in EXPECTED_TEAM_A_STARTING_SIX.items()
    ]

    six, resolutions = parse_starting_six(observations, team_id=TEAM_A_ID, set_number=1)

    assert six.III.value == 3
    resolution = next(r for r in resolutions if r.field_id == CEREA_POSITION_III)
    assert resolution.selected_value == "3"
    assert resolution.resolved_by_constraint is True
    assert resolution.constraint == C.Constraint.UNIQUE_JERSEY_IN_STARTING_SIX.value
    assert [(r.value, r.reason) for r in resolution.rejected] == [
        ("8", C.Constraint.UNIQUE_JERSEY_IN_STARTING_SIX.value)
    ]


def test_unresolved_ambiguity_keeps_best_candidate_and_stays_warning():
    """Se i vincoli non discriminano (nessuno dei due numeri è già usato),
    l'ambiguità resta aperta: si tiene il candidato migliore ma la risoluzione
    è WARNING, non VALID (backend §26)."""
    observations = [
        RawObservation(
            id=f"obs-set1-{TEAM_A_ID}-{position}",
            region_id=f"region-set1-{TEAM_A_ID}-{position}",
            expected_type=ExpectedType.PLAYER_NUMBER,
            method=ExtractionMethod.OCR,
            candidates=(
                [
                    ObservationCandidate(value="6", confidence=0.55),
                    ObservationCandidate(value="7", confidence=0.52),
                ]
                if position == "VI"
                else [ObservationCandidate(value=value, confidence=0.97)]
            ),
        )
        for position, value in EXPECTED_TEAM_A_STARTING_SIX.items()
    ]

    six, resolutions = parse_starting_six(observations, team_id=TEAM_A_ID, set_number=1)
    resolution = next(
        r for r in resolutions if r.field_id == starting_six_field_id(1, TEAM_A_ID, "VI")
    )

    assert six.VI.value == 6  # candidato a confidence più alta
    assert resolution.ambiguous is True
    assert resolution.resolved_by_constraint is False
    assert resolution.reason == REASON_AMBIGUITY_UNRESOLVED
    assert resolution.status is CheckStatus.WARNING
    assert [(r.value, r.reason) for r in resolution.rejected] == [("7", "lower-confidence")]


def test_incompatible_unambiguous_reading_is_never_silently_corrected():
    """Lettura univoca ma impossibile (III=8 con IV=8): il parser NON inventa un
    altro numero, conserva l'8 e segna la risoluzione come non fattibile."""
    values = dict(EXPECTED_TEAM_A_STARTING_SIX)
    values["III"] = "8"
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

    six, resolutions = parse_starting_six(observations, team_id=TEAM_A_ID, set_number=1)
    resolution = next(r for r in resolutions if r.field_id == CEREA_POSITION_III)

    assert six.III.value == 8
    assert resolution.reason == REASON_NO_FEASIBLE_CANDIDATE
    assert resolution.constraint == C.Constraint.UNIQUE_JERSEY_IN_STARTING_SIX.value
    assert resolution.status is CheckStatus.WARNING


# ---------------------------------------------------------------------------
# Turni di servizio
# ---------------------------------------------------------------------------


@pytest.fixture
def synthetic_set():
    return parse_set(
        synthetic.all_observations(),
        set_number=synthetic.SET_NUMBER,
        team_a_id=synthetic.TEAM_A_ID,
        team_b_id=synthetic.TEAM_B_ID,
        reported_final_score=synthetic.FINAL_SCORE,
    )


def test_serving_team_and_sequence_are_reconstructed(synthetic_set):
    assert synthetic_set.starting_team_id == synthetic.TEAM_A_ID
    assert [turn.sequence for turn in synthetic_set.service_turns] == list(range(1, 14))
    assert [turn.team_id for turn in synthetic_set.service_turns] == [
        turn[1] for turn in synthetic.TURNS
    ]
    # I turni si alternano sempre: chi mantiene il servizio resta nello stesso turno.
    teams = [turn.team_id for turn in synthetic_set.service_turns]
    assert all(current != following for current, following in zip(teams, teams[1:]))


def test_service_turn_ids_follow_the_frontend_navigation_scheme(synthetic_set):
    first = synthetic_set.service_turns[0]
    assert first.id == "set1-turn-001"
    assert first.player.id == service_turn_field_id(1, 1, "player")
    assert first.rotation.id == "set1-turn-001-rotation"
    assert first.score_start.id == "set1-turn-001-score-start"
    assert first.score_end.id == "set1-turn-001-score-end"


def test_points_scored_is_derived_from_the_score_difference(synthetic_set):
    assert [turn.points_scored for turn in synthetic_set.service_turns] == list(
        synthetic.EXPECTED_POINTS_SCORED
    )
    for turn in synthetic_set.service_turns:
        assert turn.points_scored == recompute_points_scored(turn, team_a_id=synthetic.TEAM_A_ID)


def test_points_scored_is_recomputed_after_a_manual_score_edit(synthetic_set):
    """`points_scored` non è ground truth OCR (backend §11): se il punteggio
    cambia, il derivato cambia con lui."""
    turn = synthetic_set.service_turns[0]
    assert turn.points_scored == 2

    turn.score_end.value = (5, 1)
    turn.points_scored = recompute_points_scored(turn, team_a_id=synthetic.TEAM_A_ID)

    assert turn.points_scored == 5


def test_rotation_labels_are_cyclic_per_team(synthetic_set):
    assert [turn.rotation.value.value for turn in synthetic_set.service_turns] == list(
        synthetic.EXPECTED_ROTATIONS
    )
    for team_id in (synthetic.TEAM_A_ID, synthetic.TEAM_B_ID):
        labels = [
            turn.rotation.value
            for turn in synthetic_set.service_turns
            if turn.team_id == team_id
        ]
        expected = [C.rotation_for_turn_index(index) for index in range(len(labels))]
        assert labels == expected
    assert synthetic_set.service_turns[-1].rotation.value is RotationLabel.I


def test_servers_follow_the_starting_six_rotation(synthetic_set):
    assert [turn.player.value for turn in synthetic_set.service_turns] == list(
        synthetic.EXPECTED_SERVERS
    )
    for turn in synthetic_set.service_turns:
        six = synthetic_set.starting_six_for(turn.team_id)
        assert turn.player.value == C.expected_server(six, turn.rotation.value)


def test_missing_rotation_observation_is_derived_from_the_cycle():
    observations = [
        observation
        for observation in synthetic.all_observations()
        if not observation.id.endswith("-rotation")
    ]
    parsed = parse_set(
        observations,
        set_number=1,
        team_a_id=synthetic.TEAM_A_ID,
        team_b_id=synthetic.TEAM_B_ID,
        reported_final_score=synthetic.FINAL_SCORE,
    )
    assert [turn.rotation.value.value for turn in parsed.service_turns] == list(
        synthetic.EXPECTED_ROTATIONS
    )
    # Valore derivato: nessuna confidence OCR e nessuna regione di origine.
    assert parsed.service_turns[0].rotation.confidence is None
    assert parsed.service_turns[0].rotation.source_region_id is None


def test_ambiguous_server_is_resolved_by_the_rotation_constraint():
    """Turno 7 (team-a, rotazione IV → atteso il numero 8): l'OCR propone "6"
    @0.56 e "8" @0.54. Il vincolo `server-matches-rotation` scarta "6"."""
    observations = synthetic.all_observations(
        player_alternatives={7: (("8", 0.54),)},
        player_confidences={7: 0.56},
        player_overrides={7: "6"},
    )
    parsed = parse_set(
        observations,
        set_number=1,
        team_a_id=synthetic.TEAM_A_ID,
        team_b_id=synthetic.TEAM_B_ID,
        reported_final_score=synthetic.FINAL_SCORE,
    )

    turn = parsed.service_turns[6]
    assert turn.sequence == 7
    assert turn.player.value == 8

    resolution = parsed.resolution_for(service_turn_field_id(1, 7, "player"))
    assert resolution.resolved_by_constraint is True
    assert resolution.constraint == C.Constraint.SERVER_MATCHES_ROTATION.value
    assert [(r.value, r.reason) for r in resolution.rejected] == [
        ("6", C.Constraint.SERVER_MATCHES_ROTATION.value)
    ]
    assert resolution.status is CheckStatus.WARNING
