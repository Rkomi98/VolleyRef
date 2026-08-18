"""Test del percorso "il PDF ha un text layer utilizzabile" (backend §18-§19,
§23, §28 fixture 2) sul PDF reale della partita ISUZU CEREA VR - ROTHOBLAAS
VOLANO TN (Serie B1F C, 20/12/2025).

Copre, nell'ordine:
1. `app.pdf.inspector.inspect_pdf` — deve riconoscere che questo referto ha
   un text layer utilizzabile.
2. `app.extraction.text.acroform` — il documento ha un AcroForm (confermato
   via `pdfinfo`), ma nella realtà l'unico campo presente è una firma vuota:
   il test documenta questo fatto invece di fingere che l'AcroForm contenga
   i dati di gioco.
3. `app.extraction.text.generic` — il fallback posizionale deve ricostruire
   il sestetto titolare del Set 1 per almeno una delle due squadre, con gli
   stessi valori della fixture sintetica
   `tests/fixtures/raw_observations_set1_cerea.py`.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.extraction.text.acroform import extract_acroform_observations, has_usable_acroform_data
from app.extraction.text.generic import extract_generic_text_observations
from app.pdf.inspector import inspect_pdf
from tests.fixtures.raw_observations_set1_cerea import (
    EXPECTED_TEAM_A_STARTING_SIX,
    EXPECTED_TEAM_B_STARTING_SIX,
)

CEREA_PDF_PATH = (
    Path(__file__).resolve().parents[2]
    / "examples"
    / "2025#12#20#ISUZU CEREA VR#ROTHOBLAAS VOLANO TN#Serie B1F C#11_Cerea_b1fc_25.pdf"
)

pytestmark = pytest.mark.skipif(
    not CEREA_PDF_PATH.exists(),
    reason=f"fixture PDF reale non trovata: {CEREA_PDF_PATH}",
)


def test_inspect_pdf_recognizes_usable_text_layer():
    capabilities = inspect_pdf(CEREA_PDF_PATH)

    assert capabilities.page_count == 1
    assert capabilities.has_usable_text_layer is True
    assert capabilities.requires_ocr is False
    # Non ci accontentiamo di "qualche parola": il referto ha un text layer
    # ricco, non solo un watermark o pochi metadati residui.
    assert capabilities.total_words > 500
    assert capabilities.distinct_text_rows > 20


def test_acroform_present_but_without_usable_match_data():
    """Il PDF ha davvero un AcroForm (confermato via `pdfinfo`, campo
    `Form: AcroForm`), ma è onesto constatare che l'unico campo compilabile
    al suo interno è una firma digitale vuota (`Signature1`) — i numeri di
    maglia e i punteggi sono testo disegnato staticamente, non campi di
    modulo. Questo test fissa quel comportamento osservato piuttosto che
    fingere che l'estrazione da AcroForm produca dati di gioco che nella
    realtà non porta.
    """
    assert has_usable_acroform_data(CEREA_PDF_PATH) is False

    result = extract_acroform_observations(CEREA_PDF_PATH)

    assert result.observations == []
    assert result.regions == []


def _starting_six_from_generic_extraction(path: Path) -> dict[str, dict[str, str]]:
    """Raggruppa le osservazioni del Set 1 prodotte da `generic.py` per
    "slot" di colonna (team-0 / team-1, senza pretendere di sapere quale
    squadra reale sia): {slot: {posizione: valore_candidato_migliore}}.
    """
    result = extract_generic_text_observations(path)
    per_slot: dict[str, dict[str, str]] = {}

    for observation in result.observations:
        region = result.region_by_id(observation.region_id)
        assert region is not None
        if "-set1-" not in region.id:
            continue

        # region_id ha la forma region-p{page}-set{N}-team-{slot}-{position}
        parts = region.id.split("-")
        position = parts[-1]
        team_slot = "-".join(parts[-3:-1])  # es. "team-0"

        best_candidate = max(observation.candidates, key=lambda c: c.confidence)
        per_slot.setdefault(team_slot, {})[position] = best_candidate.value

    return per_slot


def test_generic_extraction_recovers_set1_starting_six_for_at_least_one_team():
    """Criterio di successo esplicito del task: la migliore lettura prodotta
    dall'estrazione generica per il sestetto titolare del Set 1 deve
    corrispondere ai valori attesi (backend §28 fixture 2) per almeno una
    delle due squadre — gli stessi valori della fixture sintetica usata da
    `app/volleyball`.
    """
    starting_six_by_slot = _starting_six_from_generic_extraction(CEREA_PDF_PATH)

    assert starting_six_by_slot, "nessuna osservazione di Set 1 estratta"

    expected_six_sets = [EXPECTED_TEAM_A_STARTING_SIX, EXPECTED_TEAM_B_STARTING_SIX]
    matches = [
        extracted
        for extracted in starting_six_by_slot.values()
        if extracted in expected_six_sets
    ]

    assert matches, (
        "nessuno slot del Set 1 corrisponde ai valori attesi: "
        f"estratti={starting_six_by_slot}, attesi={expected_six_sets}"
    )

    # Bonus, non un requisito del task: su questa fixture reale entrambe le
    # squadre vengono ricostruite correttamente (non solo "almeno una").
    assert len(matches) == 2
