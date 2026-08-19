/**
 * Modello di dominio frontend (camelCase). Nessun componente React deve dipendere
 * dalla forma grezza delle risposte HTTP: quella vive in `src/lib/api/dto.ts` ed è
 * convertita in questi tipi da `src/lib/api/mapper.ts`.
 *
 * Specifica di riferimento: 01_volleyref_frontend_prompt.md §21, §9.
 */

export type ExtractedValue<T> = {
  id: string
  value: T
  originalValue: T
  confidence: number | null
  manuallyConfirmed: boolean
  sourceRegionId?: string
}

export type ExtractionMethod = "PDF_TEXT" | "OCR" | "DERIVED"

export type SourceRegion = {
  id: string
  page: number
  x: number
  y: number
  width: number
  height: number
  method: ExtractionMethod
  regionType?: string
  rawText?: string
}

export type RotationLabel = "I" | "II" | "III" | "IV" | "V" | "VI"

export type StartingSix = {
  I: ExtractedValue<number | null>
  II: ExtractedValue<number | null>
  III: ExtractedValue<number | null>
  IV: ExtractedValue<number | null>
  V: ExtractedValue<number | null>
  VI: ExtractedValue<number | null>
}

export type TurnStatus = "VALID" | "WARNING" | "INVALID"

export type ServiceTurn = {
  id: string
  sequence: number
  teamId: string
  player: ExtractedValue<number | null>
  rotation: ExtractedValue<RotationLabel | null>
  scoreStart: ExtractedValue<[number, number]>
  scoreEnd: ExtractedValue<[number, number]>
  pointsScored: number
  status: TurnStatus
  sourceRegionIds: string[]
}

export type CheckStatus = "VALID" | "WARNING" | "INVALID"

export type ValidationCheck = {
  id: string
  label: string
  status: CheckStatus
  message: string | null
  fieldIds: string[]
}

export type ValidationResult = {
  status: CheckStatus
  checks: ValidationCheck[]
}

export type Team = {
  id: string
  name: string
}

export type MatchInfo = {
  competition: string | null
  matchNumber: string | null
  date: string | null
  time: string | null
  venue: string | null
  teamA: Team
  teamB: Team
  finalResult: [number, number]
}

export type SetData = {
  number: number
  startingTeamId: string
  teamAStartingSix: StartingSix
  teamBStartingSix: StartingSix
  serviceTurns: ServiceTurn[]
  finalScore: [number, number]
  validation: ValidationResult
}

/** Stato globale dell'analisi (backend §6). */
export type AnalysisGlobalStatus = "UPLOADED" | "PROCESSING" | "READY" | "FAILED"

/**
 * Id dei passi della pipeline mostrati in `ProcessingState` (frontend §6).
 * Coincidono 1:1 con gli step id del backend (backend §6) — le etichette italiane
 * mostrate all'utente ("Lettura documento", "Riconoscimento dei set", ...) vivono
 * solo nel componente di presentazione, non nel contratto dati.
 */
export type ProcessingStepId =
  | "READ_DOCUMENT"
  | "DETECT_SETS"
  | "EXTRACT_STARTING_SIX"
  | "EXTRACT_SERVICE_TURNS"
  | "VALIDATE"

/**
 * Stato di un singolo step. NB: il backend restituisce questi valori in
 * UPPERCASE (vedi `ApiProcessingStep` in dto.ts); il componente di design system
 * `ProgressStep` si aspetta invece 'pending'|'processing'|'completed'|'error' in
 * lowercase — la conversione avviene nel mapper, non qui.
 */
export type ProcessingStepStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "ERROR"

export type ProcessingStep = {
  id: ProcessingStepId
  status: ProcessingStepStatus
}

export type AnalysisStatus = {
  analysisId: string
  status: AnalysisGlobalStatus
  progress: number
  currentStep: ProcessingStepId | null
  steps: ProcessingStep[]
  error: ApiError | null
}

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

export type Analysis = {
  id: string
  status: AnalysisGlobalStatus
  overallValidation: CheckStatus | null
  match: MatchInfo
  sets: SetData[]
  sourceRegions: SourceRegion[]
  validation: ValidationResult
}

/** Dataset esportabili in CSV (frontend §20, backend §31). */
export type ExportDataset = "starting-six" | "service-turns"
