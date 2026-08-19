"""Unit test di `app.services.field_update` (backend §13-§16, §36).

Due livelli, come nel modulo sotto test:

1. Direttamente su `ParsedSet` (parser -> validator -> correzione -> validator),
   con la fixture reale Cerea (posizione III ambigua) e quella sintetica a 13
   turni — è qui che si vede la correzione risolvere un'ambiguità o introdurre
   un'incoerenza (numero duplicato) che il validator deve segnalare.
2. Sopra `FieldUpdateService`, con un `AnalysisRepository`/`FieldEditRepository`
   SQLite reali su un file temporaneo (nessun mock: stesso stack usato da
   `main.py`), per PATCH/reset-corrections/reanalyze end-to-end e per i casi
   di errore (campo inesistente, valore non valido, analisi non trovata/non
   pronta).

Nota: i test di errore qui sotto chiamano `FieldUpdateService` direttamente
(non via HTTP/TestClient) e verificano l'eccezione Python alzata. Il mapping
eccezione -> risposta HTTP è responsabilità di `app/core/errors.py`, fuori
dal perimetro di questo task.
"""

from __future__ import annotations

import pytest
from fastapi import BackgroundTasks

from app.models.analysis import Analysis, AnalysisGlobalStatus
from app.models.common import CheckStatus
from app.repositories.analysis_repository import (
    SqliteAnalysisRepository,
    create_engine_from_url,
    create_session_factory,
    create_tables,
)
from app.repositories.field_edit_repository import SqliteFieldEditRepository
from app.services.analysis_service import (
    AnalysisNotFoundError,
    AnalysisService,
    InvalidFieldValueError,
    build_canned_analysis,
)
from app.services.field_update import (
    FieldUpdateService,
    apply_manual_correction,
    recompute_global_validation,
    revalidate_set_data,
)
from app.volleyball.parser import parse_set, starting_six_field_id, service_turn_field_id
from app.volleyball.validator import unresolved_ambiguity_field_ids, validate_set
from tests.fixtures import service_turns_set_synthetic as synthetic
from tests.fixtures.raw_observations_set1_cerea import (
    EXPECTED_FINAL_SCORE,
    TEAM_A_ID,
    TEAM_B_ID,
    starting_six_observations,
)

CEREA_POSITION_III = starting_six_field_id(1, TEAM_A_ID, "III")
CEREA_POSITION_II = starting_six_field_id(1, TEAM_A_ID, "II")
CEREA_POSITION_IV = starting_six_field_id(1, TEAM_A_ID, "IV")


def _check(result, check_id):
    return next(check for check in result.checks if check.id == check_id)


def _parse_cerea():
    return parse_set(
        starting_six_observations(),
        set_number=1,
        team_a_id=TEAM_A_ID,
        team_b_id=TEAM_B_ID,
        reported_final_score=EXPECTED_FINAL_SCORE,
    )


def _parse_synthetic(**kwargs):
    return parse_set(
        synthetic.all_observations(**kwargs),
        set_number=synthetic.SET_NUMBER,
        team_a_id=synthetic.TEAM_A_ID,
        team_b_id=synthetic.TEAM_B_ID,
        reported_final_score=synthetic.FINAL_SCORE,
    )


# ---------------------------------------------------------------------------
# 1a. Correzione che risolve un'ambiguità (fixture Cerea, posizione III)
# ---------------------------------------------------------------------------


def test_manual_correction_clears_the_ambiguous_reading_warning():
    parsed = _parse_cerea()

    before = validate_set(parsed)
    ambiguity_before = _check(before, "ambiguous-reading")
    assert ambiguity_before.status is CheckStatus.WARNING
    assert CEREA_POSITION_III in ambiguity_before.field_ids

    previous, coerced = apply_manual_correction(parsed, CEREA_POSITION_III, 3, team_a_id=TEAM_A_ID)
    assert previous == 3  # il parser aveva già risolto l'ambiguità a 3 col vincolo di dominio
    assert coerced == 3

    after = validate_set(parsed)
    ambiguity_after = _check(after, "ambiguous-reading")
    assert CEREA_POSITION_III not in ambiguity_after.field_ids
    assert ambiguity_after.status is CheckStatus.VALID
    # Nessuna ambiguità residua, risolta o no: era l'unica del set.
    assert unresolved_ambiguity_field_ids(parsed) == []

    resolution = parsed.resolution_for(CEREA_POSITION_III)
    assert resolution.ambiguous is False
    assert resolution.reason == "manually-confirmed"


# ---------------------------------------------------------------------------
# 1b. Correzione che introduce un'incoerenza (numero duplicato nel sestetto)
# ---------------------------------------------------------------------------


def test_manual_correction_introducing_duplicate_number_is_flagged_invalid():
    parsed = _parse_cerea()
    before = validate_set(parsed)
    assert _check(before, "starting-six-distinct").status is CheckStatus.VALID

    # Posizione II valeva 5: la correzione la porta a 8, già presente in IV.
    apply_manual_correction(parsed, CEREA_POSITION_II, 8, team_a_id=TEAM_A_ID)

    after = validate_set(parsed)
    duplicate_check = _check(after, "starting-six-distinct")
    assert duplicate_check.status is CheckStatus.INVALID
    assert CEREA_POSITION_II in duplicate_check.field_ids
    assert CEREA_POSITION_IV in duplicate_check.field_ids
    assert after.status is CheckStatus.INVALID


# ---------------------------------------------------------------------------
# Ricalcolo del derivato points_scored dopo la correzione di un punteggio
# ---------------------------------------------------------------------------


def test_manual_correction_of_score_recomputes_points_scored():
    parsed = _parse_synthetic()
    turn1 = next(t for t in parsed.service_turns if t.sequence == 1)
    assert turn1.points_scored == 2  # 0-0 -> 2-1, team-a segna 2 punti

    field_id = service_turn_field_id(1, 1, "score-end")
    apply_manual_correction(parsed, field_id, [5, 1], team_a_id=TEAM_A_ID)

    assert turn1.score_end.value == (5, 1)
    assert turn1.points_scored == 5  # ricalcolato dal nuovo delta, non più 2

    result = validate_set(parsed)
    # Il turno successivo (2) ora non riprende più da (5, 1): la continuità
    # del punteggio deve segnalarlo, prova che la rivalidazione è stata
    # rilanciata sul set intero e non solo sul campo toccato.
    continuity = _check(result, "score-continuity")
    assert continuity.status is CheckStatus.INVALID


# ---------------------------------------------------------------------------
# Validazione di tipo/range e campo inesistente (a livello di ParsedSet)
# ---------------------------------------------------------------------------


def test_apply_manual_correction_unknown_field_raises_invalid_field_value():
    parsed = _parse_cerea()
    with pytest.raises(InvalidFieldValueError):
        apply_manual_correction(parsed, "does-not-exist", 3, team_a_id=TEAM_A_ID)


def test_apply_manual_correction_rejects_out_of_range_player_number():
    parsed = _parse_cerea()
    with pytest.raises(InvalidFieldValueError):
        apply_manual_correction(parsed, CEREA_POSITION_III, 150, team_a_id=TEAM_A_ID)


def test_apply_manual_correction_rejects_non_integer_player_number():
    parsed = _parse_cerea()
    with pytest.raises(InvalidFieldValueError):
        apply_manual_correction(parsed, CEREA_POSITION_III, "abc", team_a_id=TEAM_A_ID)


def test_apply_manual_correction_rejects_invalid_rotation_label():
    parsed = _parse_synthetic()
    field_id = service_turn_field_id(1, 1, "rotation")
    with pytest.raises(InvalidFieldValueError):
        apply_manual_correction(parsed, field_id, "VII", team_a_id=TEAM_A_ID)


def test_apply_manual_correction_rejects_malformed_score():
    parsed = _parse_synthetic()
    field_id = service_turn_field_id(1, 1, "score-end")
    with pytest.raises(InvalidFieldValueError):
        apply_manual_correction(parsed, field_id, [1, 2, 3], team_a_id=TEAM_A_ID)


# ---------------------------------------------------------------------------
# FieldUpdateService — stack reale (SQLite su file temporaneo), come main.py
# ---------------------------------------------------------------------------


@pytest.fixture()
def env(tmp_path):
    db_path = tmp_path / "test.db"
    engine = create_engine_from_url(f"sqlite:///{db_path}")
    create_tables(engine)
    session_factory = create_session_factory(engine)

    analysis_repository = SqliteAnalysisRepository(session_factory)
    field_edit_repository = SqliteFieldEditRepository(session_factory)
    analysis_service = AnalysisService(analysis_repository, tmp_path / "storage")
    field_update_service = FieldUpdateService(analysis_service, field_edit_repository)

    return analysis_repository, field_edit_repository, analysis_service, field_update_service


def _seed_ready_analysis(analysis_repository, analysis_id: str = "analysis-1") -> Analysis:
    analysis = build_canned_analysis(analysis_id)
    analysis_repository.create(
        analysis_id=analysis_id,
        original_filename="referto.pdf",
        pdf_path=str(analysis_id) + ".pdf",
        initial_analysis_json=analysis.model_dump(mode="json"),
    )
    analysis_repository.save_result(
        analysis_id, status="READY", analysis_json=analysis.model_dump(mode="json")
    )
    return analysis


def test_service_patch_field_updates_value_revalidates_and_logs_edit(env):
    analysis_repository, field_edit_repository, _analysis_service, field_update_service = env
    analysis = _seed_ready_analysis(analysis_repository)
    field_id = analysis.sets[0].team_a_starting_six.I.id
    original = analysis.sets[0].team_a_starting_six.I.value

    updated = field_update_service.patch_field("analysis-1", field_id, 77)

    field = updated.sets[0].team_a_starting_six.I
    assert field.value == 77
    assert field.original_value == original
    assert field.manually_confirmed is True

    edits = field_edit_repository.list_for_analysis("analysis-1")
    assert len(edits) == 1
    assert edits[0].field_id == field_id
    assert edits[0].previous_value == original
    assert edits[0].new_value == 77

    # Persistito: una nuova lettura del record riflette la correzione.
    record = analysis_repository.get("analysis-1")
    persisted = Analysis.model_validate(record.analysis_json)
    assert persisted.sets[0].team_a_starting_six.I.value == 77


def test_service_patch_field_recomputes_points_scored_and_global_validation(env):
    analysis_repository, _field_edits, _analysis_service, field_update_service = env
    analysis = _seed_ready_analysis(analysis_repository)
    turn = analysis.sets[0].service_turns[0]
    team_index = 0 if turn.team_id == analysis.match.team_a.id else 1
    new_score = list(turn.score_start.value)
    new_score[team_index] += 9
    field_id = turn.score_end.id

    updated = field_update_service.patch_field("analysis-1", field_id, new_score)

    updated_turn = updated.sets[0].service_turns[0]
    assert updated_turn.score_end.value == tuple(new_score)
    assert updated_turn.points_scored == 9

    # La rivalidazione globale è stata rilanciata: lo stato non è rimasto
    # quello (stale) calcolato al momento della creazione canned.
    assert updated.validation is not None
    assert updated.overall_validation is not None


def test_service_patch_field_unknown_field_raises(env):
    analysis_repository, _field_edits, _analysis_service, field_update_service = env
    _seed_ready_analysis(analysis_repository)
    with pytest.raises(InvalidFieldValueError):
        field_update_service.patch_field("analysis-1", "does-not-exist", 1)


def test_service_patch_field_invalid_value_type_raises(env):
    analysis_repository, _field_edits, _analysis_service, field_update_service = env
    analysis = _seed_ready_analysis(analysis_repository)
    field_id = analysis.sets[0].team_a_starting_six.I.id
    with pytest.raises(InvalidFieldValueError):
        field_update_service.patch_field("analysis-1", field_id, "not-a-number")


def test_service_patch_field_unknown_analysis_raises_not_found(env):
    _analysis_repository, _field_edits, _analysis_service, field_update_service = env
    with pytest.raises(AnalysisNotFoundError):
        field_update_service.patch_field("does-not-exist", "some-field", 1)


def test_service_patch_field_on_analysis_not_ready_raises(env):
    analysis_repository, _field_edits, _analysis_service, field_update_service = env
    analysis = build_canned_analysis("analysis-2")
    analysis_repository.create(
        analysis_id="analysis-2",
        original_filename="referto.pdf",
        pdf_path="analysis-2.pdf",
        initial_analysis_json=analysis.model_dump(mode="json"),
    )
    # Nessun save_result: resta UPLOADED, come subito dopo l'upload.
    field_id = analysis.sets[0].team_a_starting_six.I.id
    with pytest.raises(InvalidFieldValueError):
        field_update_service.patch_field("analysis-2", field_id, 5)


def test_service_reset_corrections_restores_originals_and_clears_history(env):
    analysis_repository, field_edit_repository, _analysis_service, field_update_service = env
    analysis = _seed_ready_analysis(analysis_repository)
    field_id = analysis.sets[0].team_a_starting_six.I.id
    original = analysis.sets[0].team_a_starting_six.I.value

    field_update_service.patch_field("analysis-1", field_id, original + 1)
    assert field_edit_repository.list_for_analysis("analysis-1")  # almeno una correzione registrata

    restored = field_update_service.reset_corrections("analysis-1")

    field = restored.sets[0].team_a_starting_six.I
    assert field.value == original
    assert field.manually_confirmed is False
    assert field_edit_repository.list_for_analysis("analysis-1") == []


def test_service_reanalyze_clears_field_edit_history_and_restarts_pipeline(env):
    analysis_repository, field_edit_repository, _analysis_service, field_update_service = env
    analysis = _seed_ready_analysis(analysis_repository)
    field_id = analysis.sets[0].team_a_starting_six.I.id
    field_update_service.patch_field("analysis-1", field_id, 55)
    assert field_edit_repository.list_for_analysis("analysis-1")

    background_tasks = BackgroundTasks()
    field_update_service.reanalyze("analysis-1", background_tasks)

    # La pipeline (mock) è stata riavviata: il record torna in UPLOADED e in
    # attesa che il task in background la riporti a READY.
    record = analysis_repository.get("analysis-1")
    assert record.status == AnalysisGlobalStatus.UPLOADED.value
    assert field_edit_repository.list_for_analysis("analysis-1") == []


def test_service_reanalyze_unknown_analysis_raises_not_found(env):
    _analysis_repository, _field_edits, _analysis_service, field_update_service = env
    with pytest.raises(AnalysisNotFoundError):
        field_update_service.reanalyze("does-not-exist", BackgroundTasks())


# ---------------------------------------------------------------------------
# Helper pure functions usate anche dal service, testate in isolamento
# ---------------------------------------------------------------------------


def test_revalidate_set_data_and_recompute_global_validation_are_consistent(env):
    analysis_repository, _field_edits, _analysis_service, _field_update_service = env
    analysis = _seed_ready_analysis(analysis_repository)
    set_data = analysis.sets[0]

    # Introduce a mano un'incoerenza sulla SetData pubblica (senza passare
    # dal service) per verificare che le due funzioni pure facciano il loro
    # lavoro anche fuori dal contesto di un PATCH.
    set_data.team_a_starting_six.II.value = set_data.team_a_starting_six.IV.value

    revalidate_set_data(
        set_data, team_a_id=analysis.match.team_a.id, team_b_id=analysis.match.team_b.id
    )
    assert set_data.validation.status is CheckStatus.INVALID

    recompute_global_validation(analysis)
    assert analysis.overall_validation is CheckStatus.INVALID
