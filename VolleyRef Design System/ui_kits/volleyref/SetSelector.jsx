function SetSelector({ sets, value, onChange }) {
  const total = 5;
  return (
    <div role="tablist" aria-label="Seleziona set" style={{ display: 'flex', gap: 8, padding: '14px 24px 0' }}>
      {Array.from({ length: total }).map((_, i) => {
        const num = i + 1;
        const set = sets.find((s) => s.number === num);
        const isActive = value === num;
        const dotColor = !set ? 'transparent' : set.status === 'validated' ? 'var(--color-success)' : set.status === 'review' ? 'var(--color-warning)' : 'var(--color-danger)';
        return (
          <button
            key={num}
            role="tab" aria-selected={isActive} disabled={!set}
            onClick={() => set && onChange(num)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px',
              borderRadius: 'var(--radius-full)', border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--border-default)'}`,
              background: isActive ? 'var(--color-primary-subtle)' : 'var(--color-white)',
              color: !set ? 'var(--neutral-300)' : isActive ? 'var(--color-primary-dark)' : 'var(--color-text-primary)',
              fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)', cursor: set ? 'pointer' : 'not-allowed',
            }}
          >
            {set && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />}
            Set {num}
          </button>
        );
      })}
    </div>
  );
}
window.SetSelector = SetSelector;
