"""Contenitore di risultato condiviso dai due percorsi di estrazione da text
layer (`acroform.py` e `generic.py`).

`RawObservation.region_id` è una chiave verso una `SourceRegion` (backend §9,
§23), ma il contratto in `app/domain/raw_observation.py` non è responsabile di
trasportare la regione stessa — quello è compito di chi produce le
osservazioni. Questo modulo definisce il tipo di ritorno comune: la lista di
`RawObservation` richiesta dai due estrattori, accompagnata dalle
`SourceRegion` a cui i `region_id` fanno riferimento, così che chi consuma il
risultato (es. i test, o in futuro `app/layout`) possa risalire alle
coordinate normalizzate senza dover ri-aprire il PDF.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.domain.raw_observation import RawObservation
from app.models.common import SourceRegion


class TextLayerExtractionResult(BaseModel):
    observations: list[RawObservation]
    regions: list[SourceRegion]

    def region_by_id(self, region_id: str) -> SourceRegion | None:
        for region in self.regions:
            if region.id == region_id:
                return region
        return None
