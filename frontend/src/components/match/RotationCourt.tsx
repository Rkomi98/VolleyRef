"use client"

import { EditableValue } from "@/components/ui/editable-value"
import type { RotationLabel, StartingSix } from "@/lib/types"

import { confidenceLevel } from "./confidence"

const ROMAN: RotationLabel[] = ["I", "II", "III", "IV", "V", "VI"]
const FRONT_ROW: RotationLabel[] = ["IV", "III", "II"]
const BACK_ROW: RotationLabel[] = ["V", "VI", "I"]

export interface RotationCourtProps {
  six: StartingSix
  firstServe: boolean
  onChange: (label: RotationLabel, value: number) => void
}

export function RotationCourt({ six, firstServe, onChange }: RotationCourtProps) {
  const cell = (label: RotationLabel) => {
    const field = six[label]
    const isServer = label === "I" && firstServe
    return (
      <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: "var(--color-white)",
            border: `2.5px solid ${isServer ? "var(--color-primary)" : "var(--border-strong)"}`,
            boxShadow: isServer ? "0 0 0 3px rgba(0,170,234,0.3)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <EditableValue
            value={field.value ?? ""}
            type="number"
            size="sm"
            confidence={confidenceLevel(field.confidence)}
            edited={field.manuallyConfirmed}
            onChange={(v) => onChange(label, Number(v))}
            ariaLabel={`Posizione ${label}`}
          />
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
          {label}
          {isServer ? " · serve" : ""}
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        background: "var(--color-primary-dark)",
        borderRadius: "var(--radius-lg)",
        padding: "18px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ height: 3, background: "rgba(255,255,255,0.4)", borderRadius: 2 }} title="Rete" />
      <div style={{ display: "flex", justifyContent: "space-around" }}>{FRONT_ROW.map(cell)}</div>
      <div style={{ display: "flex", justifyContent: "space-around" }}>{BACK_ROW.map(cell)}</div>
    </div>
  )
}

export { ROMAN as ROTATION_ORDER }
