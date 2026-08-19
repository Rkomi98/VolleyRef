import type { Analysis, AnalysisStatus, ExportDataset } from "@/lib/types"

/**
 * Unico punto di contatto tra la UI e "il backend" (reale o mock).
 * Nessun componente deve chiamare `fetch` direttamente né conoscere OCR/PDF
 * parsing/computer vision: passa sempre da qui.
 *
 * Implementazioni:
 * - `MockAnalysisService` (src/services/MockAnalysisService.ts) — usata in sviluppo,
 *   nessuna rete, dati fabbricati in memoria.
 * - `HttpAnalysisService` (src/lib/api/HttpAnalysisService.ts) — chiama il backend
 *   FastAPI reale via `NEXT_PUBLIC_API_BASE_URL`.
 *
 * Lo switch tra le due è una sola configurazione (src/services/index.ts), non un
 * cambio di componenti React (frontend prompt §22, §27).
 */
export interface AnalysisService {
  create(file: File): Promise<{ analysisId: string }>
  getStatus(analysisId: string): Promise<AnalysisStatus>
  getAnalysis(analysisId: string): Promise<Analysis>
  updateField(analysisId: string, fieldId: string, value: unknown): Promise<Analysis>
  resetCorrections(analysisId: string): Promise<Analysis>
  reanalyze(analysisId: string): Promise<void>
  exportExcel(analysisId: string): Promise<Blob>
  exportCsv(analysisId: string, dataset: ExportDataset): Promise<Blob>
  /**
   * URL da cui `PdfViewer` può caricare il referto originale (render inline,
   * mai un download) quando il file appena caricato non è più in memoria —
   * ad es. dopo un reload della pagina o apertura diretta via URL. `null`
   * quando non esiste alcun URL utilizzabile (`MockAnalysisService`: non
   * c'è un backend reale da cui recuperarlo).
   */
  getSourcePdfUrl(analysisId: string): string | null
}
