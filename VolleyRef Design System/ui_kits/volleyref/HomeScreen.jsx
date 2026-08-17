function HomeScreen({ onOpenMatch }) {
  const [phase, setPhase] = React.useState('idle');
  const [outcome, setOutcome] = React.useState('success');

  if (phase === 'processing') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
        <AppHeader />
        <ProcessingState
          outcome={outcome}
          onDone={() => onOpenMatch('cerea-rothoblaas')}
          onRetry={() => { setOutcome('success'); setPhase('idle'); setTimeout(() => setPhase('processing'), 30); }}
          onCancel={() => setPhase('idle')}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
      <AppHeader />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '72px 24px 48px', display: 'flex', flexDirection: 'column', gap: 36, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 40, lineHeight: 1.15, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
            Trasforma un referto di pallavolo in dati utilizzabili
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--color-text-secondary)', margin: 0 }}>
            Carica il PDF del referto. VolleyRef ricostruisce sestetti, rotazioni e turni di servizio e prepara i dati per Excel.
          </p>
        </div>
        <UploadDropzone onAnalyze={(file, out) => { setOutcome(out); setPhase('processing'); }} />
        <button
          onClick={() => onOpenMatch('sanmarco-vicenza')}
          style={{ background: 'none', border: 'none', color: 'var(--color-primary-dark)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-body)' }}
        >
          Vedi un esempio con anomalie da correggere
        </button>
      </main>
    </div>
  );
}
window.HomeScreen = HomeScreen;
