"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  MoveHorizontal,
  PanelLeftClose,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

import { IconButton } from "@/components/ui/icon-button"

export interface PdfToolbarProps {
  pageNumber: number
  pageCount: number | null
  onPreviousPage: () => void
  onNextPage: () => void
  canGoBack?: boolean
  canGoForward?: boolean
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  onFitToWidth: () => void
  isFitToWidth?: boolean
  canZoomIn?: boolean
  canZoomOut?: boolean
  showOverlay: boolean
  onToggleOverlay: () => void
  regionCount?: number
  fullscreen: boolean
  onToggleFullscreen: () => void
  onHidePanel?: (() => void) | null
  disabled?: boolean
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{ width: 1, height: 22, background: "var(--border-default)", margin: "0 4px", flexShrink: 0 }}
    />
  )
}

/**
 * Control bar for `PdfViewer`: page navigation, zoom, fit-to-width, overlay
 * visibility and fullscreen. Purely presentational — every piece of state is
 * driven by props, so it can also be mounted outside the viewer if needed.
 */
export function PdfToolbar({
  pageNumber,
  pageCount,
  onPreviousPage,
  onNextPage,
  canGoBack = true,
  canGoForward = true,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToWidth,
  isFitToWidth = false,
  canZoomIn = true,
  canZoomOut = true,
  showOverlay,
  onToggleOverlay,
  regionCount,
  fullscreen,
  onToggleFullscreen,
  onHidePanel,
  disabled = false,
}: PdfToolbarProps) {
  const overlayLabel = showOverlay ? "Nascondi zone riconosciute" : "Mostra zone riconosciute"
  const overlayCount = typeof regionCount === "number" ? ` (${regionCount})` : ""

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "8px 12px",
        borderBottom: "1px solid var(--border-default)",
        background: "var(--color-white)",
        flexWrap: "wrap",
      }}
    >
      <IconButton
        icon={<ChevronLeft size={16} />}
        label="Pagina precedente"
        size="sm"
        disabled={disabled || !canGoBack}
        onClick={onPreviousPage}
      />
      <span
        aria-live="polite"
        style={{
          fontSize: "var(--text-sm)",
          fontFamily: "var(--font-body)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--color-text-secondary)",
          minWidth: 92,
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        {pageCount ? `Pagina ${pageNumber} di ${pageCount}` : "Pagina —"}
      </span>
      <IconButton
        icon={<ChevronRight size={16} />}
        label="Pagina successiva"
        size="sm"
        disabled={disabled || !canGoForward}
        onClick={onNextPage}
      />

      <Divider />

      <IconButton
        icon={<ZoomOut size={16} />}
        label="Riduci zoom"
        size="sm"
        disabled={disabled || !canZoomOut}
        onClick={onZoomOut}
      />
      <span
        style={{
          fontSize: "var(--text-sm)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-primary)",
          minWidth: 46,
          textAlign: "center",
        }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <IconButton
        icon={<ZoomIn size={16} />}
        label="Aumenta zoom"
        size="sm"
        disabled={disabled || !canZoomIn}
        onClick={onZoomIn}
      />
      <IconButton
        icon={<RotateCcw size={16} />}
        label="Zoom originale (100%)"
        size="sm"
        disabled={disabled}
        onClick={onResetZoom}
      />
      <IconButton
        icon={<MoveHorizontal size={16} />}
        label="Adatta alla larghezza"
        size="sm"
        active={isFitToWidth}
        disabled={disabled}
        onClick={onFitToWidth}
      />

      <Divider />

      <IconButton
        icon={showOverlay ? <Eye size={16} /> : <EyeOff size={16} />}
        label={`${overlayLabel}${overlayCount}`}
        size="sm"
        active={showOverlay}
        disabled={disabled}
        onClick={onToggleOverlay}
      />
      <IconButton
        icon={fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        label={fullscreen ? "Esci da schermo intero" : "Schermo intero"}
        size="sm"
        active={fullscreen}
        onClick={onToggleFullscreen}
      />

      <span style={{ flex: 1, minWidth: 8 }} />

      {onHidePanel ? (
        <IconButton
          icon={<PanelLeftClose size={16} />}
          label="Nascondi referto"
          size="sm"
          onClick={onHidePanel}
        />
      ) : null}
    </div>
  )
}
