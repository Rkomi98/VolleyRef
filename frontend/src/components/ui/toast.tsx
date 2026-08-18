"use client"

import * as React from "react"
import { toast as sonnerToast } from "sonner"

import { Toaster } from "@/components/ui/sonner"

export interface ToastProps {
  message: React.ReactNode
  actionLabel?: string
  onAction?: () => void
  onDismiss: () => void
  tone?: "default" | "success" | "danger"
}

/**
 * The VolleyRef toast pill. This is rendered by sonner via `toast.custom`
 * (see `ToastProvider`/`useToast` below) so the message/action/dismiss
 * markup and styling stay pixel-identical to `feedback/Toast.jsx`, while
 * sonner's `Toaster` owns the portal, stacking, and dismiss timers.
 */
export function Toast({ message, actionLabel, onAction, onDismiss, tone = "default" }: ToastProps) {
  const border = tone === "success" ? "var(--color-success)" : tone === "danger" ? "var(--color-danger)" : "var(--neutral-800)"
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "var(--color-text-primary)",
        color: "var(--color-white)",
        padding: "12px 16px",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-lg)",
        fontSize: "var(--text-sm)",
        fontFamily: "var(--font-body)",
        minWidth: 260,
        borderLeft: `3px solid ${border}`,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {actionLabel && (
        <button
          onClick={() => {
            onAction?.()
            onDismiss()
          }}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-primary)",
            fontWeight: "var(--weight-semibold)",
            cursor: "pointer",
            fontSize: "var(--text-sm)",
            padding: 0,
          }}
        >
          {actionLabel}
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Chiudi"
        style={{
          background: "none",
          border: "none",
          color: "var(--neutral-400)",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}

export interface ToastPushOptions {
  actionLabel?: string
  onAction?: () => void
  tone?: "default" | "success" | "danger"
  duration?: number
}

interface ToastContextValue {
  push: (message: React.ReactNode, opts?: ToastPushOptions) => number
  dismiss: (id: number) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const idRef = React.useRef(0)
  const sonnerIdsRef = React.useRef(new Map<number, string | number>())

  const dismiss = React.useCallback((id: number) => {
    const sonnerId = sonnerIdsRef.current.get(id)
    if (sonnerId !== undefined) {
      sonnerToast.dismiss(sonnerId)
      sonnerIdsRef.current.delete(id)
    }
  }, [])

  const push = React.useCallback(
    (message: React.ReactNode, opts: ToastPushOptions = {}) => {
      const id = ++idRef.current
      const sonnerId = sonnerToast.custom(
        () => (
          <Toast
            message={message}
            actionLabel={opts.actionLabel}
            onAction={opts.onAction}
            tone={opts.tone ?? "default"}
            onDismiss={() => dismiss(id)}
          />
        ),
        {
          duration: opts.duration || 4200,
          onDismiss: () => sonnerIdsRef.current.delete(id),
          onAutoClose: () => sonnerIdsRef.current.delete(id),
        }
      )
      sonnerIdsRef.current.set(id, sonnerId)
      return id
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <Toaster
        position="bottom-center"
        gap={8}
        toastOptions={{
          unstyled: true,
          style: { background: "transparent", boxShadow: "none", padding: 0, width: "auto" },
        }}
      />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
