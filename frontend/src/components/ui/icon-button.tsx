"use client"

import * as React from "react"

export interface IconButtonProps {
  icon: React.ReactNode
  label: string
  size?: "sm" | "md" | "lg"
  variant?: "default" | "subtle"
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  style?: React.CSSProperties
}

const dimsBySize: Record<"sm" | "md" | "lg", number> = { sm: 28, md: 36, lg: 44 }

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "default",
  active = false,
  disabled = false,
  onClick,
  style,
}: IconButtonProps) {
  const [hover, setHover] = React.useState(false)
  const dims = dimsBySize[size] || 36
  const bgIdle = variant === "subtle" ? "var(--neutral-100)" : "transparent"
  const bg = disabled
    ? "transparent"
    : active
      ? "var(--color-primary-subtle)"
      : hover
        ? "var(--neutral-100)"
        : bgIdle
  const fg = disabled ? "var(--neutral-400)" : active ? "var(--color-primary)" : "var(--color-text-primary)"
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: dims,
        height: dims,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        border: "none",
        background: bg,
        color: fg,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background var(--duration-fast) var(--ease-standard)",
        ...style,
      }}
    >
      {icon}
    </button>
  )
}
