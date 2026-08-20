"""Generazione dell'export CSV di un dataset di un'Analysis.

Specifica di riferimento: 02_volleyref_backend_prompt.md §31.
`GET /api/v1/analyses/{analysis_id}/export.csv` accetta un query parameter
`dataset` con valore ``starting-six`` oppure ``service-turns``; ogni
dataset produce le stesse colonne dello sheet corrispondente dell'export
.xlsx (§30), così che i due formati restino coerenti tra loro.
"""

from __future__ import annotations

from typing import Optional

from app.models.analysis import Analysis, AnalysisGlobalStatus
from app.models.match import ServiceTurn
from app.services.analysis_service import ExportFailedError

_STARTING_SIX_LABELS = ("I", "II", "III", "IV", "V", "VI")
_STARTING_SIX_COLUMNS = ["Set", "Team", *_STARTING_SIX_LABELS]

_SERVICE_TURNS_COLUMNS = [
    "Set",
    "Sequence",
    "Team",
    "Player",
    "Rotation",
    "Score Start A",
    "Score Start B",
    "Score End A",
    "Score End B",
    "Points Scored",
    "Confidence",
    "Status",
]

VALID_DATASETS = ("starting-six", "service-turns")


def _require_ready(analysis: Analysis) -> None:
    """Stesso controllo di readiness usato per l'export .xlsx (§30/§31):
    un'Analysis non ancora READY non ha dati affidabili da esportare."""

    if analysis.status != AnalysisGlobalStatus.READY:
        raise ExportFailedError(
            "L'analisi non è pronta per l'export: è richiesto lo stato READY.",
            details={"analysis_id": analysis.id, "status": analysis.status.value},
        )


def _rotation_value(turn: ServiceTurn) -> Optional[str]:
    rotation = turn.rotation.value
    return rotation.value if rotation is not None else None


def _starting_six_rows(analysis: Analysis) -> list[dict]:
    rows: list[dict] = []
    for set_data in analysis.sets:
        for team_name, starting_six in (
            (analysis.match.team_a.name, set_data.team_a_starting_six),
            (analysis.match.team_b.name, set_data.team_b_starting_six),
        ):
            row = {"Set": set_data.number, "Team": team_name}
            row.update(
                {label: getattr(starting_six, label).value for label in _STARTING_SIX_LABELS}
            )
            rows.append(row)
    return rows


def _service_turns_rows(analysis: Analysis) -> list[dict]:
    rows: list[dict] = []
    for set_data in analysis.sets:
        for turn in set_data.service_turns:
            rows.append(
                {
                    "Set": set_data.number,
                    "Sequence": turn.sequence,
                    "Team": turn.team_id,
                    "Player": turn.player.value,
                    "Rotation": _rotation_value(turn),
                    "Score Start A": turn.score_start.value[0],
                    "Score Start B": turn.score_start.value[1],
                    "Score End A": turn.score_end.value[0],
                    "Score End B": turn.score_end.value[1],
                    "Points Scored": turn.points_scored,
                    "Confidence": turn.player.confidence,
                    "Status": turn.status.value,
                }
            )
    return rows


def build_csv(analysis: Analysis, dataset: str) -> str:
    """Costruisce il CSV del dataset richiesto (§31).

    `dataset` deve essere ``"starting-six"`` o ``"service-turns"``; ogni
    altro valore alza ``ExportFailedError`` (EXPORT_FAILED, §34), così come
    un'Analysis non ancora READY.
    """

    _require_ready(analysis)

    # Import lazy: `pandas` pesa ~50-70MB residenti e serve solo qui, sul
    # percorso di export (raro). Importarlo all'avvio del modulo — che è nella
    # catena di import di `main` via il router — terrebbe quella memoria
    # occupata per tutta la vita del processo, riducendo il margine disponibile
    # alla pipeline di estrazione su referti scansionati.
    import pandas as pd

    if dataset == "starting-six":
        frame = pd.DataFrame(_starting_six_rows(analysis), columns=_STARTING_SIX_COLUMNS)
    elif dataset == "service-turns":
        frame = pd.DataFrame(_service_turns_rows(analysis), columns=_SERVICE_TURNS_COLUMNS)
    else:
        raise ExportFailedError(
            f"Dataset export non supportato: '{dataset}'.",
            details={"dataset": dataset, "valid_datasets": list(VALID_DATASETS)},
        )

    return frame.to_csv(index=False)
