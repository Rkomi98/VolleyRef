import { analysisService } from "@/services"
import type { AnalysisStatus } from "@/lib/types"

const POLL_INTERVAL_MS = 350

/**
 * Interroga `getStatus` a intervalli regolari finché la pipeline simulata (o
 * reale) non raggiunge uno stato terminale (`READY`/`FAILED`). Condiviso tra
 * la Home (dopo `create`) e il Match Workspace (nel caso — non previsto dal
 * flusso normale ma possibile navigando via URL — l'analisi non sia ancora
 * pronta) così che il polling non venga scritto due volte.
 */
export async function pollUntilDone(analysisId: string, onProgress?: (status: AnalysisStatus) => void): Promise<AnalysisStatus> {
  for (;;) {
    const status = await analysisService.getStatus(analysisId)
    onProgress?.(status)
    if (status.status === "READY" || status.status === "FAILED") return status
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}
