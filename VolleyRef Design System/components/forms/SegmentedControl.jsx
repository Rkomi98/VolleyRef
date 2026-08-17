import React from 'react';

export function SegmentedControl({ options = [], value, onChange, size = 'md' }) {
  const pad = size === 'sm' ? '5px 10px' : '7px 14px';
  const fontSize = size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)';
  return (
    <div role="tablist" style={{ display: 'inline-flex', padding: 3, background: 'var(--neutral-100)',
      borderRadius: 'var(--radius-md)', gap: 2 }}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button key={opt.value} type="button" role="tab" aria-selected={isActive}
            onClick={() => onChange && onChange(opt.value)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: pad, fontSize, fontFamily: 'var(--font-body)',
              fontWeight: 'var(--weight-semibold)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: isActive ? 'var(--color-white)' : 'transparent',
              color: isActive ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
              boxShadow: isActive ? 'var(--shadow-xs)' : 'none', transition: 'all var(--duration-fast) var(--ease-standard)' }}>
            {opt.icon}{opt.label}
          </button>
        );
      })}
    </div>
  );
}
