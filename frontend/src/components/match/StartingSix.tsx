"use client"

import * as React from "react"
import { Grid3x3, Search, Table as TableIcon } from "lucide-react"

import { EditableValue } from "@/components/ui/editable-value"
import { IconButton } from "@/components/ui/icon-button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Tooltip } from "@/components/ui/tooltip"
import type { RotationLabel, SetData, Team } from "@/lib/types"

import { confidenceLevel } from "./confidence"
import { lineupRegionIdsForTeam } from "./field-lookup"
import { RotationCourt } from "./RotationCourt"

const ROMAN: RotationLabel[] = ["I", "II", "III", "IV", "V", "VI"]

interface TeamLineupTableProps {
  six: SetData["teamAStartingSix"]
  firstServe: boolean
  onChange: (label: RotationLabel, value: number) => void
}

function TeamLineupTable({ six, firstServe, onChange }: TeamLineupTableProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>
      {ROMAN.map((label) => {
        const field = six[label]
        const isServer = label === "I" && firstServe
        return (
          <div
            key={label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "12px 4px",
              background: "var(--neutral-50)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)" }}>
              {label}
              {isServer ? " ●" : ""}
            </span>
            <EditableValue
              value={field.value ?? ""}
              type="number"
              confidence={confidenceLevel(field.confidence)}
              edited={field.manuallyConfirmed}
              onChange={(v) => onChange(label, Number(v))}
              ariaLabel={`Posizione ${label}`}
            />
          </div>
        )
      })}
    </div>
  )
}

export interface StartingSixPanelProps {
  set: SetData
  teamA: Team
  teamB: Team
  onEditField: (fieldId: string, value: number) => void
  onHighlight: (regionIds: string[]) => void
}

export function StartingSixPanel({ set, teamA, teamB, onEditField, onHighlight }: StartingSixPanelProps) {
  const [view, setView] = React.useState<"table" | "court">("table")

  const teams = [
    { team: teamA, six: set.teamAStartingSix, isTeamA: true },
    { team: teamB, six: set.teamBStartingSix, isTeamA: false },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SegmentedControl
          options={[
            { value: "table", label: "Tabella", icon: <TableIcon size={14} /> },
            { value: "court", label: "Campo", icon: <Grid3x3 size={14} /> },
          ]}
          value={view}
          onChange={(v) => setView(v as "table" | "court")}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {teams.map(({ team, six, isTeamA }) => {
          const isFirstServe = set.startingTeamId === team.id
          const onChangeLabel = (label: RotationLabel, value: number) => onEditField(six[label].id, value)
          return (
            <div
              key={team.id}
              style={{
                background: "var(--color-white)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)",
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--color-text-primary)" }}>
                    {team.name}
                  </span>
                  {isFirstServe && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--color-primary-dark)",
                        background: "var(--color-primary-subtle)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                      }}
                    >
                      Prima al servizio
                    </span>
                  )}
                </div>
                <Tooltip content="Evidenzia sul referto">
                  <IconButton
                    icon={<Search size={15} />}
                    label="Evidenzia sul referto"
                    size="sm"
                    onClick={() => onHighlight(lineupRegionIdsForTeam(set, isTeamA))}
                  />
                </Tooltip>
              </div>
              {view === "table" ? (
                <TeamLineupTable six={six} firstServe={isFirstServe} onChange={onChangeLabel} />
              ) : (
                <RotationCourt six={six} firstServe={isFirstServe} onChange={onChangeLabel} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
