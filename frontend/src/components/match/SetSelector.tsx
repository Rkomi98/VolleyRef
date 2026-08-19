"use client"

import type { SetData } from "@/lib/types"

const TOTAL_SETS = 5

export interface SetSelectorProps {
  sets: SetData[]
  value: number
  onChange: (setNumber: number) => void
}

const dotColor = (set: SetData | undefined): string => {
  if (!set) return "transparent"
  if (set.validation.status === "VALID") return "var(--color-success)"
  if (set.validation.status === "WARNING") return "var(--color-warning)"
  return "var(--color-danger)"
}

export function SetSelector({ sets, value, onChange }: SetSelectorProps) {
  return (
    <div role="tablist" aria-label="Seleziona set" style={{ display: "flex", gap: 8, padding: "14px 24px 0", flexWrap: "wrap" }}>
      {Array.from({ length: TOTAL_SETS }).map((_, i) => {
        const num = i + 1
        const set = sets.find((s) => s.number === num)
        const isActive = value === num
        return (
          <button
            key={num}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={!set}
            onClick={() => set && onChange(num)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 14px",
              borderRadius: "var(--radius-full)",
              border: `1px solid ${isActive ? "var(--color-primary)" : "var(--border-default)"}`,
              background: isActive ? "var(--color-primary-subtle)" : "var(--color-white)",
              color: !set ? "var(--neutral-300)" : isActive ? "var(--color-primary-dark)" : "var(--color-text-primary)",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "var(--font-body)",
              cursor: set ? "pointer" : "not-allowed",
            }}
          >
            {set && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor(set) }} />}
            Set {num}
          </button>
        )
      })}
    </div>
  )
}
