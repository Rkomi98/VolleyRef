"""Test per app.core.security (backend §5, §40).

Copre: dimensione massima upload, signature PDF reale (non ci si fida di
estensione/Content-Type dichiarati dal client), sanitizzazione filename per
evitare path traversal — sia a livello unitario sulle funzioni pure, sia
end-to-end contro l'endpoint `POST /api/v1/analyses` per verificare che la
validazione sia davvero collegata al flusso di upload.
"""

from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.errors import InvalidFileError, UnsupportedPdfError
from app.core.security import (
    DEFAULT_MAX_UPLOAD_SIZE_BYTES,
    generate_internal_filename,
    sanitize_filename,
    validate_pdf_upload,
)

_VALID_PDF_BYTES = b"%PDF-1.7\n%mock pdf content for tests\n%%EOF"


# ---------------------------------------------------------------------------
# validate_pdf_upload — unit level
# ---------------------------------------------------------------------------


def test_validate_pdf_upload_accepts_real_pdf_signature() -> None:
    result = validate_pdf_upload(
        filename="referto.pdf", content_type="application/pdf", content=_VALID_PDF_BYTES
    )
    assert result.original_filename == "referto.pdf"
    assert result.size_bytes == len(_VALID_PDF_BYTES)


def test_validate_pdf_upload_rejects_text_file_renamed_to_pdf() -> None:
    """Un file di testo rinominato .pdf: estensione e Content-Type mentono,
    i byte reali no — deve essere rifiutato come UNSUPPORTED_PDF, non
    accettato solo perché il nome finisce in .pdf."""

    with pytest.raises(UnsupportedPdfError):
        validate_pdf_upload(
            filename="referto.pdf",
            content_type="application/pdf",
            content=b"questo e' un file di testo, non un vero PDF",
        )


def test_validate_pdf_upload_rejects_wrong_extension() -> None:
    with pytest.raises(InvalidFileError):
        validate_pdf_upload(
            filename="referto.txt", content_type="text/plain", content=_VALID_PDF_BYTES
        )


def test_validate_pdf_upload_rejects_empty_file() -> None:
    with pytest.raises(InvalidFileError):
        validate_pdf_upload(filename="referto.pdf", content_type="application/pdf", content=b"")


def test_validate_pdf_upload_rejects_oversized_file() -> None:
    oversized = _VALID_PDF_BYTES + b"0" * 1000
    with pytest.raises(InvalidFileError) as exc_info:
        validate_pdf_upload(
            filename="referto.pdf",
            content_type="application/pdf",
            content=oversized,
            max_size_bytes=100,
        )
    assert exc_info.value.details["max_size_bytes"] == 100
    assert exc_info.value.details["size_bytes"] == len(oversized)


def test_validate_pdf_upload_accepts_file_within_custom_limit() -> None:
    result = validate_pdf_upload(
        filename="referto.pdf",
        content_type="application/pdf",
        content=_VALID_PDF_BYTES,
        max_size_bytes=len(_VALID_PDF_BYTES),
    )
    assert result.size_bytes == len(_VALID_PDF_BYTES)


def test_default_max_upload_size_is_20mb() -> None:
    assert DEFAULT_MAX_UPLOAD_SIZE_BYTES == 20 * 1024 * 1024


# ---------------------------------------------------------------------------
# sanitize_filename / generate_internal_filename — path traversal
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("../../etc/passwd.pdf", "passwd.pdf"),
        ("..\\..\\windows\\system32\\evil.pdf", "evil.pdf"),
        ("/etc/passwd.pdf", "passwd.pdf"),
        ("referto.pdf", "referto.pdf"),
        ("..", "document.pdf"),
        ("", "document.pdf"),
        (None, "document.pdf"),
    ],
)
def test_sanitize_filename_strips_path_traversal(raw, expected) -> None:
    assert sanitize_filename(raw) == expected


def test_generate_internal_filename_is_uuid_based_not_client_derived() -> None:
    name_a = generate_internal_filename()
    name_b = generate_internal_filename()
    assert name_a != name_b
    assert name_a.endswith(".pdf")
    assert "/" not in name_a and ".." not in name_a


# ---------------------------------------------------------------------------
# Wiring end-to-end: l'endpoint di upload usa davvero questa validazione.
# ---------------------------------------------------------------------------


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Client con DB SQLite e storage isolati in una directory temporanea
    (stesso pattern di tests/test_api_smoke.py)."""

    db_path = tmp_path / "test.db"
    storage_dir = tmp_path / "storage"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("STORAGE_DIR", str(storage_dir))

    from app.core.config import get_settings

    get_settings.cache_clear()

    import main as main_module

    importlib.reload(main_module)

    with TestClient(main_module.app) as test_client:
        yield test_client, storage_dir

    get_settings.cache_clear()


def test_upload_oversized_file_rejected_by_api(client, monkeypatch) -> None:
    test_client, _storage_dir = client
    monkeypatch.setenv("MAX_UPLOAD_SIZE_BYTES", "100")

    oversized = _VALID_PDF_BYTES + b"0" * 1000
    response = test_client.post(
        "/api/v1/analyses",
        files={"file": ("referto.pdf", oversized, "application/pdf")},
    )
    assert response.status_code == 400, response.text
    assert response.json()["error"]["code"] == "INVALID_FILE"


def test_upload_fake_pdf_rejected_by_api_regardless_of_declared_content_type(client) -> None:
    test_client, _storage_dir = client
    response = test_client.post(
        "/api/v1/analyses",
        files={"file": ("referto.pdf", b"not a real pdf body", "application/pdf")},
    )
    assert response.status_code == 400, response.text
    assert response.json()["error"]["code"] == "UNSUPPORTED_PDF"


def test_upload_malicious_filename_cannot_escape_storage_dir(client) -> None:
    test_client, storage_dir = client
    malicious_name = "../../../../etc/passwd.pdf"

    response = test_client.post(
        "/api/v1/analyses",
        files={"file": (malicious_name, _VALID_PDF_BYTES, "application/pdf")},
    )
    # L'upload in sé è accettato: il filename è solo un metadato, mai un path.
    assert response.status_code == 202, response.text
    analysis_id = response.json()["analysis_id"]

    # Il contenuto finisce esattamente dove previsto, con un nome interno
    # generato dal server (non derivato dal filename del client)...
    expected_path = storage_dir / analysis_id / "original.pdf"
    assert expected_path.exists()
    assert expected_path.read_bytes() == _VALID_PDF_BYTES

    # ...e in nessun punto del filesystem compare un file scritto seguendo
    # il filename malevolo fornito dal client.
    assert not Path("/etc/passwd.pdf").exists()
    all_files_under_storage = [p for p in storage_dir.rglob("*") if p.is_file()]
    assert all_files_under_storage  # almeno original.pdf è stato scritto
    assert all(storage_dir in p.parents for p in all_files_under_storage)
    assert not any(p.name == "passwd.pdf" for p in all_files_under_storage)
