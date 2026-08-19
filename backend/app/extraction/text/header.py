"""Estrazione dal text layer di ciò che sta FUORI dai riquadri set: nomi delle
squadre, metadati della partita e punteggi di set (backend §19, §21).

`generic.py` copre i riquadri set (sestetti titolari). Questo modulo copre il
resto della pagina, che serve per costruire l'`Analysis` pubblica:

- **nomi squadra** dalla fascia "SQUADRE" dell'header pagina, ancorati ai due
  marcatori "A" e "B" stampati sul modulo (il nome di A è la prima parola-run a
  destra del marcatore A, quello di B l'ultima run a sinistra del marcatore B).
  Questo esclude automaticamente la firma del software di compilazione, che sta
  oltre il marcatore B;
- **punteggi di set** dalla tabella "RISULTATO FINALE", le cui colonne sono
  identificate leggendo l'intestazione stampata (`"T" S V P | SET minuti | P V S
  "T"`) e non da coordinate assolute: si prendono i centri x delle due colonne
  `P` e della colonna `SET`, e ogni riga di set si aggancia a quei centri;
- **metadati** (campionato, numero gara, luogo, data, ora) con la stessa
  tecnica: si trova l'etichetta stampata, si delimita la sua colonna fino
  all'inizio dell'etichetta successiva sulla stessa riga, e si legge il valore
  nella banda di testo immediatamente sotto, filtrato per forma attesa.

Regola non negoziabile: **qualunque lettura non univoca produce `None`**. Un
campo vuoto è un'informazione corretta ("non estratto"), un campo riempito a
indovinare è un bug (backend §25, ultima riga).

Le confidence non sono "qualità OCR" — qui non c'è OCR, i caratteri sono quelli
del PDF. Rappresentano la fiducia nell'*ancoraggio geometrico*: alta, ma non 1.0,
perché l'associazione etichetta→valore resta un'euristica di layout.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import pymupdf
from pydantic import BaseModel

from app.models.common import ExtractionMethod, SourceRegion

#: Fiducia nell'ancoraggio dei nomi squadra ai marcatori A/B della fascia header.
TEAM_NAME_CONFIDENCE = 0.92
#: Fiducia nell'ancoraggio dei punteggi alle colonne `P` di "RISULTATO FINALE".
SET_SCORE_CONFIDENCE = 0.95

#: Due token la cui y0 differisce di meno di così stanno sulla stessa riga.
_ROW_BAND_TOLERANCE = 3.0
#: Distanza verticale massima fra la cifra del set e la sua riga di punteggi.
#: Deve restare sotto la metà del passo verticale fra due righe di set.
_SET_ROW_TOLERANCE = 8.0
#: Distanza orizzontale massima ammessa fra il centro di un valore e il centro
#: della colonna a cui lo si aggancia, quando le colonne sono molto ravvicinate.
_MIN_COLUMN_TOLERANCE = 3.0
_MAX_COLUMN_TOLERANCE = 10.0
#: Spazio oltre il quale due parole della stessa riga appartengono a celle diverse.
_RUN_GAP = 12.0
#: Altezza della banda di testo sotto un'etichetta in cui cercarne il valore.
_VALUE_BAND_HEIGHT = 12.0

_DIGITS_RE = re.compile(r"^\d{1,6}$")
_ALPHA_RE = re.compile(r"^[A-Za-zÀ-ÿ'.]{2,}$")
_DATE_RE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")
_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")

_Word = tuple


def _text(word: _Word) -> str:
    return word[4]


def _center_x(word: _Word) -> float:
    return (word[0] + word[2]) / 2.0


# ---------------------------------------------------------------------------
# Modelli di risultato (interni al backend, non contratto pubblico)
# ---------------------------------------------------------------------------


class TeamNameReading(BaseModel):
    """Nome squadra letto dall'header, con lo slot (A/B) del modulo."""

    slot: str
    value: str
    confidence: float
    region: SourceRegion


class SetScoreReading(BaseModel):
    """Punteggio di un set dalla tabella "RISULTATO FINALE", in ordine A/B."""

    set_number: int
    score_a: int
    score_b: int
    confidence: float
    region_a: SourceRegion
    region_b: SourceRegion


class MatchMetaReading(BaseModel):
    """Metadati della partita. Ogni campo è `None` se non letto senza ambiguità."""

    competition: Optional[str] = None
    match_number: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    venue: Optional[str] = None


class HeaderExtractionResult(BaseModel):
    team_names: list[TeamNameReading] = []
    set_scores: list[SetScoreReading] = []
    meta: MatchMetaReading = MatchMetaReading()
    regions: list[SourceRegion] = []

    def team_name(self, slot: str) -> Optional[TeamNameReading]:
        for reading in self.team_names:
            if reading.slot == slot:
                return reading
        return None

    def set_score(self, set_number: int) -> Optional[SetScoreReading]:
        for reading in self.set_scores:
            if reading.set_number == set_number:
                return reading
        return None


# ---------------------------------------------------------------------------
# Primitive geometriche
# ---------------------------------------------------------------------------


def _row_band(words: list[_Word], reference: _Word) -> list[_Word]:
    """Tutti i token la cui y0 sta entro la tolleranza di riga da `reference`."""

    band = [w for w in words if abs(w[1] - reference[1]) <= _ROW_BAND_TOLERANCE]
    band.sort(key=lambda w: w[0])
    return band


def _runs(band: list[_Word], max_gap: float = _RUN_GAP) -> list[list[_Word]]:
    """Spezza una riga in gruppi separati da uno spazio maggiore di `max_gap`."""

    groups: list[list[_Word]] = []
    for word in sorted(band, key=lambda w: w[0]):
        if groups and word[0] - groups[-1][-1][2] <= max_gap:
            groups[-1].append(word)
        else:
            groups.append([word])
    return groups


def _column_tolerance(centers: list[float]) -> float:
    """Metà della distanza minima fra due colonne adiacenti dell'intestazione."""

    ordered = sorted(centers)
    gaps = [b - a for a, b in zip(ordered, ordered[1:]) if b - a > 0.5]
    if not gaps:
        return _MAX_COLUMN_TOLERANCE
    return max(_MIN_COLUMN_TOLERANCE, min(_MAX_COLUMN_TOLERANCE, min(gaps) / 2.0))


def _region_for(
    words: list[_Word],
    *,
    region_id: str,
    page_index: int,
    page_width: float,
    page_height: float,
    region_type: str,
) -> SourceRegion:
    """SourceRegion normalizzata [0,1] che racchiude i token dati (backend §9)."""

    x0 = min(w[0] for w in words)
    y0 = min(w[1] for w in words)
    x1 = max(w[2] for w in words)
    y1 = max(w[3] for w in words)

    def clamp(value: float) -> float:
        return min(1.0, max(0.0, value))

    return SourceRegion(
        id=region_id,
        page=page_index + 1,
        x=round(clamp(x0 / page_width), 6),
        y=round(clamp(y0 / page_height), 6),
        width=round(clamp((x1 - x0) / page_width), 6),
        height=round(clamp((y1 - y0) / page_height), 6),
        method=ExtractionMethod.PDF_TEXT,
        region_type=region_type,
        raw_text=" ".join(_text(w) for w in sorted(words, key=lambda w: w[0])),
    )


# ---------------------------------------------------------------------------
# Nomi squadra
# ---------------------------------------------------------------------------


def _extract_team_names(
    words: list[_Word], page_index: int, page_width: float, page_height: float
) -> tuple[list[TeamNameReading], list[SourceRegion]]:
    """Nomi squadra dalla fascia "SQUADRE" più in alto della pagina.

    Il modulo stampa i marcatori "A" e "B" ai due estremi della fascia; i nomi
    stanno nella banda di testo immediatamente sotto l'etichetta "SQUADRE".
    Ancorare ai marcatori invece di dividere la pagina a metà è ciò che permette
    di scartare la firma del software di compilazione, che sta oltre "B".
    """

    labels = sorted(
        (w for w in words if _text(w).strip().upper() == "SQUADRE"), key=lambda w: w[1]
    )
    for label in labels:
        band = _row_band(words, label)
        marker_a = next((w for w in band if _text(w).strip() == "A"), None)
        marker_b = next((w for w in band if _text(w).strip() == "B"), None)
        if marker_a is None or marker_b is None or marker_a[0] >= marker_b[0]:
            continue

        value_band = [
            w
            for w in words
            if label[1] < w[1] <= label[1] + _VALUE_BAND_HEIGHT
            and w is not marker_a
            and w is not marker_b
            and _text(w).strip() not in ("A", "B")
        ]
        groups = _runs(value_band)
        after_a = [g for g in groups if g[0][0] >= marker_a[2]]
        before_b = [g for g in groups if g[-1][2] <= marker_b[0]]
        if not after_a or not before_b:
            continue
        group_a = min(after_a, key=lambda g: g[0][0])
        group_b = max(before_b, key=lambda g: g[-1][2])
        if group_a is group_b:
            continue

        readings: list[TeamNameReading] = []
        regions: list[SourceRegion] = []
        for slot, group in (("A", group_a), ("B", group_b)):
            region = _region_for(
                group,
                region_id=f"region-p{page_index}-header-team-{slot.lower()}",
                page_index=page_index,
                page_width=page_width,
                page_height=page_height,
                region_type="team_name",
            )
            regions.append(region)
            readings.append(
                TeamNameReading(
                    slot=slot,
                    value=" ".join(_text(w) for w in group).strip(),
                    confidence=TEAM_NAME_CONFIDENCE,
                    region=region,
                )
            )
        return readings, regions

    return [], []


# ---------------------------------------------------------------------------
# Punteggi di set dalla tabella "RISULTATO FINALE"
# ---------------------------------------------------------------------------


def _find_result_header(words: list[_Word]) -> Optional[tuple[_Word, _Word, _Word, list[_Word]]]:
    """Intestazione della tabella dei punteggi: `"T" S V P | SET | P V S "T"`.

    Ritorna `(parola SET, colonna P sinistra, colonna P destra, banda)`. Il
    riconoscimento richiede la firma completa (due `P`, due `V`, due `S` attorno
    a `SET`) per non agganciarsi ad altre righe della pagina che contengono la
    parola "SET" o una "P" isolata.
    """

    for candidate in sorted((w for w in words if _text(w).strip().upper() == "SET"), key=lambda w: w[1]):
        band = _row_band(words, candidate)
        letters = {
            letter: sorted(
                (w for w in band if _text(w).strip().upper() == letter), key=lambda w: w[0]
            )
            for letter in ("P", "V", "S")
        }
        if any(len(found) < 2 for found in letters.values()):
            continue
        p_left, p_right = letters["P"][0], letters["P"][-1]
        if not (p_left[0] < candidate[0] < p_right[0]):
            continue
        return candidate, p_left, p_right, band
    return None


def _extract_set_scores(
    words: list[_Word], page_index: int, page_width: float, page_height: float
) -> tuple[list[SetScoreReading], list[SourceRegion]]:
    header = _find_result_header(words)
    if header is None:
        return [], []
    set_word, p_left, p_right, band = header

    tolerance = _column_tolerance([_center_x(w) for w in band])
    set_center = _center_x(set_word)
    left_center = _center_x(p_left)
    right_center = _center_x(p_right)
    below = [w for w in words if w[1] > set_word[3]]

    def value_at(column_center: float, reference: _Word) -> list[_Word]:
        return [
            w
            for w in below
            if _text(w).strip().isdigit()
            and abs(_center_x(w) - column_center) <= tolerance
            and abs(w[1] - reference[1]) <= _SET_ROW_TOLERANCE
        ]

    found: dict[int, Optional[SetScoreReading]] = {}
    regions: list[SourceRegion] = []
    for word in below:
        raw = _text(word).strip()
        if not raw.isdigit() or not 1 <= int(raw) <= 5:
            continue
        if abs(_center_x(word) - set_center) > tolerance:
            continue
        set_number = int(raw)
        left = value_at(left_center, word)
        right = value_at(right_center, word)
        if len(left) != 1 or len(right) != 1:
            continue
        if set_number in found:
            # Due righe rivendicano lo stesso set: la lettura non è univoca,
            # meglio nessun punteggio che uno scelto a caso.
            found[set_number] = None
            continue
        region_a = _region_for(
            left,
            region_id=f"region-p{page_index}-final-set{set_number}-score-a",
            page_index=page_index,
            page_width=page_width,
            page_height=page_height,
            region_type="set_score",
        )
        region_b = _region_for(
            right,
            region_id=f"region-p{page_index}-final-set{set_number}-score-b",
            page_index=page_index,
            page_width=page_width,
            page_height=page_height,
            region_type="set_score",
        )
        regions.extend([region_a, region_b])
        found[set_number] = SetScoreReading(
            set_number=set_number,
            score_a=int(_text(left[0])),
            score_b=int(_text(right[0])),
            confidence=SET_SCORE_CONFIDENCE,
            region_a=region_a,
            region_b=region_b,
        )

    readings = [reading for _n, reading in sorted(found.items()) if reading is not None]
    kept_ids = {r.region_a.id for r in readings} | {r.region_b.id for r in readings}
    return readings, [region for region in regions if region.id in kept_ids]


# ---------------------------------------------------------------------------
# Metadati della partita
# ---------------------------------------------------------------------------


def _label_column(words: list[_Word], label: str) -> Optional[tuple[float, float, float]]:
    """`(x_inizio, x_fine, y_etichetta)` della colonna di una etichetta stampata.

    La colonna finisce dove inizia l'etichetta successiva sulla stessa riga:
    è una regola strutturale sul modulo, non una coordinata.
    """

    target = next(
        (w for w in sorted(words, key=lambda w: (w[1], w[0])) if _text(w).strip().upper() == label),
        None,
    )
    if target is None:
        return None
    groups = _runs(_row_band(words, target))
    for index, group in enumerate(groups):
        if any(w is target for w in group):
            x_from = group[0][0]
            x_to = groups[index + 1][0][0] if index + 1 < len(groups) else float("inf")
            return x_from, x_to, target[1]
    return None


def _value_in_column(
    words: list[_Word],
    column: tuple[float, float, float],
    pattern: Optional[re.Pattern[str]],
) -> Optional[str]:
    """Valore nella banda di testo sotto l'etichetta, dentro la sua colonna."""

    x_from, x_to, label_y = column
    tokens = [
        w
        for w in words
        if label_y < w[1] <= label_y + _VALUE_BAND_HEIGHT and x_from - 4.0 <= w[0] < x_to
    ]
    tokens.sort(key=lambda w: w[0])
    if pattern is None:
        value = " ".join(_text(w).strip() for w in tokens).strip()
        return value or None
    matching = [w for w in tokens if pattern.match(_text(w).strip())]
    if len(matching) != 1:
        # zero letture (campo vuoto) o più letture concorrenti (ambiguo):
        # in entrambi i casi non c'è un valore da dichiarare.
        return None
    return _text(matching[0]).strip()


def _extract_meta(words: list[_Word]) -> MatchMetaReading:
    def read(label: str, pattern: Optional[re.Pattern[str]]) -> Optional[str]:
        column = _label_column(words, label)
        if column is None:
            return None
        return _value_in_column(words, column, pattern)

    date_raw = read("DATA", _DATE_RE)
    date_iso: Optional[str] = None
    if date_raw is not None:
        match = _DATE_RE.match(date_raw)
        if match is not None:
            day, month, year = match.groups()
            date_iso = f"{year}-{int(month):02d}-{int(day):02d}"

    return MatchMetaReading(
        competition=read("CAMPIONATO", None),
        match_number=read("GARA", _DIGITS_RE),
        date=date_iso,
        time=read("ORA", _TIME_RE),
        venue=read("LUOGO", _ALPHA_RE),
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def extract_header_context(path: str | Path) -> HeaderExtractionResult:
    """Legge nomi squadra, punteggi di set e metadati dal text layer di `path`.

    Solo la prima pagina: il referto FIPAV sta su una pagina, e l'header e la
    tabella dei risultati vivono lì. Se una lettura non è univoca il campo
    corrispondente resta assente — non viene mai riempito per plausibilità.
    """

    doc = pymupdf.open(str(path))
    try:
        if doc.page_count == 0:
            return HeaderExtractionResult()
        page = doc[0]
        page_width = float(page.rect.width) or 1.0
        page_height = float(page.rect.height) or 1.0
        words = list(page.get_text("words"))

        team_names, name_regions = _extract_team_names(words, 0, page_width, page_height)
        set_scores, score_regions = _extract_set_scores(words, 0, page_width, page_height)
        meta = _extract_meta(words)

        return HeaderExtractionResult(
            team_names=team_names,
            set_scores=set_scores,
            meta=meta,
            regions=name_regions + score_regions,
        )
    finally:
        doc.close()
