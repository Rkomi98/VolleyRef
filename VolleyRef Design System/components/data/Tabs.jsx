import React from 'react';

export function Tabs({ tabs = [], value, onChange }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-default)' }}>
      {tabs.map((t) => {
        const isActive = t.value === value;
        return (
          <button key={t.value} type="button" role="tab" aria-selected={isActive} disabled={t.disabled}
            onClick={() => !t.disabled && onChange && onChange(t.value)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 6px', marginBottom: -1,
              background: 'none', border: 'none', borderBottom: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
              color: t.disabled ? 'var(--neutral-300)' : isActive ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)',
              cursor: t.disabled ? 'not-allowed' : 'pointer', transition: 'color var(--duration-fast), border-color var(--duration-fast)' }}>
            {t.icon}{t.label}
          </button>
        );
      })}
    </div>
  );
}
