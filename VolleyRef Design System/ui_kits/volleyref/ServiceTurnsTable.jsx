function ServiceTurnsTable({ match, set, onEditTurn, onHighlight }) {
  const { SegmentedControl, EditableValue, StatusBadge, Card } = window.VolleyRefDesignSystem_4fa89f;
  const [filter, setFilter] = React.useState('all');

  const rows = set.serviceTurns.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'review') return t.status === 'review' && !t.edited;
    return t.teamKey === filter;
  });

  const teamShort = (key) => key === match.teamA.key ? match.teamA.short : match.teamB.short;

  const recompute = (turn, field, value) => {
    const parts = value.split('\u2013').map((s) => Number(s.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN)) return;
    const next = { ...turn, [field]: value, edited: true };
    const ownIdx = turn.teamKey === match.teamA.key ? 0 : 1;
    const startParts = next.start.split('\u2013').map(Number);
    const endParts = next.end.split('\u2013').map(Number);
    next.points = endParts[ownIdx] - startParts[ownIdx];
    onEditTurn(turn.id, next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SegmentedControl
        size="sm"
        options={[{ value: 'all', label: 'Tutti' }, { value: match.teamA.key, label: match.teamA.short }, { value: match.teamB.key, label: match.teamB.short }, { value: 'review', label: 'Da verificare' }]}
        value={filter} onChange={setFilter}
      />
      <Card padding={0} style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 680 }}>
          <thead>
            <tr>
              {['#', 'Squadra', 'Battitore', 'Rotazione', 'Inizio', 'Fine', 'Punti', 'Stato'].map((h) => (
                <th key={h} style={{ textAlign: h === 'Squadra' ? 'left' : 'center', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} onClick={() => onHighlight('services')} style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-50)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--border-default)' }}>{t.index}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--border-default)' }}>{teamShort(t.teamKey)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid var(--border-default)' }}>
                  <EditableValue value={t.server} type="number" size="sm" confidence={t.confidence} edited={t.edited} onChange={(v) => onEditTurn(t.id, { ...t, server: v, edited: true })} ariaLabel="Battitore" />
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid var(--border-default)' }}>
                  <EditableValue value={t.rotation} type="text" size="sm" confidence="high" edited={t.edited} onChange={(v) => onEditTurn(t.id, { ...t, rotation: v, edited: true })} ariaLabel="Rotazione" />
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid var(--border-default)' }}>
                  <EditableValue value={t.start} type="text" size="sm" confidence="high" edited={t.edited} onChange={(v) => recompute(t, 'start', v)} ariaLabel="Punteggio iniziale" />
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid var(--border-default)' }}>
                  <EditableValue value={t.end} type="text" size="sm" confidence="high" edited={t.edited} onChange={(v) => recompute(t, 'end', v)} ariaLabel="Punteggio finale" />
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, borderBottom: '1px solid var(--border-default)' }}>{t.points}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid var(--border-default)' }}>
                  <StatusBadge status={t.edited ? 'validated' : t.status} size="sm" />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Nessun turno corrisponde al filtro selezionato.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
window.ServiceTurnsTable = ServiceTurnsTable;
