/**
 * Cache in-memory (per tab) del PDF appena caricato dall'utente, tenuta viva
 * tra la Home e il Match Workspace così che `PdfViewer` (`src/components/pdf`)
 * possa mostrare il referto realmente caricato senza un round-trip verso il
 * backend per il file che si ha già in mano.
 *
 * Non è più l'unica fonte del PDF: `MatchWorkspace` la usa come primo
 * tentativo e ricade su `AnalysisService.getSourcePdfUrl` (che serve il file
 * salvato lato backend via `GET /analyses/{id}/source-pdf`) quando la cache
 * non ha nulla — reload della pagina, apertura via URL diretto, o analisi
 * aperta in un'altra sessione del browser.
 *
 * Restano senza alcun PDF disponibile solo le due partite mock precaricate
 * (`cerea-rothoblaas`, `sanmarco-vicenza`, che non hanno mai avuto un file
 * reale caricato) e, in generale, qualunque analisi in modalità mock
 * (`NEXT_PUBLIC_USE_MOCK_API` diverso da `"false"`): lì `getSourcePdfUrl`
 * torna `null` perché non esiste un backend reale da cui recuperarlo, e
 * `PdfViewer` mostra correttamente il proprio stato vuoto ("Nessun referto
 * caricato").
 */
const cache = new Map<string, File>()

export function rememberUploadedFile(analysisId: string, file: File): void {
  cache.set(analysisId, file)
}

export function getUploadedFile(analysisId: string): File | undefined {
  return cache.get(analysisId)
}
