import type { CheckStatus } from "@/lib/types"
import type { StatusBadgeProps } from "@/components/ui/status-badge"

/**
 * Il modello dati usa `CheckStatus` ("VALID" | "WARNING" | "INVALID", frontend
 * prompt §21), mentre `StatusBadge` (design system) usa uno stato visivo più
 * ampio ("validated" | "review" | "inconsistent" | "processing", frontend
 * prompt §8). Questa mappa è l'unico punto di conversione tra i due.
 */
export function toStatusBadgeStatus(status: CheckStatus | null): NonNullable<StatusBadgeProps["status"]> {
  if (status === "INVALID") return "inconsistent"
  if (status === "WARNING") return "review"
  return "validated"
}
