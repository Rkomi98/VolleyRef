"use client"

import * as React from "react"

import { Tooltip } from "@/components/ui/tooltip"

export interface ConfidenceIndicatorProps {
  level?: "high" | "medium" | "low"
  showWhenHigh?: boolean
  message?: string
}

export function ConfidenceIndicator({ level = "high", showWhenHigh = false, message }: ConfidenceIndicatorProps) {
  if (level === "high" && !showWhenHigh) return null
  const color = level === "low" ? "var(--color-warning)" : level === "medium" ? "var(--neutral-400)" : "var(--neutral-300)"
  const text = message || (level === "low" ? "Lettura incerta — verifica sul referto" : "Confidenza media — verifica consigliata")
  return (
    <Tooltip content={text}>
      <span
        aria-label={text}
        style={{
          display: "inline-block",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          boxShadow: level === "low" ? "0 0 0 3px rgba(226,161,0,0.18)" : "none",
        }}
      />
    </Tooltip>
  )
}
