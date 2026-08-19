"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { FileText, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { SourceRegion } from "@/lib/types"

import { PdfToolbar } from "./PdfToolbar"
import { drawableRegions, RegionOverlay } from "./RegionOverlay"
import type { PdfSource } from "./PdfPageCanvas"
import { usePdfViewerState } from "./usePdfViewerState"

const PdfPageCanvas = dynamic(() => import("./PdfPageCanvas"), {
  ssr: false,
  loading: () => <CenteredNotice>Caricamento del visualizzatore…</CenteredNotice>,
})

export interface PdfViewerProps {
  /** Referto to display: a URL (also a `blob:`/`data:` one) or a memoized `Blob`/`File`. */
  pdfUrl?: PdfSource | null
  /** Regions to draw over the page, with `[0,1]` normalized coordinates. */
  regions?: SourceRegion[]
  /** Highlighted region; the viewer jumps to its page on its own. */
  selectedRegionId?: string | null
  /** A region box was clicked — select the matching data field. */
  onRegionClick?: (regionId: string, region: SourceRegion) => void
  /** A region box was hovered (`null` on leave) — useful for cross-panel highlighting. */
  onRegionHover?: (regionId: string | null, region: SourceRegion | null) => void
  /** Controlled page (1-based). Leave undefined to let the viewer own it. */
  currentPage?: number
  onPageChange?: (page: number) => void
  /** Controlled overlay visibility. Leave undefined to let the toolbar own it. */
  showOverlay?: boolean
  onShowOverlayChange?: (visible: boolean) => void
  /** When provided, the toolbar shows a "hide referto" button that calls it. */
  onHidePanel?: () => void
  onLoadError?: (error: Error) => void
  /** Tooltip/aria text for a region box. Defaults to type + raw text + method. */
  regionLabel?: (region: SourceRegion) => string
  /** Replaces the built-in "no referto loaded" placeholder. */
  emptyState?: React.ReactNode
  /** pdf.js asset URLs, only needed for PDFs without embedded fonts. */
  cMapUrl?: string
  standardFontDataUrl?: string
}

function CenteredNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-sm)",
        color: "var(--color-text-secondary)",
      }}
    >
      {children}
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        margin: "auto",
        padding: "40px 24px",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-white)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-body)",
        maxWidth: 360,
        textAlign: "center",
      }}
    >
      <FileText size={28} color="var(--neutral-400)" />
      <span style={{ fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)", color: "var(--color-text-primary)" }}>
        Nessun referto caricato
      </span>
      <span style={{ fontSize: "var(--text-sm)" }}>
        Carica il PDF del referto per confrontarlo con i dati estratti.
      </span>
    </div>
  )
}

/**
 * Side-by-side referto viewer: renders the real PDF with pdf.js and draws the
 * clickable extracted-region boxes on top of it.
 *
 * Public contract (no pdf.js knowledge required by the caller):
 *
 * - `pdfUrl` — URL / memoized Blob of the referto; `null` shows the empty state.
 * - `regions` — `SourceRegion[]`; only the ones on the visible page are drawn,
 *   positioned from their `[0,1]` normalized coordinates.
 * - `selectedRegionId` + `onRegionClick` — the two halves of the bidirectional
 *   sync: pass the region of the currently selected data field to highlight it
 *   (the viewer also switches page and scrolls it into view), and use the
 *   callback to select the data field a clicked region belongs to.
 * - `currentPage` / `onPageChange` and `showOverlay` / `onShowOverlayChange` are
 *   optional controlled pairs; omit them to let the viewer own that state.
 *
 * Zoom, fit-to-width, fullscreen and page navigation live in the toolbar and
 * need no wiring. Missing PDF, failed load, out-of-range page and malformed
 * regions all degrade to a message instead of throwing.
 */
export function PdfViewer({
  pdfUrl = null,
  regions = [],
  selectedRegionId = null,
  onRegionClick,
  onRegionHover,
  currentPage,
  onPageChange,
  showOverlay,
  onShowOverlayChange,
  onHidePanel,
  onLoadError,
  regionLabel,
  emptyState,
  cMapUrl,
  standardFontDataUrl,
}: PdfViewerProps) {
  const [reloadToken, setReloadToken] = React.useState(0)
  const [failure, setFailure] = React.useState<{ documentKey: string; error: Error } | null>(null)

  const file = pdfUrl ?? null
  const documentKey = `${typeof file === "string" ? file : file ? "inline-source" : "none"}#${reloadToken}`

  const {
    containerRef,
    pageNumber,
    pageCount,
    setPageCount,
    goToPage,
    goToPreviousPage,
    goToNextPage,
    canGoBack,
    canGoForward,
    naturalPageSize,
    setNaturalPageSize,
    renderWidth,
    zoom,
    isFitToWidth,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToWidth,
    canZoomIn,
    canZoomOut,
    showOverlay: overlayVisible,
    toggleOverlay,
    fullscreen,
    toggleFullscreen,
  } = usePdfViewerState({
    documentKey,
    page: currentPage,
    onPageChange,
    showOverlay,
    onShowOverlayChange,
  })

  // Scoped to the document it came from, so switching or retrying clears it
  // without an effect.
  const error = failure && failure.documentKey === documentKey ? failure.error : null

  const selectedRegion = React.useMemo(
    () => (selectedRegionId ? regions.find((region) => region.id === selectedRegionId) ?? null : null),
    [regions, selectedRegionId]
  )

  React.useEffect(() => {
    // Waits for the page count: following a region into a page the document does
    // not have would make pdf.js reject the render.
    if (pageCount == null || !selectedRegion || !Number.isFinite(selectedRegion.page)) return
    if (selectedRegion.page < 1 || selectedRegion.page > pageCount) return
    if (selectedRegion.page !== pageNumber) goToPage(selectedRegion.page)
  }, [selectedRegion, pageNumber, pageCount, goToPage])

  const handleLoadError = React.useCallback(
    (loadError: Error) => {
      setFailure({ documentKey, error: loadError })
      onLoadError?.(loadError)
    },
    [documentKey, onLoadError]
  )

  const regionsOnPage = React.useMemo(
    () => drawableRegions(regions, pageNumber).length,
    [regions, pageNumber]
  )

  const aspectRatio =
    naturalPageSize && naturalPageSize.width > 0
      ? naturalPageSize.height / naturalPageSize.width
      : null

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "var(--neutral-100)",
        ...(fullscreen ? { position: "fixed", inset: 0, zIndex: 300 } : {}),
      }}
    >
      <PdfToolbar
        pageNumber={pageNumber}
        pageCount={pageCount}
        onPreviousPage={goToPreviousPage}
        onNextPage={goToNextPage}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onFitToWidth={fitToWidth}
        isFitToWidth={isFitToWidth}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
        showOverlay={overlayVisible}
        onToggleOverlay={toggleOverlay}
        regionCount={regionsOnPage}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        onHidePanel={fullscreen ? null : onHidePanel}
        disabled={!file}
      />

      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          // Reserved gutter: a scrollbar appearing mid-render would change the
          // available width and restart the page render.
          scrollbarGutter: "stable",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: 24,
        }}
      >
        {!file ? (
          (emptyState ?? <EmptyState />)
        ) : error ? (
          <div
            role="alert"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              margin: "auto",
              padding: "32px 24px",
              background: "var(--color-white)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              textAlign: "center",
              maxWidth: 380,
            }}
          >
            <TriangleAlert size={26} color="var(--color-danger)" />
            <span style={{ color: "var(--color-text-primary)", fontWeight: "var(--weight-semibold)" }}>
              Non è stato possibile aprire il referto
            </span>
            <span>{error.message || "Errore sconosciuto durante la lettura del PDF."}</span>
            <Button variant="secondary" size="sm" onClick={() => setReloadToken((token) => token + 1)}>
              Riprova
            </Button>
          </div>
        ) : renderWidth == null ? (
          <CenteredNotice>Preparazione del referto…</CenteredNotice>
        ) : (
          <PdfPageCanvas
            key={reloadToken}
            file={file}
            pageNumber={pageNumber}
            width={renderWidth}
            pageAspectRatio={aspectRatio}
            cMapUrl={cMapUrl}
            standardFontDataUrl={standardFontDataUrl}
            onDocumentLoad={setPageCount}
            onPageLoad={setNaturalPageSize}
            onLoadError={handleLoadError}
          >
            <RegionOverlay
              regions={regions}
              page={pageNumber}
              selectedRegionId={selectedRegionId}
              visible={overlayVisible}
              onRegionClick={onRegionClick}
              onRegionHover={onRegionHover}
              regionLabel={regionLabel}
            />
          </PdfPageCanvas>
        )}
      </div>
    </div>
  )
}
