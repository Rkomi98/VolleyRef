"use client"

import * as React from "react"

import type { ExtractionMethod, SourceRegion } from "@/lib/types"

export interface RegionOverlayProps {
  regions: SourceRegion[]
  page: number
  selectedRegionId?: string | null
  hoveredRegionId?: string | null
  visible?: boolean
  onRegionClick?: (regionId: string, region: SourceRegion) => void
  onRegionHover?: (regionId: string | null, region: SourceRegion | null) => void
  regionLabel?: (region: SourceRegion) => string
  autoScrollIntoView?: boolean
}

type MethodPalette = { border: string; borderSelected: string; fill: string; fillHover: string; fillSelected: string; ring: string }

const palettes: Record<ExtractionMethod, MethodPalette> = {
  PDF_TEXT: {
    border: "rgba(0,170,234,0.55)",
    borderSelected: "var(--color-primary)",
    fill: "rgba(0,170,234,0.08)",
    fillHover: "rgba(0,170,234,0.16)",
    fillSelected: "rgba(0,170,234,0.22)",
    ring: "0 0 0 4px rgba(0,170,234,0.18)",
  },
  OCR: {
    border: "rgba(226,161,0,0.6)",
    borderSelected: "var(--color-warning)",
    fill: "rgba(226,161,0,0.10)",
    fillHover: "rgba(226,161,0,0.18)",
    fillSelected: "rgba(226,161,0,0.24)",
    ring: "0 0 0 4px rgba(226,161,0,0.20)",
  },
  DERIVED: {
    border: "rgba(101,115,129,0.55)",
    borderSelected: "var(--neutral-600)",
    fill: "rgba(101,115,129,0.06)",
    fillHover: "rgba(101,115,129,0.14)",
    fillSelected: "rgba(101,115,129,0.20)",
    ring: "0 0 0 4px rgba(101,115,129,0.16)",
  },
}

const methodNames: Record<ExtractionMethod, string> = {
  PDF_TEXT: "testo del PDF",
  OCR: "riconoscimento immagine",
  DERIVED: "dato derivato",
}

type PlacedRegion = {
  region: SourceRegion
  left: number
  top: number
  width: number
  height: number
}

function place(region: SourceRegion): PlacedRegion | null {
  const { x, y, width, height } = region
  if (![x, y, width, height].every((value) => typeof value === "number" && Number.isFinite(value))) {
    return null
  }
  const left = Math.min(Math.max(x, 0), 1)
  const top = Math.min(Math.max(y, 0), 1)
  const clampedWidth = Math.min(Math.max(width, 0), 1 - left)
  const clampedHeight = Math.min(Math.max(height, 0), 1 - top)
  if (clampedWidth <= 0 || clampedHeight <= 0) return null
  return { region, left, top, width: clampedWidth, height: clampedHeight }
}

/** Regions that will actually be drawn for `page` — same filtering the overlay applies. */
export function drawableRegions(regions: SourceRegion[] | undefined, page: number): SourceRegion[] {
  if (!Array.isArray(regions)) return []
  return regions.filter((region) => region && region.page === page && place(region) !== null)
}

function defaultLabel(region: SourceRegion): string {
  const kind = region.regionType ? region.regionType.replace(/[_-]+/g, " ") : "Zona riconosciuta"
  const text = region.rawText?.trim()
  const source = methodNames[region.method] ?? region.method
  return text ? `${kind} — “${text}” (${source})` : `${kind} (${source})`
}

/**
 * Clickable layer of extracted-region boxes, drawn on top of a rendered PDF page.
 *
 * Must be mounted inside a `position: relative` box whose size matches the page
 * exactly (`PdfViewer` provides one): every box is positioned in percentages of
 * that box, so zoom, panel resize and fullscreen need no recalculation.
 *
 * Coordinates come from `SourceRegion` and are expected normalized to `[0,1]`
 * with the origin at the top-left of the page. Regions on other pages, and
 * regions with non-finite or empty geometry, are skipped instead of throwing.
 */
export function RegionOverlay({
  regions,
  page,
  selectedRegionId = null,
  hoveredRegionId = null,
  visible = true,
  onRegionClick,
  onRegionHover,
  regionLabel = defaultLabel,
  autoScrollIntoView = true,
}: RegionOverlayProps) {
  const [internalHoverId, setInternalHoverId] = React.useState<string | null>(null)
  const selectedRef = React.useRef<HTMLButtonElement | null>(null)

  const placed = React.useMemo(() => {
    if (!Array.isArray(regions)) return []
    return regions
      .filter((region) => region && region.page === page)
      .map(place)
      .filter((item): item is PlacedRegion => item !== null)
  }, [regions, page])

  React.useEffect(() => {
    if (!autoScrollIntoView || !visible || !selectedRegionId) return
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
  }, [autoScrollIntoView, visible, selectedRegionId, page])

  if (!visible || placed.length === 0) return null

  return (
    <div
      aria-label="Zone riconosciute sul referto"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {placed.map(({ region, left, top, width, height }) => {
        const isSelected = selectedRegionId === region.id
        const isHovered = internalHoverId === region.id || hoveredRegionId === region.id
        const palette = palettes[region.method] ?? palettes.PDF_TEXT
        const label = regionLabel(region)
        return (
          <button
            key={region.id}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={isSelected}
            onClick={() => onRegionClick?.(region.id, region)}
            onMouseEnter={() => {
              setInternalHoverId(region.id)
              onRegionHover?.(region.id, region)
            }}
            onMouseLeave={() => {
              setInternalHoverId((current) => (current === region.id ? null : current))
              onRegionHover?.(null, null)
            }}
            onFocus={() => setInternalHoverId(region.id)}
            onBlur={() => setInternalHoverId((current) => (current === region.id ? null : current))}
            style={{
              position: "absolute",
              left: `${left * 100}%`,
              top: `${top * 100}%`,
              width: `${width * 100}%`,
              height: `${height * 100}%`,
              minWidth: 8,
              minHeight: 8,
              padding: 0,
              margin: 0,
              pointerEvents: "auto",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              border: `1.5px solid ${isSelected ? palette.borderSelected : palette.border}`,
              background: isSelected
                ? palette.fillSelected
                : isHovered
                  ? palette.fillHover
                  : palette.fill,
              boxShadow: isSelected ? palette.ring : "none",
              transition:
                "background var(--duration-base) var(--ease-standard), box-shadow var(--duration-base) var(--ease-standard), border-color var(--duration-base) var(--ease-standard)",
            }}
          />
        )
      })}
    </div>
  )
}
