"""Progressi pubblicati durante il lavoro reale dell'estrazione.

Questi test non dipendono da Tesseract: verificano il contratto che trasforma
milestone/celle OCR in ``GET /status`` e il callback emesso dalla fase di probe
del layout, che sul referto raster è la parte più costosa.
"""

from __future__ import annotations

from types import SimpleNamespace

from app.domain.raw_observation import ExpectedType
from app.extraction.raster.pipeline import _collect_cells
from app.layout.detector import RegionKind
from app.repositories.analysis_repository import (
    SqliteAnalysisRepository,
    create_engine_from_url,
    create_session_factory,
    create_tables,
)
from app.services.analysis_service import AnalysisService, _skeleton_analysis


def _service(tmp_path) -> tuple[SqliteAnalysisRepository, AnalysisService]:
    engine = create_engine_from_url(f"sqlite:///{tmp_path / 'progress.db'}")
    create_tables(engine)
    repository = SqliteAnalysisRepository(create_session_factory(engine))
    repository.create(
        analysis_id="progress-test",
        original_filename="referto.pdf",
        pdf_path="/tmp/referto.pdf",
        initial_analysis_json=_skeleton_analysis("progress-test"),
    )
    return repository, AnalysisService(repository, tmp_path / "storage")


def test_real_milestones_are_monotonic_and_mark_completed_steps(tmp_path) -> None:
    repository, service = _service(tmp_path)
    analysis_id = "progress-test"

    service._publish_pipeline_progress(analysis_id, "inspect_document", None, None)
    service._publish_pipeline_progress(analysis_id, "page_rendered", 1, 1)
    service._publish_pipeline_progress(analysis_id, "detect_layout", None, None)
    service._publish_pipeline_progress(analysis_id, "layout_detected", 1, 1)
    service._publish_pipeline_progress(analysis_id, "collect_cells", None, None)
    service._publish_pipeline_progress(analysis_id, "probe_cell", 20, None)
    probing = repository.get(analysis_id)
    assert probing is not None
    assert probing.progress == 34
    assert probing.current_step == "EXTRACT_STARTING_SIX"
    assert [step["status"] for step in probing.steps] == [
        "COMPLETED",
        "COMPLETED",
        "PROCESSING",
        "PENDING",
        "PENDING",
    ]

    service._publish_pipeline_progress(analysis_id, "cells_collected", 10, 10)
    service._publish_pipeline_progress(analysis_id, "read_cell", 5, 10)
    halfway = repository.get(analysis_id)
    assert halfway is not None
    assert halfway.progress == 68

    # An out-of-order callback cannot make a polling client observe regress.
    service._publish_pipeline_progress(analysis_id, "page_rendered", 1, 1)
    assert repository.get(analysis_id).progress == 68

    service._publish_pipeline_progress(analysis_id, "raster_complete", None, None)
    raster_done = repository.get(analysis_id)
    assert raster_done is not None
    assert raster_done.progress == 85
    assert raster_done.current_step == "EXTRACT_SERVICE_TURNS"
    assert [step["status"] for step in raster_done.steps[:3]] == [
        "COMPLETED",
        "COMPLETED",
        "COMPLETED",
    ]


def test_formation_probes_emit_one_callback_per_real_ocr_read() -> None:
    events: list[tuple[str, int | None, int | None]] = []

    class Detector:
        def starting_six_cells(self, _page, _region, *, validator, cell_reader):
            assert validator("12")
            cell_reader(object())
            cell_reader(object())
            cell_reader(object())
            return []

        def team_name_cells(self, _page, _region):
            return []

    class Ocr:
        def read(self, _image, expected_type):
            assert expected_type is ExpectedType.PLAYER_NUMBER
            return SimpleNamespace(text="12", confidence=0.99)

    layout = SimpleNamespace(
        regions=[SimpleNamespace(kind=RegionKind.SET_BOX)]
    )
    cells = _collect_cells(
        Detector(),
        object(),
        layout,
        Ocr(),
        progress_callback=lambda stage, completed, total: events.append(
            (stage, completed, total)
        ),
    )

    assert cells == []
    assert events == [
        ("probe_cell", 1, None),
        ("probe_cell", 2, None),
        ("probe_cell", 3, None),
    ]
