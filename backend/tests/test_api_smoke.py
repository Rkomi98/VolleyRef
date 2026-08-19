"""Test di integrazione (smoke) del contratto vivente upload -> ... -> export.

Specifica di riferimento: 02_volleyref_backend_prompt.md §36 (integration
test: `POST PDF -> status -> READY -> GET analysis`) e §44 (il primo
traguardo è il contratto end-to-end con risultati mock, non il parsing
reale). Copre anche §28 (fixture reali) verificando che i valori del Set 1
della fixture "ISUZU CEREA VR vs ROTHOBLAAS VOLANO TN" combacino con quelli
canned prodotti da `app.services.analysis_service.build_canned_analysis`.
"""

from __future__ import annotations

import importlib
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

EXAMPLES_DIR = Path(__file__).resolve().parents[2] / "examples"
FIXTURE_PDF_TEXT_LAYER = (
    EXAMPLES_DIR
    / "2025#12#20#ISUZU CEREA VR#ROTHOBLAAS VOLANO TN#Serie B1F C#11_Cerea_b1fc_25.pdf"
)
FIXTURE_PDF_RASTER = (
    EXAMPLES_DIR
    / "2025#10#18#ROTHOBLAAS VOLANO TN#AZIMUT GIORGIONE TV#Serie B1F C#02_Volano_b1fc_25.pdf"
)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Client con DB SQLite e storage isolati in una directory temporanea."""

    db_path = tmp_path / "test.db"
    storage_dir = tmp_path / "storage"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("STORAGE_DIR", str(storage_dir))

    from app.core.config import get_settings

    get_settings.cache_clear()

    import main as main_module

    importlib.reload(main_module)  # ricrea l'app FastAPI con i nuovi settings

    with TestClient(main_module.app) as test_client:
        yield test_client

    get_settings.cache_clear()


def _upload(client: TestClient, pdf_path: Path) -> str:
    with pdf_path.open("rb") as fh:
        response = client.post(
            "/api/v1/analyses",
            files={"file": (pdf_path.name, fh, "application/pdf")},
        )
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["status"] in ("UPLOADED", "PROCESSING")
    assert body["analysis_id"]
    return body["analysis_id"]


def _poll_until_ready(client: TestClient, analysis_id: str, timeout: float = 10.0) -> dict:
    deadline = time.monotonic() + timeout
    last_body: dict = {}
    while time.monotonic() < deadline:
        response = client.get(f"/api/v1/analyses/{analysis_id}/status")
        assert response.status_code == 200, response.text
        last_body = response.json()
        if last_body["status"] == "READY":
            return last_body
        if last_body["status"] == "FAILED":
            pytest.fail(f"Pipeline failed: {last_body}")
        time.sleep(0.1)
    pytest.fail(f"Analysis {analysis_id} did not reach READY in {timeout}s: {last_body}")


def _field_id_set1_team_a_position_i(client: TestClient, analysis_id: str) -> str:
    """Id del campo dal risultato, non hardcodato.

    Gli id dei campi sono un dettaglio interno del contratto (li produce
    `app.volleyball.parser.starting_six_field_id`): un test che li scrive a mano
    verifica la convenzione di naming invece del comportamento, e si rompe
    ad ogni cambio di pipeline. Qui si legge l'id dall'analisi appena prodotta.
    """

    analysis = client.get(f"/api/v1/analyses/{analysis_id}").json()
    return analysis["sets"][0]["team_a_starting_six"]["I"]["id"]


def test_full_flow_text_layer_fixture_matches_known_values(client: TestClient) -> None:
    """Upload -> PROCESSING -> READY -> GET, con i valori reali del §28."""

    analysis_id = _upload(client, FIXTURE_PDF_TEXT_LAYER)

    status_body = _poll_until_ready(client, analysis_id)
    assert status_body["progress"] == 100
    assert status_body["current_step"] is None
    assert all(step["status"] == "COMPLETED" for step in status_body["steps"])

    response = client.get(f"/api/v1/analyses/{analysis_id}")
    assert response.status_code == 200, response.text
    analysis = response.json()

    assert analysis["status"] == "READY"
    assert analysis["match"]["team_a"]["name"] == "ISUZU CEREA VR"
    assert analysis["match"]["team_b"]["name"] == "ROTHOBLAAS VOLANO TN"
    assert len(analysis["sets"]) == 4

    set1 = analysis["sets"][0]
    assert set1["final_score"] == [25, 27]

    team_a_six = {k: set1["team_a_starting_six"][k]["value"] for k in "I II III IV V VI".split()}
    team_b_six = {k: set1["team_b_starting_six"][k]["value"] for k in "I II III IV V VI".split()}
    assert team_a_six == {"I": 2, "II": 5, "III": 3, "IV": 8, "V": 14, "VI": 9}
    assert team_b_six == {"I": 14, "II": 9, "III": 3, "IV": 4, "V": 15, "VI": 17}


def test_full_flow_raster_fixture_reaches_ready(client: TestClient) -> None:
    """Il PDF rasterizzato passa dallo stesso contratto (mock indipendente
    dal contenuto reale del file — il parsing vero è un task successivo)."""

    analysis_id = _upload(client, FIXTURE_PDF_RASTER)
    status_body = _poll_until_ready(client, analysis_id)
    assert status_body["status"] == "READY"

    response = client.get(f"/api/v1/analyses/{analysis_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "READY"


def test_patch_field_updates_value_and_preserves_original(client: TestClient) -> None:
    analysis_id = _upload(client, FIXTURE_PDF_TEXT_LAYER)
    _poll_until_ready(client, analysis_id)

    field_id = _field_id_set1_team_a_position_i(client, analysis_id)
    response = client.patch(
        f"/api/v1/analyses/{analysis_id}/fields/{field_id}", json={"value": 99}
    )
    assert response.status_code == 200, response.text
    analysis = response.json()
    field = analysis["sets"][0]["team_a_starting_six"]["I"]
    assert field["id"] == field_id
    assert field["value"] == 99
    assert field["original_value"] == 2
    assert field["manually_confirmed"] is True

    # GET riflette la correzione persistita.
    response = client.get(f"/api/v1/analyses/{analysis_id}")
    field = response.json()["sets"][0]["team_a_starting_six"]["I"]
    assert field["value"] == 99
    assert field["manually_confirmed"] is True


def test_reset_corrections_restores_original_value(client: TestClient) -> None:
    analysis_id = _upload(client, FIXTURE_PDF_TEXT_LAYER)
    _poll_until_ready(client, analysis_id)

    field_id = _field_id_set1_team_a_position_i(client, analysis_id)
    client.patch(f"/api/v1/analyses/{analysis_id}/fields/{field_id}", json={"value": 42})

    response = client.post(f"/api/v1/analyses/{analysis_id}/reset-corrections")
    assert response.status_code == 200, response.text
    field = response.json()["sets"][0]["team_a_starting_six"]["I"]
    assert field["value"] == 2
    assert field["original_value"] == 2
    assert field["manually_confirmed"] is False


def test_reanalyze_restarts_pipeline_and_clears_manual_edits(client: TestClient) -> None:
    analysis_id = _upload(client, FIXTURE_PDF_TEXT_LAYER)
    _poll_until_ready(client, analysis_id)

    field_id = _field_id_set1_team_a_position_i(client, analysis_id)
    client.patch(f"/api/v1/analyses/{analysis_id}/fields/{field_id}", json={"value": 42})

    response = client.post(f"/api/v1/analyses/{analysis_id}/reanalyze")
    assert response.status_code == 202

    _poll_until_ready(client, analysis_id)
    analysis = client.get(f"/api/v1/analyses/{analysis_id}").json()
    field = analysis["sets"][0]["team_a_starting_six"]["I"]
    assert field["value"] == 2
    assert field["manually_confirmed"] is False


def test_patch_unknown_field_returns_invalid_field_value_error(client: TestClient) -> None:
    analysis_id = _upload(client, FIXTURE_PDF_TEXT_LAYER)
    _poll_until_ready(client, analysis_id)

    response = client.patch(
        f"/api/v1/analyses/{analysis_id}/fields/does-not-exist", json={"value": 1}
    )
    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "INVALID_FIELD_VALUE"


def test_get_unknown_analysis_returns_404_with_error_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/analyses/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "ANALYSIS_NOT_FOUND"


def test_upload_non_pdf_file_returns_invalid_file_error(client: TestClient) -> None:
    response = client.post(
        "/api/v1/analyses",
        files={"file": ("not-a-pdf.txt", b"hello world", "text/plain")},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "INVALID_FILE"


def test_upload_fake_pdf_without_signature_returns_unsupported_pdf_error(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/analyses",
        files={"file": ("fake.pdf", b"this is not really a pdf", "application/pdf")},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "UNSUPPORTED_PDF"


def test_export_endpoints_return_expected_content_types(client: TestClient) -> None:
    analysis_id = _upload(client, FIXTURE_PDF_TEXT_LAYER)
    _poll_until_ready(client, analysis_id)

    xlsx_response = client.get(f"/api/v1/analyses/{analysis_id}/export.xlsx")
    assert xlsx_response.status_code == 200
    assert "spreadsheetml" in xlsx_response.headers["content-type"]
    assert xlsx_response.content[:2] == b"PK"  # xlsx è uno zip

    csv_response = client.get(
        f"/api/v1/analyses/{analysis_id}/export.csv", params={"dataset": "service-turns"}
    )
    assert csv_response.status_code == 200
    assert "text/csv" in csv_response.headers["content-type"]
    assert csv_response.text.startswith("Set,Sequence,Team,Player")

    six_response = client.get(
        f"/api/v1/analyses/{analysis_id}/export.csv", params={"dataset": "starting-six"}
    )
    assert six_response.status_code == 200
    assert six_response.text.startswith("Set,Team,I,II,III,IV,V,VI")


def test_export_csv_unknown_dataset_returns_export_failed_error(client: TestClient) -> None:
    analysis_id = _upload(client, FIXTURE_PDF_TEXT_LAYER)
    _poll_until_ready(client, analysis_id)

    response = client.get(
        f"/api/v1/analyses/{analysis_id}/export.csv", params={"dataset": "bogus"}
    )
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "EXPORT_FAILED"
