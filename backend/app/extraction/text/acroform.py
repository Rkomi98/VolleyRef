"""Estrazione da campi AcroForm (moduli PDF compilabili).

Quando un referto ha un `AcroForm` (confermato ad es. da `pdfinfo` con
`Form: AcroForm`), i valori compilati potrebbero essere accessibili
direttamente come campi di modulo, con un bounding box preciso e senza
bisogno di alcuna inferenza posizionale sul testo disegnato.

API PyMuPDF verificata empiricamente in questa installazione (pymupdf
1.28.2, import come `import pymupdf`, non `import fitz`):

- `Document.get_form_text_fields()` NON esiste più in questa versione
  (`hasattr(doc, "get_form_text_fields")` è `False`) — non va usata.
- L'unica via verificata è `Page.widgets()`, che restituisce un oggetto
  `Widget` per ciascun campo presente su quella pagina, con `field_name`,
  `field_value`, `field_type_string` e `rect` (bounding box in coordinate
  PDF native, origine in alto a sinistra come il resto di PyMuPDF).
- `Document.is_form_pdf` indica se il documento ha un `AcroForm` con almeno
  un campo.

Nota di onestà empirica, verificata sulla fixture reale disponibile
(`examples/...Cerea.../11_Cerea_b1fc_25.pdf`): il suo `AcroForm` contiene un
solo campo, `Signature1` (tipo `Signature`, valore vuoto, `rect` degenere a
area nulla) — cioè un campo di firma digitale non compilato, non un campo
con i numeri di maglia o i punteggi. I dati della partita in quel referto
sono testo disegnato staticamente (percorso `generic.py`), non campi di
modulo. Questo modulo resta comunque necessario: altri software di
compilazione referti FIPAV (o revisioni future dello stesso software) possono
usare campi di testo/checkbox veri per i valori, e in quel caso questa è la
via corretta — molto più affidabile del parsing posizionale.
"""

from __future__ import annotations

import uuid
from pathlib import Path

import pymupdf

from app.domain.raw_observation import ExpectedType, ObservationCandidate, RawObservation
from app.extraction.text.result import TextLayerExtractionResult
from app.models.common import ExtractionMethod, SourceRegion

# Confidence alta ma non massima: il valore viene dal modulo stesso (non da
# un'inferenza posizionale), ma può comunque essere stato digitato in modo
# errato da chi ha compilato il PDF, quindi non è "certezza assoluta".
ACROFORM_CONFIDENCE = 0.98


def _guess_expected_type(field_name: str) -> ExpectedType:
    """Inferisce l'ExpectedType dal nome del campo di modulo.

    Euristica basata su parole chiave italiane/inglesi plausibili nei nomi
    dei campi di un referto FIPAV compilabile. In assenza di indizi, ricade
    su MATCH_META (il tipo più generico) piuttosto che indovinare.
    """
    name = (field_name or "").upper()
    if "SCORE" in name or "PUNT" in name:
        return ExpectedType.SCORE
    if "TEAM" in name or "SQUADR" in name:
        return ExpectedType.TEAM_NAME
    if "ROTAT" in name or "POSIZ" in name:
        return ExpectedType.ROTATION_LABEL
    if "SERV" in name and ("SQUADR" in name or "TEAM" in name or "INIZI" in name):
        return ExpectedType.SERVING_TEAM_INDICATOR
    if "PLAYER" in name or "GIOCAT" in name or "MAGLIA" in name or "NUM" in name or "N°" in name:
        return ExpectedType.PLAYER_NUMBER
    return ExpectedType.MATCH_META


def has_usable_acroform_data(path: str | Path) -> bool:
    """True se il documento ha un AcroForm con almeno un campo non vuoto.

    Utile per decidere se vale la pena tentare questo percorso prima di
    ricadere su `generic.py`: un `AcroForm` presente ma con soli campi vuoti
    (es. una firma non ancora apposta) non porta alcuna osservazione utile.
    """
    doc = pymupdf.open(str(path))
    try:
        if not doc.is_form_pdf:
            return False
        for page in doc:
            for widget in page.widgets() or []:
                if (widget.field_value or "").strip():
                    return True
        return False
    finally:
        doc.close()


def extract_acroform_observations(path: str | Path) -> TextLayerExtractionResult:
    """Estrae una RawObservation per ciascun campo AcroForm con un valore non
    vuoto, con una SourceRegion le cui coordinate sono normalizzate a [0,1]
    a partire dal bounding box nativo del widget e dalle dimensioni della
    pagina che lo contiene.

    Se il documento non ha un AcroForm, o i suoi campi sono tutti vuoti,
    restituisce un risultato con liste vuote (non è un errore: significa
    semplicemente che questo percorso non ha nulla da offrire per questo
    documento, e chi orchestra l'estrazione dovrebbe ricadere su
    `generic.py`).
    """
    doc = pymupdf.open(str(path))
    observations: list[RawObservation] = []
    regions: list[SourceRegion] = []
    try:
        if not doc.is_form_pdf:
            return TextLayerExtractionResult(observations=observations, regions=regions)

        for page_index, page in enumerate(doc):
            page_width = float(page.rect.width) or 1.0
            page_height = float(page.rect.height) or 1.0

            for widget in page.widgets() or []:
                value = (widget.field_value or "").strip()
                if not value:
                    continue

                rect = widget.rect
                field_name = widget.field_name or f"xref{widget.xref}"
                region_id = f"region-acroform-p{page_index}-{field_name}"

                region = SourceRegion(
                    id=region_id,
                    page=page_index,
                    x=min(1.0, max(0.0, rect.x0 / page_width)),
                    y=min(1.0, max(0.0, rect.y0 / page_height)),
                    width=min(1.0, max(0.0, (rect.x1 - rect.x0) / page_width)),
                    height=min(1.0, max(0.0, (rect.y1 - rect.y0) / page_height)),
                    method=ExtractionMethod.PDF_TEXT,
                    region_type="acroform_field",
                    raw_text=value,
                )
                regions.append(region)

                observations.append(
                    RawObservation(
                        id=f"obs-acroform-{uuid.uuid4()}",
                        region_id=region.id,
                        expected_type=_guess_expected_type(field_name),
                        method=ExtractionMethod.PDF_TEXT,
                        candidates=[ObservationCandidate(value=value, confidence=ACROFORM_CONFIDENCE)],
                    )
                )

        return TextLayerExtractionResult(observations=observations, regions=regions)
    finally:
        doc.close()
