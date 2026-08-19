"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useToast } from "@/components/ui/toast"
import { analysisService } from "@/services"
import type { ExportDataset } from "@/lib/types"

export interface ExportDialogProps {
  open: boolean
  onClose: () => void
  analysisId: string
}

type ExportFormat = "xlsx" | "csv"

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function ExportDialog({ open, onClose, analysisId }: ExportDialogProps) {
  const [format, setFormat] = React.useState<ExportFormat>("xlsx")
  const [dataset, setDataset] = React.useState<ExportDataset>("starting-six")
  const [downloading, setDownloading] = React.useState(false)
  const { push } = useToast()

  const handleDownload = async () => {
    setDownloading(true)
    try {
      if (format === "xlsx") {
        const blob = await analysisService.exportExcel(analysisId)
        triggerDownload(blob, `volleyref-${analysisId}.xlsx`)
        push("Download avviato — volleyref-" + analysisId + ".xlsx", { tone: "success" })
      } else {
        const blob = await analysisService.exportCsv(analysisId, dataset)
        const suffix = dataset === "starting-six" ? "sestetti" : "servizi"
        triggerDownload(blob, `volleyref-${analysisId}-${suffix}.csv`)
        push("CSV scaricato", { tone: "success" })
      }
      onClose()
    } catch {
      push("Esportazione non riuscita — riprova", { tone: "danger" })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Esporta analisi"
      description="Scegli il formato e i dati da includere."
      size="md"
      footer={
        <React.Fragment>
          <Button variant="secondary" onClick={onClose} disabled={downloading}>
            Annulla
          </Button>
          <Button onClick={handleDownload} loading={downloading}>
            {format === "csv" ? "Scarica CSV" : "Scarica Excel"}
          </Button>
        </React.Fragment>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <SegmentedControl
          options={[
            { value: "xlsx", label: "Excel (.xlsx)" },
            { value: "csv", label: "CSV" },
          ]}
          value={format}
          onChange={(v) => setFormat(v as ExportFormat)}
        />
        {format === "xlsx" ? (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            Il file Excel include informazioni partita, sestetti iniziali e turni di servizio di tutti i set.
          </p>
        ) : (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 8,
              }}
            >
              Dati da esportare
            </div>
            <SegmentedControl
              options={[
                { value: "starting-six", label: "Sestetti iniziali" },
                { value: "service-turns", label: "Turni di servizio" },
              ]}
              value={dataset}
              onChange={(v) => setDataset(v as ExportDataset)}
            />
          </div>
        )}
      </div>
    </Dialog>
  )
}
