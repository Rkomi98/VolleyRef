/**
 * Mapper tra il "wire format" del backend (`./dto.ts`, snake_case) e il modello di
 * dominio frontend (`../types.ts`, camelCase). Nessun componente React deve importare
 * `dto.ts` direttamente: passa sempre da qui (frontend prompt §21).
 *
 * Ogni tipo ha una funzione `...DtoToModel` (usata da `HttpAnalysisService` per le
 * risposte del backend, e da `MockAnalysisService` per leggere il proprio store
 * interno) e, dove serve, l'inverso `...ModelToDto`. L'inverso è usato principalmente
 * da `MockAnalysisService`, che mantiene lo stato interno nella stessa forma
 * "canonica" (snake_case) che restituirebbe il backend reale, e quindi deve poter
 * riconvertire il modello mutato (dopo `updateField`/`resetCorrections`/`reanalyze`)
 * nella forma DTO prima di persisterlo. Non serve invece per il body della PATCH
 * `/fields/{field_id}` in sé: quel body è semplicemente `{ value }` e `value` ha la
 * stessa forma sia nel DTO che nel modello (solo le chiavi che lo contengono cambiano
 * nome, es. `original_value` vs `originalValue`), quindi non richiede una funzione di
 * mapping dedicata — vedi `HttpAnalysisService.updateField`.
 *
 * Nota su `ProcessingStepStatus`/`ApiProcessingStepStatus`: restano UPPERCASE in
 * entrambe le direzioni. La conversione a lowercase per componenti di design system
 * che se lo aspettano (es. `ProgressStep`) è responsabilità del componente
 * consumatore, non di questo mapper (vedi commento in `../types.ts`).
 */

import type * as Dto from "./dto"
import type * as Model from "../types"

const ROTATION_LABELS: readonly Model.RotationLabel[] = ["I", "II", "III", "IV", "V", "VI"]

// ---------------------------------------------------------------------------
// ExtractedValue<T>
// ---------------------------------------------------------------------------

export function mapExtractedValueDtoToModel<T>(dto: Dto.ApiExtractedValue<T>): Model.ExtractedValue<T> {
  return {
    id: dto.id,
    value: dto.value,
    originalValue: dto.original_value,
    confidence: dto.confidence,
    manuallyConfirmed: dto.manually_confirmed,
    sourceRegionId: dto.source_region_id ?? undefined,
  }
}

export function mapExtractedValueModelToDto<T>(model: Model.ExtractedValue<T>): Dto.ApiExtractedValue<T> {
  return {
    id: model.id,
    value: model.value,
    original_value: model.originalValue,
    confidence: model.confidence,
    manually_confirmed: model.manuallyConfirmed,
    source_region_id: model.sourceRegionId ?? null,
  }
}

// ---------------------------------------------------------------------------
// SourceRegion
// ---------------------------------------------------------------------------

export function mapSourceRegionDtoToModel(dto: Dto.ApiSourceRegion): Model.SourceRegion {
  return {
    id: dto.id,
    page: dto.page,
    x: dto.x,
    y: dto.y,
    width: dto.width,
    height: dto.height,
    method: dto.method,
    regionType: dto.region_type ?? undefined,
    rawText: dto.raw_text ?? undefined,
  }
}

export function mapSourceRegionModelToDto(model: Model.SourceRegion): Dto.ApiSourceRegion {
  return {
    id: model.id,
    page: model.page,
    x: model.x,
    y: model.y,
    width: model.width,
    height: model.height,
    method: model.method,
    region_type: model.regionType ?? null,
    raw_text: model.rawText ?? null,
  }
}

// ---------------------------------------------------------------------------
// StartingSix
// ---------------------------------------------------------------------------

export function mapStartingSixDtoToModel(dto: Dto.ApiStartingSix): Model.StartingSix {
  return {
    I: mapExtractedValueDtoToModel(dto.I),
    II: mapExtractedValueDtoToModel(dto.II),
    III: mapExtractedValueDtoToModel(dto.III),
    IV: mapExtractedValueDtoToModel(dto.IV),
    V: mapExtractedValueDtoToModel(dto.V),
    VI: mapExtractedValueDtoToModel(dto.VI),
  }
}

export function mapStartingSixModelToDto(model: Model.StartingSix): Dto.ApiStartingSix {
  return {
    I: mapExtractedValueModelToDto(model.I),
    II: mapExtractedValueModelToDto(model.II),
    III: mapExtractedValueModelToDto(model.III),
    IV: mapExtractedValueModelToDto(model.IV),
    V: mapExtractedValueModelToDto(model.V),
    VI: mapExtractedValueModelToDto(model.VI),
  }
}

// ---------------------------------------------------------------------------
// ServiceTurn
// ---------------------------------------------------------------------------

export function mapServiceTurnDtoToModel(dto: Dto.ApiServiceTurn): Model.ServiceTurn {
  return {
    id: dto.id,
    sequence: dto.sequence,
    teamId: dto.team_id,
    player: mapExtractedValueDtoToModel(dto.player),
    rotation: mapExtractedValueDtoToModel(dto.rotation),
    scoreStart: mapExtractedValueDtoToModel(dto.score_start),
    scoreEnd: mapExtractedValueDtoToModel(dto.score_end),
    pointsScored: dto.points_scored,
    status: dto.status,
    sourceRegionIds: [...dto.source_region_ids],
  }
}

export function mapServiceTurnModelToDto(model: Model.ServiceTurn): Dto.ApiServiceTurn {
  return {
    id: model.id,
    sequence: model.sequence,
    team_id: model.teamId,
    player: mapExtractedValueModelToDto(model.player),
    rotation: mapExtractedValueModelToDto(model.rotation),
    score_start: mapExtractedValueModelToDto(model.scoreStart),
    score_end: mapExtractedValueModelToDto(model.scoreEnd),
    points_scored: model.pointsScored,
    status: model.status,
    source_region_ids: [...model.sourceRegionIds],
  }
}

// ---------------------------------------------------------------------------
// ValidationCheck / ValidationResult
// ---------------------------------------------------------------------------

export function mapValidationCheckDtoToModel(dto: Dto.ApiValidationCheck): Model.ValidationCheck {
  return {
    id: dto.id,
    label: dto.label,
    status: dto.status,
    message: dto.message,
    fieldIds: [...dto.field_ids],
  }
}

export function mapValidationCheckModelToDto(model: Model.ValidationCheck): Dto.ApiValidationCheck {
  return {
    id: model.id,
    label: model.label,
    status: model.status,
    message: model.message,
    field_ids: [...model.fieldIds],
  }
}

export function mapValidationResultDtoToModel(dto: Dto.ApiValidationResult): Model.ValidationResult {
  return {
    status: dto.status,
    checks: dto.checks.map(mapValidationCheckDtoToModel),
  }
}

export function mapValidationResultModelToDto(model: Model.ValidationResult): Dto.ApiValidationResult {
  return {
    status: model.status,
    checks: model.checks.map(mapValidationCheckModelToDto),
  }
}

// ---------------------------------------------------------------------------
// Team / MatchInfo
// ---------------------------------------------------------------------------

export function mapTeamDtoToModel(dto: Dto.ApiTeam): Model.Team {
  return { id: dto.id, name: dto.name }
}

export function mapTeamModelToDto(model: Model.Team): Dto.ApiTeam {
  return { id: model.id, name: model.name }
}

export function mapMatchInfoDtoToModel(dto: Dto.ApiMatchInfo): Model.MatchInfo {
  return {
    competition: dto.competition,
    matchNumber: dto.match_number,
    date: dto.date,
    time: dto.time,
    venue: dto.venue,
    teamA: mapTeamDtoToModel(dto.team_a),
    teamB: mapTeamDtoToModel(dto.team_b),
    finalResult: dto.final_result,
  }
}

export function mapMatchInfoModelToDto(model: Model.MatchInfo): Dto.ApiMatchInfo {
  return {
    competition: model.competition,
    match_number: model.matchNumber,
    date: model.date,
    time: model.time,
    venue: model.venue,
    team_a: mapTeamModelToDto(model.teamA),
    team_b: mapTeamModelToDto(model.teamB),
    final_result: model.finalResult,
  }
}

// ---------------------------------------------------------------------------
// SetData
// ---------------------------------------------------------------------------

export function mapSetDtoToModel(dto: Dto.ApiSet): Model.SetData {
  return {
    number: dto.number,
    startingTeamId: dto.starting_team_id,
    teamAStartingSix: mapStartingSixDtoToModel(dto.team_a_starting_six),
    teamBStartingSix: mapStartingSixDtoToModel(dto.team_b_starting_six),
    serviceTurns: dto.service_turns.map(mapServiceTurnDtoToModel),
    finalScore: dto.final_score,
    validation: mapValidationResultDtoToModel(dto.validation),
  }
}

export function mapSetModelToDto(model: Model.SetData): Dto.ApiSet {
  return {
    number: model.number,
    starting_team_id: model.startingTeamId,
    team_a_starting_six: mapStartingSixModelToDto(model.teamAStartingSix),
    team_b_starting_six: mapStartingSixModelToDto(model.teamBStartingSix),
    service_turns: model.serviceTurns.map(mapServiceTurnModelToDto),
    final_score: model.finalScore,
    validation: mapValidationResultModelToDto(model.validation),
  }
}

// ---------------------------------------------------------------------------
// ProcessingStep / ApiError
// ---------------------------------------------------------------------------

export function mapProcessingStepDtoToModel(dto: Dto.ApiProcessingStep): Model.ProcessingStep {
  return { id: dto.id, status: dto.status }
}

export function mapProcessingStepModelToDto(model: Model.ProcessingStep): Dto.ApiProcessingStep {
  return { id: model.id, status: model.status }
}

export function mapApiErrorDtoToModel(dto: Dto.ApiError | null): Model.ApiError | null {
  if (!dto) return null
  return { code: dto.code, message: dto.message, details: dto.details }
}

export function mapApiErrorModelToDto(model: Model.ApiError | null): Dto.ApiError | null {
  if (!model) return null
  return { code: model.code, message: model.message, details: model.details }
}

// ---------------------------------------------------------------------------
// AnalysisStatus
// ---------------------------------------------------------------------------

export function mapAnalysisStatusDtoToModel(dto: Dto.ApiAnalysisStatusResponse): Model.AnalysisStatus {
  return {
    analysisId: dto.analysis_id,
    status: dto.status,
    progress: dto.progress,
    currentStep: dto.current_step,
    steps: dto.steps.map(mapProcessingStepDtoToModel),
    error: mapApiErrorDtoToModel(dto.error),
  }
}

export function mapAnalysisStatusModelToDto(model: Model.AnalysisStatus): Dto.ApiAnalysisStatusResponse {
  return {
    analysis_id: model.analysisId,
    status: model.status,
    progress: model.progress,
    current_step: model.currentStep,
    steps: model.steps.map(mapProcessingStepModelToDto),
    error: mapApiErrorModelToDto(model.error),
  }
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export function mapAnalysisDtoToModel(dto: Dto.ApiAnalysis): Model.Analysis {
  return {
    id: dto.id,
    status: dto.status,
    overallValidation: dto.overall_validation,
    match: mapMatchInfoDtoToModel(dto.match),
    sets: dto.sets.map(mapSetDtoToModel),
    sourceRegions: dto.source_regions.map(mapSourceRegionDtoToModel),
    validation: mapValidationResultDtoToModel(dto.validation),
  }
}

export function mapAnalysisModelToDto(model: Model.Analysis): Dto.ApiAnalysis {
  return {
    id: model.id,
    status: model.status,
    overall_validation: model.overallValidation,
    match: mapMatchInfoModelToDto(model.match),
    sets: model.sets.map(mapSetModelToDto),
    source_regions: model.sourceRegions.map(mapSourceRegionModelToDto),
    validation: mapValidationResultModelToDto(model.validation),
  }
}

export { ROTATION_LABELS }
