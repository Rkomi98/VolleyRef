import * as XLSX from "xlsx"

import { AnalysisApiError } from "@/lib/api/errors"
import { mapAnalysisDtoToModel, mapAnalysisModelToDto, ROTATION_LABELS } from "@/lib/api/mapper"
import type * as Dto from "@/lib/api/dto"
import type * as Model from "@/lib/types"

import type { AnalysisService } from "./AnalysisService"

/**
 * Implementazione di `AnalysisService` senza alcuna chiamata di rete (frontend
 * prompt §22). Simula sia la pipeline di elaborazione (5 step consultabili via
 * `getStatus()` in polling) sia due partite mock realistiche (§23):
 *
 * - `cerea-rothoblaas`: ISUZU CEREA VR vs ROTHOBLAAS VOLANO TN, 1-3, dati puliti.
 * - `sanmarco-vicenza`: PALLAVOLO SAN MARCO vs NUOVA EDIL VICENZA, con warning ed
 *   errori deliberati (confidence bassa, un punteggio di set incoerente) — §23.
 *
 * Lo stato interno è mantenuto nella stessa forma "canonica" (DTO, snake_case) che
 * restituirebbe il vero backend: si legge/scrive sempre passando dal mapper
 * (`mapAnalysisDtoToModel` / `mapAnalysisModelToDto`), esattamente come farebbe
 * `HttpAnalysisService` con le risposte HTTP. Questo esercita entrambe le direzioni
 * del mapper e garantisce che il comportamento osservabile dai componenti React non
 * dipenda da quale implementazione è effettivamente in uso.
 */

// ---------------------------------------------------------------------------
// Generatore deterministico dei turni di servizio (ispirato a
// "VolleyRef Design System/ui_kits/volleyref/mock-data.js" — algoritmo di
// simulazione soltanto, non la forma dei dati: l'output qui rispetta esattamente
// i tipi di `src/lib/types.ts`).
// ---------------------------------------------------------------------------

type TeamSide = "A" | "B"

function mulberry32(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

type Rally = {
  team: TeamSide
  points: number
  start: { A: number; B: number }
  end: { A: number; B: number }
}

/** Porta della logica di `simulateSet` del design system: produce i turni di servizio
 * grezzi (chi serve, quanti punti fa, punteggio a inizio/fine turno) che portano
 * deterministicamente al punteggio finale dato. */
function simulateRallies(finalA: number, finalB: number, firstServer: TeamSide, rng: () => number): Rally[] {
  const score = { A: 0, B: 0 }
  let server: TeamSide = firstServer
  let turnStart = { A: 0, B: 0 }
  let turnPoints = 0
  const target = { A: finalA, B: finalB }
  const turns: Rally[] = []
  let guard = 0
  while ((score.A !== finalA || score.B !== finalB) && guard < 400) {
    guard++
    const candidates: TeamSide[] = (["A", "B"] as TeamSide[]).filter((t) => score[t] < target[t])
    const winner: TeamSide = candidates.length === 1 ? candidates[0] : candidates[Math.floor(rng() * candidates.length)]
    if (winner === server) {
      score[winner]++
      turnPoints++
    } else {
      turns.push({ team: server, points: turnPoints, start: { ...turnStart }, end: { ...score } })
      server = winner
      score[winner]++
      turnStart = { ...score }
      turnStart[winner] -= 1
      turnPoints = 1
    }
  }
  turns.push({ team: server, points: turnPoints, start: turnStart, end: { ...score } })
  return turns
}

type SetBuildOptions = {
  /** Posizioni del sestetto iniziale da marcare con confidence bassa. */
  lowConfidenceLineup?: { team: TeamSide; position: Model.RotationLabel }[]
  /** Indici (0-based) dei turni di servizio da marcare con confidence bassa / WARNING. */
  lowConfidenceTurnIndexes?: number[]
  /** Indici dei turni da marcare come già corretti manualmente. */
  editedTurnIndexes?: number[]
  /** Introduce deliberatamente un'incoerenza tra l'ultimo turno e il punteggio finale del set. */
  corruptLastEnd?: boolean
}

function buildStartingSix(
  rng: () => number,
  setNumber: number,
  teamId: string,
  lineup: readonly number[],
  method: Model.ExtractionMethod,
  lowConfidencePositions: Model.RotationLabel[]
): { six: Model.StartingSix; regions: Model.SourceRegion[] } {
  const low = new Set(lowConfidencePositions)
  const regions: Model.SourceRegion[] = []
  const six = {} as Model.StartingSix

  ROTATION_LABELS.forEach((label, idx) => {
    const fieldId = `set${setNumber}-${teamId}-position-${label}`
    const regionId = `region-${fieldId}`
    const isLow = low.has(label)

    regions.push({
      id: regionId,
      page: 1,
      x: round3(0.08 + idx * 0.03),
      y: round3(0.18 + (teamId === "team-b" ? 0.25 : 0)),
      width: 0.03,
      height: 0.02,
      method,
      regionType: "STARTING_PLAYER",
      rawText: String(lineup[idx]),
    })

    six[label] = {
      id: fieldId,
      value: lineup[idx],
      originalValue: lineup[idx],
      confidence: isLow ? round2(0.35 + rng() * 0.2) : round2(0.92 + rng() * 0.07),
      manuallyConfirmed: false,
      sourceRegionId: regionId,
    }
  })

  return { six, regions }
}

function buildServiceTurns(
  rng: () => number,
  setNumber: number,
  teamAId: string,
  teamBId: string,
  lineups: { A: readonly number[]; B: readonly number[] },
  finalA: number,
  finalB: number,
  firstServer: TeamSide,
  method: Model.ExtractionMethod,
  opts: SetBuildOptions
): { turns: Model.ServiceTurn[]; regions: Model.SourceRegion[] } {
  const rawTurns = simulateRallies(finalA, finalB, firstServer, rng)
  const counters = { A: 0, B: 0 }
  const teamIdOf: Record<TeamSide, string> = { A: teamAId, B: teamBId }
  const regions: Model.SourceRegion[] = []
  const lowConfidenceIndexes = new Set(opts.lowConfidenceTurnIndexes ?? [])
  const editedIndexes = new Set(opts.editedTurnIndexes ?? [])

  const turns: Model.ServiceTurn[] = rawTurns.map((rally, i) => {
    counters[rally.team]++
    const n = counters[rally.team]
    const offset = rally.team === firstServer ? 0 : 5
    const idx = (n - 1 + offset) % 6
    const rotation = ROTATION_LABELS[idx]
    const player = lineups[rally.team][idx]
    const sequence = i + 1
    const turnId = `set${setNumber}-turn-${String(sequence).padStart(3, "0")}`

    const isLowConfidence = lowConfidenceIndexes.has(i)
    const isEdited = editedIndexes.has(i)
    const isLastTurn = i === rawTurns.length - 1

    let end = rally.end
    if (opts.corruptLastEnd && isLastTurn) {
      end = { ...end }
      if (rally.team === "A") end.B -= 1
      else end.A -= 1
    }

    const playerRegionId = `region-${turnId}-player`
    const rotationRegionId = `region-${turnId}-rotation`
    const scoreStartRegionId = `region-${turnId}-score-start`
    const scoreEndRegionId = `region-${turnId}-score-end`
    const baseY = round3(0.3 + (setNumber - 1) * 0.12 + i * 0.01)

    regions.push(
      {
        id: playerRegionId,
        page: 1,
        x: 0.1,
        y: baseY,
        width: 0.03,
        height: 0.018,
        method,
        regionType: "SERVER_NUMBER",
        rawText: String(player),
      },
      {
        id: rotationRegionId,
        page: 1,
        x: 0.15,
        y: baseY,
        width: 0.02,
        height: 0.018,
        method,
        regionType: "ROTATION_LABEL",
        rawText: rotation,
      },
      {
        id: scoreStartRegionId,
        page: 1,
        x: 0.2,
        y: baseY,
        width: 0.04,
        height: 0.018,
        method: "DERIVED",
        regionType: "SCORE_AT_SERVE_START",
        rawText: `${rally.start.A}-${rally.start.B}`,
      },
      {
        id: scoreEndRegionId,
        page: 1,
        x: 0.25,
        y: baseY,
        width: 0.04,
        height: 0.018,
        method: "DERIVED",
        regionType: "SCORE_AT_SERVE_END",
        rawText: `${end.A}-${end.B}`,
      }
    )

    const scoreStartTuple: [number, number] = [rally.start.A, rally.start.B]
    const scoreEndTuple: [number, number] = [end.A, end.B]
    const pointsScored = rally.team === "A" ? scoreEndTuple[0] - scoreStartTuple[0] : scoreEndTuple[1] - scoreStartTuple[1]

    const status: Model.TurnStatus = opts.corruptLastEnd && isLastTurn ? "INVALID" : isLowConfidence ? "WARNING" : "VALID"

    return {
      id: turnId,
      sequence,
      teamId: teamIdOf[rally.team],
      player: {
        id: `${turnId}-player`,
        value: player,
        originalValue: player,
        confidence: isLowConfidence ? round2(0.3 + rng() * 0.25) : round2(0.9 + rng() * 0.09),
        manuallyConfirmed: isEdited,
        sourceRegionId: playerRegionId,
      },
      rotation: {
        id: `${turnId}-rotation`,
        value: rotation,
        originalValue: rotation,
        confidence: round2(0.94 + rng() * 0.05),
        manuallyConfirmed: false,
        sourceRegionId: rotationRegionId,
      },
      scoreStart: {
        id: `${turnId}-score-start`,
        value: scoreStartTuple,
        originalValue: scoreStartTuple,
        confidence: round2(0.95 + rng() * 0.04),
        manuallyConfirmed: false,
        sourceRegionId: scoreStartRegionId,
      },
      scoreEnd: {
        id: `${turnId}-score-end`,
        value: scoreEndTuple,
        originalValue: scoreEndTuple,
        confidence: round2(0.95 + rng() * 0.04),
        manuallyConfirmed: false,
        sourceRegionId: scoreEndRegionId,
      },
      pointsScored,
      status,
      sourceRegionIds: [playerRegionId, rotationRegionId, scoreStartRegionId, scoreEndRegionId],
    }
  })

  return { turns, regions }
}

function worstStatus(statuses: Model.CheckStatus[]): Model.CheckStatus {
  if (statuses.includes("INVALID")) return "INVALID"
  if (statuses.includes("WARNING")) return "WARNING"
  return "VALID"
}

/** Ricalcola `set.validation` in base allo stato corrente dei campi del set
 * (usata sia in fase di costruzione dei mock sia dopo ogni correzione manuale). */
function computeSetValidation(set: Model.SetData): Model.ValidationResult {
  const checks: Model.ValidationCheck[] = []

  const incompleteLineupFieldIds: string[] = []
  for (const six of [set.teamAStartingSix, set.teamBStartingSix] as const) {
    for (const label of ROTATION_LABELS) {
      if (six[label].value === null) incompleteLineupFieldIds.push(six[label].id)
    }
  }
  checks.push({
    id: `set${set.number}-lineup-complete`,
    label: "Sestetto iniziale completo",
    status: incompleteLineupFieldIds.length === 0 ? "VALID" : "INVALID",
    message: incompleteLineupFieldIds.length === 0 ? null : "Una o più posizioni del sestetto iniziale non sono state riconosciute",
    fieldIds: incompleteLineupFieldIds,
  })

  const lastTurn = set.serviceTurns[set.serviceTurns.length - 1]
  const scoreConsistent =
    !lastTurn || (lastTurn.scoreEnd.value[0] === set.finalScore[0] && lastTurn.scoreEnd.value[1] === set.finalScore[1])
  checks.push({
    id: `set${set.number}-score-consistent`,
    label: "Punteggio finale coerente",
    status: scoreConsistent ? "VALID" : "INVALID",
    message: scoreConsistent ? null : "Il punteggio finale del set non è coerente con l'ultimo turno di servizio registrato",
    fieldIds: lastTurn && !scoreConsistent ? [lastTurn.scoreEnd.id] : [],
  })

  const flaggedTurns = set.serviceTurns.filter((t) => t.status !== "VALID")
  checks.push({
    id: `set${set.number}-sequence-consistent`,
    label: "Sequenza dei servizi coerente",
    status: flaggedTurns.some((t) => t.status === "INVALID") ? "INVALID" : flaggedTurns.length > 0 ? "WARNING" : "VALID",
    message: flaggedTurns.length > 0 ? `${flaggedTurns.length} turni di servizio da verificare` : null,
    fieldIds: flaggedTurns.map((t) => t.id),
  })

  const lowConfidenceFieldIds: string[] = []
  const collectLow = (ev: Model.ExtractedValue<unknown>) => {
    if (ev.confidence !== null && ev.confidence < 0.7) lowConfidenceFieldIds.push(ev.id)
  }
  for (const six of [set.teamAStartingSix, set.teamBStartingSix] as const) {
    for (const label of ROTATION_LABELS) collectLow(six[label])
  }
  for (const turn of set.serviceTurns) {
    collectLow(turn.player)
    collectLow(turn.rotation)
    collectLow(turn.scoreStart)
    collectLow(turn.scoreEnd)
  }
  checks.push({
    id: `set${set.number}-confidence`,
    label: "Dati con confidence ridotta",
    status: lowConfidenceFieldIds.length > 0 ? "WARNING" : "VALID",
    message: lowConfidenceFieldIds.length > 0 ? `${lowConfidenceFieldIds.length} valori richiedono verifica` : null,
    fieldIds: lowConfidenceFieldIds,
  })

  return { status: worstStatus(checks.map((c) => c.status)), checks }
}

function computeOverallValidation(sets: Model.SetData[]): Model.ValidationResult {
  return {
    status: worstStatus(sets.map((s) => s.validation.status)),
    checks: sets.flatMap((s) => s.validation.checks),
  }
}

function buildSet(
  rng: () => number,
  setNumber: number,
  teamAId: string,
  teamBId: string,
  lineups: { A: readonly number[]; B: readonly number[] },
  finalA: number,
  finalB: number,
  firstServer: TeamSide,
  method: Model.ExtractionMethod,
  opts: SetBuildOptions
): { set: Model.SetData; regions: Model.SourceRegion[] } {
  const lowA = (opts.lowConfidenceLineup ?? []).filter((e) => e.team === "A").map((e) => e.position)
  const lowB = (opts.lowConfidenceLineup ?? []).filter((e) => e.team === "B").map((e) => e.position)

  const { six: teamAStartingSix, regions: regionsA } = buildStartingSix(rng, setNumber, teamAId, lineups.A, method, lowA)
  const { six: teamBStartingSix, regions: regionsB } = buildStartingSix(rng, setNumber, teamBId, lineups.B, method, lowB)
  const { turns: serviceTurns, regions: turnRegions } = buildServiceTurns(
    rng,
    setNumber,
    teamAId,
    teamBId,
    lineups,
    finalA,
    finalB,
    firstServer,
    method,
    opts
  )

  const set: Model.SetData = {
    number: setNumber,
    startingTeamId: firstServer === "A" ? teamAId : teamBId,
    teamAStartingSix,
    teamBStartingSix,
    serviceTurns,
    finalScore: [finalA, finalB],
    validation: { status: "VALID", checks: [] },
  }
  set.validation = computeSetValidation(set)

  return { set, regions: [...regionsA, ...regionsB, ...turnRegions] }
}

type MatchMeta = {
  competition: string
  matchNumber: string
  date: string
  time: string
  venue: string
  teamAName: string
  teamBName: string
}

type SetSpec = {
  finalA: number
  finalB: number
  firstServer: TeamSide
  opts?: SetBuildOptions
}

function buildMatchAnalysis(
  id: string,
  seed: number,
  meta: MatchMeta,
  method: Model.ExtractionMethod,
  setsSpec: SetSpec[],
  lineups: { A: readonly number[]; B: readonly number[] }
): Model.Analysis {
  const rng = mulberry32(seed)
  const teamAId = "team-a"
  const teamBId = "team-b"

  const built = setsSpec.map((spec, i) =>
    buildSet(rng, i + 1, teamAId, teamBId, lineups, spec.finalA, spec.finalB, spec.firstServer, method, spec.opts ?? {})
  )
  const sets = built.map((b) => b.set)
  const sourceRegions = built.flatMap((b) => b.regions)

  const setsWonA = sets.filter((s) => s.finalScore[0] > s.finalScore[1]).length
  const setsWonB = sets.length - setsWonA
  const validation = computeOverallValidation(sets)

  return {
    id,
    status: "READY",
    overallValidation: validation.status,
    match: {
      competition: meta.competition,
      matchNumber: meta.matchNumber,
      date: meta.date,
      time: meta.time,
      venue: meta.venue,
      teamA: { id: teamAId, name: meta.teamAName },
      teamB: { id: teamBId, name: meta.teamBName },
      finalResult: [setsWonA, setsWonB],
    },
    sets,
    sourceRegions,
    validation,
  }
}

// ---------------------------------------------------------------------------
// Le due partite mock (frontend prompt §23)
// ---------------------------------------------------------------------------

/** Partita 1 — dati puliti, nessun warning. ISUZU CEREA VR vs ROTHOBLAAS VOLANO TN,
 * 1-3, set 25-27 / 19-25 / 25-23 / 24-26. Un solo dettaglio a bassa confidence nel
 * set 4 per mostrare l'indicatore anche in un'analisi altrimenti pulita. */
const CEREA_ROTHOBLAAS = buildMatchAnalysis(
  "cerea-rothoblaas",
  42,
  {
    competition: "Serie B1 — Girone C",
    matchNumber: "8477",
    date: "2025-12-20",
    time: "21:00",
    venue: "PalaCerea, Cerea (VR)",
    teamAName: "ISUZU CEREA VR",
    teamBName: "ROTHOBLAAS VOLANO TN",
  },
  "PDF_TEXT",
  [
    { finalA: 25, finalB: 27, firstServer: "A" },
    { finalA: 19, finalB: 25, firstServer: "B" },
    { finalA: 25, finalB: 23, firstServer: "A" },
    {
      finalA: 24,
      finalB: 26,
      firstServer: "B",
      opts: {
        lowConfidenceLineup: [{ team: "B", position: "III" }],
        lowConfidenceTurnIndexes: [6],
      },
    },
  ],
  { A: [2, 5, 3, 8, 14, 9], B: [14, 9, 3, 4, 15, 17] }
)

/** Partita 2 — deliberatamente con warning ed errori (frontend prompt §23):
 * più posizioni del sestetto e più turni di servizio a bassa confidence, e nel set 2
 * un'incoerenza vera e propria tra l'ultimo turno di servizio registrato e il
 * punteggio finale dichiarato. */
const SANMARCO_VICENZA = buildMatchAnalysis(
  "sanmarco-vicenza",
  7,
  {
    competition: "Serie C — Girone A",
    matchNumber: "3021",
    date: "2026-05-03",
    time: "18:30",
    venue: "Palasport Comunale, San Marco",
    teamAName: "PALLAVOLO SAN MARCO",
    teamBName: "NUOVA EDIL VICENZA",
  },
  "OCR",
  [
    { finalA: 25, finalB: 19, firstServer: "A" },
    {
      finalA: 23,
      finalB: 25,
      firstServer: "B",
      opts: { corruptLastEnd: true, lowConfidenceTurnIndexes: [3] },
    },
    { finalA: 25, finalB: 22, firstServer: "A" },
    {
      finalA: 20,
      finalB: 25,
      firstServer: "B",
      opts: {
        lowConfidenceLineup: [
          { team: "A", position: "IV" },
          { team: "B", position: "II" },
        ],
        lowConfidenceTurnIndexes: [2, 5],
        editedTurnIndexes: [4],
      },
    },
    { finalA: 15, finalB: 12, firstServer: "A" },
  ],
  { A: [7, 11, 4, 9, 2, 15], B: [3, 18, 8, 12, 5, 21] }
)

// ---------------------------------------------------------------------------
// Pipeline di elaborazione simulata (frontend prompt §6)
// ---------------------------------------------------------------------------

const PROCESSING_STEP_IDS: Model.ProcessingStepId[] = [
  "READ_DOCUMENT",
  "DETECT_SETS",
  "EXTRACT_STARTING_SIX",
  "EXTRACT_SERVICE_TURNS",
  "VALIDATE",
]
const STEP_DURATION_MS = 650
const TOTAL_DURATION_MS = STEP_DURATION_MS * PROCESSING_STEP_IDS.length

/** Stato della pipeline calcolato come funzione pura del tempo trascorso da
 * `createdAt`: non richiede timer né mutazioni, ed è quindi stabile e coerente
 * qualunque sia la cadenza di polling del chiamante. */
function computeStatus(analysisId: string, createdAt: number): Model.AnalysisStatus {
  const elapsed = Date.now() - createdAt

  if (elapsed >= TOTAL_DURATION_MS) {
    return {
      analysisId,
      status: "READY",
      progress: 100,
      currentStep: null,
      steps: PROCESSING_STEP_IDS.map((id) => ({ id, status: "COMPLETED" })),
      error: null,
    }
  }

  const stepIndex = Math.min(PROCESSING_STEP_IDS.length - 1, Math.floor(elapsed / STEP_DURATION_MS))
  const partial = (elapsed % STEP_DURATION_MS) / STEP_DURATION_MS
  const progress = Math.min(99, Math.round(((stepIndex + partial) / PROCESSING_STEP_IDS.length) * 100))

  const steps: Model.ProcessingStep[] = PROCESSING_STEP_IDS.map((id, i) => ({
    id,
    status: i < stepIndex ? "COMPLETED" : i === stepIndex ? "PROCESSING" : "PENDING",
  }))

  return {
    analysisId,
    status: "PROCESSING",
    progress,
    currentStep: PROCESSING_STEP_IDS[stepIndex],
    steps,
    error: null,
  }
}

// ---------------------------------------------------------------------------
// Modifiche manuali / reset
// ---------------------------------------------------------------------------

function assertNumberOrNull(fieldId: string, value: unknown): asserts value is number | null {
  if (value !== null && typeof value !== "number") {
    throw new AnalysisApiError("INVALID_FIELD_VALUE", `Il campo "${fieldId}" richiede un numero oppure null`)
  }
}

function assertRotationLabelOrNull(fieldId: string, value: unknown): asserts value is Model.RotationLabel | null {
  if (value !== null && !(ROTATION_LABELS as readonly unknown[]).includes(value)) {
    throw new AnalysisApiError("INVALID_FIELD_VALUE", `Il campo "${fieldId}" richiede una rotazione valida (I-VI) oppure null`)
  }
}

function assertScoreTuple(fieldId: string, value: unknown): asserts value is [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "number" || typeof value[1] !== "number") {
    throw new AnalysisApiError("INVALID_FIELD_VALUE", `Il campo "${fieldId}" richiede una coppia di punteggi [squadraA, squadraB]`)
  }
}

function recomputePointsScored(turn: Model.ServiceTurn, teamAId: string): void {
  turn.pointsScored =
    turn.teamId === teamAId
      ? turn.scoreEnd.value[0] - turn.scoreStart.value[0]
      : turn.scoreEnd.value[1] - turn.scoreStart.value[1]
}

function recomputeValidation(analysis: Model.Analysis, set: Model.SetData): void {
  set.validation = computeSetValidation(set)
  analysis.validation = computeOverallValidation(analysis.sets)
  analysis.overallValidation = analysis.validation.status
}

/** Cerca il campo `fieldId` in tutto l'albero dell'analisi (sestetti e turni di
 * servizio di ogni set), lo aggiorna mantenendo `originalValue` e impostando
 * `manuallyConfirmed = true`, ricalcola i campi derivati e rilancia la validazione
 * del set coinvolto e quella complessiva (backend prompt §13). */
function applyFieldUpdate(analysis: Model.Analysis, fieldId: string, value: unknown): void {
  for (const set of analysis.sets) {
    for (const six of [set.teamAStartingSix, set.teamBStartingSix] as const) {
      for (const label of ROTATION_LABELS) {
        const field = six[label]
        if (field.id === fieldId) {
          assertNumberOrNull(fieldId, value)
          field.value = value
          field.manuallyConfirmed = true
          recomputeValidation(analysis, set)
          return
        }
      }
    }

    for (const turn of set.serviceTurns) {
      if (turn.player.id === fieldId) {
        assertNumberOrNull(fieldId, value)
        turn.player.value = value
        turn.player.manuallyConfirmed = true
        recomputeValidation(analysis, set)
        return
      }
      if (turn.rotation.id === fieldId) {
        assertRotationLabelOrNull(fieldId, value)
        turn.rotation.value = value
        turn.rotation.manuallyConfirmed = true
        recomputeValidation(analysis, set)
        return
      }
      if (turn.scoreStart.id === fieldId) {
        assertScoreTuple(fieldId, value)
        turn.scoreStart.value = value
        turn.scoreStart.manuallyConfirmed = true
        recomputePointsScored(turn, analysis.match.teamA.id)
        recomputeValidation(analysis, set)
        return
      }
      if (turn.scoreEnd.id === fieldId) {
        assertScoreTuple(fieldId, value)
        turn.scoreEnd.value = value
        turn.scoreEnd.manuallyConfirmed = true
        recomputePointsScored(turn, analysis.match.teamA.id)
        recomputeValidation(analysis, set)
        return
      }
    }
  }

  throw new AnalysisApiError("INVALID_FIELD_VALUE", `Campo "${fieldId}" non trovato in questa analisi`)
}

/** Riporta ogni campo modificabile al proprio `originalValue` (backend prompt §15/§16),
 * poi rilancia la validazione di ogni set e quella complessiva. */
function resetAllCorrections(analysis: Model.Analysis): void {
  for (const set of analysis.sets) {
    for (const six of [set.teamAStartingSix, set.teamBStartingSix] as const) {
      for (const label of ROTATION_LABELS) {
        const field = six[label]
        field.value = field.originalValue
        field.manuallyConfirmed = false
      }
    }
    for (const turn of set.serviceTurns) {
      turn.player.value = turn.player.originalValue
      turn.player.manuallyConfirmed = false
      turn.rotation.value = turn.rotation.originalValue
      turn.rotation.manuallyConfirmed = false
      turn.scoreStart.value = turn.scoreStart.originalValue
      turn.scoreStart.manuallyConfirmed = false
      turn.scoreEnd.value = turn.scoreEnd.originalValue
      turn.scoreEnd.manuallyConfirmed = false
      recomputePointsScored(turn, analysis.match.teamA.id)
    }
    set.validation = computeSetValidation(set)
  }
  analysis.validation = computeOverallValidation(analysis.sets)
  analysis.overallValidation = analysis.validation.status
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// ---------------------------------------------------------------------------
// Export Excel / CSV (backend prompt §30/§31 — stessa struttura del futuro export
// reale, così che passare a `HttpAnalysisService` non cambi le aspettative di chi
// consuma il Blob).
// ---------------------------------------------------------------------------

function buildStartingSixRows(analysis: Model.Analysis): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const set of analysis.sets) {
    for (const [team, six] of [
      [analysis.match.teamA.name, set.teamAStartingSix],
      [analysis.match.teamB.name, set.teamBStartingSix],
    ] as const) {
      rows.push({
        Set: set.number,
        Team: team,
        I: six.I.value,
        II: six.II.value,
        III: six.III.value,
        IV: six.IV.value,
        V: six.V.value,
        VI: six.VI.value,
      })
    }
  }
  return rows
}

function buildServiceTurnRows(analysis: Model.Analysis): Record<string, unknown>[] {
  const teamNameById = new Map<string, string>([
    [analysis.match.teamA.id, analysis.match.teamA.name],
    [analysis.match.teamB.id, analysis.match.teamB.name],
  ])
  const rows: Record<string, unknown>[] = []
  for (const set of analysis.sets) {
    for (const turn of set.serviceTurns) {
      rows.push({
        Set: set.number,
        Sequence: turn.sequence,
        Team: teamNameById.get(turn.teamId) ?? turn.teamId,
        Player: turn.player.value,
        Rotation: turn.rotation.value,
        "Score Start A": turn.scoreStart.value[0],
        "Score Start B": turn.scoreStart.value[1],
        "Score End A": turn.scoreEnd.value[0],
        "Score End B": turn.scoreEnd.value[1],
        "Points Scored": turn.pointsScored,
        Confidence: turn.player.confidence ?? "",
        Status: turn.status,
      })
    }
  }
  return rows
}

function buildMatchRows(analysis: Model.Analysis): Record<string, unknown>[] {
  return [
    { Campo: "Competizione", Valore: analysis.match.competition ?? "" },
    { Campo: "Numero gara", Valore: analysis.match.matchNumber ?? "" },
    { Campo: "Data", Valore: analysis.match.date ?? "" },
    { Campo: "Ora", Valore: analysis.match.time ?? "" },
    { Campo: "Luogo", Valore: analysis.match.venue ?? "" },
    { Campo: "Squadra A", Valore: analysis.match.teamA.name },
    { Campo: "Squadra B", Valore: analysis.match.teamB.name },
    { Campo: "Risultato finale", Valore: `${analysis.match.finalResult[0]}-${analysis.match.finalResult[1]}` },
    { Campo: "Stato", Valore: analysis.status },
    { Campo: "Validazione complessiva", Valore: analysis.overallValidation ?? "" },
  ]
}

function buildExcelBlob(analysis: Model.Analysis): Blob {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildMatchRows(analysis)), "Match")
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildStartingSixRows(analysis)), "Starting Six")
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildServiceTurnRows(analysis)), "Service Turns")

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const lines = [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))]
  return lines.join("\n")
}

function buildCsvBlob(analysis: Model.Analysis, dataset: Model.ExportDataset): Blob {
  const rows = dataset === "starting-six" ? buildStartingSixRows(analysis) : buildServiceTurnRows(analysis)
  return new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" })
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

type StoredAnalysis = {
  dto: Dto.ApiAnalysis
  /** Istante (epoch ms) usato per calcolare l'avanzamento della pipeline simulata.
   * Le due analisi "fixture" precaricate usano `0`, quindi risultano immediatamente
   * `READY`: non simulano un upload appena avvenuto. */
  createdAt: number
}

export class MockAnalysisService implements AnalysisService {
  private readonly store = new Map<string, StoredAnalysis>()
  private uploadCount = 0

  constructor() {
    this.store.set(CEREA_ROTHOBLAAS.id, { dto: mapAnalysisModelToDto(CEREA_ROTHOBLAAS), createdAt: 0 })
    this.store.set(SANMARCO_VICENZA.id, { dto: mapAnalysisModelToDto(SANMARCO_VICENZA), createdAt: 0 })
  }

  async create(file: File): Promise<{ analysisId: string }> {
    void file // il mock non effettua alcun parsing reale del PDF (frontend prompt §2)

    this.uploadCount += 1
    // Alterna le due fixture così che upload successivi mostrino sia il caso "pulito"
    // sia quello con warning/errori, senza che il chiamante debba conoscere gli id.
    const base = this.uploadCount % 2 === 1 ? CEREA_ROTHOBLAAS : SANMARCO_VICENZA
    const analysisId = `mock-${base.id}-${Date.now()}-${this.uploadCount}`

    const cloned = deepClone(base)
    cloned.id = analysisId

    this.store.set(analysisId, { dto: mapAnalysisModelToDto(cloned), createdAt: Date.now() })
    return { analysisId }
  }

  async getStatus(analysisId: string): Promise<Model.AnalysisStatus> {
    const record = this.getRecord(analysisId)
    return computeStatus(analysisId, record.createdAt)
  }

  async getAnalysis(analysisId: string): Promise<Model.Analysis> {
    const record = this.getRecord(analysisId)
    const analysis = mapAnalysisDtoToModel(record.dto)
    // Riflette lo stato "live" della pipeline simulata anche nell'Analysis completa.
    analysis.status = computeStatus(analysisId, record.createdAt).status
    return analysis
  }

  async updateField(analysisId: string, fieldId: string, value: unknown): Promise<Model.Analysis> {
    const record = this.getRecord(analysisId)
    const analysis = mapAnalysisDtoToModel(record.dto)
    applyFieldUpdate(analysis, fieldId, value)
    record.dto = mapAnalysisModelToDto(analysis)
    return mapAnalysisDtoToModel(record.dto)
  }

  async resetCorrections(analysisId: string): Promise<Model.Analysis> {
    const record = this.getRecord(analysisId)
    const analysis = mapAnalysisDtoToModel(record.dto)
    resetAllCorrections(analysis)
    record.dto = mapAnalysisModelToDto(analysis)
    return mapAnalysisDtoToModel(record.dto)
  }

  async reanalyze(analysisId: string): Promise<void> {
    const record = this.getRecord(analysisId)
    const analysis = mapAnalysisDtoToModel(record.dto)
    // Backend prompt §16: per l'MVP è accettabile azzerare le correzioni manuali
    // dopo la conferma del frontend, poi ripartire dal PDF originale.
    resetAllCorrections(analysis)
    record.dto = mapAnalysisModelToDto(analysis)
    record.createdAt = Date.now()
  }

  async exportExcel(analysisId: string): Promise<Blob> {
    const analysis = await this.getAnalysis(analysisId)
    return buildExcelBlob(analysis)
  }

  async exportCsv(analysisId: string, dataset: Model.ExportDataset): Promise<Blob> {
    const analysis = await this.getAnalysis(analysisId)
    return buildCsvBlob(analysis, dataset)
  }

  getSourcePdfUrl(): string | null {
    // Modalità mock: non esiste un backend reale da cui recuperare il PDF.
    // Il chiamante (PdfViewer, tramite MatchWorkspace) ricade sulla cache
    // in memoria del file appena caricato, o sullo stato vuoto.
    return null
  }

  private getRecord(analysisId: string): StoredAnalysis {
    const record = this.store.get(analysisId)
    if (!record) {
      throw new AnalysisApiError("ANALYSIS_NOT_FOUND", `Nessuna analisi trovata con id "${analysisId}"`)
    }
    return record
  }
}
