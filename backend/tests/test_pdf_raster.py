"""Test del percorso raster/OCR su referto REALE rasterizzato (backend §20-§21, §28).

Fixture 1 del prompt: `2025#10#18#ROTHOBLAAS VOLANO TN#AZIMUT GIORGIONE TV#…pdf`.
Il PDF è prodotto da un vecchio software Qt/Nokia e la pagina 1 **non ha alcun
text layer utile** (`pdftotext` estrae il solo carattere "1"): è quindi il caso
reale del percorso immagine.

## Che cosa è verificato end-to-end e che cosa no

VERIFICATO contro i valori attesi del prompt (§28, fixture 1), su PDF reale, con
Tesseract vero e senza alcuna coordinata di pixel scritta nel codice:

- il sestetto iniziale del **Set 1**, tutte e 12 le caselle:
  Rothoblaas (formazione di sinistra) I=9 II=17 III=14 IV=15 V=3 VI=13,
  Azimut (formazione di destra) I=4 II=16 III=1 IV=10 V=14 VI=11;
- il **punteggio del Set 1**, 26-24, letto dalla tabella "RISULTATO FINALE";
- che il riquadro del Set 5 (**non giocato**) non produca alcuna osservazione:
  è il contro-test del punto precedente, perché la numerazione prestampata
  delle colonne dei punti è OCR-abile e senza il vincolo di dominio "sei
  posizioni su sei" produceva candidati inventati.

VERIFICATO in modo più debole (contro il referto, letto a occhio da chi ha
scritto il codice, non contro valori dati dal prompt):

- i sestetti dei Set 2, 3 e 4 e i punteggi 18-25 / 17-25 / 22-25. I valori
  attesi sono stati ricavati guardando il PDF renderizzato, quindi confermano la
  robustezza del layout detector ma NON sono ground truth indipendente. Sono
  marcati `xfail(strict=False)`-like: il test li asserisce, ma il commento qui
  sopra è la loro unica garanzia di provenienza.

APPROSSIMATIVO, dichiarato tale e non asserito come esatto:

- i **nomi squadra**: il ritaglio è la cella della fascia titolo, che contiene
  anche "SQ.", l'orario e i cerchietti A/B; il test verifica solo che il nome
  compaia come sottostringa, non che il valore sia pulito;
- il **numero del set** letto dalla colonna grigia "SET": su questa fixture due
  riquadri leggono la stessa cifra, quindi la pipeline ripiega (correttamente e
  in modo tracciato in `meta`) sull'ordine di lettura dei riquadri;
- tutto il resto del riquadro set — sostituzioni, punteggio al cambio, turni di
  servizio, indicatore della prima squadra al servizio — **non è estratto**.
  Il layout detector individua le celle, ma nessuna osservazione viene prodotta:
  non c'è nulla da verificare e nulla è dichiarato funzionante.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from app.domain.raw_observation import ExpectedType
from app.extraction.raster.pipeline import extract_raster
from app.extraction.raster.render import DEFAULT_DPI, render_page
from app.layout.detector import CellRole, LayoutDetector, RegionKind
from app.models.common import ExtractionMethod
from app.ocr import tesseract as ocr_module

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PDF = (
    REPO_ROOT
    / "examples"
    / "2025#10#18#ROTHOBLAAS VOLANO TN#AZIMUT GIORGIONE TV#Serie B1F C#02_Volano_b1fc_25.pdf"
)
DEBUG_ROOT = REPO_ROOT / "backend" / "storage" / "debug"

# Valori attesi del prompt §28, fixture 1 — ground truth vera e propria.
EXPECTED_SET1_LEFT = {"I": "9", "II": "17", "III": "14", "IV": "15", "V": "3", "VI": "13"}
EXPECTED_SET1_RIGHT = {"I": "4", "II": "16", "III": "1", "IV": "10", "V": "14", "VI": "11"}
EXPECTED_SET1_SCORE = ("26", "24")

# Valori letti dal referto renderizzato durante lo sviluppo (NON dal prompt):
# servono come test di non-regressione del layout detector sugli altri riquadri.
OBSERVED_OTHER_SETS = {
    2: ({"I": "4", "II": "16", "III": "1", "IV": "10", "V": "14", "VI": "11"},
        {"I": "9", "II": "17", "III": "14", "IV": "15", "V": "3", "VI": "13"},
        ("18", "25")),
    3: ({"I": "9", "II": "17", "III": "14", "IV": "15", "V": "3", "VI": "13"},
        {"I": "11", "II": "4", "III": "16", "IV": "1", "V": "10", "VI": "14"},
        ("17", "25")),
    4: ({"I": "4", "II": "16", "III": "1", "IV": "10", "V": "14", "VI": "11"},
        {"I": "4", "II": "17", "III": "14", "IV": "15", "V": "3", "VI": "13"},
        ("22", "25")),
}

pytestmark = [
    pytest.mark.skipif(not FIXTURE_PDF.exists(), reason=f"fixture assente: {FIXTURE_PDF}"),
    pytest.mark.skipif(not ocr_module.is_available(), reason="binario tesseract non disponibile"),
]


# ---------------------------------------------------------------- rendering


def test_render_page_produce_grayscale_ad_alta_risoluzione() -> None:
    """300dpi su A3 orizzontale ⇒ ~4963x3509 px, un canale."""

    page = render_page(FIXTURE_PDF, 0, dpi=DEFAULT_DPI)
    assert page.image.ndim == 2, "l'immagine deve essere grayscale a un canale"
    assert page.image.dtype == np.uint8
    # A3 orizzontale = 1191x842 pt; a 300dpi ci si aspetta ~4.17 px/pt.
    assert page.width == pytest.approx(page.pdf_width * DEFAULT_DPI / 72, rel=0.01)
    assert page.height == pytest.approx(page.pdf_height * DEFAULT_DPI / 72, rel=0.01)
    assert page.width > 4000 and page.height > 3000


def test_normalize_rect_e_inverso_sono_coerenti() -> None:
    """Le SourceRegion non devono mai contenere pixel: il round-trip regge."""

    page = render_page(FIXTURE_PDF, 0, dpi=150)
    rect = (1000, 500, 240, 120)
    normalized = page.normalize_rect(*rect)
    assert all(0.0 <= v <= 1.0 for v in normalized)
    assert page.denormalize_rect(*normalized) == pytest.approx(rect, abs=1)


def test_render_a_dpi_diversi_da_le_stesse_coordinate_normalizzate() -> None:
    """Invariante centrale: cambiare il dpi non sposta nulla in coordinate [0,1]."""

    low = render_page(FIXTURE_PDF, 0, dpi=150)
    high = render_page(FIXTURE_PDF, 0, dpi=300)
    a = low.normalize_rect(500, 250, 120, 60)
    b = high.normalize_rect(1000, 500, 240, 120)
    assert a == pytest.approx(b, abs=1e-3)


# ------------------------------------------------------------ layout detection


@pytest.fixture(scope="module")
def layout():
    """Layout detection con OCR reale (una sola volta: costa ~10s)."""

    page = render_page(FIXTURE_PDF, 0)
    detector = LayoutDetector(probe=ocr_module.TesseractOcr())
    return detector.detect(page)


def test_macroregioni_individuate_senza_coordinate_hardcodate(layout) -> None:
    """Le macroregioni di backend §21 escono dalla sola maschera di linee."""

    kinds = {region.kind for region in layout.regions}
    assert RegionKind.SET_BOX in kinds
    assert RegionKind.FINAL_RESULT in kinds
    assert RegionKind.MATCH_HEADER in kinds
    assert RegionKind.PLAYER_LIST in kinds

    set_boxes = layout.regions_of(RegionKind.SET_BOX)
    assert len(set_boxes) == 5, f"attesi 5 riquadri set, trovati {len(set_boxes)}"
    assert {r.set_number for r in set_boxes} == {1, 2, 3, 4, 5}


def test_riquadri_set_hanno_la_griglia_attesa(layout) -> None:
    """Ogni riquadro set ha ~10 bande di riga e almeno 12+6 bande di colonna."""

    for region in layout.regions_of(RegionKind.SET_BOX):
        assert region.grid.n_rows >= 8, f"{region.id}: {region.grid.n_rows} bande di riga"
        assert region.grid.n_cols >= 12, f"{region.id}: {region.grid.n_cols} bande di colonna"


def test_coordinate_locali_del_set_1_sono_normalizzate_nel_riquadro(layout) -> None:
    """backend §21: dentro un riquadro set si lavora in coordinate locali [0,1]."""

    page = layout.page
    detector = LayoutDetector(probe=ocr_module.TesseractOcr())
    region = layout.set_box(1)
    assert region is not None
    ocr = ocr_module.TesseractOcr()
    cells = detector.starting_six_cells(
        page,
        region,
        validator=ocr_module.is_valid_player_number,
        cell_reader=lambda img: (
            ocr.read(img, ExpectedType.PLAYER_NUMBER).text,
            ocr.read(img, ExpectedType.PLAYER_NUMBER).confidence,
        ),
    )
    assert len(cells) == 12
    for cell in cells:
        lx, ly, lw, lh = cell.local
        assert 0.0 <= lx < 1.0 and 0.0 <= ly < 1.0
        assert 0.0 < lw <= 1.0 and 0.0 < lh <= 1.0
        assert lx + lw <= 1.0 + 1e-6 and ly + lh <= 1.0 + 1e-6
        # la cella assoluta cade dentro il riquadro del set
        assert region.x <= cell.x <= region.x + region.width
        assert region.y <= cell.y <= region.y + region.height


# ------------------------------------------------------------------- pipeline


@pytest.fixture(scope="module")
def result():
    """Una sola esecuzione completa della pipeline (~35s con Tesseract reale).

    Gli artefatti vanno in `backend/storage/debug/test-raster-set1/`, cioè nella
    posizione vera e non in una tmpdir: sono destinati all'ispezione visiva
    umana e devono sopravvivere alla fine del test.
    """

    return extract_raster(FIXTURE_PDF, debug=True, run_id="test-raster-set1")


def test_pipeline_produce_raw_observation_con_metodo_ocr(result) -> None:
    assert result.observations, "la pipeline non ha prodotto nessuna osservazione"
    for observation in result.observations:
        assert observation.method is ExtractionMethod.OCR
        assert observation.candidates, f"{observation.id} senza candidati"
        # candidati ordinati per confidence decrescente, confidence in [0,1]
        confidences = [c.confidence for c in observation.candidates]
        assert confidences == sorted(confidences, reverse=True)
        assert all(0.0 <= c <= 1.0 for c in confidences)
        # ogni osservazione ha la sua SourceRegion
        assert result.region_by_id(observation.region_id) is not None


def test_source_region_sono_normalizzate_e_marcate_ocr(result) -> None:
    """backend §9: coordinate [0,1] di pagina, metodo OCR, pagina 1-based."""

    assert result.regions
    for region in result.regions:
        assert region.method is ExtractionMethod.OCR
        assert region.page == 1
        assert 0.0 <= region.x <= 1.0 and 0.0 <= region.y <= 1.0
        assert 0.0 < region.width <= 1.0 and 0.0 < region.height <= 1.0
        assert region.x + region.width <= 1.0 + 1e-6
        assert region.y + region.height <= 1.0 + 1e-6


def test_sestetto_iniziale_set1_formazione_sinistra_rothoblaas(result) -> None:
    """VALORI ATTESI DEL PROMPT §28: Rothoblaas I=9 II=17 III=14 IV=15 V=3 VI=13."""

    assert result.starting_six(1, "A") == EXPECTED_SET1_LEFT


def test_sestetto_iniziale_set1_formazione_destra_azimut(result) -> None:
    """VALORI ATTESI DEL PROMPT §28: Azimut I=4 II=16 III=1 IV=10 V=14 VI=11."""

    assert result.starting_six(1, "B") == EXPECTED_SET1_RIGHT


def test_punteggio_set1_e_26_24(result) -> None:
    """VALORE ATTESO DEL PROMPT §28: 26-24, dalla tabella RISULTATO FINALE."""

    score = result.set_score(1)
    assert (score.get("A"), score.get("B")) == EXPECTED_SET1_SCORE


def test_confidence_del_sestetto_set1_e_alta(result) -> None:
    """Le 12 caselle del Set 1 devono essere lette con confidence convincente.

    Non è un test di accuratezza (quello è sopra): serve a intercettare il caso
    in cui i valori giusti escano per fortuna da letture incerte.
    """

    set1 = [
        observation
        for observation in result.observations_of(ExpectedType.PLAYER_NUMBER)
        if "-set1-formation-" in observation.region_id
    ]
    assert len(set1) == 12
    best = [observation.candidates[0].confidence for observation in set1]
    assert min(best) >= 0.60, f"confidence minima {min(best):.2f}"
    assert float(np.mean(best)) >= 0.80


def test_set5_non_giocato_non_produce_osservazioni(result) -> None:
    """Contro-test: nessun dato inventato dove non c'è nulla da leggere.

    Il riquadro del Set 5 è vuoto ma NON è privo di inchiostro (le colonne dei
    punti hanno la numerazione 1-48 prestampata). Senza il vincolo «sei posizioni
    su sei» di backend §25.1 la pipeline produceva qui candidati inventati.
    """

    assert result.starting_six(5, "A") == {}
    assert result.starting_six(5, "B") == {}
    assert result.set_score(5) == {}


@pytest.mark.parametrize("set_number", sorted(OBSERVED_OTHER_SETS))
def test_sestetti_e_punteggi_degli_altri_set(result, set_number: int) -> None:
    """Set 2-4: valori NON forniti dal prompt, letti dal referto in sviluppo.

    Test di non-regressione del layout detector (i riquadri di destra non hanno
    la colonna delle etichette, quindi la riga del sestetto lì viene trovata per
    via numerica e non per etichetta), non una verifica su ground truth
    indipendente.
    """

    expected_a, expected_b, expected_score = OBSERVED_OTHER_SETS[set_number]
    assert result.starting_six(set_number, "A") == expected_a
    assert result.starting_six(set_number, "B") == expected_b
    score = result.set_score(set_number)
    assert (score.get("A"), score.get("B")) == expected_score


def test_nomi_squadra_sono_approssimativi_ma_riconoscibili(result) -> None:
    """Il nome squadra NON è estratto in modo pulito: si verifica solo che ci sia.

    Il ritaglio è la cella della fascia titolo, che contiene anche "SQ.",
    l'orario e i cerchietti A/B: la pulizia è lessicale e può lasciare residui o
    troncare l'ultima lettera. Il test è deliberatamente debole per non
    dichiarare una precisione che non c'è.
    """

    names = {
        observation.region_id: observation.candidates[0].value
        for observation in result.observations_of(ExpectedType.TEAM_NAME)
    }
    assert names, "nessun nome squadra estratto"
    joined = " ".join(names.values()).upper()
    assert "ROTHOBLAA" in joined
    assert "AZIMUT" in joined


def test_artefatti_di_debug_sono_ispezionabili(result) -> None:
    """Il percorso raster deve lasciare tracce visive: è la parte più incerta."""

    debug_dir = result.debug_dir
    assert debug_dir is not None and debug_dir.is_dir()
    for name in (
        "p1_render.png",  # pagina rasterizzata a 300dpi
        "p1_regions.png",  # macroregioni riconosciute, con etichetta
        "p1_grid.png",  # griglie interne rilevate
        "p1_cells.png",  # celle effettivamente passate a Tesseract
        "p1_layout.json",
        "result.json",
    ):
        path = debug_dir / name
        assert path.is_file() and path.stat().st_size > 0, f"artefatto mancante: {path}"

    crops = list((debug_dir / "crops").glob("*.png"))
    assert len(crops) >= 20, f"solo {len(crops)} ritagli salvati"
    # i ritagli del sestetto del Set 1 devono esserci tutti, per posizione
    for slot in ("a", "b"):
        for position in ("I", "II", "III", "IV", "V", "VI"):
            expected = debug_dir / "crops" / f"p1-set1-formation-{slot}-{position}.png"
            assert expected.is_file(), f"ritaglio mancante: {expected.name}"


def test_ocr_e_mirato_non_sulla_pagina_intera(result) -> None:
    """backend §20: «Evita OCR indiscriminato della pagina intera».

    Verifica strutturale: la somma delle aree delle regioni passate all'OCR è una
    frazione minima della pagina.
    """

    total = sum(region.width * region.height for region in result.regions)
    assert total < 0.05, f"le regioni OCR coprono il {total:.1%} della pagina"


# --------------------------------------------------------------- wrapper OCR


def test_ocr_su_ritaglio_vuoto_non_inventa_candidati() -> None:
    ocr = ocr_module.TesseractOcr()
    white = np.full((60, 120), 255, dtype=np.uint8)
    reading = ocr.read(white, ExpectedType.PLAYER_NUMBER)
    assert reading.is_empty
    assert reading.candidates == []


def test_ocr_scarta_i_caratteri_fuori_profilo() -> None:
    """Il profilo PLAYER_NUMBER ha whitelist di cifre: nessuna lettera passa."""

    page = render_page(FIXTURE_PDF, 0)
    detector = LayoutDetector(probe=ocr_module.TesseractOcr())
    layout = detector.detect(page)
    header = next(
        (r for r in layout.regions if r.kind is RegionKind.MATCH_HEADER),
        None,
    )
    assert header is not None
    crop = page.crop(header.x, header.y, header.width, header.height)
    reading = ocr_module.TesseractOcr().read(crop, ExpectedType.PLAYER_NUMBER)
    assert all(c.value.isdigit() for c in reading.candidates)


def test_validatore_numero_di_maglia() -> None:
    assert ocr_module.is_valid_player_number("1")
    assert ocr_module.is_valid_player_number("99")
    assert not ocr_module.is_valid_player_number("0")
    assert not ocr_module.is_valid_player_number("100")
    assert not ocr_module.is_valid_player_number("")
    assert not ocr_module.is_valid_player_number("1A")


def test_cell_role_e_expected_type_coerenti(result) -> None:
    """Ogni ruolo di cella mappa su un solo ExpectedType."""

    layout = result.layouts[0]
    mapping = {
        CellRole.STARTING_SIX: ExpectedType.PLAYER_NUMBER,
        CellRole.SET_SCORE: ExpectedType.SCORE,
        CellRole.TEAM_NAME: ExpectedType.TEAM_NAME,
    }
    for cell in layout.cells:
        assert cell.expected_type is mapping[cell.role]
