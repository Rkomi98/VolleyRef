"use client"

import * as React from "react"

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4]
const MIN_ZOOM = ZOOM_STEPS[0]
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1]
const PAGE_GUTTER = 24
const MIN_RENDER_WIDTH = 160
const MAX_RENDER_WIDTH = 4000
const RESIZE_DEBOUNCE_MS = 150

export type PageSize = { width: number; height: number }

export interface UsePdfViewerStateOptions {
  /**
   * Identifies the open document. Page number, page count and measured page size
   * are scoped to it, so a new key starts again from page 1 with nothing measured.
   */
  documentKey?: string
  page?: number | null
  onPageChange?: (page: number) => void
  initialPage?: number
  showOverlay?: boolean
  onShowOverlayChange?: (visible: boolean) => void
  initialShowOverlay?: boolean
}

export interface PdfViewerState {
  containerRef: React.RefObject<HTMLDivElement | null>
  pageNumber: number
  pageCount: number | null
  setPageCount: (count: number | null) => void
  goToPage: (page: number) => void
  goToPreviousPage: () => void
  goToNextPage: () => void
  canGoBack: boolean
  canGoForward: boolean
  naturalPageSize: PageSize | null
  setNaturalPageSize: (size: PageSize | null) => void
  renderWidth: number | null
  zoom: number
  isFitToWidth: boolean
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  fitToWidth: () => void
  canZoomIn: boolean
  canZoomOut: boolean
  showOverlay: boolean
  toggleOverlay: () => void
  fullscreen: boolean
  toggleFullscreen: () => void
}

type DocumentState = {
  key: string
  pageCount: number | null
  naturalPageSize: PageSize | null
}

function clampPage(page: number, pageCount: number | null): number {
  const candidate = Number.isFinite(page) ? Math.floor(page) : 1
  if (pageCount == null || pageCount < 1) return Math.max(1, candidate)
  return Math.min(Math.max(candidate, 1), pageCount)
}

function nextZoomStep(current: number, direction: 1 | -1): number {
  if (direction === 1) return ZOOM_STEPS.find((step) => step > current + 0.001) ?? MAX_ZOOM
  return [...ZOOM_STEPS].reverse().find((step) => step < current - 0.001) ?? MIN_ZOOM
}

/**
 * Zoom / page / overlay / fullscreen state for `PdfViewer`, plus the pixel width
 * to hand to the underlying page renderer. `page` and `showOverlay` may be driven
 * from the outside (controlled) or left undefined (managed here).
 */
export function usePdfViewerState(options: UsePdfViewerStateOptions = {}): PdfViewerState {
  const {
    documentKey = "",
    page,
    onPageChange,
    initialPage = 1,
    showOverlay: showOverlayProp,
    onShowOverlayChange,
    initialShowOverlay = true,
  } = options

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = React.useState(0)
  const [pageState, setPageState] = React.useState(() => ({
    key: documentKey,
    page: clampPage(initialPage, null),
  }))
  const [documentState, setDocumentState] = React.useState<DocumentState>(() => ({
    key: documentKey,
    pageCount: null,
    naturalPageSize: null,
  }))
  const [zoomState, setZoomState] = React.useState({ zoom: 1, fitToWidth: true })
  const [uncontrolledShowOverlay, setUncontrolledShowOverlay] = React.useState(initialShowOverlay)
  const [fullscreen, setFullscreen] = React.useState(false)

  // Anything measured on another document is stale rather than reset in an effect.
  const isCurrentDocument = documentState.key === documentKey
  const pageCount = isCurrentDocument ? documentState.pageCount : null
  const naturalPageSize = isCurrentDocument ? documentState.naturalPageSize : null

  const isPageControlled = typeof page === "number" && Number.isFinite(page)
  const requestedPage = isPageControlled
    ? (page as number)
    : pageState.key === documentKey
      ? pageState.page
      : 1
  const pageNumber = clampPage(requestedPage, pageCount)

  const isOverlayControlled = typeof showOverlayProp === "boolean"
  const showOverlay = isOverlayControlled ? (showOverlayProp as boolean) : uncontrolledShowOverlay

  React.useEffect(() => {
    const element = containerRef.current
    if (!element || typeof ResizeObserver === "undefined") return
    let timeout: ReturnType<typeof setTimeout> | null = null
    setContainerWidth(element.clientWidth)
    // Debounced: every width change restarts the page render, and react-pdf keeps
    // the canvas hidden until one completes, so thrashing it shows a blank page.
    const observer = new ResizeObserver(() => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => setContainerWidth(element.clientWidth), RESIZE_DEBOUNCE_MS)
    })
    observer.observe(element)
    return () => {
      if (timeout) clearTimeout(timeout)
      observer.disconnect()
    }
  }, [])

  const availableWidth =
    containerWidth > 0 ? Math.max(containerWidth - PAGE_GUTTER * 2, MIN_RENDER_WIDTH) : 0
  const naturalWidth = naturalPageSize && naturalPageSize.width > 0 ? naturalPageSize.width : null

  const renderWidth =
    availableWidth === 0
      ? null
      : Math.min(
          MAX_RENDER_WIDTH,
          Math.max(
            MIN_RENDER_WIDTH,
            Math.round(
              zoomState.fitToWidth ? availableWidth : (naturalWidth ?? availableWidth) * zoomState.zoom
            )
          )
        )

  const zoom = renderWidth != null && naturalWidth ? renderWidth / naturalWidth : zoomState.zoom

  const setPageCount = React.useCallback(
    (count: number | null) => {
      const next = count != null && Number.isFinite(count) && count > 0 ? Math.floor(count) : null
      setDocumentState((previous) =>
        previous.key === documentKey && previous.pageCount === next
          ? previous
          : { ...previous, key: documentKey, pageCount: next }
      )
    },
    [documentKey]
  )

  const setNaturalPageSize = React.useCallback(
    (size: PageSize | null) => {
      const next = size && size.width > 0 && size.height > 0 ? { ...size } : null
      setDocumentState((previous) => {
        const current = previous.key === documentKey ? previous.naturalPageSize : null
        if (
          previous.key === documentKey &&
          current?.width === next?.width &&
          current?.height === next?.height
        ) {
          return previous
        }
        return { ...previous, key: documentKey, naturalPageSize: next }
      })
    },
    [documentKey]
  )

  const goToPage = React.useCallback(
    (target: number) => {
      const clamped = clampPage(target, pageCount)
      if (clamped === pageNumber) return
      if (!isPageControlled) setPageState({ key: documentKey, page: clamped })
      onPageChange?.(clamped)
    },
    [documentKey, isPageControlled, onPageChange, pageCount, pageNumber]
  )

  const goToPreviousPage = React.useCallback(() => goToPage(pageNumber - 1), [goToPage, pageNumber])
  const goToNextPage = React.useCallback(() => goToPage(pageNumber + 1), [goToPage, pageNumber])

  const zoomIn = React.useCallback(
    () => setZoomState({ zoom: nextZoomStep(zoom, 1), fitToWidth: false }),
    [zoom]
  )
  const zoomOut = React.useCallback(
    () => setZoomState({ zoom: nextZoomStep(zoom, -1), fitToWidth: false }),
    [zoom]
  )
  const resetZoom = React.useCallback(() => setZoomState({ zoom: 1, fitToWidth: false }), [])
  const fitToWidth = React.useCallback(
    () => setZoomState((previous) => ({ ...previous, fitToWidth: true })),
    []
  )

  const toggleOverlay = React.useCallback(() => {
    if (isOverlayControlled) {
      onShowOverlayChange?.(!showOverlayProp)
      return
    }
    const next = !uncontrolledShowOverlay
    setUncontrolledShowOverlay(next)
    onShowOverlayChange?.(next)
  }, [isOverlayControlled, onShowOverlayChange, showOverlayProp, uncontrolledShowOverlay])

  const toggleFullscreen = React.useCallback(() => setFullscreen((value) => !value), [])

  React.useEffect(() => {
    if (!fullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [fullscreen])

  return {
    containerRef,
    pageNumber,
    pageCount,
    setPageCount,
    goToPage,
    goToPreviousPage,
    goToNextPage,
    canGoBack: pageNumber > 1,
    canGoForward: pageCount != null && pageNumber < pageCount,
    naturalPageSize,
    setNaturalPageSize,
    renderWidth,
    zoom,
    isFitToWidth: zoomState.fitToWidth,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToWidth,
    canZoomIn: zoom < MAX_ZOOM - 0.001,
    canZoomOut: zoom > MIN_ZOOM + 0.001,
    showOverlay,
    toggleOverlay,
    fullscreen,
    toggleFullscreen,
  }
}
