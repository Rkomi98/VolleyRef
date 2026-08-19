"use client"

import { Card } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import type { Analysis } from "@/lib/types"

import { toStatusBadgeStatus } from "./status"

export interface MatchSummaryProps {
  analysis: Analysis
  onSelectSet: (setNumber: number) => void
}

export function MatchSummary({ analysis, onSelectSet }: MatchSummaryProps) {
  const { match } = analysis
  const info: [string, string][] = [
    ["Squadra A", match.teamA.name],
    ["Squadra B", match.teamB.name],
    ["Competizione", match.competition ?? "—"],
    ["Numero gara", match.matchNumber ?? "—"],
    ["Data", match.date ?? "—"],
    ["Ora", match.time ?? "—"],
    ["Luogo", match.venue ?? "—"],
    ["Risultato finale", `${match.finalResult[0]} — ${match.finalResult[1]}`],
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {info.map(([label, value]) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontWeight: 700,
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: 15, color: "var(--color-text-primary)", fontWeight: 600, marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card padding={0}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Set", match.teamA.name, match.teamB.name, "Stato"].map((h, i) => (
                  <th
                    key={h + i}
                    style={{
                      textAlign: i === 0 ? "left" : "center",
                      padding: "12px 16px",
                      fontSize: 11.5,
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
              {analysis.sets.map((set) => (
                <tr
                  key={set.number}
                  onClick={() => onSelectSet(set.number)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--neutral-50)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--color-text-primary)", borderBottom: "1px solid var(--border-default)" }}>
                    {set.number}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      textAlign: "center",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      borderBottom: "1px solid var(--border-default)",
                    }}
                  >
                    {set.finalScore[0]}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      textAlign: "center",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      borderBottom: "1px solid var(--border-default)",
                    }}
                  >
                    {set.finalScore[1]}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", borderBottom: "1px solid var(--border-default)" }}>
                    <StatusBadge status={toStatusBadgeStatus(set.validation.status)} size="sm" />
                  </td>
                </tr>
              ))}
              {analysis.sets.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--color-text-secondary)" }}>
                    Nessun set disponibile per questa analisi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
