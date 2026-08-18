import type { ApiErrorCode } from "./dto"

/**
 * Errore tipizzato lanciato da entrambe le implementazioni di `AnalysisService`
 * (mock e HTTP) quando un'operazione fallisce con un errore "di dominio", cioè uno
 * di quelli descritti da `ApiErrorEnvelope` (dto.ts, backend prompt §34).
 *
 * Permette ai componenti React di fare `catch (e)` e leggere `e.code`/`e.message`
 * in modo identico indipendentemente dal fatto che la richiesta sia passata per
 * `fetch` (HttpAnalysisService) o sia stata simulata in memoria (MockAnalysisService).
 */
export class AnalysisApiError extends Error {
  readonly code: ApiErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = "AnalysisApiError"
    this.code = code
    this.details = details
  }
}
