/**
 * Forma esatta ("wire format") delle risposte del backend FastAPI — snake_case,
 * rispecchia 1:1 i modelli Pydantic in backend/app/models/. Nessun componente React
 * deve importare da questo file: solo `mapper.ts` lo fa, per produrre i tipi
 * camelCase di `src/lib/types.ts` (frontend prompt §21: "aggiungi un mapper tra API
 * DTO e model frontend").
 *
 * Specifica di riferimento: 02_volleyref_backend_prompt.md §6-§12, §34.
 */

export type ApiExtractedValue<T> = {
  id: string
  value: T
  original_value: T
  confidence: number | null
  manually_confirmed: boolean
  source_region_id?: string | null
}

export type ApiExtractionMethod = "PDF_TEXT" | "OCR" | "DERIVED"

export type ApiSourceRegion = {
  id: string
  page: number
  x: number
  y: number
  width: number
  height: number
  method: ApiExtractionMethod
  region_type?: string | null
  raw_text?: string | null
}

export type ApiRotationLabel = "I" | "II" | "III" | "IV" | "V" | "VI"

export type ApiStartingSix = {
  I: ApiExtractedValue<number | null>
  II: ApiExtractedValue<number | null>
  III: ApiExtractedValue<number | null>
  IV: ApiExtractedValue<number | null>
  V: ApiExtractedValue<number | null>
  VI: ApiExtractedValue<number | null>
}

export type ApiCheckStatus = "VALID" | "WARNING" | "INVALID"

export type ApiServiceTurn = {
  id: string
  sequence: number
  team_id: string
  player: ApiExtractedValue<number | null>
  rotation: ApiExtractedValue<ApiRotationLabel | null>
  score_start: ApiExtractedValue<[number, number]>
  score_end: ApiExtractedValue<[number, number]>
  points_scored: number
  status: ApiCheckStatus
  source_region_ids: string[]
}

export type ApiValidationCheck = {
  id: string
  label: string
  status: ApiCheckStatus
  message: string | null
  field_ids: string[]
}

export type ApiValidationResult = {
  status: ApiCheckStatus
  checks: ApiValidationCheck[]
}

export type ApiTeam = {
  id: string
  name: string
}

export type ApiMatchInfo = {
  competition: string | null
  match_number: string | null
  date: string | null
  time: string | null
  venue: string | null
  team_a: ApiTeam
  team_b: ApiTeam
  final_result: [number, number]
}

export type ApiSet = {
  number: number
  starting_team_id: string
  team_a_starting_six: ApiStartingSix
  team_b_starting_six: ApiStartingSix
  service_turns: ApiServiceTurn[]
  final_score: [number, number]
  validation: ApiValidationResult
}

export type ApiAnalysisGlobalStatus = "UPLOADED" | "PROCESSING" | "READY" | "FAILED"

export type ApiErrorCode =
  | "INVALID_FILE"
  | "UNSUPPORTED_PDF"
  | "ANALYSIS_NOT_FOUND"
  | "ANALYSIS_FAILED"
  | "INVALID_FIELD_VALUE"
  | "EXPORT_FAILED"
  | "SOURCE_PDF_MISSING"
  | "INTERNAL_ERROR"

export type ApiError = {
  code: ApiErrorCode
  message: string
  details?: Record<string, unknown>
}

export type ApiErrorEnvelope = {
  error: ApiError
}

export type ApiProcessingStepId =
  | "READ_DOCUMENT"
  | "DETECT_SETS"
  | "EXTRACT_STARTING_SIX"
  | "EXTRACT_SERVICE_TURNS"
  | "VALIDATE"

export type ApiProcessingStepStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "ERROR"

export type ApiProcessingStep = {
  id: ApiProcessingStepId
  status: ApiProcessingStepStatus
}

/** Risposta di `POST /api/v1/analyses` (backend §5). */
export type ApiCreateAnalysisResponse = {
  analysis_id: string
  status: ApiAnalysisGlobalStatus
}

/** Risposta di `GET /api/v1/analyses/{id}/status` (backend §6). */
export type ApiAnalysisStatusResponse = {
  analysis_id: string
  status: ApiAnalysisGlobalStatus
  progress: number
  current_step: ApiProcessingStepId | null
  steps: ApiProcessingStep[]
  error: ApiError | null
}

/** Risposta di `GET /api/v1/analyses/{id}` (backend §7). */
export type ApiAnalysis = {
  id: string
  status: ApiAnalysisGlobalStatus
  overall_validation: ApiCheckStatus | null
  match: ApiMatchInfo
  sets: ApiSet[]
  source_regions: ApiSourceRegion[]
  validation: ApiValidationResult
}
