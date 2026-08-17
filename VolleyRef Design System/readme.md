# VolleyRef Design System

VolleyRef is a from-scratch product concept: a web app that turns a paper/PDF volleyball match report ("referto") into structured, checkable data — starting six, rotations, service turns — ready for export to Excel. This project is both the brand's design system (tokens, components) and a fully clickable frontend prototype of the product, built with mock data (no backend, no real PDF parsing yet).

**Sources provided:** a brief (product spec, in `Additional notes` of the design request) and one uploaded reference file, `uploads/logo-fipav.png` (the official FIPAV — Federazione Italiana Pallavolo — logo, provided only as color/context reference). No Figma file or codebase was attached; everything here was built from scratch to the brief's exact spec.

**Important — no official logo used.** The brief explicitly asks not to use the official FIPAV logo, and this system never reproduces it. VolleyRef's mark is an original, simple stylised volleyball / "VR" monogram (`assets/mark.svg`), and the palette below only borrows FIPAV's general blue identity as a stylistic cue, not its brand assets.

## Index

- `styles.css` — the single global stylesheet; imports everything below.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `fonts.css` (Google Fonts import).
- `base.css` — resets and the one shared keyframe (`vr-pulse`, used by ProgressStep).
- `assets/` — `mark.svg` (colour, light-background lockups), `mark-light.svg` (white, for dark backgrounds).
- `guidelines/` — 15 foundation specimen cards (Colors, Type, Spacing, Effects, Brand groups) shown in the Design System tab.
- `components/` — reusable UI primitives, grouped by concern:
  - `actions/` — Button, IconButton
  - `forms/` — Input, Select, SegmentedControl
  - `overlay/` — Tooltip, Dialog
  - `feedback/` — Badge, StatusBadge, ConfidenceIndicator, Toast (+ToastProvider/useToast), ProgressStep
  - `data/` — EditableValue, Card, Tabs
- `ui_kits/volleyref/` — the full clickable VolleyRef prototype (`index.html`), composed from the primitives above plus VolleyRef-specific screens: AppHeader, UploadDropzone, ProcessingState, HomeScreen, MatchHeader, SetSelector, PdfToolbar, RegionOverlay, PdfViewer, MatchSummary, StartingSix, RotationCourt, ServiceTurnsTable, ValidationPanel, ExportDialog, ResetCorrectionsDialog, MatchWorkspace, and `mock-data.js` (two realistic mock matches).
- `thumbnail.html` — the project's homepage tile.

### Intentional additions
No component source (Figma/codebase) was given, so the primitive set was authored from scratch, sized to exactly what the VolleyRef brief needs — nothing more. `Card` and `Tabs` were added as generic layout/navigation primitives because the workspace's four-tab layout and every panel needed them and no equivalent existed.

## Content fundamentals

- **Language:** Italian throughout — the product is aimed at Italian coaches, scoutmen and club volunteers. Copy is direct and procedural, never marketing-flowery: *"Trascina qui il referto PDF"*, *"Analizza referto"*, *"Modificato manualmente"*.
- **Voice:** second person singular, informal but professional ("Carica il PDF del referto", never "Lei"). No exclamation marks, no hype adjectives.
- **Core question the UI always answers:** *"Il sistema ha interpretato correttamente il mio referto?"* Every label prioritises verifiability over decoration — status words (Validato / Da verificare / Incoerente) instead of confidence percentages scattered everywhere.
- **Terminology is sport-specific and exact:** sestetto, rotazione, turno di servizio, battitore, sideout — the vocabulary of the sport, not generic "record/field/row" data language.
- **No emoji.** No em-dash-driven copy. Numbers are set in monospace (JetBrains Mono) wherever they represent extracted data (scores, shirt numbers) so they read as "data", distinct from UI prose (Manrope).
- **Buttons are verbs:** "Analizza referto", "Esporta", "Ripristina dati estratti", "Rianalizza" — never "OK/Submit".

## Visual foundations

- **Palette:** one brand blue (`--color-primary` #00AAEA) for CTAs and active states, one navy (`--color-primary-dark` #285180) for headers/navigation/important text. Green/amber/red are reserved *exclusively* for the three analysis states (Validato/Da verificare/Incoerente) — never used decoratively. Amber (`--color-warning` #E2A100) was added to the brief's palette because "Da verificare" needs a third semantic colour the brief didn't specify a hex for.
- **Neutrals:** an 11-step cool-charcoal scale (`--neutral-50`…`--neutral-900`) under the brief's three literal neutrals (Surface #EDEDED, Background #F7F9FB, Text #17212B/#657381), used for borders, dividers and muted text.
- **Type:** Outfit (display — headlines, scores, section titles) + Manrope (body/UI copy) + JetBrains Mono (numbers/data). Google Fonts substitutes since no brand type files were provided — see Caveats.
- **Spacing:** 4px-based scale (4→64px). Panels and cards favour generous padding (20–24px) over dense administrative-tool spacing.
- **Corners:** soft throughout, never sharp — 6/10/16/20px radii, full-pill for badges and segmented controls (`--radius-sm/md/lg/xl/full`).
- **Elevation:** four low-contrast shadow steps (`--shadow-xs/sm/md/lg`), tinted with the text-primary colour at low opacity rather than pure black — soft, not heavy drop shadows. No glassmorphism, no blur.
- **Backgrounds:** flat colour only. No gradients, no photography, no textures or patterns. The one full-bleed colour surface is the primary-dark band behind the brand mark on the project thumbnail.
- **Motion:** short and purposeful — 120/180/280ms with a single standard ease (`--ease-standard`). No bounce, no decorative animation. The only continuous animation is the small pulsing dot on an in-progress ProgressStep.
- **Hover/press states:** hover = one step darker (buttons) or a light neutral/tint fill (ghost buttons, rows); press = a further darkening (`-active` tokens), no scale/shrink effects.
- **Transparency/blur:** none — the brief explicitly asks to avoid glassmorphism; every surface is opaque.
- **Cards:** white surface, 1px neutral border, soft `shadow-xs` at rest (elevating to `shadow-md` only where a card is genuinely interactive), 16px radius. No coloured left-border accent strip.
- **Data-trust colour:** the single most important visual convention in the product — every status pill anywhere in the UI uses exactly the same three colours (green/amber/red) so a user can scan for problems without reading text.

## Iconography

No icon codebase was provided. Icons are hand-drawn as minimal inline SVGs in `ui_kits/volleyref/Icons.jsx`, matching Lucide's visual grammar (2px stroke, round caps/joins, 24×24 grid) since the brief explicitly asked for a Lucide-style icon language — this keeps the prototype dependency-free while staying visually identical to linking Lucide from a CDN in production. No emoji, no icon font, no PNG icons anywhere in the product.

## Templates
None requested yet.

## Caveats & how to help me improve this

- **Fonts are Google Fonts substitutes** (Outfit / Manrope / JetBrains Mono), picked to fit "sportivo, tecnico, contemporaneo" since no brand type files were supplied. If VolleyRef has (or wants) different fonts, tell me and I'll swap the token file.
- **The uploaded `logo-fipav.png` was intentionally not used** anywhere in the system, per the brief and per policy — VolleyRef's mark is 100% original. If you'd like a different original mark direction (pure monogram vs. ball icon vs. something else), I can iterate.
- **PDF viewer is a stylised mock**, not a real PDF renderer — there's no real referto scan to render, so the "page" is an original schematic layout (header/lineups/service-log blocks) with simulated click regions. Once real referto scans and real OCR coordinates exist, `PdfViewer.jsx`/`RegionOverlay.jsx` are the two files to wire up to true page images and coordinates.
- **Mock data is generated**, not transcribed by hand, in `ui_kits/volleyref/mock-data.js` — service-turn sequences are produced by a small deterministic rotation/score simulator (documented in-file) so they're internally consistent, not just placeholder numbers.
- Tell me if you want more mock matches, additional warning/error scenarios, a real .xlsx export (would need a small library), or visual iteration on any screen — happy to keep refining.
