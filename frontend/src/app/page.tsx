"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FileText, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { ProgressStep } from "@/components/ui/progress-step"
import { useToast } from "@/components/ui/toast"
import { AnalysisApiError } from "@/lib/api/errors"
import type { ProcessingStepId, ProcessingStepStatus } from "@/lib/types"
import { analysisService } from "@/services"
import { pollUntilDone } from "@/components/match/polling"
import { rememberUploadedFile } from "@/components/match/uploadedFileCache"

const PROCESS_STEP_ORDER: ProcessingStepId[] = [
  "READ_DOCUMENT",
  "DETECT_SETS",
  "EXTRACT_STARTING_SIX",
  "EXTRACT_SERVICE_TURNS",
  "VALIDATE",
]

const STEP_LABELS: Record<ProcessingStepId, string> = {
  READ_DOCUMENT: "Lettura documento",
  DETECT_SETS: "Riconoscimento dei set",
  EXTRACT_STARTING_SIX: "Estrazione delle formazioni",
  EXTRACT_SERVICE_TURNS: "Ricostruzione dei servizi",
  VALIDATE: "Controllo di coerenza",
}

function toProgressStepStatus(status: ProcessingStepStatus): "pending" | "processing" | "completed" | "error" {
  if (status === "PROCESSING") return "processing"
  if (status === "COMPLETED") return "completed"
  if (status === "ERROR") return "error"
  return "pending"
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DEMO_ANALYSIS_ID = "sanmarco-vicenza"
const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_API !== "false"

type Phase = "idle" | "processing" | "error"

export default function Home() {
  const router = useRouter()
  const { push } = useToast()

  const [file, setFile] = React.useState<File | null>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [stepStatuses, setStepStatuses] = React.useState<Record<ProcessingStepId, ProcessingStepStatus>>(
    () => Object.fromEntries(PROCESS_STEP_ORDER.map((id) => [id, "PENDING"])) as Record<ProcessingStepId, ProcessingStepStatus>
  )
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const pickFile = (candidate: File | null | undefined) => {
    if (!candidate) return
    if (candidate.type !== "application/pdf") {
      push("Il file deve essere un PDF", { tone: "danger" })
      return
    }
    setFile(candidate)
  }

  const runAnalysis = React.useCallback(async (targetFile: File) => {
    setPhase("processing")
    setErrorMessage(null)
    setStepStatuses(Object.fromEntries(PROCESS_STEP_ORDER.map((id) => [id, "PENDING"])) as Record<ProcessingStepId, ProcessingStepStatus>)
    try {
      const { analysisId } = await analysisService.create(targetFile)
      rememberUploadedFile(analysisId, targetFile)
      const status = await pollUntilDone(analysisId, (s) => {
        const next = Object.fromEntries(PROCESS_STEP_ORDER.map((id) => [id, "PENDING"])) as Record<ProcessingStepId, ProcessingStepStatus>
        for (const step of s.steps) next[step.id] = step.status
        setStepStatuses(next)
      })
      if (status.status === "READY") {
        router.push(`/match/${analysisId}`)
        return
      }
      setPhase("error")
      setErrorMessage(status.error?.message ?? "Il documento presenta pagine illeggibili o un formato non riconosciuto.")
    } catch (error) {
      setPhase("error")
      setErrorMessage(error instanceof AnalysisApiError ? error.message : "Analisi non riuscita — riprova.")
    }
  }, [router])

  const handleAnalyze = () => {
    if (file) void runAnalysis(file)
  }

  const handleRetry = () => {
    if (file) void runAnalysis(file)
  }

  const handleCancel = () => {
    setPhase("idle")
  }

  const handleChooseOther = () => {
    setFile(null)
    setPhase("idle")
  }

  const handleDemo = () => {
    router.push(`/match/${DEMO_ANALYSIS_ID}`)
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: "1px solid var(--border-default)",
          background: "var(--color-white)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "var(--radius-md)",
              background: "var(--color-primary)",
              color: "var(--color-white)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FileText size={16} />
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--color-text-primary)" }}>
            VolleyRef
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 13.5, color: "var(--color-text-secondary)", fontWeight: 600 }}>
          <span>Come funziona</span>
          <span>Privacy</span>
        </div>
      </header>

      {phase === "processing" || phase === "error" ? (
        <main style={{ maxWidth: 480, margin: "64px auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 28, width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, color: "var(--color-text-primary)" }}>
              Analisi del referto in corso
            </div>
            <div style={{ fontSize: 14, color: "var(--color-text-secondary)", marginTop: 6 }}>Non chiudere questa pagina.</div>
          </div>
          <div style={{ background: "var(--color-white)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "24px 28px" }}>
            {PROCESS_STEP_ORDER.map((id, i) => (
              <ProgressStep
                key={id}
                label={STEP_LABELS[id]}
                status={toProgressStepStatus(stepStatuses[id])}
                isLast={i === PROCESS_STEP_ORDER.length - 1}
              />
            ))}
          </div>
          {phase === "error" && (
            <div
              style={{
                background: "var(--color-danger-subtle)",
                border: "1px solid rgba(220,28,52,0.25)",
                borderRadius: "var(--radius-lg)",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-danger)" }}>Impossibile completare l&apos;analisi</div>
              <div style={{ fontSize: 13.5, color: "var(--color-text-primary)", lineHeight: 1.5 }}>{errorMessage}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={handleCancel}>
                  Annulla
                </Button>
                <Button variant="secondary" onClick={handleChooseOther}>
                  Scegli un altro PDF
                </Button>
                <Button onClick={handleRetry}>Riprova</Button>
              </div>
            </div>
          )}
        </main>
      ) : (
        <main
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "72px 24px 48px",
            display: "flex",
            flexDirection: "column",
            gap: 36,
            alignItems: "center",
            textAlign: "center",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 40,
                lineHeight: 1.15,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Trasforma un referto di pallavolo in dati utilizzabili
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--color-text-secondary)", margin: 0 }}>
              Carica il PDF del referto. VolleyRef ricostruisce sestetti, rotazioni e turni di servizio e prepara i dati per
              Excel.
            </p>
          </div>

          <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  pickFile(e.dataTransfer.files?.[0])
                }}
                style={{
                  border: `2px dashed ${dragOver ? "var(--color-primary)" : "var(--border-strong)"}`,
                  borderRadius: "var(--radius-lg)",
                  background: dragOver ? "var(--color-primary-subtle)" : "var(--color-white)",
                  padding: "56px 32px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                  transition: "all var(--duration-base) var(--ease-standard)",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "var(--color-primary-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-primary-dark)",
                  }}
                >
                  <Upload size={26} />
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19, color: "var(--color-text-primary)" }}>
                  Trascina qui il referto PDF
                </div>
                <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>oppure seleziona un file dal computer</div>
                <Button onClick={() => inputRef.current?.click()}>Seleziona PDF</Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <FileText size={13} /> PDF · elaborazione locale
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--color-white)",
                  padding: 22,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "var(--radius-md)",
                      background: "var(--color-danger-subtle)",
                      color: "var(--color-danger)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={19} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {file.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{formatSize(file.size)}</div>
                  </div>
                  <IconButton icon={<X size={16} />} label="Rimuovi file" onClick={() => setFile(null)} />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 12,
                    paddingTop: 4,
                    borderTop: "1px solid var(--border-default)",
                  }}
                >
                  <Button onClick={handleAnalyze}>Analizza referto</Button>
                </div>
              </div>
            )}
          </div>

          {isMockMode && (
            <button
              type="button"
              onClick={handleDemo}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-primary-dark)",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
                fontFamily: "var(--font-body)",
              }}
            >
              Vedi un esempio con anomalie da correggere
            </button>
          )}
        </main>
      )}
    </div>
  )
}
