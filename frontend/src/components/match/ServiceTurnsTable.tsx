"use client"

import * as React from "react"

import { Card } from "@/components/ui/card"
import { EditableValue } from "@/components/ui/editable-value"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { StatusBadge } from "@/components/ui/status-badge"
import { useToast } from "@/components/ui/toast"
import type { RotationLabel, SetData, Team } from "@/lib/types"

import { confidenceLevel } from "./confidence"

const ROTATION_LABELS: readonly RotationLabel[] = ["I", "II", "III", "IV", "V", "VI"]

function formatScore(score: [number, number]): string {
  return `${score[0]}-${score[1]}`
}

function parseScore(text: string): [number, number] | null {
  const parts = text.split("-").map((p) => p.trim())
  if (parts.length !== 2) return null
  const a = Number(parts[0])
  const b = Number(parts[1])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return [a, b]
}

function isRotationLabel(value: string): value is RotationLabel {
  return (ROTATION_LABELS as readonly string[]).includes(value.toUpperCase())
}

export interface ServiceTurnsTableProps {
  set: SetData
  teamA: Team
  teamB: Team
  onEditField: (fieldId: string, value: unknown) => void
  onHighlight: (regionIds: string[]) => void
}

type FilterValue = "all" | "team-a" | "team-b" | "review"

export function ServiceTurnsTable({ set, teamA, teamB, onEditField, onHighlight }: ServiceTurnsTableProps) {
  const [filter, setFilter] = React.useState<FilterValue>("all")
  const { push } = useToast()

  const teamName = (teamId: string) => (teamId === teamA.id ? teamA.name : teamB.name)

  const rows = set.serviceTurns.filter((turn) => {
    if (filter === "all") return true
    if (filter === "review") return turn.status !== "VALID" && !turn.player.manuallyConfirmed
    if (filter === "team-a") return turn.teamId === teamA.id
    return turn.teamId === teamB.id
  })

  const handleScoreChange = (fieldId: string, raw: string | number) => {
    const parsed = parseScore(String(raw))
    if (!parsed) {
      push("Formato punteggio non valido — usa ad esempio 12-8", { tone: "danger" })
      return
    }
    onEditField(fieldId, parsed)
  }

  const handleRotationChange = (fieldId: string, raw: string | number) => {
    const value = String(raw).toUpperCase()
    if (!isRotationLabel(value)) {
      push("Rotazione non valida — usa un valore da I a VI", { tone: "danger" })
      return
    }
    onEditField(fieldId, value)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SegmentedControl
        size="sm"
        options={[
          { value: "all", label: "Tutti" },
          { value: "team-a", label: "Squadra A" },
          { value: "team-b", label: "Squadra B" },
          { value: "review", label: "Da verificare" },
        ]}
        value={filter}
        onChange={(v) => setFilter(v as FilterValue)}
      />
      <Card padding={0} style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 680 }}>
          <thead>
            <tr>
              {["#", "Squadra", "Battitore", "Rotazione", "Inizio", "Fine", "Punti", "Stato"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: h === "Squadra" ? "left" : "center",
                    padding: "10px 14px",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--color-text-secondary)",
                    borderBottom: "1px solid var(--border-default)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((turn) => {
              const edited =
                turn.player.manuallyConfirmed ||
                turn.rotation.manuallyConfirmed ||
                turn.scoreStart.manuallyConfirmed ||
                turn.scoreEnd.manuallyConfirmed
              return (
                <tr
                  key={turn.id}
                  onClick={() => onHighlight(turn.sourceRegionIds)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--neutral-50)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 14px", textAlign: "center", color: "var(--color-text-secondary)", borderBottom: "1px solid var(--border-default)" }}>
                    {turn.sequence}
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--color-text-primary)", borderBottom: "1px solid var(--border-default)" }}>
                    {teamName(turn.teamId)}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", borderBottom: "1px solid var(--border-default)" }}>
                    <EditableValue
                      value={turn.player.value ?? ""}
                      type="number"
                      size="sm"
                      confidence={confidenceLevel(turn.player.confidence)}
                      edited={turn.player.manuallyConfirmed}
                      onChange={(v) => onEditField(turn.player.id, Number(v))}
                      ariaLabel="Battitore"
                    />
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", borderBottom: "1px solid var(--border-default)" }}>
                    <EditableValue
                      value={turn.rotation.value ?? ""}
                      type="text"
                      size="sm"
                      confidence={confidenceLevel(turn.rotation.confidence)}
                      edited={turn.rotation.manuallyConfirmed}
                      onChange={(v) => handleRotationChange(turn.rotation.id, v)}
                      ariaLabel="Rotazione"
                    />
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", borderBottom: "1px solid var(--border-default)" }}>
                    <EditableValue
                      value={formatScore(turn.scoreStart.value)}
                      type="text"
                      size="sm"
                      confidence={confidenceLevel(turn.scoreStart.confidence)}
                      edited={turn.scoreStart.manuallyConfirmed}
                      onChange={(v) => handleScoreChange(turn.scoreStart.id, v)}
                      ariaLabel="Punteggio iniziale"
                    />
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", borderBottom: "1px solid var(--border-default)" }}>
                    <EditableValue
                      value={formatScore(turn.scoreEnd.value)}
                      type="text"
                      size="sm"
                      confidence={confidenceLevel(turn.scoreEnd.confidence)}
                      edited={turn.scoreEnd.manuallyConfirmed}
                      onChange={(v) => handleScoreChange(turn.scoreEnd.id, v)}
                      ariaLabel="Punteggio finale"
                    />
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      textAlign: "center",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      borderBottom: "1px solid var(--border-default)",
                    }}
                  >
                    {turn.pointsScored}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", borderBottom: "1px solid var(--border-default)" }}>
                    <StatusBadge status={edited ? "validated" : turn.status === "VALID" ? "validated" : turn.status === "WARNING" ? "review" : "inconsistent"} size="sm" />
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--color-text-secondary)" }}>
                  Nessun turno corrisponde al filtro selezionato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
