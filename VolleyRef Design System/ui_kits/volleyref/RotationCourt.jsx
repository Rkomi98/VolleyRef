function RotationCourt({ numbers, confidence, edited, onChange, firstServe, teamLabel }) {
  const { EditableValue } = window.VolleyRefDesignSystem_4fa89f;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const frontRow = [3, 2, 1]; // IV, III, II
  const backRow = [4, 5, 0]; // V, VI, I

  const cell = (idx) => (
    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 46, height: 46, borderRadius: '50%', background: 'var(--color-white)',
        border: `2.5px solid ${idx === 0 && firstServe ? 'var(--color-primary)' : 'var(--border-strong)'}`,
        boxShadow: idx === 0 && firstServe ? '0 0 0 3px rgba(0,170,234,0.3)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <EditableValue value={numbers[idx]} type="number" size="sm" confidence={confidence[idx]} edited={edited[idx]} onChange={(v) => onChange(idx, v)} ariaLabel={`Posizione ${ROMAN[idx]}`} />
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{ROMAN[idx]}{idx === 0 && firstServe ? ' · serve' : ''}</span>
    </div>
  );

  return (
    <div style={{ background: 'var(--color-primary-dark)', borderRadius: 'var(--radius-lg)', padding: '18px 16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.4)', borderRadius: 2 }} title="Rete" />
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>{frontRow.map(cell)}</div>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>{backRow.map(cell)}</div>
    </div>
  );
}
window.RotationCourt = RotationCourt;
