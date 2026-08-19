"use client"

/**
 * pdf.js only draws text for fonts that are either embedded in the PDF or
 * available as "standard font data". Several referti (e.g. the FIPAV scoresheets
 * generated with Roboto/BenchNine/Helvetica) embed nothing, so without this the
 * page renders blank.
 *
 * The font files ship inside `pdfjs-dist`; the bundler is asked for their URLs
 * so they are emitted as static assets instead of expecting the app to copy them
 * into `public/`. Filenames are then resolved through that map, because bundlers
 * fingerprint asset names and pdf.js' default `standardFontDataUrl` (a directory
 * prefix) cannot survive that.
 */
const fontUrls: Record<string, string> = {
  "FoxitDingbats.pfb": new URL("pdfjs-dist/standard_fonts/FoxitDingbats.pfb", import.meta.url).toString(),
  "FoxitFixed.pfb": new URL("pdfjs-dist/standard_fonts/FoxitFixed.pfb", import.meta.url).toString(),
  "FoxitFixedBold.pfb": new URL("pdfjs-dist/standard_fonts/FoxitFixedBold.pfb", import.meta.url).toString(),
  "FoxitFixedBoldItalic.pfb": new URL("pdfjs-dist/standard_fonts/FoxitFixedBoldItalic.pfb", import.meta.url).toString(),
  "FoxitFixedItalic.pfb": new URL("pdfjs-dist/standard_fonts/FoxitFixedItalic.pfb", import.meta.url).toString(),
  "FoxitSerif.pfb": new URL("pdfjs-dist/standard_fonts/FoxitSerif.pfb", import.meta.url).toString(),
  "FoxitSerifBold.pfb": new URL("pdfjs-dist/standard_fonts/FoxitSerifBold.pfb", import.meta.url).toString(),
  "FoxitSerifBoldItalic.pfb": new URL("pdfjs-dist/standard_fonts/FoxitSerifBoldItalic.pfb", import.meta.url).toString(),
  "FoxitSerifItalic.pfb": new URL("pdfjs-dist/standard_fonts/FoxitSerifItalic.pfb", import.meta.url).toString(),
  "FoxitSymbol.pfb": new URL("pdfjs-dist/standard_fonts/FoxitSymbol.pfb", import.meta.url).toString(),
  "LiberationSans-Bold.ttf": new URL("pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf", import.meta.url).toString(),
  "LiberationSans-BoldItalic.ttf": new URL("pdfjs-dist/standard_fonts/LiberationSans-BoldItalic.ttf", import.meta.url).toString(),
  "LiberationSans-Italic.ttf": new URL("pdfjs-dist/standard_fonts/LiberationSans-Italic.ttf", import.meta.url).toString(),
  "LiberationSans-Regular.ttf": new URL("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf", import.meta.url).toString(),
}

export class BundledStandardFontDataFactory {
  async fetch({ filename }: { filename?: string }): Promise<Uint8Array> {
    const url = filename ? fontUrls[filename] : undefined
    if (!url) throw new Error(`Font standard non disponibile: ${filename ?? "(nessun nome)"}`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Impossibile leggere il font standard ${filename}`)
    return new Uint8Array(await response.arrayBuffer())
  }
}
