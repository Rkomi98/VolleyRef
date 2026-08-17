function PdfViewer({ match, set, highlightRegion, onRegionClick, onHidePanel }) {
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [showOverlay, setShowOverlay] = React.useState(true);
  const [fullscreen, setFullscreen] = React.useState(false);

  const teamAKey = match.teamA.key, teamBKey = match.teamB.key;
  const regions = [
    { id: 'header', top: '4%', left: '6%', width: '88%', height: '13%', label: 'Intestazione e punteggio' },
    { id: `lineup-${teamAKey}`, top: '21%', left: '6%', width: '41%', height: '25%', label: `Sestetto ${match.teamA.short}` },
    { id: `lineup-${teamBKey}`, top: '21%', left: '53%', width: '41%', height: '25%', label: `Sestetto ${match.teamB.short}` },
    { id: 'services', top: '50%', left: '6%', width: '88%', height: '44%', label: 'Turni di servizio' },
  ];

  const box = { border: '1px solid var(--neutral-300)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' };

  const page = (
    <div style={{ position: 'relative', width: 600, height: 848, background: '#fff', boxShadow: 'var(--shadow-md)', transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: 'top center', transition: 'transform var(--duration-base) var(--ease-standard)', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '4%', left: '6%', width: '88%', height: '13%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#657381' }}>{match.competition} · {match.date}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#17212B' }}>{match.teamA.name} <span style={{ color: '#657381', fontWeight: 600 }}>vs</span> {match.teamB.name}</div>
        <div style={{ fontSize: 12, color: '#657381' }}>{match.venue}</div>
      </div>
      {[[teamAKey, match.teamA.short, '21%', '6%'], [teamBKey, match.teamB.short, '21%', '53%']].map(([key, short, top, left]) => (
        <div key={key} style={{ position: 'absolute', top, left, width: '41%', height: '25%', border: '1px solid #EDEDED', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#285180' }}>{short}{set.firstServe === key ? ' · al servizio' : ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, flex: 1 }}>
            {set.lineups[key].map((n, i) => <div key={i} style={{ ...box, fontSize: 12 }}>{n}</div>)}
          </div>
        </div>
      ))}
      <div style={{ position: 'absolute', top: '50%', left: '6%', width: '88%', height: '44%', border: '1px solid #EDEDED', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#285180', marginBottom: 2 }}>Turni di servizio</div>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ width: 16, height: 10, border: '1px solid #D5DADF', borderRadius: 2 }} />
            <div style={{ flex: 1, height: 10, borderBottom: '1px dotted #D5DADF' }} />
            <div style={{ width: 28, height: 10, border: '1px solid #D5DADF', borderRadius: 2 }} />
          </div>
        ))}
      </div>
      {showOverlay && regions.map((r) => (
        <RegionOverlay key={r.id} {...r} active={true} highlighted={highlightRegion === r.id} onClick={onRegionClick} />
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--neutral-100)', ...(fullscreen ? { position: 'fixed', inset: 0, zIndex: 300 } : {}) }}>
      <PdfToolbar
        zoom={zoom} onZoomIn={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} onZoomOut={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
        onFitWidth={() => setZoom(1)} rotation={rotation} onRotate={() => setRotation((r) => (r + 90) % 360)}
        showOverlay={showOverlay} onToggleOverlay={() => setShowOverlay((v) => !v)}
        fullscreen={fullscreen} onToggleFullscreen={() => setFullscreen((v) => !v)}
        onHidePanel={fullscreen ? null : onHidePanel}
      />
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: 24 }}>
        {page}
      </div>
    </div>
  );
}
window.PdfViewer = PdfViewer;
