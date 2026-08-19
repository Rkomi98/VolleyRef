"""Test per `GET /api/v1/analyses/{id}/source-pdf` (visualizzazione inline
del PDF originale nel frontend — vedi `frontend/src/components/pdf/PdfViewer.tsx`).

Copre:
- happy path: il PDF caricato viene servito con Content-Type/Content-Disposition
  corretti e con i byte reali del file caricato;
- analisi inesistente -> 404 ANALYSIS_NOT_FOUND (stesso ErrorEnvelope delle
  altre route, backend §34);
- file non più presente su disco (storage azzerato) -> errore distinto
  SOURCE_PDF_MISSING, non un 500 generico né un file vuoto;
- un `pdf_path` di record manomesso per puntare fuori dalla storage dir
  (simulazione di path traversal) non viene mai servito: stesso errore
  SOURCE_PDF_MISSING, nessun accesso al file esterno.

Stesso pattern di fixture di tests/test_api_smoke.py e tests/test_security.py
(DB SQLite e storage isolati in tmp_path, app ricaricata con settings puliti).
"""

from __future__ import annotations

import importlib
import sqlite3
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
    """Client con DB SQLite e storage isolati in una directory temporanea."""

    db_path = tmp_path / "test.db"
    storage_dir = tmp_path / "storage"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("STORAGE_DIR", str(storage_dir))

    from app.core.config import get_settings

    get_settings.cache_clear()

    import main as main_module

    importlib.reload(main_module)

    with TestClient(main_module.app) as test_client:
        yield test_client, storage_dir, db_path

    get_settings.cache_clear()


def _upload_and_wait_ready(test_client: TestClient, pdf_path: Path) -> str:
    with pdf_path.open("rb") as fh:
        response = test_client.post(
            "/api/v1/analyses",
            files={"file": (pdf_path.name, fh, "application/pdf")},
        )
    assert response.status_code == 202, response.text
    analysis_id = response.json()["analysis_id"]

    deadline = time.monotonic() + 10.0
    while time.monotonic() < deadline:
        status = test_client.get(f"/api/v1/analyses/{analysis_id}/status").json()
        if status["status"] in ("READY", "FAILED"):
            break
        time.sleep(0.1)
    return analysis_id


def _set_pdf_path_in_db(db_path: Path, analysis_id: str, new_pdf_path: str) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            "UPDATE analyses SET pdf_path = ? WHERE id = ?", (new_pdf_path, analysis_id)
        )
        conn.commit()
    finally:
        conn.close()


def test_get_source_pdf_returns_uploaded_pdf_bytes(client) -> None:
    test_client, _storage_dir, _db_path = client
    analysis_id = _upload_and_wait_ready(test_client, FIXTURE_PDF_TEXT_LAYER)

    response = test_client.get(f"/api/v1/analyses/{analysis_id}/source-pdf")

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("inline")
    assert response.content[:5] == b"%PDF-"
    assert response.content == FIXTURE_PDF_TEXT_LAYER.read_bytes()


def test_get_source_pdf_for_unknown_analysis_returns_404_uniform_envelope(client) -> None:
    test_client, _storage_dir, _db_path = client

    response = test_client.get("/api/v1/analyses/does-not-exist/source-pdf")

    assert response.status_code == 404
    body = response.json()
    assert set(body.keys()) == {"error"}
    assert body["error"]["code"] == "ANALYSIS_NOT_FOUND"


def test_get_source_pdf_missing_from_disk_returns_distinct_error(client) -> None:
    """Simula uno storage azzerato (es. filesystem effimero tra deploy):
    il record esiste ma il file non è più su disco. Deve tornare un errore
    chiaro e distinto (SOURCE_PDF_MISSING), non un 500 generico né bytes
    vuoti spacciati per PDF."""

    test_client, storage_dir, _db_path = client
    analysis_id = _upload_and_wait_ready(test_client, FIXTURE_PDF_TEXT_LAYER)

    pdf_on_disk = storage_dir / analysis_id / "original.pdf"
    assert pdf_on_disk.exists()
    pdf_on_disk.unlink()

    response = test_client.get(f"/api/v1/analyses/{analysis_id}/source-pdf")

    assert response.status_code == 404
    body = response.json()
    assert set(body.keys()) == {"error"}
    assert body["error"]["code"] == "SOURCE_PDF_MISSING"
    assert response.content[:5] != b"%PDF-"


def test_get_source_pdf_rejects_pdf_path_pointing_outside_storage_dir(
    client, tmp_path
) -> None:
    """Anche se il `pdf_path` persistito nel record puntasse (per bug o
    manomissione futura) fuori dalla storage dir, l'endpoint non deve mai
    servire quel file: è la difesa di contenimento in
    `app.core.security.resolve_pdf_within_storage`."""

    test_client, _storage_dir, db_path = client
    analysis_id = _upload_and_wait_ready(test_client, FIXTURE_PDF_TEXT_LAYER)

    secret_file = tmp_path / "outside-storage-secret.pdf"
    secret_file.write_bytes(b"%PDF-1.7\nsecret content that must never be served\n%%EOF")
    _set_pdf_path_in_db(db_path, analysis_id, str(secret_file))

    response = test_client.get(f"/api/v1/analyses/{analysis_id}/source-pdf")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "SOURCE_PDF_MISSING"
    assert b"secret content" not in response.content
