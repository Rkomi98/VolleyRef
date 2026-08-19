"""Test per app.core.errors (backend §34): la struttura di errore
`{error: {code, message, details}}` deve essere identica su qualunque
route e qualunque causa d'errore — errori di dominio applicativo, file
invalidi, campi sconosciuti, richieste malformate (422 di FastAPI/Pydantic)
ed export non supportati.
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


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    storage_dir = tmp_path / "storage"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("STORAGE_DIR", str(storage_dir))

    from app.core.config import get_settings

    get_settings.cache_clear()

    import main as main_module

    importlib.reload(main_module)

    with TestClient(main_module.app) as test_client:
        yield test_client

    get_settings.cache_clear()


def _assert_uniform_envelope(body: dict) -> dict:
    """Verifica la forma esatta richiesta: {"error": {"code", "message",
    "details"}} — nessun campo extra, nessun campo mancante."""

    assert set(body.keys()) == {"error"}
    error = body["error"]
    assert set(error.keys()) == {"code", "message", "details"}
    assert isinstance(error["code"], str) and error["code"]
    assert isinstance(error["message"], str) and error["message"]
    assert isinstance(error["details"], dict)
    return error


def _poll_until_ready(client: TestClient, analysis_id: str, timeout: float = 10.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status = client.get(f"/api/v1/analyses/{analysis_id}/status").json()
        if status["status"] == "READY":
            return
        if status["status"] == "FAILED":
            pytest.fail(f"Pipeline failed: {status}")
        time.sleep(0.1)
    pytest.fail(f"Analysis {analysis_id} did not reach READY in {timeout}s")


def test_analysis_not_found_has_uniform_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/analyses/does-not-exist")
    assert response.status_code == 404
    error = _assert_uniform_envelope(response.json())
    assert error["code"] == "ANALYSIS_NOT_FOUND"


def test_status_of_unknown_analysis_has_uniform_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/analyses/does-not-exist/status")
    assert response.status_code == 404
    error = _assert_uniform_envelope(response.json())
    assert error["code"] == "ANALYSIS_NOT_FOUND"


def test_invalid_file_upload_has_uniform_envelope(client: TestClient) -> None:
    response = client.post(
        "/api/v1/analyses",
        files={"file": ("not-a-pdf.txt", b"hello world", "text/plain")},
    )
    assert response.status_code == 400
    error = _assert_uniform_envelope(response.json())
    assert error["code"] == "INVALID_FILE"


def test_unsupported_pdf_upload_has_uniform_envelope(client: TestClient) -> None:
    response = client.post(
        "/api/v1/analyses",
        files={"file": ("fake.pdf", b"this is not really a pdf", "application/pdf")},
    )
    assert response.status_code == 400
    error = _assert_uniform_envelope(response.json())
    assert error["code"] == "UNSUPPORTED_PDF"


def test_patch_unknown_field_has_uniform_envelope(client: TestClient) -> None:
    with FIXTURE_PDF_TEXT_LAYER.open("rb") as fh:
        upload = client.post(
            "/api/v1/analyses",
            files={"file": (FIXTURE_PDF_TEXT_LAYER.name, fh, "application/pdf")},
        )
    analysis_id = upload.json()["analysis_id"]
    _poll_until_ready(client, analysis_id)

    response = client.patch(
        f"/api/v1/analyses/{analysis_id}/fields/does-not-exist", json={"value": 1}
    )
    assert response.status_code == 400
    error = _assert_uniform_envelope(response.json())
    assert error["code"] == "INVALID_FIELD_VALUE"


def test_malformed_request_body_has_uniform_envelope_not_default_fastapi_shape(
    client: TestClient,
) -> None:
    """PATCH senza il campo `value` richiesto: FastAPI/Pydantic alzano
    RequestValidationError. Senza l'handler centralizzato la risposta
    sarebbe `{"detail": [...]}` (il default di FastAPI) — con l'handler
    registrato in app.core.errors deve restare invece un'ErrorEnvelope."""

    response = client.patch(
        "/api/v1/analyses/some-id/fields/some-field", json={}
    )
    assert response.status_code == 422
    body = response.json()
    assert "detail" not in body
    error = _assert_uniform_envelope(body)
    assert "errors" in error["details"]


def test_export_unknown_dataset_has_uniform_envelope(client: TestClient) -> None:
    with FIXTURE_PDF_TEXT_LAYER.open("rb") as fh:
        upload = client.post(
            "/api/v1/analyses",
            files={"file": (FIXTURE_PDF_TEXT_LAYER.name, fh, "application/pdf")},
        )
    analysis_id = upload.json()["analysis_id"]
    _poll_until_ready(client, analysis_id)

    response = client.get(
        f"/api/v1/analyses/{analysis_id}/export.csv", params={"dataset": "bogus"}
    )
    assert response.status_code in (400, 500)
    error = _assert_uniform_envelope(response.json())
    assert error["code"] == "EXPORT_FAILED"


def test_unknown_route_still_returns_json_not_html(client: TestClient) -> None:
    """Anche un errore "di infrastruttura" (route inesistente, HTTPException
    di Starlette) passa dallo stesso handler centralizzato, non dalla pagina
    di default."""

    response = client.get("/api/v1/this-route-does-not-exist")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    _assert_uniform_envelope(response.json())
