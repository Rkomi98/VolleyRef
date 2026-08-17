function TeamLineupTable({ teamKey, numbers, confidence, edited, onChange, firstServe }) {
  const { EditableValue } = window.VolleyRefDesignSystem_4fa89f;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
      {numbers.map((n, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px', background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>{ROMAN[i]}{i === 0 && firstServe ? ' ●' : ''}</span>
          <EditableValue value={n} type="number" confidence={confidence[i]} edited={edited[i]} onChange={(v) => onChange(i, v)} ariaLabel={`Posizione ${ROMAN[i]}`} />
        </div>
      ))}
    </div>
  );
}

function StartingSix({ match, set, onEditLineup, onHighlight }) {
  const { SegmentedControl, IconButton, Tooltip } = window.VolleyRefDesignSystem_4fa89f;
  const Icon = window.VRIcons;
  const [view, setView] = React.useState('table');
  const teams = [
    { key: match.teamA.key, name: match.teamA.name },
    { key: match.teamB.key, name: match.teamB.name },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <SegmentedControl options={[{ value: 'table', label: 'Tabella', icon: <Icon.Table size={14} /> }, { value: 'court', label: 'Campo', icon: <Icon.Grid size={14} /> }]} value={view} onChange={setView} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {teams.map((team) => {
          const isFirstServe = set.firstServe === team.key;
          const numbers = set.lineups[team.key];
          const confidence = set.lineupConfidence[team.key];
          const edited = set.lineupEdited[team.key];
          return (
            <div key={team.key} style={{ background: 'var(--color-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--color-text-primary)' }}>{team.name}</span>
                  {isFirstServe && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary-dark)', background: 'var(--color-primary-subtle)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>Prima al servizio</span>}
                </div>
                <Tooltip content="Evidenzia sul referto">
                  <IconButton icon={<Icon.Search size={15} />} label="Evidenzia sul referto" size="sm" onClick={() => onHighlight(team.key)} />
                </Tooltip>
              </div>
              {view === 'table'
                ? <TeamLineupTable teamKey={team.key} numbers={numbers} confidence={confidence} edited={edited} firstServe={isFirstServe} onChange={(i, v) => onEditLineup(team.key, i, v)} />
                : <RotationCourt numbers={numbers} confidence={confidence} edited={edited} firstServe={isFirstServe} onChange={(i, v) => onEditLineup(team.key, i, v)} teamLabel={team.name} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
window.StartingSix = StartingSix;
