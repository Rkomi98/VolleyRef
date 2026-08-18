import { HttpAnalysisService } from "@/lib/api/HttpAnalysisService"

import type { AnalysisService } from "./AnalysisService"
import { MockAnalysisService } from "./MockAnalysisService"

/**
 * Unico punto di switch tra mock e backend reale (frontend prompt §22/§27): una
 * sola variabile d'ambiente, nessun cambio nei componenti React.
 *
 * `NEXT_PUBLIC_USE_MOCK_API` è "vero di default": il mock è usato a meno che non
 * venga esplicitamente disattivato impostando la variabile a `"false"`.
 */
const useMock = process.env.NEXT_PUBLIC_USE_MOCK_API !== "false"

export const analysisService: AnalysisService = useMock ? new MockAnalysisService() : new HttpAnalysisService()

export type { AnalysisService }
