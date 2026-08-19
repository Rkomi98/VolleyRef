"use client"

import { AlertCircle, AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"

import { Card } from "@/components/ui/card"
import { IconButton } from "@/components/ui/icon-button"
import type { Analysis, SetData } from "@/lib/types"

import { locateField, type FieldLocation } from "./field-lookup"
import { toStatusBadgeStatus } from "./status"

const BANNER: Record<"validated" | "review" | "inconsistent", { label: string; bg: string; fg: string; Icon: typeof CheckCircle2 }> = {
  validated: { label: "VALIDATO", bg: "var(--color-success-subtle)", fg: "var(--color-success)", Icon: CheckCircle2 },
  review: { label: "DA VERIFICARE", bg: "var(--color-warning-subtle)", fg: "var(--color-warning-hover)", Icon: AlertTriangle },
  inconsistent: { label: "INCOERENTE", bg: "var(--color-danger-subtle)", fg: "var(--color-danger)", Icon: AlertCircle },
}

function checkIcon(status: "VALID" | "WARNING" | "INVALID") {
  if (status === "VALID") return <Check size={15} style={{ color: "var(--color-success)" }} />
  if (status === "WARNING") return <AlertTriangle size={15} style={{ color: "var(--color-warning-hover)" }} />
  return <AlertCircle size={15} style={{ color: "var(--color-danger)" }} />
}

export interface ValidationPanelProps {
  analysis: Analysis
  set: SetData
  setPosition: { index: number; total: number }
  onPrevSet: () => void
  onNextSet: () => void
  onJump: (location: FieldLocation) => void
}

export function ValidationPanel({ analysis, set, setPosition, onPrevSet, onNextSet, onJump }: ValidationPanelProps) {
  const bannerKey = toStatusBadgeStatus(set.validation.status)
  const banner = bannerKey === "processing" ? BANNER.validated : BANNER[bannerKey]

  const handleJump = (fieldIds: string[]) => {
    for (const id of fieldIds) {
      const location = locateField(analysis, id)
      if (location) {
        onJump(location)
        return
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 20px",
            borderRadius: "var(--radius-lg)",
            background: banner.bg,
            color: banner.fg,
          }}
        >
          <banner.Icon size={22} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "0.03em" }}>
            {banner.label}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <IconButton icon={<ChevronLeft size={16} />} label="Set precedente" disabled={setPosition.index === 0} onClick={onPrevSet} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
          {setPosition.index + 1} di {setPosition.total}
        </span>
        <IconButton
          icon={<ChevronRight size={16} />}
          label="Set successivo"
          disabled={setPosition.index >= setPosition.total - 1}
          onClick={onNextSet}
        />
      </div>

      <Card padding={0}>
        {set.validation.checks.map((check, i) => {
          const clickable = check.status !== "VALID" && check.fieldIds.length > 0
          return (
            <div
              key={check.id}
              onClick={() => clickable && handleJump(check.fieldIds)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                borderBottom: i < set.validation.checks.length - 1 ? "1px solid var(--border-default)" : "none",
                cursor: clickable ? "pointer" : "default",
              }}
              onMouseEnter={(e) => {
                if (clickable) e.currentTarget.style.background = "var(--neutral-50)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
              }}
            >
              {checkIcon(check.status)}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "var(--color-text-primary)", fontWeight: 500 }}>{check.label}</div>
                {check.message && (
                  <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", marginTop: 2 }}>{check.message}</div>
                )}
              </div>
              {clickable && <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-primary)" }}>Vai al dato →</span>}
            </div>
          )
        })}
        {set.validation.checks.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13.5 }}>
            Nessun controllo disponibile per questo set.
          </div>
        )}
      </Card>
    </div>
  )
}
