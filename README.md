# VolleyRef

VolleyRef trasforma un referto PDF ufficiale di pallavolo in dati strutturati e verificabili: sestetti iniziali, rotazioni, turni di servizio. L'utente carica il PDF, verifica cosa il sistema ha letto confrontandolo fianco a fianco con il documento originale, corregge le letture sbagliate ed esporta il risultato in Excel/CSV.

Flusso principale: `Caricamento PDF → Elaborazione → Controllo dati → Correzione → Validazione → Esportazione`

## Architettura

Due progetti indipendenti che comunicano solo via API REST — il frontend non conosce mai OCR, PDF parsing o computer vision, il backend non conosce mai i dettagli di React (vedi [`02_volleyref_backend_prompt.md`](02_volleyref_backend_prompt.md) §41-43 per la regola completa):

```text
Next.js UI  →  AnalysisService interface  →  HttpAnalysisService  →  HTTP/JSON  →  FastAPI  →  Domain services  →  Parser / Validator / Export
```

- **`frontend/`** — Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui. Rendering PDF reale via `react-pdf`, split view ridimensionabile via `react-resizable-panels`.
- **`backend/`** — FastAPI + Pydantic v2 + SQLAlchemy/SQLite. Due percorsi di estrazione (text-layer via PyMuPDF, raster via OpenCV + Tesseract) che convergono in un parser/validator pallavolistico deterministico.
- **`VolleyRef Design System/`** — token visivi e prototipo di riferimento (non prodotto finale — vedi nota sotto).
- **`examples/`** — due referti PDF reali usati come fixture di test (non versionati, vedi `.gitignore`).

## Struttura cartelle

```text
frontend/src/
├── app/                 route Next.js (home, match/[id])
├── components/
│   ├── ui/               primitive di design system (Button, Card, EditableValue, ...)
│   ├── match/             MatchWorkspace, pannelli Riepilogo/Formazioni/Servizi/Controllo
│   └── pdf/               PdfViewer, PdfToolbar, RegionOverlay
├── lib/
│   ├── api/               dto.ts (wire format), HttpAnalysisService, mapper
│   └── types.ts           modello di dominio frontend
└── services/              AnalysisService interface, MockAnalysisService

backend/app/
├── api/            router FastAPI
├── domain/          modelli di dominio condivisi (incl. RawObservation)
├── models/          modelli Pydantic (DTO pubblici)
├── services/        orchestrazione, field update
├── repositories/    accesso dati (SQLite, astratto per Postgres futuro)
├── pdf/             PDF inspector, estrazione text-layer/AcroForm
├── layout/          detection macroregioni/griglie
├── extraction/      text/ (PyMuPDF) e raster/ (OpenCV)
├── ocr/             wrapper Tesseract
├── volleyball/      parser + validator pallavolistico
├── export/          xlsx (openpyxl) / csv (pandas)
└── core/            security, logging, config, error model
```

## Avvio in locale

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Apre su `http://localhost:3000`.

**Backend**

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

Apre su `http://localhost:8000` (OpenAPI su `http://localhost:8000/docs`).

Il frontend si collega al backend tramite `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1` (file `.env.local` in `frontend/`). In sviluppo, senza backend, il frontend può girare interamente con `MockAnalysisService` — lo switch tra mock e backend reale è una sola configurazione, non un cambio di componenti.

**Test**

```bash
cd backend && pytest
cd frontend && npm run build   # type-check + build
```

## Fixture di test reali

`examples/` contiene due referti reali (non versionati):

- un caso **rasterizzato** (nessun text layer utile → percorso OCR/raster);
- un caso con **text layer utilizzabile** (contiene anche un AcroForm).

Sono usati come test di non-regressione per l'estrazione reale (vedi `backend/tests/`) — i valori esatti attesi per il Set 1 di entrambe le partite sono documentati in [`02_volleyref_backend_prompt.md`](02_volleyref_backend_prompt.md) §28.

## Materiale di riferimento

- [`01_volleyref_frontend_prompt.md`](01_volleyref_frontend_prompt.md) / [`02_volleyref_backend_prompt.md`](02_volleyref_backend_prompt.md) — le specifiche di prodotto originali da cui è nato il piano di implementazione.
- `VolleyRef Design System/` — token visivi e un prototipo statico interattivo (`ui_kits/volleyref/`) usato come riferimento UX. **Non è codice di produzione**: nel prototipo il visualizzatore PDF è un mock illustrativo (nessun rendering PDF reale) e l'export Excel è finto — il vero `PdfViewer`/`RegionOverlay` e il vero export xlsx vivono solo in `frontend/` e `backend/`.
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — dove e come deployare, con i limiti reali dei piani gratuiti delle piattaforme candidate.

## Stato del progetto

Contratto dati condiviso (tipi TypeScript ↔ modelli Pydantic) e scaffolding di entrambi i progetti completati. Sviluppo delle singole funzionalità in corso, in parallelo, secondo il piano di implementazione.
