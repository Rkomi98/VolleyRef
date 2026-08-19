"use client"

import * as React from "react"
import { ArrowLeft, Download, History, MoreVertical, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { SegmentedControl, type SegmentOption } from "@/components/ui/segmented-control"
import { StatusBadge } from "@/components/ui/status-badge"
import type { CheckStatus } from "@/lib/types"

import { toStatusBadgeStatus } from "./status"

export type ViewMode = "pdf" | "split" | "data"

const DESKTOP_VIEW_OPTIONS: SegmentOption[] = [
  { value: "pdf", label: "Solo referto" },
  { value: "split", label: "Affiancato" },
  { value: "data", label: "Solo dati" },
]

export interface MatchHeaderProps {
  teamAName: string
  teamBName: string
  finalResult: [number, number]
  overallValidation: CheckStatus | null
  editCount: number
  onExport: () => void
  onReanalyze: () => void
  reanalyzing?: boolean
  onResetCorrections: () => void
  onNewReport: () => void
  viewMode: string
  onChangeViewMode: (value: string) => void
  viewOptions?: SegmentOption[]
}

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  background: "none",
  border: "none",
  borderRadius: 6,
  fontSize: 13.5,
  fontWeight: 600,
  color: "var(--color-text-primary)",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "var(--font-body)",
  width: "100%",
}

export function MatchHeader({
  teamAName,
  teamBName,
  finalResult,
  overallValidation,
  editCount,
  onExport,
  onReanalyze,
  reanalyzing = false,
  onResetCorrections,
  onNewReport,
  viewMode,
  onChangeViewMode,
  viewOptions,
}: MatchHeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false)

  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "14px 24px",
        borderBottom: "1px solid var(--border-default)",
        background: "var(--color-white)",
      }}
    >
      <button
        type="button"
        onClick={onNewReport}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          padding: 0,
          color: "var(--color-text-secondary)",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
          alignSelf: "flex-start",
          fontFamily: "var(--font-body)",
        }}
      >
        <ArrowLeft size={13} /> Nuovo referto
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", flex: 1, minWidth: 260 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 21, color: "var(--color-text-primary)" }}>
            {teamAName}
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--color-primary-dark)" }}>
            {finalResult[0]} — {finalResult[1]}
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 21, color: "var(--color-text-primary)" }}>
            {teamBName}
          </span>
          <StatusBadge status={toStatusBadgeStatus(overallValidation)} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onChangeViewMode && (
            <SegmentedControl size="sm" options={viewOptions ?? DESKTOP_VIEW_OPTIONS} value={viewMode} onChange={onChangeViewMode} />
          )}
          <Button icon={<Download size={15} />} onClick={onExport}>
            Esporta
          </Button>
          <div style={{ position: "relative" }}>
            <IconButton icon={<MoreVertical size={17} />} label="Altre azioni" onClick={() => setMenuOpen((v) => !v)} />
            {menuOpen && (
              <React.Fragment>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "110%",
                    background: "var(--color-white)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-lg)",
                    minWidth: 220,
                    zIndex: 41,
                    padding: 6,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <button
                    type="button"
                    disabled={reanalyzing}
                    onClick={() => {
                      setMenuOpen(false)
                      onReanalyze()
                    }}
                    style={{ ...menuItemStyle, opacity: reanalyzing ? 0.5 : 1, cursor: reanalyzing ? "not-allowed" : "pointer" }}
                  >
                    <RefreshCw size={15} /> {reanalyzing ? "Rianalisi in corso…" : "Rianalizza"}
                  </button>
                  <button
                    type="button"
                    disabled={editCount === 0}
                    onClick={() => {
                      setMenuOpen(false)
                      onResetCorrections()
                    }}
                    style={{ ...menuItemStyle, opacity: editCount === 0 ? 0.5 : 1, cursor: editCount === 0 ? "not-allowed" : "pointer" }}
                  >
                    <History size={15} /> Ripristina dati estratti{editCount > 0 ? ` (${editCount})` : ""}
                  </button>
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
