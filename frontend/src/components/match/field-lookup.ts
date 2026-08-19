/**
 * Risoluzione incrociata dato ↔ regione del PDF (frontend prompt §9).
 *
 * Il modello dati non contiene un indice invertito "regione → campo": ogni
 * `ExtractedValue` porta un `sourceRegionId` opzionale e ogni `ServiceTurn`
 * porta un array `sourceRegionIds`. Questo file cerca nell'intera analisi,
 * a partire da un id di campo, di turno o di regione, dove si trova il dato
 * corrispondente (quale tab, quale set, quali regioni evidenziare), così che
 * sia il click su un overlay del PDF sia il click su "Evidenzia sul referto"
 * nel pannello dati possano condividere la stessa logica.
 */
import type { Analysis, RotationLabel, SetData } from "@/lib/types"

export type WorkspaceTab = "summary" | "lineups" | "services" | "validation"

export type FieldLocation = {
  tab: WorkspaceTab
  setNumber: number
  regionIds: string[]
}

const ROTATION_LABELS: readonly RotationLabel[] = ["I", "II", "III", "IV", "V", "VI"]

/** Regioni delle sei posizioni della squadra A o B in un set (usato da "Evidenzia sul referto"). */
export function lineupRegionIdsForTeam(set: SetData, isTeamA: boolean): string[] {
  const six = isTeamA ? set.teamAStartingSix : set.teamBStartingSix
  return ROTATION_LABELS.map((label) => six[label].sourceRegionId).filter((id): id is string => Boolean(id))
}

/**
 * Cerca `id` (che può essere l'id di un `ExtractedValue`, di un `ServiceTurn`,
 * oppure l'id di una `SourceRegion`) in tutta l'analisi e restituisce dove si
 * trova: la sezione (tab) da aprire, il numero di set da selezionare e le
 * regioni del PDF da evidenziare.
 */
export function locateField(analysis: Analysis, id: string): FieldLocation | null {
  for (const set of analysis.sets) {
    for (const six of [set.teamAStartingSix, set.teamBStartingSix] as const) {
      for (const label of ROTATION_LABELS) {
        const field = six[label]
        if (field.id === id || field.sourceRegionId === id) {
          return { tab: "lineups", setNumber: set.number, regionIds: field.sourceRegionId ? [field.sourceRegionId] : [] }
        }
      }
    }

    for (const turn of set.serviceTurns) {
      const fields = [turn.player, turn.rotation, turn.scoreStart, turn.scoreEnd]
      const matches =
        turn.id === id ||
        turn.sourceRegionIds.includes(id) ||
        fields.some((f) => f.id === id || f.sourceRegionId === id)
      if (matches) {
        return { tab: "services", setNumber: set.number, regionIds: turn.sourceRegionIds }
      }
    }
  }
  return null
}
