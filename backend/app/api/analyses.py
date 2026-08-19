"""Router FastAPI per la risorsa Analysis.

Specifica di riferimento: 02_volleyref_backend_prompt.md §4-§20 (contratto
endpoint). Gli errori non vengono gestiti qui: i metodi di
`app.services.analysis_service.AnalysisService` alzano `AnalysisServiceError`
(e sottoclassi), che `main.py` traduce in `ErrorEnvelope` con lo status HTTP
corretto — questo router resta quindi privo di logica di error-mapping.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, Request, Response, UploadFile
from pydantic import BaseModel

from app.export.csv import build_csv
from app.export.xlsx import build_xlsx
from app.core.security import validate_pdf_upload
from app.models.analysis import Analysis, AnalysisStatusResponse, CreateAnalysisResponse
from app.services.analysis_service import AnalysisService
from app.services.field_update import FieldUpdateService, get_field_update_service

router = APIRouter(prefix="/api/v1/analyses", tags=["analyses"])


def get_analysis_service(request: Request) -> AnalysisService:
    """Recupera il singleton AnalysisService creato allo startup (main.py)."""

    return request.app.state.analysis_service


class FieldUpdateRequest(BaseModel):
    """Body di `PATCH /analyses/{id}/fields/{field_id}` (backend §13)."""

    value: Any


@router.post("", status_code=202, response_model=CreateAnalysisResponse)
async def create_analysis(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    service: AnalysisService = Depends(get_analysis_service),
) -> CreateAnalysisResponse:
    content = await file.read()
    validate_pdf_upload(
        filename=file.filename, content_type=file.content_type, content=content
    )
    return await service.create_analysis(
        filename=file.filename,
        content_type=file.content_type,
        content=content,
        background_tasks=background_tasks,
    )


@router.get("/{analysis_id}/status", response_model=AnalysisStatusResponse)
def get_analysis_status(
    analysis_id: str, service: AnalysisService = Depends(get_analysis_service)
) -> AnalysisStatusResponse:
    return service.get_status(analysis_id)


@router.get("/{analysis_id}", response_model=Analysis)
def get_analysis(
    analysis_id: str, service: AnalysisService = Depends(get_analysis_service)
) -> Analysis:
    return service.get_analysis(analysis_id)


@router.patch("/{analysis_id}/fields/{field_id}", response_model=Analysis)
def patch_field(
    analysis_id: str,
    field_id: str,
    body: FieldUpdateRequest,
    service: FieldUpdateService = Depends(get_field_update_service),
) -> Analysis:
    return service.patch_field(analysis_id, field_id, body.value)


@router.post("/{analysis_id}/reset-corrections", response_model=Analysis)
def reset_corrections(
    analysis_id: str, service: FieldUpdateService = Depends(get_field_update_service)
) -> Analysis:
    return service.reset_corrections(analysis_id)


@router.post("/{analysis_id}/reanalyze", status_code=202)
def reanalyze(
    analysis_id: str,
    background_tasks: BackgroundTasks,
    service: FieldUpdateService = Depends(get_field_update_service),
) -> Response:
    service.reanalyze(analysis_id, background_tasks)
    return Response(status_code=202)


@router.get("/{analysis_id}/export.xlsx")
def export_xlsx(
    analysis_id: str, service: AnalysisService = Depends(get_analysis_service)
) -> Response:
    analysis = service.get_analysis(analysis_id)
    content = build_xlsx(analysis)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="analysis-{analysis_id}.xlsx"'
        },
    )


@router.get("/{analysis_id}/export.csv")
def export_csv(
    analysis_id: str,
    dataset: str = Query(...),
    service: AnalysisService = Depends(get_analysis_service),
) -> Response:
    analysis = service.get_analysis(analysis_id)
    content = build_csv(analysis, dataset)
    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="analysis-{analysis_id}-{dataset}.csv"'
        },
    )
