"""Analisi tecnica del PDF: determina se il text layer è utilizzabile o se è
necessario il percorso raster + OCR.

Specifica di riferimento: 02_volleyref_backend_prompt.md §18.

`inspect_pdf` NON si limita a controllare la presenza di *qualche* testo: valuta
numero di parole, distribuzione sulla pagina, percentuale di copertura
testuale e rapporto testo/immagine, in modo da distinguere:

- un PDF "vettoriale" con un text layer ricco e ben distribuito (percorso
  `app/extraction/text`);
- un PDF che è in realtà l'immagine scannerizzata di un referto, con al più
  pochissimo testo residuo (percorso raster + OCR, fuori dai confini di
  questo modulo).
"""

from __future__ import annotations

from pathlib import Path

import pymupdf
from pydantic import BaseModel

# Soglie empiriche calibrate sulla fixture reale "Cerea" (referto Newbit,
# text layer nativo, ~2000 parole su un'unica pagina A4 orizzontale) e
# pensate per restare abbondantemente permissive verso i referti "buoni"
# pur escludendo pagine quasi vuote di testo (scansioni pure).
MIN_WORDS_PER_PAGE = 30
MIN_TEXT_COVERAGE_RATIO = 0.01
MIN_DISTINCT_ROWS = 5


class PdfCapabilities(BaseModel):
    """Esito dell'analisi tecnica di un PDF (backend §18)."""

    page_count: int
    total_words: int
    words_per_page: list[int]
    avg_words_per_page: float
    text_coverage_ratio: float
    """Percentuale approssimata di area di pagina coperta da bounding box di parole."""
    image_coverage_ratio: float
    """Percentuale approssimata di area di pagina coperta da immagini raster."""
    text_to_image_ratio: float | None
    """Rapporto fra area di testo e area di immagine; None se non ci sono immagini."""
    distinct_text_rows: int
    """Numero di righe di testo distinte (proxy della distribuzione sulla pagina)."""
    has_usable_text_layer: bool
    requires_ocr: bool


def _distinct_rows(words: list[tuple], tolerance: float = 2.0) -> int:
    """Conta quante "righe" di testo distinte esistono sulla pagina,
    raggruppando le parole per baseline (y1) con una tolleranza in punti.
    Usato come proxy della distribuzione del testo sulla pagina: un referto
    compilato ha decine di righe distribuite su tutta la pagina, mentre una
    scansione senza OCR o con pochissimo testo residuo ne ha poche.
    """
    baselines = sorted(w[3] for w in words)
    if not baselines:
        return 0
    rows = 1
    last = baselines[0]
    for y in baselines[1:]:
        if y - last > tolerance:
            rows += 1
            last = y
    return rows


def inspect_pdf(path: str | Path) -> PdfCapabilities:
    """Valuta se il PDF a `path` possiede un text layer utilizzabile.

    Apre il documento con PyMuPDF e, per ciascuna pagina, misura:
    - numero di parole (`page.get_text("words")`);
    - area coperta dai bounding box delle parole rispetto all'area di pagina;
    - area coperta da immagini raster rispetto all'area di pagina;
    - numero di righe di testo distinte (distribuzione sulla pagina).

    `has_usable_text_layer` è True solo se il numero medio di parole per
    pagina e la copertura testuale superano soglie minime e il testo è
    distribuito su più righe (non solo, ad esempio, un singolo watermark).
    """
    doc = pymupdf.open(str(path))
    try:
        page_count = doc.page_count
        words_per_page: list[int] = []
        total_text_area = 0.0
        total_image_area = 0.0
        total_page_area = 0.0
        total_rows = 0

        for page in doc:
            words = page.get_text("words")
            words_per_page.append(len(words))
            total_rows += _distinct_rows(words)

            page_area = float(page.rect.width) * float(page.rect.height)
            total_page_area += page_area

            for x0, y0, x1, y1, *_ in words:
                total_text_area += max(0.0, x1 - x0) * max(0.0, y1 - y0)

            for image_info in page.get_image_info():
                bbox = image_info.get("bbox")
                if not bbox:
                    continue
                ix0, iy0, ix1, iy1 = bbox
                total_image_area += max(0.0, ix1 - ix0) * max(0.0, iy1 - iy0)

        total_words = sum(words_per_page)
        avg_words_per_page = total_words / page_count if page_count else 0.0
        text_coverage_ratio = total_text_area / total_page_area if total_page_area else 0.0
        image_coverage_ratio = total_image_area / total_page_area if total_page_area else 0.0
        text_to_image_ratio = (total_text_area / total_image_area) if total_image_area > 0 else None

        has_usable_text_layer = (
            avg_words_per_page >= MIN_WORDS_PER_PAGE
            and text_coverage_ratio >= MIN_TEXT_COVERAGE_RATIO
            and total_rows >= MIN_DISTINCT_ROWS
        )
        requires_ocr = not has_usable_text_layer

        return PdfCapabilities(
            page_count=page_count,
            total_words=total_words,
            words_per_page=words_per_page,
            avg_words_per_page=avg_words_per_page,
            text_coverage_ratio=text_coverage_ratio,
            image_coverage_ratio=image_coverage_ratio,
            text_to_image_ratio=text_to_image_ratio,
            distinct_text_rows=total_rows,
            has_usable_text_layer=has_usable_text_layer,
            requires_ocr=requires_ocr,
        )
    finally:
        doc.close()
