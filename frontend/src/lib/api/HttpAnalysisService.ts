import type { AnalysisService } from "@/services/AnalysisService"
import type { AnalysisStatus, Analysis, ExportDataset } from "@/lib/types"

import { AnalysisApiError } from "./errors"
import type { ApiAnalysis, ApiAnalysisStatusResponse, ApiCreateAnalysisResponse, ApiErrorEnvelope } from "./dto"
import { mapAnalysisDtoToModel, mapAnalysisStatusDtoToModel } from "./mapper"

/**
 * Implementazione di `AnalysisService` che parla con il backend FastAPI reale via
 * `fetch` (backend prompt §4-§20, §33). Nessun componente React deve importare
 * questo file direttamente: passa sempre da `analysisService` (`src/services/index.ts`).
 */

const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1"

function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL
  return configured && configured.length > 0 ? configured : DEFAULT_API_BASE_URL
}

/**
 * Interpreta il body di una risposta non-2xx come `ApiErrorEnvelope`
 * (backend prompt §34: `{ error: { code, message, details } }`) e produce un
 * `AnalysisApiError` che preserva `code`/`message`/`details`. Se il body non è nel
 * formato atteso (es. errore di rete/proxy che restituisce HTML), usa un errore
 * generico `INTERNAL_ERROR` senza far fallire il parsing.
 */
async function toAnalysisApiError(response: Response): Promise<AnalysisApiError> {
  try {
    const body = (await response.json()) as ApiErrorEnvelope
    if (body?.error?.code && body?.error?.message) {
      return new AnalysisApiError(body.error.code, body.error.message, body.error.details)
    }
  } catch {
    // Il body non era JSON valido (o non aveva la forma attesa): usa il fallback sotto.
  }
  return new AnalysisApiError("INTERNAL_ERROR", `Richiesta al backend non riuscita (HTTP ${response.status})`)
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, init)
  if (!response.ok) throw await toAnalysisApiError(response)
  return (await response.json()) as T
}

async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, init)
  if (!response.ok) throw await toAnalysisApiError(response)
}

async function requestBlob(path: string, init?: RequestInit): Promise<Blob> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, init)
  if (!response.ok) throw await toAnalysisApiError(response)
  return await response.blob()
}

export class HttpAnalysisService implements AnalysisService {
  async create(file: File): Promise<{ analysisId: string }> {
    const formData = new FormData()
    formData.append("file", file)
    const dto = await requestJson<ApiCreateAnalysisResponse>("/analyses", {
      method: "POST",
      body: formData,
    })
    return { analysisId: dto.analysis_id }
  }

  async getStatus(analysisId: string): Promise<AnalysisStatus> {
    const dto = await requestJson<ApiAnalysisStatusResponse>(`/analyses/${encodeURIComponent(analysisId)}/status`)
    return mapAnalysisStatusDtoToModel(dto)
  }

  async getAnalysis(analysisId: string): Promise<Analysis> {
    const dto = await requestJson<ApiAnalysis>(`/analyses/${encodeURIComponent(analysisId)}`)
    return mapAnalysisDtoToModel(dto)
  }

  async updateField(analysisId: string, fieldId: string, value: unknown): Promise<Analysis> {
    // Il body della PATCH è semplicemente `{ value }` (backend prompt §13): `value`
    // ha la stessa forma nel modello e nel DTO (solo le chiavi che lo contengono
    // cambiano nome), quindi non serve passare da mapper.ts per costruirlo.
    const dto = await requestJson<ApiAnalysis>(
      `/analyses/${encodeURIComponent(analysisId)}/fields/${encodeURIComponent(fieldId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      }
    )
    return mapAnalysisDtoToModel(dto)
  }

  async resetCorrections(analysisId: string): Promise<Analysis> {
    const dto = await requestJson<ApiAnalysis>(`/analyses/${encodeURIComponent(analysisId)}/reset-corrections`, {
      method: "POST",
    })
    return mapAnalysisDtoToModel(dto)
  }

  async reanalyze(analysisId: string): Promise<void> {
    await requestVoid(`/analyses/${encodeURIComponent(analysisId)}/reanalyze`, { method: "POST" })
  }

  async exportExcel(analysisId: string): Promise<Blob> {
    return requestBlob(`/analyses/${encodeURIComponent(analysisId)}/export.xlsx`)
  }

  async exportCsv(analysisId: string, dataset: ExportDataset): Promise<Blob> {
    return requestBlob(`/analyses/${encodeURIComponent(analysisId)}/export.csv?dataset=${encodeURIComponent(dataset)}`)
  }
}
