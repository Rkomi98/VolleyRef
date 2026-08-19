"""Regressione: due righe della tabella "RISULTATO FINALE" che leggono la stessa
cifra del set non devono più collidere, e la loro ambiguità va esposta.

## Il bug

`PageLayoutDetector.set_score_cells` costruiva l'id della cella del punteggio con
la cifra LETTA nella colonna centrale del riquadro:

    id = f"{region.id}-set{set_number}-score-{slot}"

L'id dipendeva quindi da un riconoscimento, non dalla posizione fisica della
cella. Se l'OCR leggeva la stessa cifra in due righe diverse — succede: la
tabella ha sotto le righe dei set anche una riga di TOTALI e alcune righe vuote,
e la cifra del Set 5 su referto reale si legge con confidence 0.37 — due
`FieldCell` diverse ottenevano lo stesso id, e a valle:

- il frontend riceveva due `SourceRegion` con la stessa chiave (l'errore React
  «Encountered two children with the same key, `p1-final_result-set4-score-a`»
  visto in produzione sul referto Volano);
- soprattutto, nell'aggregazione una delle due letture sovrascriveva l'altra:
  un'ambiguità reale scompariva prima che l'utente potesse vederla, che è
  esattamente la correzione silenziosa vietata da backend §25.

## Il fix, in due parti distinte

1. **identità** della cella = posizione fisica (`row`), unica per costruzione:
   `p1-final_result-row3-set1-score-a`;
2. **aggregazione** per numero di set letto, che resta in `meta["set_number"]`:
   quando più righe dichiarano lo stesso set l'ambiguità viene risolta con un
   vincolo di dominio (un risultato di set plausibile) se possibile, dichiarata
   con un `ValidationCheck` sempre, e le letture scartate restano candidati
   della `RawObservation` — lo stesso pattern che `app/volleyball/parser.py` usa
   per le letture alternative dei numeri di maglia.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.domain.raw_observation import (
    ExpectedType,
    ObservationCandidate,
    RawObservation,
)
from app.extraction.raster.pipeline import RasterExtractionResult, _unique_cell_ids
from app.extraction.raster.render import RenderedPage
from app.layout.detector import (
    CellRole,
    FieldCell,
    Grid,
    LayoutDetector,
    Region,
    RegionKind,
)
from app.models.common import ExtractionMethod, SourceRegion
from app.services import extraction_pipeline as ep

# ---------------------------------------------------------------------------
# Impalcatura: una tabella "RISULTATO FINALE" sintetica
# ---------------------------------------------------------------------------

#: `"T" S V P | SET minuti | P V S "T"`: nove colonne, la centrale molto più
#: larga (è così che il detector la riconosce), sette righe.
_COL_LINES = (0, 40, 80, 120, 160, 400, 440, 480, 520, 560)
_ROW_LINES = (0, 50, 100, 150, 200, 250, 300, 350)


def _blank_page(width: int = 800, height: int = 600) -> RenderedPage:
    return RenderedPage(
        page_index=0,
        dpi=300.0,
        image=np.full((height, width), 255, dtype=np.uint8),
        pdf_width=width / 300.0 * 72.0,
        pdf_height=height / 300.0 * 72.0,
    )


def _final_result_region() -> Region:
    return Region(
        id="p1-final_result",
        kind=RegionKind.FINAL_RESULT,
        page_index=0,
        x=100,
        y=100,
        width=_COL_LINES[-1],
        height=_ROW_LINES[-1],
        grid=Grid(horizontal=_ROW_LINES, vertical=_COL_LINES),
    )


class _ReaderByRow:
    """Legge la cifra del set in funzione della riga, nell'ordine di chiamata.

    `set_score_cells` sonda le righe dall'alto in sequenza, una chiamata per
    riga: la n-esima chiamata corrisponde alla riga n.
    """

    def __init__(self, per_row: dict[int, tuple[str, float]]) -> None:
        self.per_row = per_row
        self.calls = 0

    def __call__(self, image: np.ndarray) -> tuple[str, float]:
        row = self.calls
        self.calls += 1
        return self.per_row.get(row, ("", 0.0))


# ---------------------------------------------------------------------------
# 1. Identità della cella: mai due id uguali, qualunque cosa legga l'OCR
# ---------------------------------------------------------------------------


def test_due_righe_con_la_stessa_cifra_non_producono_id_duplicati() -> None:
    """Il caso del bug: la riga 3 e la riga 5 leggono entrambe "4"."""

    detector = LayoutDetector()
    reader = _ReaderByRow({0: ("4", 0.92), 1: ("2", 0.95), 2: ("4", 0.31)})
    cells = detector.set_score_cells(
        _blank_page(), _final_result_region(), digit_reader=reader
    )

    ids = [cell.id for cell in cells]
    assert len(ids) == len(set(ids)), f"id duplicati fra le celle: {sorted(ids)}"
    # sei celle: tre righe accettate × due colonne di punti
    assert len(cells) == 6
    # entrambe le letture "set 4" sopravvivono, distinte dalla riga fisica
    set4 = [cell for cell in cells if cell.meta["set_number"] == 4]
    assert len(set4) == 4
    assert {cell.meta["grid_row"] for cell in set4} == {0, 2}
    # e la cifra del set resta un DATO (con la sua confidence), non un'identità
    assert {cell.meta["set_number_confidence"] for cell in set4} == {0.92, 0.31}


def test_id_di_cella_contiene_la_riga_prima_del_numero_di_set() -> None:
    """La forma dell'id è parte del contratto con `_RASTER_SCORE_RE`."""

    detector = LayoutDetector()
    cells = detector.set_score_cells(
        _blank_page(), _final_result_region(), digit_reader=_ReaderByRow({0: ("1", 0.9)})
    )
    assert [cell.id for cell in cells] == [
        "p1-final_result-row0-set1-score-a",
        "p1-final_result-row0-set1-score-b",
    ]


@pytest.mark.parametrize(
    "region_id, expected",
    [
        ("p1-final_result-row6-set4-score-a", ("6", "4", "a")),
        ("p1-final_result-row0-set1-score-b", ("0", "1", "b")),
        # id storico senza riga (fixture registrate, percorsi precedenti)
        ("p1-final_result-set4-score-a", (None, "4", "a")),
    ],
)
def test_regex_dei_punteggi_regge_l_indice_di_riga(region_id, expected) -> None:
    match = ep._RASTER_SCORE_RE.search(region_id)
    assert match is not None, region_id
    assert (match.group("row"), match.group("set"), match.group("slot")) == expected


def test_regex_dei_punteggi_resta_ancorata_alla_fine() -> None:
    """`$`: un id che continua dopo lo slot non è una cella di punteggio."""

    assert ep._RASTER_SCORE_RE.search("p1-final_result-row6-set4-score-a-extra") is None
    assert ep._RASTER_SCORE_RE.search("p1-set4-score-ab") is None


def test_unique_cell_ids_conserva_la_seconda_lettura_invece_di_perderla() -> None:
    """Rete di sicurezza della pipeline: una collisione non cancella una cella."""

    def cell(cell_id: str) -> FieldCell:
        return FieldCell(
            id=cell_id,
            region_id="p1-final_result",
            role=CellRole.SET_SCORE,
            expected_type=ExpectedType.SCORE,
            x=0,
            y=0,
            width=10,
            height=10,
        )

    cells = _unique_cell_ids([cell("x"), cell("x"), cell("x")])
    assert len(cells) == 3
    assert len({c.id for c in cells}) == 3
    assert cells[1].meta["duplicate_of"] == "x"


# ---------------------------------------------------------------------------
# 2. Aggregazione: l'ambiguità diventa candidati multipli + warning
# ---------------------------------------------------------------------------


def _raster_result(rows: list[tuple[int, int, str, str, float]]) -> RasterExtractionResult:
    """`RasterExtractionResult` con le sole celle del punteggio.

    `rows` è una lista di `(riga, set_letto, punti_a, punti_b, confidence)`; gli
    id sono quelli veri prodotti da `app/layout/detector.py`.
    """

    observations: list[RawObservation] = []
    regions: list[SourceRegion] = []
    for index, (row, set_number, score_a, score_b, confidence) in enumerate(rows):
        for slot, value in (("a", score_a), ("b", score_b)):
            region_id = f"p1-final_result-row{row}-set{set_number}-score-{slot}"
            regions.append(
                SourceRegion(
                    id=region_id,
                    page=1,
                    x=0.1,
                    y=0.10 + index * 0.01,
                    width=0.01,
                    height=0.01,
                    method=ExtractionMethod.OCR,
                    region_type="SET_SCORE",
                    raw_text=value,
                )
            )
            observations.append(
                RawObservation(
                    id=f"obs-{region_id}",
                    region_id=region_id,
                    expected_type=ExpectedType.SCORE,
                    method=ExtractionMethod.OCR,
                    candidates=[
                        ObservationCandidate(value=value, confidence=confidence)
                    ],
                )
            )
    return RasterExtractionResult(
        run_id="synthetic",
        pdf_path="synthetic.pdf",
        dpi=300.0,
        observations=observations,
        regions=regions,
        diagnostics={"source": "letture sintetiche"},
    )


def _read(monkeypatch, rows) -> ep.DocumentReading:
    from app.extraction.raster import pipeline as raster_pipeline

    monkeypatch.setattr(
        raster_pipeline, "extract_raster", lambda *a, **k: _raster_result(rows)
    )
    return ep._read_raster("synthetic.pdf", debug=False)


def test_una_sola_riga_per_set_non_dichiara_nessuna_ambiguita(monkeypatch) -> None:
    reading = _read(monkeypatch, [(3, 1, "26", "24", 0.96)])
    box = reading.sets[0]
    assert box.score == (26, 24)
    assert box.score_conflicts == []


def test_due_righe_stesso_set_il_vincolo_di_dominio_scarta_la_riga_dei_totali(
    monkeypatch,
) -> None:
    """Il caso realistico: la riga dei TOTALI legge la stessa cifra di un set.

    83-99 non può essere il risultato di un set: il vincolo di dominio decide,
    ma l'ambiguità resta dichiarata (come fa `check_ambiguous_readings` per i
    numeri di maglia risolti dai vincoli).
    """

    reading = _read(
        monkeypatch,
        [(6, 4, "22", "25", 0.96), (9, 4, "83", "99", 0.42)],
    )
    box = reading.sets[0]
    assert box.score == (22, 25)
    assert box.score_conflicts, "l'ambiguità non è stata dichiarata"
    message = box.score_conflicts[0]
    assert "riga 6" in message and "riga 9" in message
    assert "83-99" in message

    # la lettura scartata NON è persa: resta candidata dell'osservazione
    observations = ep._observations_for(
        box, {ep._SLOT_A: ep.TEAM_A_ID, ep._SLOT_B: ep.TEAM_B_ID}, reading.method
    )
    scores = [o for o in observations if o.expected_type is ExpectedType.SCORE]
    assert len(scores) == 2
    values = {o.id: [c.value for c in o.candidates] for o in scores}
    assert values == {
        f"obs-set4-{ep.TEAM_A_ID}-final-score": ["22", "83"],
        f"obs-set4-{ep.TEAM_B_ID}-final-score": ["25", "99"],
    }
    for observation in scores:
        confidences = [c.confidence for c in observation.candidates]
        assert confidences == sorted(confidences, reverse=True)
        assert all(0.0 < c <= 1.0 for c in confidences)


def test_due_righe_entrambe_plausibili_restano_ambigue_e_lo_dichiarano(
    monkeypatch,
) -> None:
    """Nessun vincolo può decidere: si tiene la confidence più alta e si avvisa."""

    reading = _read(
        monkeypatch,
        [(6, 4, "22", "25", 0.70), (7, 4, "25", "20", 0.95)],
    )
    box = reading.sets[0]
    assert box.score == (25, 20), "va scelta la lettura con confidence più alta"
    assert box.score_conflicts
    assert "nessun vincolo" in box.score_conflicts[0]


def test_l_ambiguita_arriva_all_utente_come_check_di_validazione(monkeypatch) -> None:
    reading = _read(
        monkeypatch,
        [(6, 4, "22", "25", 0.96), (9, 4, "83", "99", 0.42)],
    )
    box = reading.sets[0]
    set_data = ep._build_set_data(
        box,
        {ep._SLOT_A: ep.TEAM_A_ID, ep._SLOT_B: ep.TEAM_B_ID},
        reading.method,
        side_ambiguous=False,
    )
    check = next(
        (c for c in set_data.validation.checks if c.id == ep.SCORE_AMBIGUOUS_CHECK_ID),
        None,
    )
    assert check is not None, "l'utente non vedrebbe l'ambiguità"
    assert check.status.value == "WARNING"
    assert check.message and "RISULTATO FINALE" in check.message
    # il punteggio pubblicato è quello selezionato, non una media o uno zero
    assert set_data.final_score == (22, 25)


def test_piu_letture_identiche_dalla_stessa_riga_non_creano_falsa_ambiguita(
    monkeypatch,
) -> None:
    """Due righe che leggono lo STESSO punteggio non sono un conflitto di valore,
    ma restano due letture distinte: il candidato compare una volta sola."""

    reading = _read(
        monkeypatch,
        [(6, 4, "22", "25", 0.96), (7, 4, "22", "25", 0.50)],
    )
    box = reading.sets[0]
    assert box.score == (22, 25)
    observations = ep._observations_for(
        box, {ep._SLOT_A: ep.TEAM_A_ID, ep._SLOT_B: ep.TEAM_B_ID}, reading.method
    )
    scores = [o for o in observations if o.expected_type is ExpectedType.SCORE]
    assert [len(o.candidates) for o in scores] == [1, 1]
    assert scores[0].candidates[0].confidence == 0.96


def test_plausibilita_del_punteggio_di_set() -> None:
    """Il vincolo usato per disambiguare è quello di gioco, non un'euristica."""

    assert ep._is_plausible_set_score(1, 26, 24)
    assert ep._is_plausible_set_score(1, 18, 25)
    assert ep._is_plausible_set_score(5, 15, 11), "il quinto set si vince a 15"
    assert not ep._is_plausible_set_score(1, 15, 11), "un set normale si vince a 25"
    assert not ep._is_plausible_set_score(1, 25, 24), "margine minimo di 2 punti"
    assert not ep._is_plausible_set_score(1, 83, 99), "riga dei totali, non un set"
