function useIsMobile(breakpoint) {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < breakpoint);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

function MatchWorkspace({ matchId, onNewReport }) {
  const originalRef = React.useRef(structuredClone(window.VR_MOCK.matches[matchId]));
  const [match, setMatch] = React.useState(() => structuredClone(originalRef.current));
  const lastSnapshotRef = React.useRef(null);
  const [currentSetNumber, setCurrentSetNumber] = React.useState(1);
  const [activeTab, setActiveTab] = React.useState('summary');
  const [viewMode, setViewMode] = React.useState('split');
  const [mobileView, setMobileView] = React.useState('data');
  const [highlightRegion, setHighlightRegion] = React.useState(null);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [leftPct, setLeftPct] = React.useState(46);
  const dragRef = React.useRef(false);
  const isMobile = useIsMobile(880);
  const { useToast, Tabs, ToastProvider } = window.VolleyRefDesignSystem_4fa89f;
  const { push } = useToast();

  const currentSet = match.sets.find((s) => s.number === currentSetNumber) || match.sets[0];

  const editCount = React.useMemo(() => {
    let n = 0;
    match.sets.forEach((s) => {
      Object.values(s.lineupEdited).forEach((arr) => arr.forEach((v) => v && n++));
      s.serviceTurns.forEach((t) => t.edited && n++);
    });
    return n;
  }, [match]);

  const snapshotThen = (mutator) => {
    lastSnapshotRef.current = structuredClone(match);
    setMatch((m) => { const clone = structuredClone(m); mutator(clone); return clone; });
    push('Valore aggiornato', { actionLabel: 'Annulla', onAction: () => setMatch(lastSnapshotRef.current) });
  };

  const handleEditLineup = (teamKey, idx, value) => {
    snapshotThen((clone) => {
      const s = clone.sets.find((s) => s.number === currentSetNumber);
      s.lineups[teamKey][idx] = value;
      s.lineupEdited[teamKey][idx] = true;
    });
  };

  const handleEditTurn = (turnId, nextTurn) => {
    snapshotThen((clone) => {
      const s = clone.sets.find((s) => s.number === currentSetNumber);
      const i = s.serviceTurns.findIndex((t) => t.id === turnId);
      if (i >= 0) s.serviceTurns[i] = nextTurn;
    });
  };

  const handleRegionClick = (regionId) => {
    setHighlightRegion(regionId);
    if (regionId === 'header') setActiveTab('summary');
    else if (regionId.startsWith('lineup-')) setActiveTab('lineups');
    else if (regionId === 'services') setActiveTab('services');
    setTimeout(() => setHighlightRegion((r) => r === regionId ? null : r), 2400);
  };

  const handleHighlightTeam = (teamKey) => {
    setHighlightRegion(`lineup-${teamKey}`);
    if (isMobile) setMobileView('pdf');
    setTimeout(() => setHighlightRegion((r) => r === `lineup-${teamKey}` ? null : r), 2400);
  };

  const handleHighlightServices = () => {
    setHighlightRegion('services');
    setTimeout(() => setHighlightRegion((r) => r === 'services' ? null : r), 2400);
  };

  const handleSelectSet = (n) => { setCurrentSetNumber(n); setActiveTab('lineups'); };

  const startDrag = (e) => {
    dragRef.current = true;
    const onMove = (ev) => {
      if (!dragRef.current) return;
      const pct = Math.min(72, Math.max(26, (ev.clientX / window.innerWidth) * 100));
      setLeftPct(pct);
    };
    const onUp = () => { dragRef.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const tabs = [
    { value: 'summary', label: 'Riepilogo' },
    { value: 'lineups', label: 'Formazioni' },
    { value: 'services', label: 'Servizi' },
    { value: 'validation', label: 'Controllo' },
  ];

  const pdfPanel = (
    <PdfViewer match={match} set={currentSet} highlightRegion={highlightRegion} onRegionClick={handleRegionClick} onHidePanel={!isMobile ? () => setViewMode('data') : null} />
  );

  const dataPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '0 24px' }}>
        <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
      </div>
      {activeTab !== 'summary' && <SetSelector sets={match.sets} value={currentSetNumber} onChange={setCurrentSetNumber} />}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {activeTab === 'summary' && <MatchSummary match={match} onSelectSet={handleSelectSet} />}
        {activeTab === 'lineups' && <StartingSix match={match} set={currentSet} onEditLineup={handleEditLineup} onHighlight={handleHighlightTeam} />}
        {activeTab === 'services' && <ServiceTurnsTable match={match} set={currentSet} onEditTurn={handleEditTurn} onHighlight={handleHighlightServices} />}
        {activeTab === 'validation' && <ValidationPanel set={currentSet} onJump={(tab) => { setActiveTab(tab); handleHighlightServices(); }} />}
      </div>
      {editCount > 0 && (
        <div style={{ padding: '10px 24px', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setResetOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-body)' }}>
            Ripristina dati estratti ({editCount})
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-background)' }}>
      <MatchHeader
        match={match} onExport={() => setExportOpen(true)}
        onReanalyze={() => { setMatch(structuredClone(originalRef.current)); push('Referto rianalizzato'); }}
        onNewReport={onNewReport}
        viewMode={isMobile ? mobileView : viewMode}
        onChangeViewMode={isMobile ? setMobileView : setViewMode}
        viewOptions={isMobile ? [{ value: 'pdf', label: 'Referto' }, { value: 'data', label: 'Dati' }] : undefined}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {isMobile ? (
          mobileView === 'pdf' ? pdfPanel : dataPanel
        ) : viewMode === 'pdf' ? pdfPanel
          : viewMode === 'data' ? dataPanel
          : (
            <React.Fragment>
              <div style={{ width: `${leftPct}%`, minWidth: 280, height: '100%' }}>{pdfPanel}</div>
              <div onMouseDown={startDrag} style={{ width: 6, cursor: 'col-resize', background: 'var(--border-default)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 320, height: '100%' }}>{dataPanel}</div>
            </React.Fragment>
          )}
      </div>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} match={match} />
      <ResetCorrectionsDialog open={resetOpen} onClose={() => setResetOpen(false)} editCount={editCount}
        onConfirm={() => { setMatch(structuredClone(originalRef.current)); setResetOpen(false); push('Dati ripristinati'); }} />
    </div>
  );
}
window.MatchWorkspace = MatchWorkspace;
