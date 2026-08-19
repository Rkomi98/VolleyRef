"""Rendering delle pagine PDF ad alta risoluzione per l'elaborazione OpenCV.

Primo passo del percorso raster (backend §20.1): quando `inspect_pdf` stabilisce
che il text layer non è utile, la pagina viene rasterizzata a ~300dpi e da quel
momento in poi tutto (layout detection, ritagli, OCR) lavora su pixel.

Due invarianti che il resto della pipeline dà per scontati:

1. l'immagine è in **scala di grigi** uint8 — OpenCV e Tesseract lavorano meglio
   su un singolo canale e il referto è monocromatico in origine;
2. ogni `RenderedPage` sa riconvertire i propri pixel in **coordinate
   normalizzate [0,1]** (backend §9, §19): le SourceRegion prodotte dalla
   pipeline non devono mai contenere pixel, altrimenti l'overlay del frontend
   si romperebbe al cambiare del dpi di rendering.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Union

import cv2
import numpy as np
import pymupdf

#: dpi di default del rendering. 300 è il compromesso classico per l'OCR di
#: testo stampato: sotto i ~200dpi Tesseract perde le cifre piccole, sopra i
#: ~400dpi il costo di memoria cresce senza guadagno misurabile.
DEFAULT_DPI = 300.0

#: dpi nominale di un PDF (PostScript points per inch).
PDF_DPI = 72.0

PdfSource = Union[str, Path, pymupdf.Document]


@dataclass(frozen=True)
class RenderedPage:
    """Una pagina rasterizzata, con tutto il necessario per tornare al PDF.

    `image` è grayscale (H, W) uint8. `pdf_width`/`pdf_height` sono le
    dimensioni della pagina in punti PDF e servono soltanto a documentare la
    provenienza: la normalizzazione avviene sui pixel, quindi resta corretta
    anche se il dpi cambia.
    """

    page_index: int
    dpi: float
    image: np.ndarray
    pdf_width: float
    pdf_height: float

    @property
    def height(self) -> int:
        return int(self.image.shape[0])

    @property
    def width(self) -> int:
        return int(self.image.shape[1])

    @property
    def scale(self) -> float:
        """Fattore pixel-per-punto usato nel rendering."""

        return self.dpi / PDF_DPI

    def normalize_rect(self, x: int, y: int, w: int, h: int) -> tuple[float, float, float, float]:
        """Pixel → coordinate normalizzate [0,1] (origine in alto a sinistra)."""

        return (x / self.width, y / self.height, w / self.width, h / self.height)

    def denormalize_rect(self, x: float, y: float, w: float, h: float) -> tuple[int, int, int, int]:
        """Inverso di `normalize_rect`, utile per ridisegnare gli overlay di debug."""

        return (
            int(round(x * self.width)),
            int(round(y * self.height)),
            int(round(w * self.width)),
            int(round(h * self.height)),
        )

    def crop(self, x: int, y: int, w: int, h: int, *, pad: int = 0) -> np.ndarray:
        """Ritaglio sicuro (clampato ai bordi) della pagina.

        `pad` NEGATIVO erode il ritaglio verso l'interno: è il modo con cui la
        pipeline esclude le linee della griglia dalle celle prima dell'OCR
        (una linea nera sul bordo fa allucinare Tesseract con "1", "|", "I").
        """

        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(self.width, x + w + pad)
        y2 = min(self.height, y + h + pad)
        if x2 <= x1 or y2 <= y1:
            return np.zeros((0, 0), dtype=np.uint8)
        return self.image[y1:y2, x1:x2]


def _as_document(pdf: PdfSource) -> tuple[pymupdf.Document, bool]:
    """Normalizza l'input a un Document; il bool dice se va chiuso da noi."""

    if isinstance(pdf, pymupdf.Document):
        return pdf, False
    return pymupdf.open(str(pdf)), True


def _pixmap_to_gray(pixmap: pymupdf.Pixmap) -> np.ndarray:
    """Pixmap PyMuPDF → ndarray grayscale, senza ricopiare più del necessario."""

    buf = np.frombuffer(pixmap.samples, dtype=np.uint8)
    arr = buf.reshape(pixmap.height, pixmap.width, pixmap.n)
    if pixmap.n == 1:
        return np.ascontiguousarray(arr[:, :, 0])
    if pixmap.n == 3:
        # PyMuPDF restituisce RGB (non BGR): la conversione va fatta con i pesi
        # corretti, non con cv2.COLOR_BGR2GRAY, altrimenti R e B si scambiano.
        return cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    if pixmap.n == 4:
        return cv2.cvtColor(arr, cv2.COLOR_RGBA2GRAY)
    raise ValueError(f"pixmap con {pixmap.n} canali non supportato")


def render_page(pdf: PdfSource, page_index: int = 0, *, dpi: float = DEFAULT_DPI) -> RenderedPage:
    """Renderizza una singola pagina a `dpi`.

    `alpha=False` evita il canale alfa (che sarebbe tutto opaco) e quindi un
    terzo di memoria e una conversione in meno.
    """

    doc, owned = _as_document(pdf)
    try:
        if not 0 <= page_index < doc.page_count:
            raise IndexError(f"page_index {page_index} fuori range (pagine: {doc.page_count})")
        page = doc[page_index]
        zoom = dpi / PDF_DPI
        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        return RenderedPage(
            page_index=page_index,
            dpi=dpi,
            image=_pixmap_to_gray(pixmap),
            pdf_width=float(page.rect.width),
            pdf_height=float(page.rect.height),
        )
    finally:
        if owned:
            doc.close()


def iter_rendered_pages(pdf: PdfSource, *, dpi: float = DEFAULT_DPI) -> Iterator[RenderedPage]:
    """Generatore lazy: a 300dpi una pagina A3 pesa ~17MB, non teniamo in RAM
    tutto un documento se il chiamante può consumarlo una pagina alla volta."""

    doc, owned = _as_document(pdf)
    try:
        for index in range(doc.page_count):
            yield render_page(doc, index, dpi=dpi)
    finally:
        if owned:
            doc.close()


def render_pages(pdf: PdfSource, *, dpi: float = DEFAULT_DPI) -> list[RenderedPage]:
    return list(iter_rendered_pages(pdf, dpi=dpi))
