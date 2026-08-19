import { MatchWorkspace } from "@/components/match/MatchWorkspace"

/**
 * Route del Match Workspace (frontend prompt §7). Resta un Server Component
 * minimale che si limita a risolvere il parametro dinamico `id` (Next.js 16:
 * `params` è una Promise, vedi `node_modules/next/dist/docs/01-app/...`) e a
 * passarlo al vero orchestratore client-side, che possiede tutto lo stato
 * interattivo (tab, set selezionato, editing, dialog, sincronizzazione con il
 * PDF).
 */
export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MatchWorkspace analysisId={id} />
}
