import { PdfViewerDemo } from "@/components/pdf/__dev__/PdfViewerDemo"

export default async function PdfDevPage({
  searchParams,
}: {
  searchParams: Promise<{ i?: string; path?: string }>
}) {
  const { i = "0", path } = await searchParams
  const query = path ? `path=${encodeURIComponent(path)}` : `i=${encodeURIComponent(i)}`
  return <PdfViewerDemo initialPdfUrl={`/pdf-dev/pdf?${query}`} />
}
