"""Estrazione posizionale generica da text layer, per referti FIPAV senza un
AcroForm compilato con dati utili (fallback rispetto ad `acroform.py`).

Layout comune di riferimento (backend §21-§22, "Layout comune: parser
generico basato sulla struttura del referto FIPAV"): il referto standard
disegna, per ciascun set, un riquadro con un'intestazione di 6 colonne
etichettate con i numeri romani delle posizioni di rotazione (I, II, III,
IV, V, VI), ripetuta due volte affiancata — una per squadra — e sotto
ciascuna colonna il numero di maglia del titolare in quella posizione
(eventuali sostituzioni compaiono più in basso, nella stessa colonna, e non
sono estratte da questo modulo, che si occupa del sestetto iniziale).

Questa struttura è stata confermata empiricamente (non assunta a tavolino)
leggendo con `page.get_text("words")` la fixture reale
`examples/...Cerea.../11_Cerea_b1fc_25.pdf`: l'intestazione "I II III IV V VI"
compare due volte affiancata nella banda orizzontale più in alto della
pagina, e i numeri di maglia del sestetto titolare del Set 1 (2, 5, 3, 8, 14,
9 per la prima squadra e 14, 9, 3, 4, 15, 17 per la seconda) compaiono a
poca distanza verticale sotto le rispettive colonne — esattamente i valori
di `backend/tests/fixtures/raw_observations_set1_cerea.py`.

Il riquadro set più in alto e più a sinistra nell'ordine di lettura è
sempre il Set 1 in questa diagrammazione: i riquadri sono piastrellati in
ordine di lettura (righe di riquadri dall'alto in basso, riquadri dentro la
riga da sinistra a destra). Questo modulo non tenta di identificare QUALE
squadra reale (nome) corrisponda a `team-0`/`team-1`: quell'associazione
richiede il layout detector (`app/layout`, fuori dai confini di questo
modulo) che ha accesso ai nomi squadra nell'header pagina.
"""

from __future__ import annotations

import re
import uuid
from pathlib import Path

import pymupdf

from app.domain.raw_observation import ExpectedType, ObservationCandidate, RawObservation
from app.extraction.text.result import TextLayerExtractionResult
from app.models.common import ExtractionMethod, SourceRegion

ROTATION_LABELS = ("I", "II", "III", "IV", "V", "VI")

_NUMBER_RE = re.compile(r"^\d{1,2}$")

# Tolleranza di raggruppamento in "bande" orizzontali: due token la cui y0
# differisce di meno di questo valore sono considerati sulla stessa riga.
_ROW_BAND_TOLERANCE = 3.0

# Margine di sicurezza aggiunto all'altezza dell'intestazione per definire la
# finestra verticale in cui cercare il numero del titolare sotto ciascuna
# colonna: deve captare la prima riga di numeri sotto l'intestazione ma
# escludere le righe successive (sostituzioni), che nella diagrammazione
# osservata iniziano un'intera altezza di riga più in basso rispetto alla
# prima.
_STARTING_NUMBER_WINDOW_MARGIN = 2.0

DEFAULT_STARTING_CONFIDENCE = 0.9

# Tipo interno: una parola come restituita da page.get_text("words"):
# (x0, y0, x1, y1, text, block_no, line_no, word_no)
_Word = tuple


def _text(word: _Word) -> str:
    return word[4]


def _find_header_groups(words: list[_Word]) -> list[list[_Word]]:
    """Individua i gruppi di 6 token consecutivi (per x crescente, sulla
    stessa riga) che formano la sequenza I, II, III, IV, V, VI. Ciascun
    gruppo è l'intestazione delle posizioni di rotazione per UNA squadra in
    UN riquadro di set.
    """
    roman_tokens = [w for w in words if _text(w) in ROTATION_LABELS]
    if not roman_tokens:
        return []

    bands: list[list[_Word]] = []
    for token in sorted(roman_tokens, key=lambda w: w[1]):
        for band in bands:
            if abs(band[0][1] - token[1]) < _ROW_BAND_TOLERANCE:
                band.append(token)
                break
        else:
            bands.append([token])

    groups: list[list[_Word]] = []
    for band in bands:
        band.sort(key=lambda w: w[0])
        current: list[_Word] = []
        for token in band:
            expected_label = ROTATION_LABELS[len(current)]
            if _text(token) == expected_label:
                current.append(token)
                if len(current) == len(ROTATION_LABELS):
                    groups.append(current)
                    current = []
            else:
                current = [token] if _text(token) == ROTATION_LABELS[0] else []
    return groups


def _pair_groups_into_sets(groups: list[list[_Word]]) -> list[tuple[list[_Word], list[_Word]]]:
    """Accoppia i gruppi (uno per squadra) in coppie (squadra sinistra,
    squadra destra) che rappresentano un singolo riquadro di set, seguendo
    l'ordine di lettura: bande dall'alto in basso, e dentro la banda da
    sinistra a destra. La prima coppia trovata è sempre il Set 1.
    """
    bands: list[list[list[_Word]]] = []
    for group in groups:
        header_y = group[0][1]
        for band in bands:
            if abs(band[0][0][1] - header_y) < _ROW_BAND_TOLERANCE:
                band.append(group)
                break
        else:
            bands.append([group])

    pairs: list[tuple[list[_Word], list[_Word]]] = []
    for band in bands:
        band.sort(key=lambda g: g[0][0])
        for i in range(0, len(band) - 1, 2):
            pairs.append((band[i], band[i + 1]))
    return pairs


def _column_centers(group: list[_Word]) -> dict[str, float]:
    return {_text(token): (token[0] + token[2]) / 2 for token in group}


def _starting_number_window(group: list[_Word]) -> tuple[float, float]:
    header_bottom = max(token[3] for token in group)
    header_height = max(token[3] - token[1] for token in group)
    return header_bottom, header_bottom + header_height + _STARTING_NUMBER_WINDOW_MARGIN


def _column_x_tolerance(centers: dict[str, float]) -> float:
    ordered = sorted(centers.values())
    if len(ordered) < 2:
        return 10.0
    spacings = [b - a for a, b in zip(ordered, ordered[1:])]
    return min(spacings) / 2.0


def _find_starting_number(
    words: list[_Word],
    column_center_x: float,
    x_tolerance: float,
    y_window: tuple[float, float],
) -> list[_Word]:
    y_low, y_high = y_window
    matches = [
        word
        for word in words
        if _NUMBER_RE.match(_text(word))
        and abs(((word[0] + word[2]) / 2) - column_center_x) <= x_tolerance
        and y_low < word[1] <= y_high
    ]
    matches.sort(key=lambda w: w[1])  # il più vicino all'intestazione prima
    return matches


def extract_generic_text_observations(path: str | Path) -> TextLayerExtractionResult:
    """Estrae le RawObservation del sestetto titolare per ciascun riquadro
    di set/squadra individuato sulla pagina, usando esclusivamente le parole
    con bounding box del text layer (`page.get_text("words")`) — nessun
    AcroForm coinvolto.

    Convenzioni di naming nei `region_id` prodotti (non un'identificazione
    pallavolistica definitiva — spetta al layer successivo):
    - `set{N}` è l'ordine di lettura del riquadro set individuato (1-based,
      il primo riquadro nella prima banda è sempre il Set 1);
    - `team-0`/`team-1` sono la colonna sinistra/destra all'interno di quel
      riquadro.

    Se per una posizione non viene trovato alcun numero nella finestra
    attesa, non viene fabbricata alcuna osservazione per quella posizione
    (nessun candidato inventato): è preferibile un'estrazione parziale ma
    onesta.
    """
    doc = pymupdf.open(str(path))
    observations: list[RawObservation] = []
    regions: list[SourceRegion] = []
    try:
        for page_index, page in enumerate(doc):
            page_width = float(page.rect.width) or 1.0
            page_height = float(page.rect.height) or 1.0
            words = page.get_text("words")

            groups = _find_header_groups(words)
            pairs = _pair_groups_into_sets(groups)

            for set_index, (left_group, right_group) in enumerate(pairs, start=1):
                for team_slot, group in (("team-0", left_group), ("team-1", right_group)):
                    centers = _column_centers(group)
                    x_tolerance = _column_x_tolerance(centers)
                    y_window = _starting_number_window(group)

                    for position in ROTATION_LABELS:
                        matches = _find_starting_number(
                            words, centers[position], x_tolerance, y_window
                        )
                        if not matches:
                            continue

                        best = matches[0]
                        candidates = [
                            ObservationCandidate(
                                value=_text(best), confidence=DEFAULT_STARTING_CONFIDENCE
                            )
                        ]
                        # Se più di un token cade nella finestra attesa
                        # (colonna affollata), li riportiamo come candidati
                        # aggiuntivi a confidence inferiore, invece di
                        # scartarli silenziosamente: l'ambiguità va risolta
                        # dal validator pallavolistico (backend §26), non
                        # nascosta qui.
                        for extra in matches[1:]:
                            candidates.append(
                                ObservationCandidate(
                                    value=_text(extra),
                                    confidence=DEFAULT_STARTING_CONFIDENCE * 0.5,
                                )
                            )

                        x0, y0, x1, y1 = best[0], best[1], best[2], best[3]
                        region_id = f"region-p{page_index}-set{set_index}-{team_slot}-{position}"
                        region = SourceRegion(
                            id=region_id,
                            page=page_index,
                            x=min(1.0, max(0.0, x0 / page_width)),
                            y=min(1.0, max(0.0, y0 / page_height)),
                            width=min(1.0, max(0.0, (x1 - x0) / page_width)),
                            height=min(1.0, max(0.0, (y1 - y0) / page_height)),
                            method=ExtractionMethod.PDF_TEXT,
                            region_type="starting_lineup_number",
                            raw_text=_text(best),
                        )
                        regions.append(region)

                        observations.append(
                            RawObservation(
                                id=f"obs-generic-{uuid.uuid4()}",
                                region_id=region.id,
                                expected_type=ExpectedType.PLAYER_NUMBER,
                                method=ExtractionMethod.PDF_TEXT,
                                candidates=candidates,
                            )
                        )

        return TextLayerExtractionResult(observations=observations, regions=regions)
    finally:
        doc.close()
