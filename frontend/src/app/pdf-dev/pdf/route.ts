import fs from "node:fs/promises"
import path from "node:path"

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const override = params.get("path")
  if (override) {
    const data = await fs.readFile(override)
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" },
    })
  }
  const index = Number(params.get("i") ?? "0")
  const dir = path.join(process.cwd(), "..", "examples")
  const files = (await fs.readdir(dir)).filter((name) => name.toLowerCase().endsWith(".pdf")).sort()
  const data = await fs.readFile(path.join(dir, files[index] ?? files[0]))
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" },
  })
}
