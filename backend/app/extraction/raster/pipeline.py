"""Orchestrazione del percorso raster: PDF immagine → `list[RawObservation]`.

Implementa la sequenza di backend §20 nell'ordine esatto:

    render (300dpi) → griglie e macroregioni → riquadri set → normalizzazione
    del layout → OCR SOLO sulle aree utili → SourceRegion → confidence

L'output è il contratto intermedio `RawObservation` (backend §23) con
`method=ExtractionMethod.OCR`, più le `SourceRegion` in coordinate normalizzate
[0,1] di pagina per gli overlay del frontend (backend §9). Nessuna
interpretazione pallavolistica avviene qui: associare i numeri alle posizioni
I-VI in senso di dominio, validare le rotazioni e risolvere le ambiguità è
compito di `app/volleyball` (backend §24-§26).

Sugli artefatti di debug (backend §38): il layout detection su referto scansionato
è la parte del sistema che più probabilmente richiederà debug visivo, quindi ogni
esecuzione salva sotto `storage/debug/<run_id>/` la pagina renderizzata, gli
overlay delle regioni/griglie/celle e i singoli ritagli passati a Tesseract, così
che un umano possa vedere *cosa* ha guardato l'OCR e non solo cosa ha letto.
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Optional

import cv2
import numpy as np

from app.domain.raw_observation import ExpectedType, ObservationCandidate, RawObservation
from app.extraction.raster.render import DEFAULT_DPI, RenderedPage, render_page
from app.layout.detector import (
    CellRole,
    DetectorConfig,
    FieldCell,
    LayoutDetector,
    PageLayout,
    RegionKind,
)
from app.models.common import ExtractionMethod, SourceRegion
from app.ocr.tesseract import TesseractOcr, is_valid_player_number

#: Directory di default degli artefatti di debug, relativa alla root del backend.
DEFAULT_DEBUG_ROOT = Path(__file__).resolve().parents[3] / "storage" / "debug"

#: Larghezza massima delle immagini di overlay salvate: a 300dpi la pagina A3 è
#: ~5000px e un PNG del genere è scomodo da aprire per un controllo visivo.
_OVERLAY_MAX_WIDTH = 2400

_REGION_COLORS: dict[RegionKind, tuple[int, int, int]] = {
    RegionKind.SET_BOX: (0, 0, 220),
    RegionKind.FINAL_RESULT: (0, 150, 0),
    RegionKind.MATCH_HEADER: (200, 120, 0),
    RegionKind.PLAYER_LIST: (160, 0, 160),
    RegionKind.SANCTIONS: (120, 120, 120),
    RegionKind.OBSERVATIONS: (120, 120, 120),
    RegionKind.APPROVAL: (120, 120, 120),
    RegionKind.UNKNOWN: (60, 60, 60),
}

#: Parole prestampate sul modulo che finiscono nel ritaglio del nome squadra
#: insieme al nome vero e proprio (la cella della fascia titolo le contiene).
_TEAM_NAME_STOPWORDS = {"SQU", "FINE", "INIZIO", "PUNTI", "LIBERO", "UNDER", "SET"}

_ROLE_COLORS: dict[CellRole, tuple[int, int, int]] = {
    CellRole.STARTING_SIX: (0, 0, 255),
    CellRole.SET_SCORE: (0, 140, 0),
    CellRole.TEAM_NAME: (200, 100, 0),
}


@dataclass
class RasterExtractionResult:
    """Esito completo di una passata raster su un documento."""

    run_id: str
    pdf_path: str
    dpi: float
    observations: list[RawObservation] = field(default_factory=list)
    regions: list[SourceRegion] = field(default_factory=list)
    layouts: list[PageLayout] = field(default_factory=list)
    debug_dir: Optional[Path] = None
    diagnostics: dict = field(default_factory=dict)

    # -- accessi comodi per test e per il parser pallavolistico ---------------

    def region_by_id(self, region_id: str) -> Optional[SourceRegion]:
        for region in self.regions:
            if region.id == region_id:
                return region
        return None

    def observations_of(self, expected_type: ExpectedType) -> list[RawObservation]:
        return [o for o in self.observations if o.expected_type is expected_type]

    def starting_six(self, set_number: int, team_slot: str) -> dict[str, str]:
        """Mappa posizione I-VI → miglior candidato, per un set e una formazione.

        Solo una comodità di lettura: la scelta fra candidati alternativi resta
        del validator pallavolistico (backend §26).
        """

        prefix = f"-set{set_number}-formation-{team_slot.lower()}-"
        out: dict[str, str] = {}
        for observation in self.observations:
            if observation.expected_type is not ExpectedType.PLAYER_NUMBER:
                continue
            if prefix not in observation.region_id:
                continue
            position = observation.region_id.rsplit("-", 1)[-1]
            if observation.candidates:
                out[position] = observation.candidates[0].value
        return out

    def set_score(self, set_number: int) -> dict[str, str]:
        out: dict[str, str] = {}
        for observation in self.observations:
            if observation.expected_type is not ExpectedType.SCORE:
                continue
            marker = f"-set{set_number}-score-"
            if marker not in observation.region_id:
                continue
            slot = observation.region_id.rsplit("-", 1)[-1].upper()
            if observation.candidates:
                out[slot] = observation.candidates[0].value
        return out


def extract_raster(
    pdf_path: str | Path,
    *,
    dpi: float = DEFAULT_DPI,
    pages: Optional[Iterable[int]] = None,
    ocr: Optional[TesseractOcr] = None,
    detector_config: Optional[DetectorConfig] = None,
    debug: bool = True,
    debug_root: Optional[Path] = None,
    run_id: Optional[str] = None,
) -> RasterExtractionResult:
    """Esegue il percorso raster completo su `pdf_path`.

    `pages` limita le pagine da elaborare (default: solo la prima — il referto
    FIPAV sta su una pagina sola e renderizzare a 300dpi non è gratis).
    """

    pdf_path = Path(pdf_path)
    ocr = ocr or TesseractOcr()
    detector = LayoutDetector(probe=ocr, config=detector_config)
    run_id = run_id or uuid.uuid4().hex[:12]

    debug_dir: Optional[Path] = None
    if debug:
        debug_dir = Path(debug_root or DEFAULT_DEBUG_ROOT) / run_id
        (debug_dir / "crops").mkdir(parents=True, exist_ok=True)

    result = RasterExtractionResult(
        run_id=run_id, pdf_path=str(pdf_path), dpi=dpi, debug_dir=debug_dir
    )

    page_indexes = list(pages) if pages is not None else [0]
    for page_index in page_indexes:
        page = render_page(pdf_path, page_index, dpi=dpi)
        layout = detector.detect(page)
        cells = _collect_cells(detector, page, layout, ocr)
        layout.cells = cells
        result.layouts.append(layout)

        for cell in cells:
            observation, region = _read_cell(page, cell, ocr, debug_dir)
            result.regions.append(region)
            if observation is not None:
                result.observations.append(observation)

        if debug_dir is not None:
            _write_debug_artifacts(debug_dir, page, layout)

    result.diagnostics = {
        "run_id": run_id,
        "dpi": dpi,
        "pages": page_indexes,
        "n_observations": len(result.observations),
        "n_regions": len(result.regions),
        "per_page": [layout.diagnostics for layout in result.layouts],
    }
    if debug_dir is not None:
        _write_json(debug_dir / "result.json", _result_summary(result))
    return result


# --------------------------------------------------------------- celle e OCR


def _collect_cells(
    detector: LayoutDetector,
    page: RenderedPage,
    layout: PageLayout,
    ocr: TesseractOcr,
) -> list[FieldCell]:
    """Chiede al layout detector le celle utili di ogni macroregione."""

    def read_player_number(image: np.ndarray) -> tuple[str, float]:
        # `TesseractOcr` memoizza internamente sul contenuto del ritaglio: le
        # finestre candidate della formazione si sovrappongono e le celle scelte
        # vengono rilette a valle, quindi senza cache la stessa cella pagherebbe
        # più volte l'avvio di Tesseract.
        res = ocr.read(image, ExpectedType.PLAYER_NUMBER)
        return res.text, res.confidence

    cells: list[FieldCell] = []
    for region in layout.regions:
        if region.kind is RegionKind.SET_BOX:
            six = detector.starting_six_cells(
                page,
                region,
                validator=is_valid_player_number,
                cell_reader=read_player_number,
            )
            cells.extend(six)
            cells.extend(detector.team_name_cells(page, region))
        elif region.kind is RegionKind.FINAL_RESULT:
            cells.extend(detector.set_score_cells(page, region, digit_reader=read_player_number))
    return cells


def _read_cell(
    page: RenderedPage,
    cell: FieldCell,
    ocr: TesseractOcr,
    debug_dir: Optional[Path],
) -> tuple[Optional[RawObservation], SourceRegion]:
    """OCR del singolo ritaglio → (RawObservation | None, SourceRegion).

    Una cella vuota produce comunque la SourceRegion (il frontend deve poter
    mostrare "qui non è stato letto niente" e permettere la correzione manuale)
    ma nessuna RawObservation: inventare un candidato a confidence bassa
    equivarrebbe a correggere in silenzio un dato mancante (backend §25).
    """

    crop = page.crop(cell.x, cell.y, cell.width, cell.height)
    reading = ocr.read(crop, cell.expected_type)
    candidates = _clean_candidates(cell, reading.candidates)

    nx, ny, nw, nh = page.normalize_rect(cell.x, cell.y, cell.width, cell.height)
    region = SourceRegion(
        id=cell.id,
        page=page.page_index + 1,
        x=round(nx, 6),
        y=round(ny, 6),
        width=round(nw, 6),
        height=round(nh, 6),
        method=ExtractionMethod.OCR,
        region_type=cell.role.value,
        raw_text=candidates[0].value if candidates else None,
    )

    if debug_dir is not None and crop.size:
        cv2.imwrite(str(debug_dir / "crops" / f"{cell.id}.png"), crop)

    if not candidates:
        return None, region

    observation = RawObservation(
        id=f"obs-{cell.id}",
        region_id=cell.id,
        expected_type=cell.expected_type,
        method=ExtractionMethod.OCR,
        candidates=candidates,
    )
    return observation, region


def _clean_candidates(
    cell: FieldCell, candidates: list[ObservationCandidate]
) -> list[ObservationCandidate]:
    """Filtri per tipo, senza mai *modificare* un valore letto.

    - numeri di maglia: si scartano i candidati fuori dal range regolamentare
      1-99 (non sono letture alternative plausibili, sono rumore);
    - nomi squadra: la cella della fascia titolo contiene anche l'etichetta
      "SQ.", l'orario di inizio/fine e i cerchietti A/B; si tengono solo i token
      alfabetici di almeno tre lettere, che è quanto basta per far emergere
      "ROTHOBLAAS" / "AZIMUT GIO" senza riscrivere niente.
    """

    if cell.expected_type is ExpectedType.PLAYER_NUMBER:
        return [c for c in candidates if is_valid_player_number(c.value)]
    if cell.expected_type is ExpectedType.SCORE:
        return [c for c in candidates if c.value.isdigit() and 0 <= int(c.value) <= 99]
    if cell.expected_type is ExpectedType.TEAM_NAME:
        cleaned: list[ObservationCandidate] = []
        seen: set[str] = set()
        for candidate in candidates:
            tokens = [
                token
                for token in re.findall(r"[A-Za-z]{3,}", candidate.value)
                if token.upper() not in _TEAM_NAME_STOPWORDS
            ]
            value = " ".join(tokens).upper().strip()
            if value and value not in seen:
                seen.add(value)
                cleaned.append(
                    ObservationCandidate(value=value, confidence=candidate.confidence)
                )
        return cleaned
    return candidates


# ---------------------------------------------------------------- debug


def _overlay_base(page: RenderedPage) -> tuple[np.ndarray, float]:
    scale = min(1.0, _OVERLAY_MAX_WIDTH / page.width)
    image = cv2.cvtColor(page.image, cv2.COLOR_GRAY2BGR)
    if scale < 1.0:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return image, scale


def _write_debug_artifacts(debug_dir: Path, page: RenderedPage, layout: PageLayout) -> None:
    """Salva pagina renderizzata + tre overlay + il JSON del layout."""

    suffix = f"p{page.page_index + 1}"
    cv2.imwrite(str(debug_dir / f"{suffix}_render.png"), page.image)

    # 1) macroregioni con etichetta del tipo riconosciuto
    regions_img, scale = _overlay_base(page)
    for region in layout.regions:
        color = _REGION_COLORS.get(region.kind, (60, 60, 60))
        x1, y1 = int(region.x * scale), int(region.y * scale)
        x2, y2 = int((region.x + region.width) * scale), int((region.y + region.height) * scale)
        cv2.rectangle(regions_img, (x1, y1), (x2, y2), color, 3)
        label = region.kind.value
        if region.set_number is not None:
            label = f"{label} {region.set_number}"
        cv2.putText(
            regions_img, label, (x1 + 6, max(14, y1 + 24)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2
        )
    cv2.imwrite(str(debug_dir / f"{suffix}_regions.png"), regions_img)

    # 2) griglie interne di ogni macroregione
    grid_img, scale = _overlay_base(page)
    for region in layout.regions:
        color = _REGION_COLORS.get(region.kind, (60, 60, 60))
        for y in region.grid.horizontal:
            yy = int((region.y + y) * scale)
            cv2.line(
                grid_img,
                (int(region.x * scale), yy),
                (int((region.x + region.width) * scale), yy),
                color,
                1,
            )
        for x in region.grid.vertical:
            xx = int((region.x + x) * scale)
            cv2.line(
                grid_img,
                (xx, int(region.y * scale)),
                (xx, int((region.y + region.height) * scale)),
                color,
                1,
            )
    cv2.imwrite(str(debug_dir / f"{suffix}_grid.png"), grid_img)

    # 3) celle effettivamente passate a Tesseract, con il loro ruolo
    cells_img, scale = _overlay_base(page)
    for cell in layout.cells:
        color = _ROLE_COLORS.get(cell.role, (0, 0, 255))
        x1, y1 = int(cell.x * scale), int(cell.y * scale)
        x2, y2 = int((cell.x + cell.width) * scale), int((cell.y + cell.height) * scale)
        cv2.rectangle(cells_img, (x1, y1), (x2, y2), color, 2)
        tag = str(cell.meta.get("position") or cell.meta.get("team_slot") or "")
        if tag:
            cv2.putText(
                cells_img, tag, (x1, max(10, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1
            )
    cv2.imwrite(str(debug_dir / f"{suffix}_cells.png"), cells_img)

    _write_json(debug_dir / f"{suffix}_layout.json", _layout_summary(layout))


def _layout_summary(layout: PageLayout) -> dict:
    return {
        "page": layout.page.page_index + 1,
        "page_size_px": [layout.page.width, layout.page.height],
        "dpi": layout.page.dpi,
        "diagnostics": layout.diagnostics,
        "regions": [
            {
                "id": r.id,
                "kind": r.kind.value,
                "set_number": r.set_number,
                "rect_px": [r.x, r.y, r.width, r.height],
                "grid_rows": r.grid.n_rows,
                "grid_cols": r.grid.n_cols,
                "probe_text": r.probe_text[:300],
                "meta": _jsonable(r.meta),
            }
            for r in layout.regions
        ],
        "cells": [
            {
                "id": c.id,
                "role": c.role.value,
                "expected_type": c.expected_type.value,
                "rect_px": [c.x, c.y, c.width, c.height],
                "local_normalized": [round(v, 6) for v in c.local],
                "meta": _jsonable(c.meta),
            }
            for c in layout.cells
        ],
    }


def _result_summary(result: RasterExtractionResult) -> dict:
    return {
        "run_id": result.run_id,
        "pdf": result.pdf_path,
        "diagnostics": result.diagnostics,
        "observations": [o.model_dump(mode="json") for o in result.observations],
        "regions": [r.model_dump(mode="json") for r in result.regions],
    }


def _jsonable(value):
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
