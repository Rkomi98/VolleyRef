function MatchHeader({ match, onExport, onReanalyze, onNewReport, viewMode, onChangeViewMode, viewOptions }) {
  const { Button, IconButton, StatusBadge, SegmentedControl } = window.VolleyRefDesignSystem_4fa89f;
  const Icon = window.VRIcons;
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 24px', borderBottom: '1px solid var(--border-default)', background: 'var(--color-white)' }}>
      <button onClick={onNewReport} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, color: 'var(--color-text-secondary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', fontFamily: 'var(--font-body)' }}>
        <Icon.ArrowLeft size={13} /> Nuovo referto
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', flex: 1, minWidth: 260 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--color-text-primary)' }}>{match.teamA.name}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--color-primary-dark)' }}>{match.finalScore.a} — {match.finalScore.b}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--color-text-primary)' }}>{match.teamB.name}</span>
          <StatusBadge status={match.status} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onChangeViewMode && <SegmentedControl size="sm" options={viewOptions || [{ value: 'pdf', label: 'Solo referto' }, { value: 'split', label: 'Split' }, { value: 'data', label: 'Solo dati' }]} value={viewMode} onChange={onChangeViewMode} />}
          <Button icon={<Icon.Download size={15} />} onClick={onExport}>Esporta</Button>
          <div style={{ position: 'relative' }}>
            <IconButton icon={<Icon.MoreVertical size={17} />} label="Altre azioni" onClick={() => setMenuOpen((v) => !v)} />
            {menuOpen && (
              <React.Fragment>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--color-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: 180, zIndex: 41, padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => { setMenuOpen(false); onReanalyze(); }} style={menuItemStyle}><Icon.RefreshCw size={15} /> Rianalizza</button>
                  <button onClick={() => { setMenuOpen(false); onNewReport(); }} style={menuItemStyle}><Icon.Upload size={15} /> Nuovo referto</button>
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
const menuItemStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'none', border: 'none', borderRadius: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' };
window.MatchHeader = MatchHeader;
