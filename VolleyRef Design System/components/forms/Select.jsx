import React, { useState } from 'react';

export function Select({ options = [], value, onChange, placeholder = 'Seleziona…', size = 'md', style }) {
  const [focused, setFocused] = useState(false);
  const heights = { sm: 32, md: 40 };
  const h = heights[size] || 40;
  return (
    <div style={{ position: 'relative', height: h, ...style }}>
      <select
        value={value ?? ''} onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', height: '100%', appearance: 'none', WebkitAppearance: 'none',
          padding: '0 34px 0 12px', borderRadius: 'var(--radius-md)',
          border: `1px solid ${focused ? 'var(--color-primary)' : 'var(--border-default)'}`,
          background: 'var(--color-white)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)',
          color: 'var(--color-text-primary)', boxShadow: focused ? 'var(--shadow-focus)' : 'none', cursor: 'pointer' }}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', pointerEvents: 'none' }}>
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
