const PROCESS_STEPS = [
  { id: 'read', label: 'Lettura documento' },
  { id: 'sets', label: 'Riconoscimento dei set' },
  { id: 'lineups', label: 'Estrazione delle formazioni' },
  { id: 'services', label: 'Ricostruzione dei servizi' },
  { id: 'checks', label: 'Controllo di coerenza' },
];

function ProcessingState({ outcome, onDone, onRetry, onCancel }) {
  const { Button, ProgressStep } = window.VolleyRefDesignSystem_4fa89f;
  const [statuses, setStatuses] = React.useState(PROCESS_STEPS.map(() => 'pending'));
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setStatuses(PROCESS_STEPS.map(() => 'pending'));
    setFailed(false);
    async function run() {
      for (let i = 0; i < PROCESS_STEPS.length; i++) {
        if (cancelled) return;
        setStatuses((s) => s.map((v, idx) => idx === i ? 'processing' : v));
        await new Promise((r) => setTimeout(r, 650 + i * 90));
        if (cancelled) return;
        const isLastStep = i === PROCESS_STEPS.length - 1;
        if (outcome === 'error' && isLastStep) {
          setStatuses((s) => s.map((v, idx) => idx === i ? 'error' : v));
          setFailed(true);
          return;
        }
        setStatuses((s) => s.map((v, idx) => idx === i ? 'completed' : v));
      }
      await new Promise((r) => setTimeout(r, 400));
      if (!cancelled) onDone();
    }
    run();
    return () => { cancelled = true; };
  }, [outcome]);

  return (
    <div style={{ maxWidth: 480, margin: '64px auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, color: 'var(--color-text-primary)' }}>Analisi del referto in corso</div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 6 }}>Non chiudere questa pagina.</div>
      </div>
      <div style={{ background: 'var(--color-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '24px 28px' }}>
        {PROCESS_STEPS.map((s, i) => (
          <ProgressStep key={s.id} label={s.label} status={statuses[i]} isLast={i === PROCESS_STEPS.length - 1} />
        ))}
      </div>
      {failed && (
        <div style={{ background: 'var(--color-danger-subtle)', border: '1px solid rgba(220,28,52,0.25)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-danger)' }}>Impossibile completare il controllo di coerenza</div>
          <div style={{ fontSize: 13.5, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>Il documento presenta pagine illeggibili o un formato non riconosciuto. Riprova con una scansione più nitida oppure torna alla home.</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={onCancel}>Torna alla home</Button>
            <Button onClick={onRetry}>Riprova</Button>
          </div>
        </div>
      )}
    </div>
  );
}
window.ProcessingState = ProcessingState;
