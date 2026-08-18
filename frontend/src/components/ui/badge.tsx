"use client"

import * as React from "react"

export interface BadgeProps {
  children?: React.ReactNode
  tone?: "neutral" | "primary" | "success" | "warning" | "danger"
  size?: "sm" | "md"
  icon?: React.ReactNode
}

const tones: Record<"neutral" | "primary" | "success" | "warning" | "danger", { bg: string; fg: string }> = {
  neutral: { bg: "var(--neutral-100)", fg: "var(--color-text-secondary)" },
  primary: { bg: "var(--color-primary-subtle)", fg: "var(--color-primary-dark)" },
  success: { bg: "var(--color-success-subtle)", fg: "var(--color-success)" },
  warning: { bg: "var(--color-warning-subtle)", fg: "var(--color-warning-hover)" },
  danger: { bg: "var(--color-danger-subtle)", fg: "var(--color-danger)" },
}

export function Badge({ children, tone = "neutral", size = "md", icon = null }: BadgeProps) {
  const t = tones[tone] || tones.neutral
  const pad = size === "sm" ? "2px 8px" : "4px 10px"
  const fontSize = size === "sm" ? "var(--text-xs)" : "var(--text-sm)"
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: pad,
        borderRadius: "var(--radius-full)",
        background: t.bg,
        color: t.fg,
        fontSize,
        fontFamily: "var(--font-body)",
        fontWeight: "var(--weight-semibold)",
        lineHeight: 1.4,
      }}
    >
      {icon}
      {children}
    </span>
  )
}
