"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { PdfViewer } from "@/components/pdf"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Tabs, type TabItem } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import { AnalysisApiError } from "@/lib/api/errors"
import { analysisService } from "@/services"
import type { Analysis, SetData } from "@/lib/types"

import { ExportDialog } from "./ExportDialog"
import type { FieldLocation, WorkspaceTab } from "./field-lookup"
import { locateField } from "./field-lookup"
import { MatchHeader } from "./MatchHeader"
import { MatchSummary } from "./MatchSummary"
import { pollUntilDone } from "./polling"
import { ResetCorrectionsDialog } from "./ResetCorrectionsDialog"
import { ServiceTurnsTable } from "./ServiceTurnsTable"
import { SetSelector } from "./SetSelector"
import { StartingSixPanel } from "./StartingSix"
import { getUploadedFile } from "./uploadedFileCache"
import { ValidationPanel } from "./ValidationPanel"

const TAB_ITEMS: TabItem[] = [
  { value: "summary", label: "Riepilogo" },
  { value: "lineups", label: "Formazioni" },
  { value: "services", label: "Servizi" },
  { value: "validation", label: "Controllo" },
]

const MOBILE_BREAKPOINT = 880

type DesktopViewMode = "pdf" | "split" | "data"
type MobileViewMode = "pdf" | "data"

function useIsMobile(breakpoint: number): boolean {
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = () => setIsMobile(mq.matches)
    handler()
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [breakpoint])
  return isMobile
}

function countManualCorrections(analysis: Analysis): number {
  let count = 0
  for (const set of analysis.sets) {
    for (const six of [set.teamAStartingSix, set.teamBStartingSix] as const) {
      for (const label of ["I", "II", "III", "IV", "V", "VI"] as const) {
        if (six[label].manuallyConfirmed) count++
      }
    }
    for (const turn of set.serviceTurns) {
      if (turn.player.manuallyConfirmed) count++
      if (turn.rotation.manuallyConfirmed) count++
      if (turn.scoreStart.manuallyConfirmed) count++
      if (turn.scoreEnd.manuallyConfirmed) count++
    }
  }
  return count
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof AnalysisApiError ? error.message : fallback
}

export interface MatchWorkspaceProps {
  analysisId: string
}

export function MatchWorkspace({ analysisId }: MatchWorkspaceProps) {
  const router = useRouter()
  const { push } = useToast()
  const isMobile = useIsMobile(MOBILE_BREAKPOINT)

  const [analysis, setAnalysis] = React.useState<Analysis | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>("summary")
  const [currentSetNumber, setCurrentSetNumber] = React.useState(1)
  const [desktopViewMode, setDesktopViewMode] = React.useState<DesktopViewMode>("split")
  const [mobileViewMode, setMobileViewMode] = React.useState<MobileViewMode>("data")
  const [selectedRegionId, setSelectedRegionId] = React.useState<string | null>(null)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [reanalyzing, setReanalyzing] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        let current = await analysisService.getAnalysis(analysisId)
        if (current.status === "UPLOADED" || current.status === "PROCESSING") {
          const status = await pollUntilDone(analysisId)
          if (status.status !== "READY") {
            if (!cancelled) setLoadError(status.error?.message ?? "L'analisi non è andata a buon fine.")
            return
          }
          current = await analysisService.getAnalysis(analysisId)
        }
        if (!cancelled) {
          setAnalysis(current)
          setCurrentSetNumber(current.sets[0]?.number ?? 1)
        }
      } catch (error) {
        if (!cancelled) setLoadError(errorMessage(error, "Impossibile caricare l'analisi."))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [analysisId])

  const applyLocation = React.useCallback((location: FieldLocation) => {
    setActiveTab(location.tab)
    setCurrentSetNumber(location.setNumber)
    setSelectedRegionId(location.regionIds[0] ?? null)
  }, [])

  const handleRegionClick = React.useCallback(
    (regionId: string) => {
      if (!analysis) return
      const location = locateField(analysis, regionId)
      if (location) {
        applyLocation(location)
      } else {
        setSelectedRegionId(regionId)
      }
      if (isMobile) setMobileViewMode("data")
    },
    [analysis, applyLocation, isMobile]
  )

  const handleHighlightRegions = React.useCallback(
    (regionIds: string[]) => {
      setSelectedRegionId(regionIds[0] ?? null)
      if (isMobile) setMobileViewMode("pdf")
    },
    [isMobile]
  )

  const handleEditField = React.useCallback(
    async (fieldId: string, value: unknown) => {
      if (!analysis) return
      const previous = analysis
      try {
        const updated = await analysisService.updateField(analysisId, fieldId, value)
        setAnalysis(updated)
        push("Valore aggiornato", {
          actionLabel: "Annulla",
          onAction: () => setAnalysis(previous),
        })
      } catch (error) {
        push(errorMessage(error, "Aggiornamento non riuscito"), { tone: "danger" })
      }
    },
    [analysis, analysisId, push]
  )

  const handleResetCorrections = React.useCallback(async () => {
    setResetting(true)
    try {
      const updated = await analysisService.resetCorrections(analysisId)
      setAnalysis(updated)
      setResetOpen(false)
      push("Dati ripristinati", { tone: "success" })
    } catch (error) {
      push(errorMessage(error, "Ripristino non riuscito"), { tone: "danger" })
    } finally {
      setResetting(false)
    }
  }, [analysisId, push])

  const handleReanalyze = React.useCallback(async () => {
    setReanalyzing(true)
    try {
      await analysisService.reanalyze(analysisId)
      const status = await pollUntilDone(analysisId)
      if (status.status === "READY") {
        const updated = await analysisService.getAnalysis(analysisId)
        setAnalysis(updated)
        push("Referto rianalizzato", { tone: "success" })
      } else {
        push("Rianalisi non riuscita — riprova", { tone: "danger" })
      }
    } catch (error) {
      push(errorMessage(error, "Rianalisi non riuscita"), { tone: "danger" })
    } finally {
      setReanalyzing(false)
    }
  }, [analysisId, push])

  const handleNewReport = React.useCallback(() => {
    router.push("/")
  }, [router])

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--color-background)" }}>
        <span style={{ fontSize: 14, color: "var(--color-text-secondary)", fontFamily: "var(--font-body)" }}>Caricamento analisi…</span>
      </div>
    )
  }

  if (loadError || !analysis) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--color-background)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: 420, textAlign: "center", padding: 24 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, color: "var(--color-text-primary)" }}>
            Impossibile mostrare questa analisi
          </span>
          <span style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            {loadError ?? "Analisi non trovata."}
          </span>
          <Button onClick={handleNewReport}>Torna alla home</Button>
        </div>
      </div>
    )
  }

  const currentSet: SetData = analysis.sets.find((s) => s.number === currentSetNumber) ?? analysis.sets[0]
  const setIndex = Math.max(0, analysis.sets.findIndex((s) => s.number === currentSet.number))
  const editCount = countManualCorrections(analysis)

  const handleValidationJump = (location: FieldLocation) => {
    applyLocation(location)
  }

  const goToPrevSet = () => {
    if (setIndex > 0) setCurrentSetNumber(analysis.sets[setIndex - 1].number)
  }
  const goToNextSet = () => {
    if (setIndex < analysis.sets.length - 1) setCurrentSetNumber(analysis.sets[setIndex + 1].number)
  }

  const pdfPanel = (
    <PdfViewer
      pdfUrl={getUploadedFile(analysisId) ?? null}
      regions={analysis.sourceRegions}
      selectedRegionId={selectedRegionId}
      onRegionClick={(regionId) => handleRegionClick(regionId)}
      onHidePanel={!isMobile && desktopViewMode === "split" ? () => setDesktopViewMode("data") : undefined}
    />
  )

  const dataPanel = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "0 24px" }}>
        <Tabs tabs={TAB_ITEMS} value={activeTab} onChange={(v) => setActiveTab(v as WorkspaceTab)} />
      </div>
      {activeTab !== "summary" && <SetSelector sets={analysis.sets} value={currentSetNumber} onChange={setCurrentSetNumber} />}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {activeTab === "summary" && (
          <MatchSummary
            analysis={analysis}
            onSelectSet={(setNumber) => {
              setCurrentSetNumber(setNumber)
              setActiveTab("lineups")
            }}
          />
        )}
        {activeTab === "lineups" && (
          <StartingSixPanel
            set={currentSet}
            teamA={analysis.match.teamA}
            teamB={analysis.match.teamB}
            onEditField={handleEditField}
            onHighlight={handleHighlightRegions}
          />
        )}
        {activeTab === "services" && (
          <ServiceTurnsTable
            set={currentSet}
            teamA={analysis.match.teamA}
            teamB={analysis.match.teamB}
            onEditField={handleEditField}
            onHighlight={handleHighlightRegions}
          />
        )}
        {activeTab === "validation" && (
          <ValidationPanel
            analysis={analysis}
            set={currentSet}
            setPosition={{ index: setIndex, total: analysis.sets.length }}
            onPrevSet={goToPrevSet}
            onNextSet={goToNextSet}
            onJump={handleValidationJump}
          />
        )}
      </div>
      {editCount > 0 && (
        <div style={{ padding: "10px 24px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-text-secondary)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              fontFamily: "var(--font-body)",
            }}
          >
            Ripristina dati estratti ({editCount})
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--color-background)" }}>
      <MatchHeader
        teamAName={analysis.match.teamA.name}
        teamBName={analysis.match.teamB.name}
        finalResult={analysis.match.finalResult}
        overallValidation={analysis.overallValidation}
        editCount={editCount}
        onExport={() => setExportOpen(true)}
        onReanalyze={handleReanalyze}
        reanalyzing={reanalyzing}
        onResetCorrections={() => setResetOpen(true)}
        onNewReport={handleNewReport}
        viewMode={isMobile ? mobileViewMode : desktopViewMode}
        onChangeViewMode={(v) => (isMobile ? setMobileViewMode(v as MobileViewMode) : setDesktopViewMode(v as DesktopViewMode))}
        viewOptions={isMobile ? [{ value: "pdf", label: "Referto" }, { value: "data", label: "Dati" }] : undefined}
      />
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {isMobile ? (
          mobileViewMode === "pdf" ? (
            pdfPanel
          ) : (
            dataPanel
          )
        ) : desktopViewMode === "pdf" ? (
          pdfPanel
        ) : desktopViewMode === "data" ? (
          dataPanel
        ) : (
          <ResizablePanelGroup orientation="horizontal" style={{ flex: 1 }}>
            <ResizablePanel defaultSize="45%" minSize="26%" maxSize="72%">
              {pdfPanel}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel minSize="28%">{dataPanel}</ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} analysisId={analysisId} />
      <ResetCorrectionsDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleResetCorrections}
        editCount={editCount}
        confirming={resetting}
      />
    </div>
  )
}
