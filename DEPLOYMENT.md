# VolleyRef — Deployment e limiti dei piani gratuiti

> Documento pensato per essere condiviso con chi deciderà dove e come ospitare VolleyRef. I numeri sotto sono stati verificati sulla documentazione ufficiale delle piattaforme il **18 agosto 2026** (link in fondo) — i piani gratuiti cambiano spesso, quindi prima di decidere vale la pena controllare che non siano cambiati nel frattempo.

## In breve

- Il **frontend** (Next.js) può girare gratis su Vercel senza problemi tecnici — con un solo vincolo non tecnico da tenere a mente: il piano gratuito è per uso **personale/non commerciale**.
- Il **backend** (FastAPI + OpenCV + Tesseract + PyMuPDF) **non può girare su una piattaforma serverless gratuita**: ha dipendenze di sistema pesanti e deve conservare file (PDF caricati, database SQLite) su disco. Nessuna delle piattaforme gratuite più comuni offre oggi (agosto 2026) un runtime Python persistente con storage che non venga azzerato.
- Esistono due percorsi realistici, uno gratuito ma fragile, uno a costo minimo ma solido. Vedi tabella di raccomandazione finale.

## Frontend: Vercel (piano Hobby, gratuito)

Next.js su Vercel è la combinazione più naturale — non serve altro.

| Limite | Valore su Hobby |
|---|---|
| Durata massima funzione | 300s (default **e** massimo) |
| Memoria funzione | 2 GB / 1 vCPU |
| Active CPU incluso | 4 CPU-ore/mese |
| Memoria provisionata inclusa | 360 GB-ore/mese |
| Invocazioni funzioni incluse | 1.000.000/mese |
| Trasferimento dati (Fast Data Transfer) | 100 GB/mese |
| Tempo di build per deployment | max 45 minuti |
| Deployment al giorno | 100 |
| Log runtime conservati | solo 1 ora |

**Vincolo non tecnico da comunicare a chi deciderà l'hosting**: la documentazione Vercel dichiara esplicitamente che *"the Hobby plan restricts users to non-commercial, personal use only"*. Se VolleyRef verrà usato da allenatori/società in modo continuativo (anche senza pagamento), è una situazione da valutare con attenzione — non è chiaramente "personale" nel senso previsto dal piano gratuito. L'alternativa è il piano Pro (a pagamento, da $20/utente/mese).

Questi limiti sono ampiamente sufficienti per il solo frontend di VolleyRef (nessun calcolo pesante lato Vercel, l'elaborazione reale è sul backend).

## Backend: perché "gratis e serverless" non funziona

Il backend richiede:
- librerie di sistema pesanti (OpenCV, Tesseract, PyMuPDF) — spesso oltre i limiti di dimensione bundle delle funzioni serverless (su Vercel: 250 MB non compresso, 500 MB per funzioni Python);
- un **filesystem persistente** per il database SQLite e i PDF caricati (backend prompt §1, §34) — le funzioni serverless non lo garantiscono tra un'invocazione e l'altra;
- tempi di elaborazione potenzialmente superiori ai timeout delle funzioni serverless gratuite.

Serve quindi un runtime **container/VM persistente**, non una funzione stateless. Ecco le opzioni realistiche.

### Opzione A — Render free (gratis, ma fragile)

| Limite | Valore |
|---|---|
| Ore incluse | 750 ore/mese per workspace (le istanze spente non consumano ore) |
| Spin-down per inattività | dopo **15 minuti** senza richieste |
| Tempo di risveglio (cold start) | circa **1 minuto** |
| RAM / CPU | 512 MB / 0.1 CPU |
| Storage | **solo filesystem effimero — nessun disco persistente sul piano free** |
| Banda incluso | 100 GB/mese (oltre: $0.15/GB) |
| Build incluso | 500 minuti/mese (oltre: $5/1000 min) |
| Postgres free (se usato) | 1 GB, **scade dopo 30 giorni**, nessun backup |

⚠️ **Il punto critico**: sul piano free di Render, "i dati locali vengono persi ogni volta che il servizio viene rideployato, riavviato o va in spin-down" (documentazione ufficiale). Significa che **il database SQLite e i PDF caricati/analizzati vengono azzerati** a ogni riavvio — che succede sia ad ogni redeploy, sia semplicemente dopo 15 minuti di inattività seguiti da una nuova richiesta. Questa opzione è accettabile **solo per una demo** in cui nessuno si aspetta che i dati caricati sopravvivano — non per un uso reale dove un allenatore si aspetta di ritrovare le proprie correzioni.

### Opzione B — Runtime persistente a basso costo (~5€/mese)

Se serve che i dati sopravvivano davvero, la spesa minima realistica oggi è:

- **Railway** — piano Hobby $5/mese, include un volume persistente reale (il piano Free/trial non è sufficiente: il trial dà $5 di credito per 30 giorni, poi il piano Free gratuito ha solo $1/mese di credito, insufficiente per un servizio sempre attivo con volume).
- **Fly.io** — non ha più un piano gratuito permanente dal 2024 (solo un trial di $5 di credito o 2 ore VM per i nuovi account); un'app minima sempre attiva con un volume costa realisticamente $2-5/mese a consumo.

### Opzione C — Backend gratis "stateless" + persistenza gestita altrove (raccomandato se si vuole restare a costo zero)

Il backend prompt (§1, §36) chiede già di mantenere storage e repository astratti "per poter passare in futuro a PostgreSQL/object storage" — questa è esattamente l'occasione per farlo da subito, non in futuro:

- **Database**: [Neon](https://neon.com) (Postgres serverless) piano free — 0.5 GB storage/progetto, 100 CU-ore/mese, scale-to-zero dopo 5 minuti di inattività, 5 GB di trasferimento pubblico incluso. Sostituisce SQLite senza bisogno di disco persistente sul compute.
- **File (PDF caricati + artefatti di debug)**: [Cloudflare R2](https://developers.cloudflare.com/r2/) piano free — 10 GB storage/mese, 1 milione di operazioni Class A e 10 milioni Class B al mese, **banda in uscita gratuita**. Sostituisce il filesystem locale.
- **Compute**: resta su Render free (Opzione A) — ma dato che lo stato vero vive su Neon/R2, il fatto che il filesystem locale del container venga azzerato ad ogni riavvio non è più un problema.

Questa combinazione può restare interamente gratuita, **ma non è priva di rischi da verificare empiricamente**: 512 MB RAM / 0.1 CPU (le specifiche del piano free di Render) potrebbero non bastare per OpenCV + Tesseract su pagine scansionate ad alta risoluzione — è qualcosa da misurare una volta che il backend reale è in piedi, non da assumere a priori. Se il rendering/OCR è troppo lento o va in out-of-memory, la soluzione più semplice resta passare a un compute a pagamento (Opzione B) mantenendo Neon/R2 per la persistenza.

## Raccomandazione finale

| Percorso | Costo | Persistenza reale | Quando usarlo |
|---|---|---|---|
| Frontend Vercel Hobby + Backend Render free (Opzione A) | €0 | ❌ dati azzerati a ogni riavvio/redeploy | Solo demo "usa e getta" per far vedere il flusso a qualcuno |
| Frontend Vercel Hobby + Backend Render free + Neon + R2 (Opzione C) | €0 | ✅ (compute ancora limitato: 512MB/0.1 CPU) | Uso reale a basso traffico, budget zero, accettando di dover verificare le performance OCR |
| Frontend Vercel Hobby + Backend Railway Hobby o Fly.io (Opzione B) | ~€5-10/mese | ✅ piena, compute più solido | Uso reale con più margine di risorse, quando si è disposti a una spesa minima |

Nota trasversale: se VolleyRef verrà usato in modo continuativo da società/allenatori (non solo per una demo personale), il piano Vercel Hobby per il frontend pone comunque il vincolo di uso "non commerciale" descritto sopra — da tenere in conto insieme alla scelta del backend.

## Fonti (consultate il 18 agosto 2026)

- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Vercel — Limits](https://vercel.com/docs/limits)
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby)
- [Render FAQ](https://render.com/docs/faq)
- [Render — Free instance types](https://render.com/docs/free)
- [Railway Pricing](https://railway.com/pricing)
- [Neon — Plans](https://neon.com/docs/introduction/plans)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
