"""Layout detection su referto rasterizzato con CV classica (backend §20-§21).

La regola architetturale di §21 è «Non creare parser basati soltanto su pixel
assoluti»: qui non c'è nessuna coordinata di pixel del referto hardcodata. Tutto
parte dalle **linee** disegnate sul modulo FIPAV, che sono l'unica struttura
davvero stabile fra software di compilazione diversi e fra scansioni a
risoluzioni diverse:

1. si isolano linee orizzontali e verticali con due `MORPH_OPEN` a kernel
   allungato (una linea sopravvive all'apertura, una lettera no);
2. i contorni della maschera di linee danno le **macroregioni** (header, riquadri
   set, risultato finale, elenco giocatori, …);
3. dentro ogni macroregione si ricostruisce la **griglia** con i profili di
   proiezione delle stesse due maschere, ottenendo bande di riga e di colonna;
4. le regioni interessanti si identificano per **significato**, non per
   posizione: si legge l'etichetta di riga stampata sul modulo ("Giocatori
   titolari N°") e la si confronta col testo atteso, e si validano le colonne
   della formazione verificando che contengano davvero numeri di maglia.

Da qui in poi si lavora in **coordinate locali normalizzate** dentro il riquadro
del set, come chiede §21: `FieldCell.local_*` è la posizione della cella dentro
la sua macroregione, indipendente dalla posizione della macroregione sulla pagina.

Il riconoscimento del testo è iniettato dall'esterno (`LayoutProbe`): il layout
detector non importa `app.ocr`, così può essere testato con un probe finto e
funziona (in modalità degradata, solo geometrica) anche senza Tesseract.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Protocol, Sequence

import cv2
import numpy as np

from app.domain.raw_observation import ExpectedType
from app.extraction.raster.render import RenderedPage

#: Le sei posizioni di rotazione, nell'ordine in cui il referto le stampa.
ROTATION_POSITIONS: tuple[str, ...] = ("I", "II", "III", "IV", "V", "VI")


class RegionKind(str, Enum):
    """Macroregioni previste da backend §21."""

    MATCH_HEADER = "MATCH_HEADER"
    SET_BOX = "SET_BOX"
    FINAL_RESULT = "FINAL_RESULT"
    PLAYER_LIST = "PLAYER_LIST"
    SANCTIONS = "SANCTIONS"
    OBSERVATIONS = "OBSERVATIONS"
    APPROVAL = "APPROVAL"
    UNKNOWN = "UNKNOWN"


class CellRole(str, Enum):
    """Ruolo pallavolistico della singola cella individuata."""

    STARTING_SIX = "STARTING_SIX"
    SET_SCORE = "SET_SCORE"
    TEAM_NAME = "TEAM_NAME"


class TeamSlot(str, Enum):
    """Quale delle due squadre, per posizione sul referto (non per nome)."""

    A = "A"
    B = "B"


class LayoutProbe(Protocol):
    """Il minimo che serve al layout detector per leggere un'etichetta.

    `app.ocr.tesseract.TesseractOcr` lo soddisfa.
    """

    def read_text(self, image: np.ndarray, *, multiline: bool = False) -> str: ...


# --------------------------------------------------------------------- griglia


@dataclass(frozen=True)
class Grid:
    """Linee interne di una macroregione, in coordinate LOCALI (pixel)."""

    horizontal: tuple[int, ...]
    vertical: tuple[int, ...]

    @property
    def row_bands(self) -> list[tuple[int, int]]:
        return list(zip(self.horizontal, self.horizontal[1:]))

    @property
    def col_bands(self) -> list[tuple[int, int]]:
        return list(zip(self.vertical, self.vertical[1:]))

    @property
    def n_rows(self) -> int:
        return max(0, len(self.horizontal) - 1)

    @property
    def n_cols(self) -> int:
        return max(0, len(self.vertical) - 1)

    def cell(self, row: int, col: int) -> tuple[int, int, int, int]:
        """Rettangolo locale (x, y, w, h) della cella (row, col)."""

        x1, x2 = self.col_bands[col]
        y1, y2 = self.row_bands[row]
        return (x1, y1, x2 - x1, y2 - y1)

    def span(self, row: int, col_from: int, col_to: int) -> tuple[int, int, int, int]:
        """Rettangolo locale di una fascia di colonne contigue [col_from, col_to]."""

        x1 = self.col_bands[col_from][0]
        x2 = self.col_bands[col_to][1]
        y1, y2 = self.row_bands[row]
        return (x1, y1, x2 - x1, y2 - y1)


# --------------------------------------------------------------------- regioni


@dataclass
class Region:
    """Una macroregione della pagina, in pixel ASSOLUTI di pagina."""

    id: str
    kind: RegionKind
    page_index: int
    x: int
    y: int
    width: int
    height: int
    grid: Grid
    set_number: Optional[int] = None
    probe_text: str = ""
    meta: dict = field(default_factory=dict)

    def absolute(self, local: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
        lx, ly, lw, lh = local
        return (self.x + lx, self.y + ly, lw, lh)

    def normalize_local(self, local: tuple[int, int, int, int]) -> tuple[float, float, float, float]:
        """Rettangolo locale → [0,1] DENTRO la macroregione (backend §21)."""

        lx, ly, lw, lh = local
        return (lx / self.width, ly / self.height, lw / self.width, lh / self.height)


@dataclass
class FieldCell:
    """Una cella da dare in pasto all'OCR, con il suo significato già deciso."""

    id: str
    region_id: str
    role: CellRole
    expected_type: ExpectedType
    #: pixel assoluti di pagina — usati solo per ritagliare
    x: int
    y: int
    width: int
    height: int
    #: coordinate locali normalizzate dentro la macroregione (backend §21)
    local: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)
    meta: dict = field(default_factory=dict)


@dataclass
class PageLayout:
    page: RenderedPage
    regions: list[Region]
    cells: list[FieldCell]
    diagnostics: dict = field(default_factory=dict)

    def regions_of(self, kind: RegionKind) -> list[Region]:
        return [r for r in self.regions if r.kind is kind]

    def set_box(self, set_number: int) -> Optional[Region]:
        for region in self.regions:
            if region.kind is RegionKind.SET_BOX and region.set_number == set_number:
                return region
        return None

    def cells_of(self, role: CellRole) -> list[FieldCell]:
        return [c for c in self.cells if c.role is role]


# ------------------------------------------------------------------- detector


@dataclass(frozen=True)
class DetectorConfig:
    """Tutte le soglie sono FRAZIONI delle dimensioni (pagina o regione).

    Nessuna è in pixel: cambiare il dpi di rendering non cambia il risultato.
    """

    #: lunghezza minima di una linea, come frazione del lato corrispondente
    line_kernel_frac: float = 1 / 60
    #: Una linea di griglia deve superare DUE soglie: una assoluta (frazione del
    #: lato della regione) e una relativa alla linea più lunga trovata nella
    #: regione. La seconda è quella che conta: dentro un riquadro set le
    #: colonne della formazione arrivano da un bordo all'altro, mentre i
    #: separatori interni delle celle dei turni di servizio coprono solo ~4
    #: bande di riga. Senza la soglia relativa quei separatori spezzano le
    #: colonne della formazione e il gruppo di 6 celle uguali non si forma più.
    grid_line_coverage: float = 0.25
    grid_line_relative: float = 0.55
    #: linee più vicine di così vengono fuse (bordi doppi del modulo)
    line_merge_frac: float = 0.005
    #: area minima di una macroregione, frazione dell'area di pagina
    min_region_area_frac: float = 0.004
    min_region_width_frac: float = 0.04
    min_region_height_frac: float = 0.015
    #: bande di riga/colonna più sottili di così sono artefatti
    min_band_frac: float = 0.02
    #: larghezza minima di una colonna di formazione, frazione della regione
    min_formation_col_frac: float = 0.030
    #: tolleranza sull'uguaglianza delle larghezze in un gruppo di 6 colonne
    equal_width_tol: float = 0.18
    #: erosione del ritaglio di cella, per non includere le linee della griglia
    cell_inset_frac: float = 0.10
    #: frazione di pixel scuri sopra la quale una cella si considera "scritta".
    #: Una cifra stampata copre il 5-15% della cella, una cella vuota <1%.
    ink_threshold: float = 0.02
    #: quante finestre candidate al massimo si mandano all'OCR (le migliori per
    #: copertura di inchiostro): tiene limitato il costo su griglie molto fitte
    max_formation_windows: int = 6
    #: quante bande di riga scritte provare quando l'etichetta di riga non si
    #: legge. Nel modulo FIPAV il sestetto è la SECONDA riga di contenuto del
    #: riquadro set: cercarlo oltre le prime bande scritte è solo costo. È un
    #: vincolo ordinale sulla griglia, non una coordinata in pixel.
    max_fallback_rows: int = 4
    #: quante delle sei celle devono leggersi come numero di maglia valido per
    #: accettare una finestra come formazione. Backend §25.1: «ogni sestetto
    #: iniziale deve avere sei posizioni» — quindi il default è 6/6. Si scende a
    #: 5/6 solo quando la riga è stata ancorata all'etichetta stampata sul
    #: modulo, cioè quando esiste una prova indipendente dall'OCR delle cifre.
    #: Senza questo vincolo un riquadro di un set NON GIOCATO produce candidati
    #: inventati leggendo la numerazione prestampata delle colonne dei punti.
    min_valid_cells_with_label: int = 5
    min_valid_cells_without_label: int = 6
    #: confidence media minima delle celle valide di una finestra
    min_formation_confidence: float = 0.45


class LayoutDetector:
    """Individua macroregioni, griglie e celle utili su una pagina rasterizzata."""

    def __init__(
        self,
        probe: Optional[LayoutProbe] = None,
        config: Optional[DetectorConfig] = None,
    ) -> None:
        self.probe = probe
        self.config = config or DetectorConfig()

    # ------------------------------------------------------- primitive CV

    def _binarize(self, image: np.ndarray) -> np.ndarray:
        """Binarizzazione adattiva (testo/linee = bianco su nero).

        Adattiva e non Otsu globale perché le scansioni di referti hanno spesso
        un gradiente di illuminazione: una soglia unica mangia un angolo.
        """

        return cv2.adaptiveThreshold(
            image, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 25, 15
        )

    def _line_masks(self, binary: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """(maschera_orizzontale, maschera_verticale) via apertura morfologica."""

        h, w = binary.shape[:2]
        kx = max(8, int(w * self.config.line_kernel_frac))
        ky = max(8, int(h * self.config.line_kernel_frac))
        horizontal = cv2.morphologyEx(
            binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (kx, 1))
        )
        vertical = cv2.morphologyEx(
            binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, ky))
        )
        return horizontal, vertical

    @staticmethod
    def _peaks(projection: np.ndarray, threshold: float, merge_gap: int) -> tuple[int, ...]:
        """Indici dei gruppi di righe/colonne che superano `threshold`.

        Le linee del modulo sono spesse 2-5px a 300dpi (e i bordi esterni sono
        doppi): i gruppi contigui entro `merge_gap` collassano in un indice, il
        loro baricentro.
        """

        indices = np.where(projection > threshold)[0]
        if indices.size == 0:
            return ()
        groups: list[list[int]] = [[int(indices[0])]]
        for idx in indices[1:]:
            if int(idx) - groups[-1][-1] <= merge_gap:
                groups[-1].append(int(idx))
            else:
                groups.append([int(idx)])
        return tuple(int(round(float(np.mean(g)))) for g in groups)

    # ---------------------------------------------------- macroregioni

    def _macro_boxes(self, page: RenderedPage) -> list[tuple[int, int, int, int]]:
        """Rettangoli candidati a macroregione, dedotti dalla maschera di linee."""

        cfg = self.config
        h, w = page.image.shape[:2]
        binary = self._binarize(page.image)
        horizontal, vertical = self._line_masks(binary)
        # La dilatazione ricongiunge gli angoli dei rettangoli, dove le due
        # maschere non si toccano per un paio di pixel: senza di essa il
        # findContours restituisce quattro segmenti invece di un riquadro.
        grid = cv2.dilate(cv2.bitwise_or(horizontal, vertical), np.ones((3, 3), np.uint8), 2)

        contours, _ = cv2.findContours(grid, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        boxes: list[tuple[int, int, int, int]] = []
        min_area = cfg.min_region_area_frac * w * h
        for contour in contours:
            bx, by, bw, bh = cv2.boundingRect(contour)
            if bw * bh < min_area:
                continue
            if bw < cfg.min_region_width_frac * w or bh < cfg.min_region_height_frac * h:
                continue
            boxes.append((bx, by, bw, bh))

        # Dedup per contenimento: il modulo ha bordi doppi, quindi ogni riquadro
        # esce due volte (esterno e interno), e le sotto-tabelle escono dentro il
        # riquadro che le contiene.
        boxes.sort(key=lambda b: -(b[2] * b[3]))
        kept: list[tuple[int, int, int, int]] = []
        for box in boxes:
            if not any(_contained(box, other, 0.95) for other in kept):
                kept.append(box)
        # ordine di lettura: bande orizzontali, poi da sinistra a destra
        kept.sort(key=lambda b: (round(b[1] / max(1, h) * 40), b[0]))
        return kept

    def _grid_for(self, page: RenderedPage, box: tuple[int, int, int, int]) -> Grid:
        cfg = self.config
        bx, by, bw, bh = box
        sub = page.image[by : by + bh, bx : bx + bw]
        binary = self._binarize(sub)
        horizontal, vertical = self._line_masks(binary)
        h_proj = horizontal.sum(axis=1) / 255.0
        v_proj = vertical.sum(axis=0) / 255.0
        h_lines = self._peaks(
            h_proj,
            max(cfg.grid_line_coverage * bw, cfg.grid_line_relative * float(h_proj.max() or 0.0)),
            max(3, int(bh * cfg.line_merge_frac)),
        )
        v_lines = self._peaks(
            v_proj,
            max(cfg.grid_line_coverage * bh, cfg.grid_line_relative * float(v_proj.max() or 0.0)),
            max(3, int(bw * cfg.line_merge_frac)),
        )
        h_lines = _drop_thin_bands(h_lines, cfg.min_band_frac * bh)
        v_lines = _drop_thin_bands(v_lines, cfg.min_band_frac * bw)
        return Grid(horizontal=h_lines, vertical=v_lines)

    # ------------------------------------------------------ classificazione

    # NB: nessun pattern può contenere "libero" — le colonne "LIBERO / UNDER"
    # sono stampate nella fascia titolo di OGNI riquadro set, quindi userebbe
    # come indizio qualcosa che compare in tutte le regioni.
    _SET_BOX_LABELS = re.compile(r"giocator|titolar|ordine\s*di\s*serv|turni\s*di\s*serv", re.I)
    _FINAL_LABELS = re.compile(r"risultato\s*finale|durata\s*incontro|vince", re.I)
    _PLAYER_LIST_LABELS = re.compile(r"c[o0]gn[o0]me|tesserati|squadre", re.I)
    _HEADER_LABELS = re.compile(r"campionato|manifestazione|divisione", re.I)
    _SANCTIONS_LABELS = re.compile(r"sanzioni|richieste\s*improprie", re.I)
    _OBSERVATIONS_LABELS = re.compile(r"[o0]sservazi|zioni", re.I)
    _APPROVAL_LABELS = re.compile(r"appr[o0]vazi|arbitr", re.I)

    def _read(self, page: RenderedPage, rect: tuple[int, int, int, int], *, multiline: bool = False) -> str:
        if self.probe is None:
            return ""
        x, y, w, h = rect
        if w <= 2 or h <= 2:
            return ""
        try:
            return self.probe.read_text(page.crop(x, y, w, h), multiline=multiline)
        except Exception:  # pragma: no cover - un OCR fallito non deve fermare il layout
            return ""

    def _classify(self, page: RenderedPage, region: Region) -> None:
        """Assegna `kind` guardando il TESTO stampato sul modulo, non la posizione.

        Le tre sonde (colonna etichette di riga, prima banda di riga, intera
        prima colonna) sono piccole: qualche ritaglio, non la pagina — coerente
        con backend §20.
        """

        grid = region.grid
        probes: list[str] = []
        if grid.n_rows >= 1 and grid.n_cols >= 1:
            # 1) prima banda di riga per tutta la larghezza: è la fascia titolo
            #    ("RISULTATO FINALE", "N° Cognome e Nome", "CAMPIONATO SERIE …")
            top = grid.span(0, 0, grid.n_cols - 1)
            probes.append(self._read(page, region.absolute(_inset(top, self.config.cell_inset_frac))))
            # 2) colonna delle etichette di riga (la prima), tutta l'altezza:
            #    nei riquadri set contiene "Ordine di servizio / Giocatori titolari N°"
            if grid.n_rows >= 2:
                label_cols = min(2, grid.n_cols)
                x1 = grid.vertical[0]
                x2 = grid.vertical[label_cols]
                y1 = grid.horizontal[0]
                y2 = grid.horizontal[-1]
                probes.append(
                    self._read(page, region.absolute((x1, y1, x2 - x1, y2 - y1)), multiline=True)
                )
        text = " | ".join(p for p in probes if p)
        region.probe_text = text

        # L'ordine conta: i pattern più specifici prima. "APPROVAZIONE" contiene
        # anche "Cognome e Nome" (i nomi degli arbitri) e quasi tutti i riquadri
        # contengono qualche parola che finisce in "-zioni", quindi il pattern
        # più permissivo (OBSERVATIONS) va valutato per ultimo.
        for pattern, kind in (
            (self._SET_BOX_LABELS, RegionKind.SET_BOX),
            (self._FINAL_LABELS, RegionKind.FINAL_RESULT),
            (self._SANCTIONS_LABELS, RegionKind.SANCTIONS),
            (self._APPROVAL_LABELS, RegionKind.APPROVAL),
            # MATCH_HEADER prima di PLAYER_LIST: l'header contiene la parola
            # "SQUADRE" (indizio dell'elenco giocatori) accanto ai nomi delle
            # due squadre, mentre "CAMPIONATO"/"MANIFESTAZIONE" stanno solo lì.
            (self._HEADER_LABELS, RegionKind.MATCH_HEADER),
            (self._PLAYER_LIST_LABELS, RegionKind.PLAYER_LIST),
            (self._OBSERVATIONS_LABELS, RegionKind.OBSERVATIONS),
        ):
            if pattern.search(text):
                region.kind = kind
                break
        else:
            region.kind = self._classify_geometric(page, region)
            return

        # Una regione con la forma di griglia inequivocabile di un riquadro set
        # vince su un match testuale debole: le colonne "LIBERO / UNDER" e i nomi
        # squadra stampati nella fascia titolo generano falsi positivi.
        if region.kind is not RegionKind.SET_BOX and self._looks_like_set_box(region):
            region.kind = RegionKind.SET_BOX

    def _looks_like_set_box(self, region: Region) -> bool:
        """Firma geometrica di un riquadro set: ~10 bande di riga, ≥12 di colonna
        e almeno due gruppi di 6 colonne uguali (le due formazioni)."""

        grid = region.grid
        if grid.n_rows < 8 or grid.n_cols < 12:
            return False
        return len(self._formation_windows(region)) >= 2

    def _classify_geometric(self, page: RenderedPage, region: Region) -> RegionKind:
        """Ripiego senza OCR: la forma della griglia è già molto informativa."""

        if self._looks_like_set_box(region):
            return RegionKind.SET_BOX
        if region.y < 0.12 * page.height and region.grid.n_rows <= 5:
            return RegionKind.MATCH_HEADER
        return RegionKind.UNKNOWN

    # --------------------------------------------------- numero del set

    _SET_LABEL_RE = re.compile(r"S\W*E\W*T\W*([1-5])", re.I)

    def _detect_set_number(self, page: RenderedPage, region: Region) -> Optional[int]:
        """Legge il numero stampato nella colonna grigia "SET" del riquadro.

        È l'identificazione più affidabile perché sta dentro il riquadro stesso:
        non dipende da quale posizione occupa il riquadro sulla pagina, quindi
        regge anche layout con i set disposti diversamente.
        """

        grid = region.grid
        if grid.n_cols == 0 or grid.n_rows < 2:
            return None
        # La colonna "SET" è grigia: cercala fra le prime colonne come quella con
        # intensità media più bassa (il grigio è più scuro del bianco della carta
        # ma non nero come le colonne tratteggiate).
        y1, y2 = grid.horizontal[1], grid.horizontal[-1]
        best: tuple[float, int] | None = None
        for col in range(min(6, grid.n_cols)):
            x1, x2 = grid.col_bands[col]
            patch = page.crop(region.x + x1, region.y + y1, x2 - x1, y2 - y1, pad=-3)
            if patch.size == 0:
                continue
            mean = float(np.mean(patch))
            if 90.0 < mean < 215.0 and (best is None or mean < best[0]):
                best = (mean, col)
        if best is None:
            return None
        col = best[1]
        x1, x2 = grid.col_bands[col]
        text = self._read(
            page,
            region.absolute((x1, y1, x2 - x1, y2 - y1)),
            multiline=True,
        )
        match = self._SET_LABEL_RE.search(text.replace("\n", " "))
        if match:
            return int(match.group(1))
        # Se "SET" non si legge, accetta comunque una cifra 1-5 isolata.
        digits = re.findall(r"[1-5]", text)
        if len(digits) == 1:
            return int(digits[0])
        return None

    # ------------------------------------------- colonne della formazione

    def _formation_windows(self, region: Region) -> list[tuple[int, int]]:
        """Candidati gruppi di 6 colonne contigue e di larghezza uguale.

        Le posizioni I-VI di una formazione sono sei celle uguali affiancate. Il
        problema è che sul referto anche le colonne "LIBERO"/"UNDER" hanno la
        stessa larghezza e sono adiacenti alla formazione di destra: la geometria
        da sola produce quindi run di 7-8 colonne. Non si indovina qui — si
        restituiscono TUTTE le finestre plausibili e si lascia decidere all'OCR
        (`resolve_formations`), che sa quali celle contengono numeri di maglia.
        """

        cfg = self.config
        bands = region.grid.col_bands
        min_w = cfg.min_formation_col_frac * region.width
        widths = [b[1] - b[0] for b in bands]

        runs: list[list[int]] = []
        current: list[int] = []
        for i, width in enumerate(widths):
            if width < min_w:
                current = []
                continue
            if current:
                reference = float(np.median([widths[j] for j in current]))
                if abs(width - reference) > cfg.equal_width_tol * reference:
                    runs.append(current)
                    current = [i]
                    continue
            current.append(i)
        if current:
            runs.append(current)
        runs = [r for r in runs if len(r) >= 6]

        windows: list[tuple[int, int]] = []
        for run in runs:
            for start in range(0, len(run) - 5):
                windows.append((run[start], run[start + 5]))
        return windows

    def _ink_map(self, page: RenderedPage, region: Region) -> np.ndarray:
        """Matrice (righe × colonne) della frazione di pixel scuri per cella.

        Puro numpy, nessun OCR: è la mappa di "dove c'è qualcosa scritto" e serve
        a scartare in anticipo le celle vuote.
        """

        grid = region.grid
        ink = np.zeros((grid.n_rows, grid.n_cols), dtype=np.float32)
        for row in range(grid.n_rows):
            for col in range(grid.n_cols):
                rect = region.absolute(_inset(grid.cell(row, col), self.config.cell_inset_frac))
                patch = page.crop(*rect)
                if patch.size:
                    ink[row, col] = float(np.count_nonzero(patch < 128)) / patch.size
        return ink

    def _filter_windows_by_ink(
        self,
        page: RenderedPage,
        region: Region,
        windows: list[tuple[int, int]],
    ) -> tuple[list[tuple[int, int]], list[int]]:
        """Tiene le finestre che in ALMENO una banda di riga hanno 6 celle scritte.

        Restituisce anche l'elenco delle righe candidate, così la ricerca della
        riga del sestetto non deve provare tutte le bande.
        """

        cfg = self.config
        ink = self._ink_map(page, region)
        written = ink >= cfg.ink_threshold
        scored: list[tuple[float, tuple[int, int]]] = []
        rows: set[int] = set()
        for window in windows:
            cols = slice(window[0], window[1] + 1)
            per_row = written[:, cols].sum(axis=1)
            best = int(per_row.max()) if per_row.size else 0
            if best < 6:
                continue
            for row in np.where(per_row >= 6)[0]:
                rows.add(int(row))
            # a parità di copertura preferisci la finestra con più inchiostro:
            # una cella con un numero stampato è più "piena" di una cella con
            # solo dei due punti o un trattino
            scored.append((float(ink[:, cols].max(axis=1).sum()), window))
        scored.sort(key=lambda t: -t[0])
        kept = [w for _s, w in scored[: cfg.max_formation_windows]]
        return kept, sorted(rows)

    def _label_row(self, page: RenderedPage, region: Region, pattern: re.Pattern[str]) -> Optional[int]:
        """Indice di banda di riga la cui etichetta (colonne di sinistra) matcha.

        È l'ancoraggio "semantico" della riga: sul referto ogni riga della
        formazione ha la sua etichetta stampata a sinistra, ed è quella che
        rende inutile sapere *dove* si trova la riga in pixel.
        """

        grid = region.grid
        if grid.n_cols == 0:
            return None
        windows = self._formation_windows(region)
        first_formation_col = min((w[0] for w in windows), default=grid.n_cols)
        label_cols = max(1, min(first_formation_col, grid.n_cols))
        x1 = grid.vertical[0]
        x2 = grid.vertical[label_cols]
        for row in range(grid.n_rows):
            y1, y2 = grid.row_bands[row]
            text = self._read(page, region.absolute((x1, y1, x2 - x1, y2 - y1)))
            if text and pattern.search(text):
                return row
        return None

    # ------------------------------------------------------------- API

    def detect(self, page: RenderedPage) -> PageLayout:
        """Macroregioni + griglie + classificazione. Non produce ancora celle."""

        regions: list[Region] = []
        for index, box in enumerate(self._macro_boxes(page)):
            bx, by, bw, bh = box
            region = Region(
                id=f"p{page.page_index + 1}-r{index:02d}",
                kind=RegionKind.UNKNOWN,
                page_index=page.page_index,
                x=bx,
                y=by,
                width=bw,
                height=bh,
                grid=self._grid_for(page, box),
            )
            self._classify(page, region)
            regions.append(region)

        set_boxes = [r for r in regions if r.kind is RegionKind.SET_BOX]
        detected = [self._detect_set_number(page, r) for r in set_boxes]
        # La cifra letta nella colonna grigia "SET" è l'identificazione migliore
        # perché sta dentro il riquadro. Ma se due riquadri leggono lo stesso
        # numero, o se manca qualche lettura, la numerazione OCR è inaffidabile e
        # si ripiega in blocco sull'ordine di lettura (bande dall'alto, poi da
        # sinistra a destra) — che resta una regola strutturale, non un pixel.
        readable = [d for d in detected if d is not None]
        use_ocr = len(readable) == len(set_boxes) and len(set(readable)) == len(readable)
        for order, (region, number) in enumerate(zip(set_boxes, detected), start=1):
            region.set_number = number if use_ocr else order
            region.meta["set_number_source"] = "ocr" if use_ocr else "reading_order"
            region.meta["set_number_ocr"] = number
            region.id = f"p{page.page_index + 1}-set{region.set_number}"

        # Rinomina le regioni riconosciute con id parlanti e stabili.
        for region in regions:
            if region.kind is RegionKind.SET_BOX:
                continue
            region.id = f"p{page.page_index + 1}-{region.kind.value.lower()}"

        diagnostics = {
            "n_regions": len(regions),
            "kinds": {k.value: sum(1 for r in regions if r.kind is k) for k in RegionKind},
            "probe_available": self.probe is not None,
        }
        return PageLayout(page=page, regions=regions, cells=[], diagnostics=diagnostics)

    # ------------------------------------------- celle: sestetto iniziale

    _STARTING_SIX_LABEL = re.compile(r"giocator|titolar", re.I)

    def starting_six_cells(
        self,
        page: RenderedPage,
        region: Region,
        *,
        validator,
        cell_reader,
    ) -> list[FieldCell]:
        """Celle del sestetto iniziale di un riquadro set.

        `cell_reader(image) -> (value, confidence)` legge una cella come numero
        di maglia; `validator(value) -> bool` dice se il valore è plausibile.
        Sono iniettati perché la scelta della riga e delle colonne *è* un
        problema di riconoscimento: la geometria propone, l'OCR conferma.

        Procedura:
          1. la riga si trova per etichetta ("Giocatori titolari N°"); se
             l'etichetta non si legge, si ripiega sulla prima banda di riga in
             cui una finestra di 6 colonne dà 6 numeri di maglia validi;
          2. fra le finestre di 6 colonne candidate si tengono le due migliori
             disgiunte, ordinate da sinistra a destra ⇒ formazione A e B.
        """

        grid = region.grid
        if grid.n_rows < 2 or grid.n_cols < 6:
            return []
        windows = self._formation_windows(region)
        if not windows:
            return []

        # Prefiltro senza OCR: una finestra della formazione ha sei celle SCRITTE
        # nella riga del sestetto. Serve a due cose: eliminare le finestre
        # impossibili prima di spendere Tesseract, e riconoscere subito un
        # riquadro set non giocato (nel referto di esempio il set 5 è vuoto e
        # senza questo filtro costerebbe ~400 invocazioni di Tesseract per nulla).
        windows, ink_rows = self._filter_windows_by_ink(page, region, windows)
        if not windows:
            region.meta["starting_six"] = "no_ink"
            return []

        def score(row: int, window: tuple[int, int]) -> tuple[int, float]:
            """(numero di celle lette come numero di maglia, confidence media)."""

            readings: list[tuple[str, float]] = []
            for col in range(window[0], window[1] + 1):
                rect = region.absolute(_inset(grid.cell(row, col), self.config.cell_inset_frac))
                readings.append(cell_reader(page.crop(*rect)))
            valid = [(v, c) for v, c in readings if v and validator(v)]
            if not valid:
                return 0, 0.0
            return len(valid), float(np.mean([c for _v, c in valid]))

        row = self._label_row(page, region, self._STARTING_SIX_LABEL)
        row_source = "label"
        if row is not None and row not in ink_rows:
            # L'etichetta si è letta ma quella riga non ha sei celle scritte:
            # è più probabile che l'etichetta sia scivolata di una banda che il
            # contrario, quindi si torna al criterio numerico.
            row = None
        min_valid = (
            self.config.min_valid_cells_with_label
            if row is not None
            else self.config.min_valid_cells_without_label
        )
        if row is None:
            row_source = "numeric_fallback"
            best_row: tuple[tuple[int, float], int] | None = None
            for candidate_row in ink_rows[: self.config.max_fallback_rows]:
                best_here = max((score(candidate_row, w) for w in windows), default=(0, 0.0))
                if best_here[0] >= min_valid and best_here[1] >= self.config.min_formation_confidence:
                    best_row = (best_here, candidate_row)
                    break
                if best_row is None or best_here > best_row[0]:
                    best_row = (best_here, candidate_row)
            if best_row is None:
                return []
            row = best_row[1]

        scored = sorted(((score(row, w), w) for w in windows), key=lambda t: (-t[0][0], -t[0][1]))
        chosen: list[tuple[int, int]] = []
        for (valid, confidence), window in scored:
            if valid < min_valid or confidence < self.config.min_formation_confidence:
                continue
            if any(not (window[1] < c[0] or window[0] > c[1]) for c in chosen):
                continue  # sovrapposta a una già scelta
            chosen.append(window)
            if len(chosen) == 2:
                break
        if not chosen:
            region.meta["starting_six"] = "no_window_met_threshold"
            return []
        chosen.sort(key=lambda w: w[0])

        cells: list[FieldCell] = []
        for slot, window in zip((TeamSlot.A, TeamSlot.B), chosen):
            # memorizzata per `team_name_cells`: il nome squadra sta nella fascia
            # titolo, esattamente sopra le sei colonne della sua formazione.
            region.meta[f"formation_window_{slot.value}"] = list(window)
            region.meta["starting_six_row"] = row
            region.meta["starting_six_row_source"] = row_source
            for offset, position in enumerate(ROTATION_POSITIONS):
                col = window[0] + offset
                local = _inset(grid.cell(row, col), self.config.cell_inset_frac)
                ax, ay, aw, ah = region.absolute(local)
                cells.append(
                    FieldCell(
                        id=f"{region.id}-formation-{slot.value.lower()}-{position}",
                        region_id=region.id,
                        role=CellRole.STARTING_SIX,
                        expected_type=ExpectedType.PLAYER_NUMBER,
                        x=ax,
                        y=ay,
                        width=aw,
                        height=ah,
                        local=region.normalize_local(local),
                        meta={
                            "set_number": region.set_number,
                            "team_slot": slot.value,
                            "position": position,
                            "grid_row": row,
                            "grid_col": col,
                            "row_source": row_source,
                        },
                    )
                )
        return cells

    def _band_verticals(self, page: RenderedPage, region: Region, row: int) -> tuple[int, ...]:
        """Linee verticali presenti SOLO dentro una banda di riga.

        La fascia titolo del riquadro set ha una suddivisione in celle propria
        (`INIZIO | SQ. <squadra> | PUNTI | LIBERO / UNDER | …`) che non coincide
        con le colonne delle righe sottostanti: quelle linee sono corte e la
        detection di griglia della regione le scarta. Qui si ri-cercano nella
        sola banda, così il nome squadra si può ritagliare sulla SUA cella.
        """

        y1, y2 = region.grid.row_bands[row]
        sub = page.crop(region.x, region.y + y1, region.width, y2 - y1)
        if sub.size == 0:
            return ()
        binary = self._binarize(sub)
        height = sub.shape[0]
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(6, int(height * 0.5))))
        vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        projection = vertical.sum(axis=0) / 255.0
        lines = self._peaks(
            projection,
            0.55 * height,
            max(3, int(region.width * self.config.line_merge_frac)),
        )
        return lines

    def team_name_cells(self, page: RenderedPage, region: Region) -> list[FieldCell]:
        """Celle dei nomi squadra nella fascia titolo del riquadro set.

        Il nome squadra è nella cella della fascia titolo che si sovrappone di più
        alle sei colonne della sua formazione. Resta un ritaglio *rumoroso*: la
        cella contiene anche l'etichetta "SQ." e il cerchietto A/B stampati
        accanto al nome, e l'OCR li restituisce. La pulizia (in
        `pipeline._clean_candidates`) è lessicale, non semantica: qui non si
        finge una precisione che non c'è.
        """

        grid = region.grid
        if grid.n_rows < 1:
            return []
        band_lines = self._band_verticals(page, region, 0)
        cells: list[FieldCell] = []
        for slot in (TeamSlot.A, TeamSlot.B):
            window = region.meta.get(f"formation_window_{slot.value}")
            if window is None:
                continue
            x1 = grid.vertical[window[0]]
            x2 = grid.vertical[window[1] + 1]
            header_rect = _best_overlap_band(band_lines, x1, x2)
            if header_rect is None:
                header_rect = (x1, x2)
            y1, y2 = grid.row_bands[0]
            local = _inset(
                (header_rect[0], y1, header_rect[1] - header_rect[0], y2 - y1),
                self.config.cell_inset_frac,
            )
            ax, ay, aw, ah = region.absolute(local)
            cells.append(
                FieldCell(
                    id=f"{region.id}-team-{slot.value.lower()}",
                    region_id=region.id,
                    role=CellRole.TEAM_NAME,
                    expected_type=ExpectedType.TEAM_NAME,
                    x=ax,
                    y=ay,
                    width=aw,
                    height=ah,
                    local=region.normalize_local(local),
                    meta={"set_number": region.set_number, "team_slot": slot.value},
                )
            )
        return cells

    # -------------------------------------------- celle: risultato finale

    def set_score_cells(
        self,
        page: RenderedPage,
        region: Region,
        *,
        digit_reader,
    ) -> list[FieldCell]:
        """Celle dei punteggi di set nella tabella "RISULTATO FINALE".

        Struttura del riquadro: `"T" S V P | SET  minuti | P V S "T"`. La colonna
        centrale (numero del set + durata) è nettamente la più larga: la si trova
        come massimo delle larghezze, e le due colonne dei punti sono quelle
        immediatamente a sinistra e a destra. Le righe si identificano leggendo la
        cifra del set nella colonna centrale, non contandole dall'alto.
        """

        grid = region.grid
        if grid.n_cols < 3 or grid.n_rows < 2:
            return []
        widths = [b[1] - b[0] for b in grid.col_bands]
        center = int(np.argmax(widths))
        if center == 0 or center == len(widths) - 1:
            return []
        left_col, right_col = center - 1, center + 1

        cells: list[FieldCell] = []
        for row in range(grid.n_rows):
            cx, cy, cw, ch = grid.cell(row, center)
            # la cifra del set sta nel primo terzo della colonna centrale
            probe_rect = region.absolute(
                _inset((cx, cy, max(4, int(cw * 0.30)), ch), self.config.cell_inset_frac)
            )
            value, _conf = digit_reader(page.crop(*probe_rect))
            if not value or not value.isdigit() or not 1 <= int(value) <= 5:
                continue
            set_number = int(value)
            for slot, col in ((TeamSlot.A, left_col), (TeamSlot.B, right_col)):
                local = _inset(grid.cell(row, col), self.config.cell_inset_frac)
                ax, ay, aw, ah = region.absolute(local)
                cells.append(
                    FieldCell(
                        id=f"{region.id}-set{set_number}-score-{slot.value.lower()}",
                        region_id=region.id,
                        role=CellRole.SET_SCORE,
                        expected_type=ExpectedType.SCORE,
                        x=ax,
                        y=ay,
                        width=aw,
                        height=ah,
                        local=region.normalize_local(local),
                        meta={
                            "set_number": set_number,
                            "team_slot": slot.value,
                            "grid_row": row,
                            "grid_col": col,
                        },
                    )
                )
        return cells


# ------------------------------------------------------------------ helpers


def _contained(inner: tuple[int, int, int, int], outer: tuple[int, int, int, int], frac: float) -> bool:
    """True se almeno `frac` dell'area di `inner` cade dentro `outer`."""

    ix, iy, iw, ih = inner
    ox, oy, ow, oh = outer
    x1 = max(ix, ox)
    y1 = max(iy, oy)
    x2 = min(ix + iw, ox + ow)
    y2 = min(iy + ih, oy + oh)
    if x2 <= x1 or y2 <= y1:
        return False
    return ((x2 - x1) * (y2 - y1)) >= frac * (iw * ih)


def _drop_thin_bands(lines: Sequence[int], min_size: float) -> tuple[int, ...]:
    """Elimina le linee che creerebbero bande più sottili di `min_size`.

    Conserva sempre la prima e l'ultima (i bordi della regione).
    """

    if len(lines) < 3:
        return tuple(lines)
    kept = [lines[0]]
    for value in lines[1:-1]:
        if value - kept[-1] >= min_size:
            kept.append(value)
    if lines[-1] - kept[-1] >= min_size:
        kept.append(lines[-1])
    else:
        kept[-1] = lines[-1]
    return tuple(kept)


def _best_overlap_band(lines: Sequence[int], x1: int, x2: int) -> Optional[tuple[int, int]]:
    """Fra le bande delimitate da `lines`, quella che si sovrappone più a [x1,x2]."""

    best: tuple[int, tuple[int, int]] | None = None
    for a, b in zip(lines, lines[1:]):
        overlap = min(b, x2) - max(a, x1)
        if overlap > 0 and (best is None or overlap > best[0]):
            best = (overlap, (a, b))
    return best[1] if best else None


def _inset(rect: tuple[int, int, int, int], frac: float) -> tuple[int, int, int, int]:
    """Restringe un rettangolo di `frac` per lato, per escludere le linee.

    Le linee della griglia dentro il ritaglio sono la prima causa di
    allucinazioni dell'OCR su celle piccole ("|" letto come "1").
    """

    x, y, w, h = rect
    dx = max(2, int(w * frac))
    dy = max(2, int(h * frac))
    nw = max(1, w - 2 * dx)
    nh = max(1, h - 2 * dy)
    return (x + dx, y + dy, nw, nh)
