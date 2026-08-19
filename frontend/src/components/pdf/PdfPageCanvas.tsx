"use client"

import * as React from "react"
import { Document, Page, pdfjs } from "react-pdf"

import { BundledStandardFontDataFactory } from "./standardFontData"
import type { PageSize } from "./usePdfViewerState"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

export type PdfSource = string | Blob | { url: string }

export interface PdfPageCanvasProps {
  file: PdfSource
  pageNumber: number
  width: number
  pageAspectRatio?: number | null
  cMapUrl?: string
  standardFontDataUrl?: string
  children?: React.ReactNode
  onDocumentLoad?: (pageCount: number) => void
  onPageLoad?: (size: PageSize) => void
  onLoadError?: (error: Error) => void
}

type LoadedDocument = { numPages: number }
type LoadedPage = { originalWidth: number; originalHeight: number }

/**
 * react-pdf reloads the document whenever the identity of `options` changes, and a
 * `useMemo` is not stable enough (double renders, remounts of the lazy chunk), so
 * one object per distinct configuration is kept here instead.
 *
 * `useSystemFonts: false` keeps rendering identical on every machine instead of
 * depending on locally installed fonts, and `useWasm: false` keeps pdf.js on its
 * JS decoders since no wasm assets are served.
 */
const optionsCache = new Map<string, Record<string, unknown>>()

function documentOptions(cMapUrl?: string, standardFontDataUrl?: string): Record<string, unknown> {
  const key = `${cMapUrl ?? ""}|${standardFontDataUrl ?? ""}`
  const cached = optionsCache.get(key)
  if (cached) return cached
  const options: Record<string, unknown> = {
    useSystemFonts: false,
    useWasm: false,
    ...(cMapUrl ? { cMapUrl, cMapPacked: true } : {}),
    ...(standardFontDataUrl
      ? { standardFontDataUrl }
      : { StandardFontDataFactory: BundledStandardFontDataFactory }),
  }
  optionsCache.set(key, options)
  return options
}

function Notice({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "danger" }) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        textAlign: "center",
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-sm)",
        color: tone === "danger" ? "var(--color-danger)" : "var(--color-text-secondary)",
      }}
    >
      {children}
    </div>
  )
}

/**
 * pdf.js rendering surface. Kept in its own module so `PdfViewer` can load it
 * with `ssr: false` (pdf.js needs browser APIs) and so the worker is configured
 * in the very module that renders `<Document>`, as react-pdf requires.
 *
 * `children` are rendered inside a box whose size matches the page exactly —
 * that is the coordinate space `RegionOverlay` positions itself against.
 */
export default function PdfPageCanvas({
  file,
  pageNumber,
  width,
  pageAspectRatio,
  cMapUrl,
  standardFontDataUrl,
  children,
  onDocumentLoad,
  onPageLoad,
  onLoadError,
}: PdfPageCanvasProps) {
  const options = documentOptions(cMapUrl, standardFontDataUrl)

  const height = pageAspectRatio && pageAspectRatio > 0 ? Math.round(width * pageAspectRatio) : undefined

  // react-pdf keeps the canvas hidden until a render completes, and a dense
  // referto can take seconds, so the wait needs to be visible to the user.
  const renderKey = `${pageNumber}@${width}`
  const [paintedKey, setPaintedKey] = React.useState<string | null>(null)
  const isRendering = paintedKey !== renderKey

  return (
    <Document
      file={file}
      options={options}
      onLoadSuccess={(pdf: LoadedDocument) => onDocumentLoad?.(pdf.numPages)}
      onLoadError={(error: Error) => onLoadError?.(error)}
      loading={<Notice>Apertura del referto…</Notice>}
      error={<Notice tone="danger">Impossibile aprire il PDF del referto.</Notice>}
      noData={<Notice>Nessun referto da mostrare.</Notice>}
    >
      <div
        style={{
          position: "relative",
          width,
          height,
          background: "var(--color-white)",
          boxShadow: "var(--shadow-md)",
          borderRadius: 2,
          lineHeight: 0,
        }}
      >
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          canvasBackground="#FFFFFF"
          onLoadSuccess={(page: LoadedPage) =>
            onPageLoad?.({ width: page.originalWidth, height: page.originalHeight })
          }
          onLoadError={(error: Error) => onLoadError?.(error)}
          onRenderSuccess={() => setPaintedKey(renderKey)}
          onRenderError={(error: Error) => {
            setPaintedKey(renderKey)
            onLoadError?.(error)
          }}
          loading={<Notice>Rendering della pagina…</Notice>}
          error={<Notice tone="danger">Impossibile disegnare questa pagina.</Notice>}
          noData={<Notice>Pagina non disponibile.</Notice>}
        />
        {children}
        {isRendering ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-white)",
              pointerEvents: "none",
            }}
          >
            <Notice>Rendering della pagina…</Notice>
          </div>
        ) : null}
      </div>
    </Document>
  )
}
