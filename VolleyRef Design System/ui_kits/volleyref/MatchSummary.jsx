function MatchSummary({ match, onSelectSet }) {
  const { Card, StatusBadge } = window.VolleyRefDesignSystem_4fa89f;
  const info = [
    ['Squadra A', match.teamA.name], ['Squadra B', match.teamB.name],
    ['Competizione', match.competition], ['Data', match.date],
    ['Luogo', match.venue], ['Risultato finale', `${match.finalScore.a} — ${match.finalScore.b}`],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {info.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 15, color: 'var(--color-text-primary)', fontWeight: 600, marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card padding={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {['Set', match.teamA.short, match.teamB.short, 'Stato'].map((h) => (
                <th key={h} style={{ textAlign: h === 'Set' ? 'left' : 'center', padding: '12px 16px', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--border-default)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {match.sets.map((s) => (
              <tr key={s.number} onClick={() => onSelectSet(s.number)} style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-50)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--border-default)' }}>{s.number}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, borderBottom: '1px solid var(--border-default)' }}>{s.scoreA}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, borderBottom: '1px solid var(--border-default)' }}>{s.scoreB}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--border-default)' }}><StatusBadge status={s.status} size="sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
window.MatchSummary = MatchSummary;
