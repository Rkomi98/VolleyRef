import type { ConfidenceIndicatorProps } from "@/components/ui/confidence-indicator"

/**
 * Traduce il punteggio numerico `confidence` (0..1, o `null` quando non
 * disponibile) nei tre livelli discreti usati da `ConfidenceIndicator` ed
 * `EditableValue` (frontend prompt §14). Le soglie non sono normative — nei
 * dati mock la fascia "bassa" sta sotto 0.6 e quella "alta" sopra 0.85 (vedi
 * `MockAnalysisService`), quindi qui si riflette la stessa suddivisione.
 */
export function confidenceLevel(confidence: number | null): NonNullable<ConfidenceIndicatorProps["level"]> {
  if (confidence === null) return "high"
  if (confidence < 0.6) return "low"
  if (confidence < 0.85) return "medium"
  return "high"
}
