function AppHeader() {
  const { Dialog } = window.VolleyRefDesignSystem_4fa89f;
  const [dialog, setDialog] = React.useState(null);
  const navLinkStyle = { background: 'none', border: 'none', padding: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' };
  return (
    <React.Fragment>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderBottom: '1px solid var(--border-default)', background: 'var(--color-white)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="../../assets/mark.svg" width="30" height="30" alt="" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: 'var(--color-text-primary)' }}>Volley<span style={{ color: 'var(--color-primary)' }}>Ref</span></span>
        </div>
        <nav style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <button onClick={() => setDialog('how')} style={navLinkStyle}>Come funziona</button>
          <button onClick={() => setDialog('privacy')} style={navLinkStyle}>Privacy</button>
        </nav>
      </header>
      <Dialog open={dialog === 'how'} onClose={() => setDialog(null)} title="Come funziona VolleyRef" size="md">
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
          <li>Carichi il PDF del referto cartaceo o digitale.</li>
          <li>VolleyRef legge il documento e ricostruisce set, sestetti e turni di servizio.</li>
          <li>Controlli i dati estratti affiancati alla pagina originale del referto.</li>
          <li>Correggi eventuali letture incerte con un click.</li>
          <li>Esporti i dati validati in Excel o CSV.</li>
        </ol>
      </Dialog>
      <Dialog open={dialog === 'privacy'} onClose={() => setDialog(null)} title="Privacy" size="md">
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Versione dimostrativa. I referti caricati in questo prototipo non vengono inviati a nessun server: l'elaborazione è simulata interamente nel browser.
        </p>
      </Dialog>
    </React.Fragment>
  );
}
window.AppHeader = AppHeader;
