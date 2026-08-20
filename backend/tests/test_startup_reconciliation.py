"""Test della riconciliazione all'avvio delle analisi non terminate.

I task di estrazione girano in-process (FastAPI BackgroundTasks): se il processo
muore mentre elabora (tipicamente un OOM su un referto scansionato pesante) lo
stato resta congelato su UPLOADED/PROCESSING e il polling del frontend non
finirebbe mai. All'avvio nessun task del processo precedente è più vivo, quindi
`AnalysisService.fail_unfinished_analyses` chiude ogni analisi non terminale come
FAILED con un `ErrorDetail` esplicito.
"""

from __future__ import annotations

import pytest

from app.models.analysis import AnalysisGlobalStatus
from app.models.common import ErrorCode
from app.repositories.analysis_repository import (
    SqliteAnalysisRepository,
    create_engine_from_url,
    create_session_factory,
    create_tables,
)
from app.services.analysis_service import AnalysisService, _skeleton_analysis


@pytest.fixture()
def env(tmp_path):
    engine = create_engine_from_url(f"sqlite:///{tmp_path / 'test.db'}")
    create_tables(engine)
    repository = SqliteAnalysisRepository(create_session_factory(engine))
    service = AnalysisService(repository, tmp_path / "storage")
    return repository, service


def _seed(repository, analysis_id: str, status: str) -> None:
    repository.create(
        analysis_id=analysis_id,
        original_filename="referto.pdf",
        pdf_path=f"{analysis_id}.pdf",
        initial_analysis_json=_skeleton_analysis(analysis_id),
    )
    if status == AnalysisGlobalStatus.PROCESSING.value:
        repository.update_progress(
            analysis_id,
            status=status,
            progress=40,
            current_step="READ_DOCUMENT",
            steps=[],
        )
    elif status == AnalysisGlobalStatus.READY.value:
        repository.save_result(analysis_id, status=status, analysis_json={"id": analysis_id})
    # UPLOADED: lasciato com'è dopo create()


def test_reconciliation_fails_only_unfinished_analyses(env):
    repository, service = env
    _seed(repository, "processing", AnalysisGlobalStatus.PROCESSING.value)
    _seed(repository, "uploaded", AnalysisGlobalStatus.UPLOADED.value)
    _seed(repository, "ready", AnalysisGlobalStatus.READY.value)

    closed = service.fail_unfinished_analyses()

    assert closed == 2

    processing = repository.get("processing")
    uploaded = repository.get("uploaded")
    ready = repository.get("ready")

    assert processing.status == AnalysisGlobalStatus.FAILED.value
    assert processing.current_step is None
    assert processing.error["code"] == ErrorCode.ANALYSIS_FAILED.value
    assert uploaded.status == AnalysisGlobalStatus.FAILED.value
    assert uploaded.error["code"] == ErrorCode.ANALYSIS_FAILED.value
    # Un'analisi già terminale non viene toccata.
    assert ready.status == AnalysisGlobalStatus.READY.value
    assert ready.error is None


def test_reconciliation_is_noop_when_nothing_unfinished(env):
    repository, service = env
    _seed(repository, "ready", AnalysisGlobalStatus.READY.value)

    assert service.fail_unfinished_analyses() == 0
    assert repository.get("ready").status == AnalysisGlobalStatus.READY.value


def test_status_response_exposes_failed_error(env):
    """Dopo la riconciliazione, GET .../status deve poter serializzare l'errore:
    il dict scritto nel record deve combaciare con lo schema `ErrorDetail`."""

    repository, service = env
    _seed(repository, "processing", AnalysisGlobalStatus.PROCESSING.value)
    service.fail_unfinished_analyses()

    status = service.get_status("processing")

    assert status.status == AnalysisGlobalStatus.FAILED
    assert status.error is not None
    assert status.error.code == ErrorCode.ANALYSIS_FAILED
    assert status.error.message
