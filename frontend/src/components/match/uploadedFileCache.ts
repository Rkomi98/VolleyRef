/**
 * Cache in-memory (per tab) del PDF appena caricato dall'utente, tenuta viva
 * tra la Home e il Match Workspace così che `PdfViewer` (`src/components/pdf`)
 * possa mostrare il referto realmente caricato, senza che il backend (mock o
 * reale) debba esporre un URL scaricabile del PDF originale — cosa che oggi
 * non è prevista dal modello dati (`Analysis` non porta alcun campo con l'URL
 * del referto).
 *
 * Le due partite mock precaricate (`cerea-rothoblaas`, `sanmarco-vicenza`) e
 * qualunque analisi aperta direttamente via URL (o dopo un reload della
 * pagina) non hanno un file qui: in quel caso `PdfViewer` mostra il proprio
 * stato vuoto ("Nessun referto caricato"), il che è corretto perché non
 * esiste davvero un PDF disponibile lato client per quel caso.
 */
const cache = new Map<string, File>()

export function rememberUploadedFile(analysisId: string, file: File): void {
  cache.set(analysisId, file)
}

export function getUploadedFile(analysisId: string): File | undefined {
  return cache.get(analysisId)
}
