"use client"

import * as React from "react"

import { ConfidenceIndicator } from "@/components/ui/confidence-indicator"

export interface EditableValueProps {
  value: string | number
  onChange?: (value: string | number) => void
  type?: "text" | "number"
  confidence?: "high" | "medium" | "low"
  edited?: boolean
  size?: "sm" | "md" | "lg"
  ariaLabel?: string
}

export function EditableValue({
  value,
  onChange,
  type = "text",
  confidence = "high",
  edited = false,
  size = "md",
  ariaLabel,
}: EditableValueProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(String(value))
  const [justEdited, setJustEdited] = React.useState(false)
  const [prevValue, setPrevValue] = React.useState(value)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Keep `draft` in sync when `value` changes from outside (e.g. the parent
  // re-renders after `onChange`). Adjusted during render rather than in an
  // effect, per https://react.dev/learn/you-might-not-need-an-effect —
  // equivalent to the original's `useEffect(() => setDraft(...), [value])`
  // but without the extra render pass.
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(String(value))
  }

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = () => {
    const next = type === "number" ? Number(draft) : draft
    if (String(next) !== String(value) && draft !== "" && !(type === "number" && Number.isNaN(next))) {
      onChange?.(next)
      setJustEdited(true)
      setTimeout(() => setJustEdited(false), 2600)
    }
    setEditing(false)
  }
  const cancel = () => {
    setDraft(String(value))
    setEditing(false)
  }

  const fontSize = size === "lg" ? "var(--text-2xl)" : size === "sm" ? "var(--text-base)" : "var(--text-lg)"

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") cancel()
        }}
        style={{
          width: type === "number" ? 48 : 96,
          fontSize,
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--weight-semibold)",
          textAlign: "center",
          color: "var(--color-text-primary)",
          border: "1.5px solid var(--color-primary)",
          borderRadius: "var(--radius-sm)",
          padding: "2px 4px",
          outline: "none",
          boxShadow: "var(--shadow-focus)",
        }}
      />
    )
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button
        type="button"
        aria-label={(ariaLabel ? ariaLabel + ": " : "") + value + " — modifica"}
        onClick={() => setEditing(true)}
        style={{
          font: "inherit",
          fontSize,
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--color-text-primary)",
          background: "transparent",
          border: "1.5px dashed transparent",
          borderRadius: "var(--radius-sm)",
          padding: "2px 6px",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--neutral-300)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "transparent"
        }}
      >
        {value}
      </button>
      {edited ? (
        <span
          title="Confermato manualmente"
          aria-label="Confermato manualmente"
          style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-primary)" }}
        />
      ) : (
        <ConfidenceIndicator level={confidence} />
      )}
      {justEdited && (
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-primary-dark)",
            background: "var(--color-primary-subtle)",
            padding: "2px 6px",
            borderRadius: "var(--radius-full)",
            whiteSpace: "nowrap",
          }}
        >
          Modificato manualmente
        </span>
      )}
    </span>
  )
}
