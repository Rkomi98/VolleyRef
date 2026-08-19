"use client"

import * as React from "react"

import type { SourceRegion } from "@/lib/types"

import { PdfViewer } from "../PdfViewer"

const demoRegions: SourceRegion[] = [
  { id: "r-header", page: 1, x: 0.06, y: 0.04, width: 0.88, height: 0.09, method: "PDF_TEXT", regionType: "Intestazione", rawText: "Serie B1F" },
  { id: "r-lineup-a", page: 1, x: 0.06, y: 0.2, width: 0.41, height: 0.22, method: "PDF_TEXT", regionType: "Sestetto squadra A" },
  { id: "r-lineup-b", page: 1, x: 0.53, y: 0.2, width: 0.41, height: 0.22, method: "OCR", regionType: "Sestetto squadra B", rawText: "4 7 11 3 9 12" },
  { id: "r-services", page: 1, x: 0.06, y: 0.5, width: 0.88, height: 0.4, method: "PDF_TEXT", regionType: "Turni di servizio" },
  { id: "r-page2", page: 2, x: 0.1, y: 0.1, width: 0.5, height: 0.2, method: "DERIVED", regionType: "Set 2 — risultato" },
  { id: "r-out-of-range", page: 99, x: 0.1, y: 0.1, width: 0.2, height: 0.2, method: "PDF_TEXT", regionType: "Pagina inesistente" },
  { id: "r-broken", page: 1, x: Number.NaN, y: 0.5, width: 0.2, height: 0.2, method: "PDF_TEXT", regionType: "Geometria non valida" },
]

/**
 * Manual harness for `PdfViewer`: pick any local PDF, then click a field on the
 * right or a region box on the left to exercise the bidirectional selection.
 */
export function PdfViewerDemo({ initialPdfUrl = null }: { initialPdfUrl?: string | null }) {
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(initialPdfUrl)
  const [selectedRegionId, setSelectedRegionId] = React.useState<string | null>(null)
  const [lastEvent, setLastEvent] = React.useState<string>("—")

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "var(--font-body)" }}>
      <div style={{ flex: "1 1 60%", minWidth: 0, borderRight: "1px solid var(--border-default)" }}>
        <PdfViewer
          pdfUrl={pdfUrl}
          regions={demoRegions}
          selectedRegionId={selectedRegionId}
          onRegionClick={(regionId) => {
            setSelectedRegionId(regionId)
            setLastEvent(`click regione: ${regionId}`)
          }}
          onRegionHover={(regionId) => setLastEvent(regionId ? `hover regione: ${regionId}` : "hover: —")}
          onHidePanel={() => setLastEvent("richiesta: nascondi referto")}
        />
      </div>
      <div style={{ flex: "1 1 40%", padding: 20, display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>
        <input
          type="file"
          accept="application/pdf"
          onChange={(event) => {
            const selected = event.target.files?.[0]
            if (selected) setPdfUrl(URL.createObjectURL(selected))
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setPdfUrl(null)} style={{ fontSize: 13, cursor: "pointer" }}>
            Nessun PDF
          </button>
          <button type="button" onClick={() => setPdfUrl("/referto-inesistente.pdf")} style={{ fontSize: 13, cursor: "pointer" }}>
            URL non valido
          </button>
          <button type="button" onClick={() => setPdfUrl(initialPdfUrl)} style={{ fontSize: 13, cursor: "pointer" }}>
            Ricarica fixture
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Ultimo evento: {lastEvent}</p>
        {demoRegions.map((region) => (
          <button
            key={region.id}
            type="button"
            onClick={() => setSelectedRegionId(region.id)}
            style={{
              textAlign: "left",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${selectedRegionId === region.id ? "var(--color-primary)" : "var(--border-default)"}`,
              background: selectedRegionId === region.id ? "var(--color-primary-subtle)" : "var(--color-white)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {region.regionType} · pagina {region.page} · {region.method}
          </button>
        ))}
      </div>
    </div>
  )
}
