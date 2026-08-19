"""Test end-to-end della pipeline di estrazione REALE, dall'upload del PDF
all'`Analysis` pubblica servita dall'API (backend §28, §42, §44).

## Perché passa dall'API e non dai moduli di estrazione

I valori del §28 erano già verificati contro i moduli intermedi
(`tests/test_pdf_text_layer.py`, `tests/test_pdf_raster.py`), ma nessuno di quei
moduli era collegato all'applicazione: l'API rispondeva con dati fabbricati.
Questi test interrogano quindi **esattamente ciò che legge il frontend**:
`POST /api/v1/analyses` → polling di `/status` → `GET /api/v1/analyses/{id}`.

## Cosa è verificato contro il §28 (ground truth del prompt)

- fixture 2 (Cerea, text layer): sestetti del Set 1 di entrambe le squadre e
  punteggio 25-27 — **end-to-end su PDF reale**;
- fixture 1 (Volano, raster/OCR): sestetti del Set 1 di entrambe le squadre e
  punteggio 26-24 — end-to-end su PDF reale **solo se il binario `tesseract` è
  installato**, altrimenti il test è `skip` (non passa a vuoto). Poiché
  Tesseract è una dipendenza di sistema che può mancare, gli stessi valori sono
  verificati anche da `test_raster_branch_maps_recorded_readings_to_public_analysis`,
  che sostituisce **solo** lo stadio OCR con le letture registrate in
  `tests/test_pdf_raster.py` e lascia girare tutto il resto della pipeline
  (assegnazione formazione↔squadra, parser, validator, mappatura pubblica).
  Quel test NON dimostra che l'OCR legga bene: dimostra che, date quelle
  letture, l'`Analysis` pubblica è corretta.

## Cosa è verificato in negativo (onestà dei campi non estratti)

Sostituzioni, punteggio al cambio di campo, turni di servizio e indicatore della
prima squadra al servizio non sono estratti da nessuno dei due percorsi. I test
`test_*_does_not_fabricate_*` verificano che restino **vuoti** e che l'assenza
sia dichiarata da un `ValidationCheck`, invece di essere riempita con valori
plausibili.
"""

from __future__ import annotations

import importlib
import time
from pathlib import Path
from typing import Optional

import pytest
from fastapi.testclient import TestClient

from app.domain.raw_observation import ExpectedType, ObservationCandidate, RawObservation
from app.models.common import ExtractionMethod, SourceRegion
from app.ocr import tesseract as ocr_module

REPO_ROOT = Path(__file__).resolve().parents[2]
EXAMPLES_DIR = REPO_ROOT / "examples"
CEREA_PDF = (
    EXAMPLES_DIR
    / "2025#12#20#ISUZU CEREA VR#ROTHOBLAAS VOLANO TN#Serie B1F C#11_Cerea_b1fc_25.pdf"
)
VOLANO_PDF = (
    EXAMPLES_DIR
    / "2025#10#18#ROTHOBLAAS VOLANO TN#AZIMUT GIORGIONE TV#Serie B1F C#02_Volano_b1fc_25.pdf"
)

POSITIONS = ("I", "II", "III", "IV", "V", "VI")

# --- Ground truth del prompt §28 -------------------------------------------

# Fixture 1 — Volano (raster/OCR). Rothoblaas è la squadra "A" del referto.
VOLANO_SET1_ROTHOBLAAS = {"I": 9, "II": 17, "III": 14, "IV": 15, "V": 3, "VI": 13}
VOLANO_SET1_AZIMUT = {"I": 4, "II": 16, "III": 1, "IV": 10, "V": 14, "VI": 11}
VOLANO_SET1_SCORE = [26, 24]

# Fixture 2 — Cerea (text layer). ISUZU CEREA è la squadra "A" del referto.
CEREA_SET1_CEREA = {"I": 2, "II": 5, "III": 3, "IV": 8, "V": 14, "VI": 9}
CEREA_SET1_ROTHOBLAAS = {"I": 14, "II": 9, "III": 3, "IV": 4, "V": 15, "VI": 17}
CEREA_SET1_SCORE = [25, 27]


# ---------------------------------------------------------------------------
# Client isolato (DB + storage in tmpdir) e helper di flusso
# ---------------------------------------------------------------------------


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path / "storage"))
    # La pipeline reale è già il default; lo si fissa comunque, perché il test
    # non deve dipendere dall'ambiente della macchina che lo esegue.
    monkeypatch.setenv("VOLLEYREF_USE_REAL_PIPELINE", "1")

    from app.core.config import get_settings

    get_settings.cache_clear()
    import main as main_module

    importlib.reload(main_module)
    with TestClient(main_module.app) as test_client:
        yield test_client
    get_settings.cache_clear()


def _analysis_for(client: TestClient, pdf_path: Path, timeout: float = 180.0) -> dict:
    """Upload → attesa di READY → `Analysis` pubblica completa."""

    with pdf_path.open("rb") as fh:
        response = client.post(
            "/api/v1/analyses", files={"file": (pdf_path.name, fh, "application/pdf")}
        )
    assert response.status_code == 202, response.text
    analysis_id = response.json()["analysis_id"]

    deadline = time.monotonic() + timeout
    body: dict = {}
    while time.monotonic() < deadline:
        body = client.get(f"/api/v1/analyses/{analysis_id}/status").json()
        if body["status"] == "READY":
            break
        if body["status"] == "FAILED":
            pytest.fail(f"pipeline FAILED: {body}")
        time.sleep(0.1)
    else:  # pragma: no cover - solo se la pipeline si blocca
        pytest.fail(f"analisi non pronta entro {timeout}s: {body}")

    response = client.get(f"/api/v1/analyses/{analysis_id}")
    assert response.status_code == 200, response.text
    return response.json()


def _six(set_data: dict, side: str) -> dict[str, Optional[int]]:
    return {p: set_data[f"team_{side}_starting_six"][p]["value"] for p in POSITIONS}


def _check(analysis: dict, check_id: str) -> Optional[dict]:
    for check in analysis["validation"]["checks"]:
        if check["id"] == check_id:
            return check
    return None


def _assert_not_from_fallback(analysis: dict) -> None:
    """La garanzia centrale: questi numeri vengono dal PDF, non dal mock.

    `pipeline-fallback` è il check che `AnalysisService._canned_fallback`
    inserisce quando serve dati fabbricati: se c'è, tutte le altre assert di
    questo file sarebbero vere per caso (i valori canned del Set 1 coincidono
    con quelli del §28 per la fixture Cerea).
    """

    fallback = _check(analysis, "pipeline-fallback")
    assert fallback is None, f"analisi prodotta dal fallback canned: {fallback}"


# ---------------------------------------------------------------------------
# Fixture 2 — Cerea, percorso text layer, end-to-end su PDF reale
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def cerea_analysis(tmp_path_factory) -> dict:
    """Una sola esecuzione della pipeline reale sul PDF Cerea, attraverso l'API.

    Module-scoped perché l'estrazione è deterministica: ripeterla per ogni
    assert non aggiunge informazione, aggiunge solo secondi.
    """

    if not CEREA_PDF.exists():
        pytest.skip(f"fixture PDF reale assente: {CEREA_PDF}")
    return _analysis_via_isolated_app(CEREA_PDF, tmp_path_factory.mktemp("cerea"))


class TestCereaTextLayerEndToEnd:
    @pytest.fixture()
    def analysis(self, cerea_analysis: dict) -> dict:
        return cerea_analysis

    def test_set1_starting_six_matches_prompt_section_28(self, analysis: dict) -> None:
        """§28 fixture 2: Cerea 2,5,3,8,14,9 — Rothoblaas 14,9,3,4,15,17."""

        _assert_not_from_fallback(analysis)
        set1 = next(s for s in analysis["sets"] if s["number"] == 1)
        assert _six(set1, "a") == CEREA_SET1_CEREA
        assert _six(set1, "b") == CEREA_SET1_ROTHOBLAAS

    def test_set1_score_matches_prompt_section_28(self, analysis: dict) -> None:
        """§28 fixture 2: punteggio Set 1 = 25-27."""

        _assert_not_from_fallback(analysis)
        set1 = next(s for s in analysis["sets"] if s["number"] == 1)
        assert set1["final_score"] == CEREA_SET1_SCORE

    def test_team_names_come_from_the_document(self, analysis: dict) -> None:
        """Sul text layer i nomi sono testo esatto del PDF, non OCR."""

        assert analysis["match"]["team_a"]["name"] == "ISUZU CEREA VR"
        assert analysis["match"]["team_b"]["name"] == "ROTHOBLAAS VOLANO TN"
        # Nomi certi ⇒ nessun warning di verifica sul nome.
        assert _check(analysis, "team-name-uncertain") is None

    def test_only_the_four_played_sets_are_reported(self, analysis: dict) -> None:
        """Il riquadro del Set 5 è vuoto (partita finita 1-3): non deve
        comparire come set con sei posizioni non lette."""

        assert [s["number"] for s in analysis["sets"]] == [1, 2, 3, 4]

    def test_extraction_method_and_source_regions_are_real(self, analysis: dict) -> None:
        """Ogni valore estratto punta a una `SourceRegion` reale, marcata
        `PDF_TEXT` e in coordinate normalizzate (backend §9)."""

        regions = {region["id"]: region for region in analysis["source_regions"]}
        assert regions, "nessuna SourceRegion pubblicata"
        assert {region["method"] for region in regions.values()} == {"PDF_TEXT"}
        for region in regions.values():
            assert 0.0 <= region["x"] <= 1.0 and 0.0 <= region["y"] <= 1.0
            assert 0.0 < region["width"] <= 1.0 and 0.0 < region["height"] <= 1.0

        set1 = next(s for s in analysis["sets"] if s["number"] == 1)
        for side in ("a", "b"):
            for position in POSITIONS:
                field = set1[f"team_{side}_starting_six"][position]
                assert field["source_region_id"] in regions, field
                assert field["confidence"] is not None and field["confidence"] > 0.0

    def test_match_metadata_comes_from_the_header(self, analysis: dict) -> None:
        match = analysis["match"]
        assert match["competition"] == "Serie B1"
        assert match["match_number"] == "8477"
        assert match["date"] == "2025-12-20"
        assert match["time"] == "21:00"
        assert match["venue"] == "CEREA"
        # `final_result` è DERIVATO dai punteggi dei set estratti: Cerea perde 1-3.
        assert match["final_result"] == [1, 3]

    def test_does_not_fabricate_service_turns_or_first_server(self, analysis: dict) -> None:
        """Il requisito più importante: ciò che non è estratto resta vuoto.

        Se un giorno questi campi vengono estratti davvero, questo test va
        aggiornato — ed è esattamente il punto: il cambiamento deve essere
        deliberato, non un effetto collaterale silenzioso.
        """

        for set_data in analysis["sets"]:
            assert set_data["service_turns"] == [], (
                f"set {set_data['number']}: turni di servizio fabbricati"
            )
            assert set_data["starting_team_id"] == "", (
                f"set {set_data['number']}: prima squadra al servizio inventata"
            )
            check = next(
                (c for c in set_data["validation"]["checks"] if c["id"] == "fields-not-extracted"),
                None,
            )
            assert check is not None, f"set {set_data['number']}: assenza non dichiarata"
            assert check["status"] == "WARNING"
            for missing in ("turni di servizio", "sostituzioni", "punteggio al cambio"):
                assert missing in check["message"]


def _analysis_via_isolated_app(pdf_path: Path, tmp_dir: Path) -> dict:
    """Come la fixture `client`, ma usabile da una fixture di classe.

    `monkeypatch` non è disponibile a scope di classe: l'ambiente viene
    modificato e ripristinato a mano.
    """

    import os

    previous = {
        key: os.environ.get(key)
        for key in ("DATABASE_URL", "STORAGE_DIR", "VOLLEYREF_USE_REAL_PIPELINE")
    }
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_dir / 'test.db'}"
    os.environ["STORAGE_DIR"] = str(tmp_dir / "storage")
    os.environ["VOLLEYREF_USE_REAL_PIPELINE"] = "1"
    try:
        from app.core.config import get_settings

        get_settings.cache_clear()
        import main as main_module

        importlib.reload(main_module)
        with TestClient(main_module.app) as test_client:
            return _analysis_for(test_client, pdf_path)
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        from app.core.config import get_settings

        get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Fixture 1 — Volano, percorso raster/OCR, end-to-end su PDF reale
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not VOLANO_PDF.exists(), reason=f"fixture PDF reale assente: {VOLANO_PDF}")
@pytest.mark.skipif(
    not ocr_module.is_available(),
    reason=(
        "binario `tesseract` non installato: il percorso raster non può girare. "
        "I valori §28 della fixture Volano restano verificati solo dal test "
        "`test_raster_branch_maps_recorded_readings_to_public_analysis`, che NON "
        "esercita l'OCR reale. Installare Tesseract per la verifica completa."
    ),
)
def test_volano_raster_end_to_end_matches_prompt_section_28(client: TestClient) -> None:
    """§28 fixture 1, end-to-end con OCR reale: Rothoblaas 9,17,14,15,3,13 —
    Azimut 4,16,1,10,14,11 — punteggio Set 1 26-24."""

    analysis = _analysis_for(client, VOLANO_PDF)
    _assert_not_from_fallback(analysis)

    set1 = next(s for s in analysis["sets"] if s["number"] == 1)
    assert _six(set1, "a") == VOLANO_SET1_ROTHOBLAAS
    assert _six(set1, "b") == VOLANO_SET1_AZIMUT
    assert set1["final_score"] == VOLANO_SET1_SCORE

    assert {region["method"] for region in analysis["source_regions"]} == {"OCR"}
    # Nomi squadra da OCR: sempre dichiarati "da verificare" (backend §27).
    uncertain = _check(analysis, "team-name-uncertain")
    assert uncertain is not None and uncertain["status"] == "WARNING"

    for set_data in analysis["sets"]:
        assert set_data["service_turns"] == []
        assert set_data["starting_team_id"] == ""


# ---------------------------------------------------------------------------
# Ramo raster verificato senza Tesseract, con le letture registrate
# ---------------------------------------------------------------------------

#: Letture del referto Volano fissate da `tests/test_pdf_raster.py` (Set 1 dal
#: §28, Set 2-4 osservati sul PDF renderizzato). Slot A = formazione di
#: sinistra del riquadro, B = destra; le squadre si scambiano di lato fra i set.
_VOLANO_FORMATIONS: dict[int, dict[str, dict[str, str]]] = {
    1: {
        "a": {"I": "9", "II": "17", "III": "14", "IV": "15", "V": "3", "VI": "13"},
        "b": {"I": "4", "II": "16", "III": "1", "IV": "10", "V": "14", "VI": "11"},
    },
    2: {
        "a": {"I": "4", "II": "16", "III": "1", "IV": "10", "V": "14", "VI": "11"},
        "b": {"I": "9", "II": "17", "III": "14", "IV": "15", "V": "3", "VI": "13"},
    },
    3: {
        "a": {"I": "9", "II": "17", "III": "14", "IV": "15", "V": "3", "VI": "13"},
        "b": {"I": "11", "II": "4", "III": "16", "IV": "1", "V": "10", "VI": "14"},
    },
    4: {
        "a": {"I": "4", "II": "16", "III": "1", "IV": "10", "V": "14", "VI": "11"},
        "b": {"I": "4", "II": "17", "III": "14", "IV": "15", "V": "3", "VI": "13"},
    },
}
#: Colonne fisse `SQUADRA A` / `SQUADRA B` della tabella "RISULTATO FINALE".
_VOLANO_SET_SCORES = {1: ("26", "24"), 2: ("18", "25"), 3: ("17", "25"), 4: ("22", "25")}
#: Nomi squadra come li restituisce l'OCR della fascia titolo: troncati.
_VOLANO_TEAM_NAMES = {
    1: {"a": "ROTHOBLAAS", "b": "AZIMUT GIO"},
    2: {"a": "AZIMUT GIO", "b": "ROTHOBLAAS"},
    3: {"a": "ROTHOBLAAS", "b": "AZIMUT GIO"},
    4: {"a": "AZIMUT GIO", "b": "ROTHOBLAA"},
}


def _recorded_volano_raster_result():
    """`RasterExtractionResult` con le letture registrate al posto dell'OCR.

    Sostituisce **solo** lo stadio "leggi i pixel": gli id di regione, il metodo
    e la forma delle osservazioni sono quelli veri prodotti da
    `app/layout/detector.py` (`p1-set{N}-formation-{slot}-{POS}`,
    `p1-final_result-set{N}-score-{slot}`, `p1-set{N}-team-{slot}`).
    """

    from app.extraction.raster.pipeline import RasterExtractionResult

    observations: list[RawObservation] = []
    regions: list[SourceRegion] = []
    y = 0.10

    def add(region_id: str, value: str, expected: ExpectedType, confidence: float) -> None:
        nonlocal y
        y = min(0.95, y + 0.001)
        regions.append(
            SourceRegion(
                id=region_id,
                page=1,
                x=0.1,
                y=y,
                width=0.01,
                height=0.01,
                method=ExtractionMethod.OCR,
                region_type=expected.value,
                raw_text=value,
            )
        )
        observations.append(
            RawObservation(
                id=f"obs-{region_id}",
                region_id=region_id,
                expected_type=expected,
                method=ExtractionMethod.OCR,
                candidates=[ObservationCandidate(value=value, confidence=confidence)],
            )
        )

    for set_number, slots in _VOLANO_FORMATIONS.items():
        for slot, six in slots.items():
            for position, value in six.items():
                add(
                    f"p1-set{set_number}-formation-{slot}-{position}",
                    value,
                    ExpectedType.PLAYER_NUMBER,
                    0.93,
                )
        for slot, name in _VOLANO_TEAM_NAMES[set_number].items():
            add(f"p1-set{set_number}-team-{slot}", name, ExpectedType.TEAM_NAME, 0.81)
    for set_number, (score_a, score_b) in _VOLANO_SET_SCORES.items():
        add(f"p1-final_result-set{set_number}-score-a", score_a, ExpectedType.SCORE, 0.95)
        add(f"p1-final_result-set{set_number}-score-b", score_b, ExpectedType.SCORE, 0.95)

    return RasterExtractionResult(
        run_id="recorded",
        pdf_path=str(VOLANO_PDF),
        dpi=300.0,
        observations=observations,
        regions=regions,
        diagnostics={"source": "letture registrate, nessun OCR eseguito"},
    )


@pytest.mark.skipif(not VOLANO_PDF.exists(), reason=f"fixture PDF reale assente: {VOLANO_PDF}")
def test_raster_branch_maps_recorded_readings_to_public_analysis(
    client: TestClient, monkeypatch
) -> None:
    """§28 fixture 1 attraverso l'API, con l'OCR sostituito dalle letture note.

    NON è una verifica dell'OCR (per quella serve Tesseract, vedi il test sopra):
    verifica che il ramo raster della pipeline — riconoscimento del lato di campo
    set per set, ordine dei punteggi, nomi squadra, mappatura sul modello
    pubblico — produca l'`Analysis` giusta date quelle letture. È il pezzo che
    prima non esisteva e che l'OCR da solo non copriva.
    """

    from app.extraction.raster import pipeline as raster_pipeline

    monkeypatch.setattr(
        raster_pipeline, "extract_raster", lambda *a, **k: _recorded_volano_raster_result()
    )

    analysis = _analysis_for(client, VOLANO_PDF)
    _assert_not_from_fallback(analysis)

    assert [s["number"] for s in analysis["sets"]] == [1, 2, 3, 4]

    set1 = next(s for s in analysis["sets"] if s["number"] == 1)
    assert _six(set1, "a") == VOLANO_SET1_ROTHOBLAAS
    assert _six(set1, "b") == VOLANO_SET1_AZIMUT
    assert set1["final_score"] == VOLANO_SET1_SCORE

    # Set 2: le squadre hanno cambiato campo. Il sestetto di Rothoblaas deve
    # restare su `team_a` — è il caso che un mapping "sinistra = squadra A"
    # sbaglierebbe in silenzio.
    set2 = next(s for s in analysis["sets"] if s["number"] == 2)
    assert _six(set2, "a") == VOLANO_SET1_ROTHOBLAAS
    assert _six(set2, "b") == VOLANO_SET1_AZIMUT
    assert set2["final_score"] == [18, 25]

    # Nomi squadra: OCR troncato, usato così com'è e dichiarato incerto.
    assert "ROTHOBLAA" in analysis["match"]["team_a"]["name"].upper()
    assert "AZIMUT" in analysis["match"]["team_b"]["name"].upper()
    uncertain = _check(analysis, "team-name-uncertain")
    assert uncertain is not None and uncertain["status"] == "WARNING"

    # Metadati partita: il percorso raster non li estrae ⇒ restano assenti.
    match = analysis["match"]
    assert match["competition"] is None
    assert match["match_number"] is None
    assert match["date"] is None
    assert match["time"] is None
    assert match["venue"] is None
    # Derivato dai punteggi estratti: Rothoblaas vince solo il Set 1.
    assert match["final_result"] == [1, 3]

    for set_data in analysis["sets"]:
        assert set_data["service_turns"] == []
        assert set_data["starting_team_id"] == ""


# ---------------------------------------------------------------------------
# Il fallback esiste, non fa crashare l'app e non si spaccia per dato reale
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not CEREA_PDF.exists(), reason=f"fixture PDF reale assente: {CEREA_PDF}")
def test_fallback_is_disabled_by_default_and_loudly_marked_when_forced(
    client: TestClient, monkeypatch
) -> None:
    """Con `VOLLEYREF_USE_REAL_PIPELINE=0` l'app continua a funzionare ma
    dichiara `INVALID` che i dati non vengono dal PDF caricato."""

    monkeypatch.setenv("VOLLEYREF_USE_REAL_PIPELINE", "0")
    analysis = _analysis_for(client, CEREA_PDF)

    fallback = _check(analysis, "pipeline-fallback")
    assert fallback is not None, "fallback silenzioso: nessun check nel risultato"
    assert fallback["status"] == "INVALID"
    assert "NON provengono dal PDF caricato" in fallback["message"]
    assert analysis["overall_validation"] == "INVALID"
    assert analysis["validation"]["status"] == "INVALID"
    # L'app resta usabile: lo stato è READY, non FAILED.
    assert analysis["status"] == "READY"


def test_unsupported_pdf_falls_back_instead_of_crashing(client: TestClient, tmp_path) -> None:
    """Un PDF valido che non è un referto non deve far esplodere la pipeline,
    ma non deve nemmeno produrre un'analisi che sembra reale."""

    import pymupdf

    path = tmp_path / "vuoto.pdf"
    doc = pymupdf.open()
    doc.new_page()
    doc.save(str(path))
    doc.close()

    analysis = _analysis_for(client, path)
    assert analysis["status"] == "READY"
    fallback = _check(analysis, "pipeline-fallback")
    assert fallback is not None and fallback["status"] == "INVALID"
