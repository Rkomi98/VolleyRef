"""Validazione difensiva dei file caricati (backend §5, §40).

Il backend accetta PDF da utenti non fidati: prima di qualunque elaborazione
il file deve superare tre controlli indipendenti dall'estensione o dal
Content-Type dichiarati dal client (che sono solo metadati HTTP, non prova
di nulla):

1. dimensione massima (evita upload abnormi che saturano disco/memoria);
2. signature PDF reale (`%PDF-` nei primi byte del contenuto) — un file di
   testo rinominato `.pdf` non la supera, indipendentemente da estensione o
   Content-Type;
3. nome file sanificato: il filename fornito dal client non viene MAI usato
   per costruire un percorso sul filesystem. Viene ripulito da qualunque
   componente di directory (incluso `..`) e conservato solo come metadato
   "umano"; il nome usato per scrivere su disco è sempre generato
   internamente (UUID), quindi un filename come `../../etc/passwd.pdf` non
   può in nessun caso risultare in una scrittura fuori dalla directory di
   storage dell'analysis.
"""

from __future__ import annotations

import os
import re
import uuid
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Optional

from app.core.errors import InvalidFileError, UnsupportedPdfError

# Un PDF valido inizia con questa signature. La cerchiamo in una finestra
# limitata di byte iniziali (mai sull'intero file): un file malevolo che
# incolla `%PDF-` in coda a contenuto arbitrario non deve passare come PDF
# valido solo perché la stringa esiste da qualche parte nel file.
_PDF_MAGIC = b"%PDF-"
_MAGIC_SEARCH_WINDOW = 1024

DEFAULT_MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
"""Limite di default per un referto PDF: un referto FIPAV (1-2 pagine, anche
rasterizzato ad alta risoluzione con firme/timbri) sta comodamente entro
pochi MB; 20MB lascia ampio margine senza permettere upload multi-decina-di-MB
usati per saturare disco/memoria del servizio. Configurabile via env var
`MAX_UPLOAD_SIZE_BYTES` per ambienti con esigenze diverse."""

_MAX_UPLOAD_SIZE_ENV_VAR = "MAX_UPLOAD_SIZE_BYTES"

_ACCEPTED_CONTENT_TYPES = (None, "", "application/pdf", "application/octet-stream")

_FALLBACK_FILENAME = "document.pdf"


def max_upload_size_bytes() -> int:
    """Limite dimensione upload corrente: env var se impostata e valida,
    altrimenti il default. Letta ad ogni chiamata (non cache-ata) così i test
    possono cambiarla con `monkeypatch.setenv` senza dover ricaricare moduli."""

    raw = os.environ.get(_MAX_UPLOAD_SIZE_ENV_VAR)
    if raw:
        try:
            parsed = int(raw)
            if parsed > 0:
                return parsed
        except ValueError:
            pass
    return DEFAULT_MAX_UPLOAD_SIZE_BYTES


@dataclass(frozen=True)
class ValidatedUpload:
    """Esito di una validazione riuscita.

    `original_filename` è il nome ripulito ma resta solo un metadato di
    presentazione: non deve mai essere usato per costruire un path. Il nome
    da usare per scrivere su disco va generato con
    `generate_internal_filename()`, indipendente da qualunque input client.
    """

    original_filename: str
    content_type: Optional[str]
    size_bytes: int


def sanitize_filename(raw_filename: Optional[str], *, fallback: str = _FALLBACK_FILENAME) -> str:
    """Ripulisce un filename fornito dal client per poterlo mostrare/salvare
    come *metadato* (mai come componente di un percorso sul filesystem).

    Rimuove qualunque componente di directory — inclusi `..` e path assoluti,
    sia in stile POSIX (`/`) sia Windows (`\\`) — e caratteri di controllo.
    Se il risultato è vuoto o degenere (`.`, `..`), usa `fallback`.
    """

    name = raw_filename if raw_filename is not None else ""
    name = name.replace("\\", "/")
    # PurePosixPath(...).name scarta qualunque componente di directory,
    # incluso `..`: è questo che rende impossibile il path traversal, non un
    # controllo puntuale su singole sottostringhe sospette.
    name = PurePosixPath(name).name
    name = re.sub(r"[\x00-\x1f]", "", name).strip().strip(".")

    if not name or name in ("..", "."):
        return fallback
    return name


def generate_internal_filename(extension: str = ".pdf") -> str:
    """Nome file interno da usare per scrivere su disco: non deriva mai
    dall'input del client (è un UUID), quindi non può mai contenere `..` o
    separatori di percorso — elimina il path traversal per costruzione,
    indipendentemente da qualunque controllo fatto sul filename originale."""

    return f"{uuid.uuid4().hex}{extension}"


def validate_pdf_upload(
    *,
    filename: Optional[str],
    content_type: Optional[str],
    content: bytes,
    max_size_bytes: Optional[int] = None,
) -> ValidatedUpload:
    """Valida un upload dichiarato come PDF (backend §5, §40).

    Solleva `InvalidFileError` per problemi di "involucro" (estensione,
    Content-Type, file vuoto o troppo grande) e `UnsupportedPdfError` quando
    il contenuto non è davvero un PDF (signature assente) — codici distinti
    perché mappano a `ErrorCode` diversi (backend §34).
    """

    limit = max_size_bytes if max_size_bytes is not None else max_upload_size_bytes()

    safe_name = sanitize_filename(filename)
    if not filename or not safe_name.lower().endswith(".pdf"):
        raise InvalidFileError(
            "Il file deve avere estensione .pdf.",
            details={"filename": filename},
        )

    if content_type not in _ACCEPTED_CONTENT_TYPES:
        raise InvalidFileError(
            "Content-Type non valido per un PDF.",
            details={"content_type": content_type},
        )

    size = len(content)
    if size == 0:
        raise InvalidFileError("Il file è vuoto.")

    if size > limit:
        raise InvalidFileError(
            "Il file supera la dimensione massima consentita.",
            details={"size_bytes": size, "max_size_bytes": limit},
        )

    window = content[:_MAGIC_SEARCH_WINDOW]
    if _PDF_MAGIC not in window:
        raise UnsupportedPdfError(
            "Il documento non può essere interpretato: signature PDF assente."
        )

    return ValidatedUpload(
        original_filename=safe_name,
        content_type=content_type,
        size_bytes=size,
    )
