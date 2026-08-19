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
  exitFullscreen: () => void
}

function clampPage(page: number, pageCount: number | null): number {
  const candidate = Number.isFinite(page) ? Math.floor(page) : 1
  if (pageCount == null || pageCount < 1) return Math.max(1, candidate)
  return Math.min(Math.max(candidate, 1), pageCount)
}

function nextZoomStep(current: number, direction: 1 | -1): number {
  if (direction === 1) {
    const found = ZOOM_STEPS.find((step) => step > current + 0.001)
    return found ?? MAX_ZOOM
  }
  const reversed = [...ZOOM_STEPS].reverse()
  const found = reversed.find((step) => step < current - 0.001)
  return found ?? MIN_ZOOM
}

/**
 * Zoom / page / overlay / fullscreen state for `PdfViewer`, plus the pixel width
 * to hand to the underlying page renderer. `page` and `showOverlay` may be driven
 * from the outside (controlled) or left undefined (managed here).
 */
export function usePdfViewerState(options: UsePdfViewerStateOptions = {}): PdfViewerState {
  const {
    page,
    onPageChange,
    initialPage = 1,
    showOverlay: showOverlayProp,
    onShowOverlayChange,
    initialShowOverlay = true,
  } = options

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = React.useState(0)
  const [uncontrolledPage, setUncontrolledPage] = React.useState(() => clampPage(initialPage, null))
  const [pageCount, setPageCountState] = React.useState<number | null>(null)
  const [naturalPageSize, setNaturalPageSizeState] = React.useState<PageSize | null>(null)
  const [zoom, setZoom] = React.useState(1)
  const [isFitToWidth, setIsFitToWidth] = React.useState(true)
  const [uncontrolledShowOverlay, setUncontrolledShowOverlay] = React.useState(initialShowOverlay)
  const [fullscreen, setFullscreen] = React.useState(false)

  const isPageControlled = typeof page === "number" && Number.isFinite(page)
  const pageNumber = clampPage(isPageControlled ? (page as number) : uncontrolledPage, pageCount)

  const isOverlayControlled = typeof showOverlayProp === "boolean"
  const showOverlay = isOverlayControlled ? (showOverlayProp as boolean) : uncontrolledShowOverlay

  React.useEffect(() => {
    const element = containerRef.current
    if (!element || typeof ResizeObserver === "undefined") return
    let timeout: ReturnType<typeof setTimeout> | null = null
    setContainerWidth(element.clientWidth)
    // Debounced: every width change restarts the page render, and react-pdf keeps
    // the canvas hidden until one completes, so thrashing it would show a blank page.
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
  const naturalWidth =
    naturalPageSize && naturalPageSize.width > 0 ? naturalPageSize.width : null

  const renderWidth =
    availableWidth === 0
      ? null
      : Math.min(
          MAX_RENDER_WIDTH,
          Math.max(
            MIN_RENDER_WIDTH,
            Math.round(isFitToWidth ? availableWidth : (naturalWidth ?? availableWidth) * zoom)
          )
        )

  const effectiveZoom =
    renderWidth != null && naturalWidth ? renderWidth / naturalWidth : zoom

  const stateRef = React.useRef({ pageNumber, pageCount, effectiveZoom })
  stateRef.current = { pageNumber, pageCount, effectiveZoom }

  const setPageCount = React.useCallback((count: number | null) => {
    setPageCountState((previous) => {
      const next = count != null && Number.isFinite(count) && count > 0 ? Math.floor(count) : null
      return previous === next ? previous : next
    })
  }, [])

  const setNaturalPageSize = React.useCallback((size: PageSize | null) => {
    setNaturalPageSizeState((previous) => {
      if (size == null) return previous == null ? previous : null
      if (!(size.width > 0) || !(size.height > 0)) return previous
      if (previous && previous.width === size.width && previous.height === size.height) {
        return previous
      }
      return { width: size.width, height: size.height }
    })
  }, [])

  const goToPage = React.useCallback(
    (target: number) => {
      const clamped = clampPage(target, stateRef.current.pageCount)
      if (clamped === stateRef.current.pageNumber) return
      if (!isPageControlled) setUncontrolledPage(clamped)
      onPageChange?.(clamped)
    },
    [isPageControlled, onPageChange]
  )

  const goToPreviousPage = React.useCallback(
    () => goToPage(stateRef.current.pageNumber - 1),
    [goToPage]
  )
  const goToNextPage = React.useCallback(
    () => goToPage(stateRef.current.pageNumber + 1),
    [goToPage]
  )

  const applyZoom = React.useCallback((direction: 1 | -1) => {
    setZoom(nextZoomStep(stateRef.current.effectiveZoom, direction))
    setIsFitToWidth(false)
  }, [])

  const zoomIn = React.useCallback(() => applyZoom(1), [applyZoom])
  const zoomOut = React.useCallback(() => applyZoom(-1), [applyZoom])

  const resetZoom = React.useCallback(() => {
    setZoom(1)
    setIsFitToWidth(false)
  }, [])

  const fitToWidth = React.useCallback(() => setIsFitToWidth(true), [])

  const toggleOverlay = React.useCallback(() => {
    if (isOverlayControlled) {
      onShowOverlayChange?.(!showOverlayProp)
      return
    }
    setUncontrolledShowOverlay((visible) => {
      onShowOverlayChange?.(!visible)
      return !visible
    })
  }, [isOverlayControlled, onShowOverlayChange, showOverlayProp])

  const toggleFullscreen = React.useCallback(() => setFullscreen((value) => !value), [])
  const exitFullscreen = React.useCallback(() => setFullscreen(false), [])

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
    zoom: effectiveZoom,
    isFitToWidth,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToWidth,
    canZoomIn: effectiveZoom < MAX_ZOOM - 0.001,
    canZoomOut: effectiveZoom > MIN_ZOOM + 0.001,
    showOverlay,
    toggleOverlay,
    fullscreen,
    toggleFullscreen,
    exitFullscreen,
  }
}
