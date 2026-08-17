import React, { useState } from 'react';

export function Input({ value, onChange, placeholder, type = 'text', icon = null, error = false, disabled = false, size = 'md', style, ...rest }) {
  const [focused, setFocused] = useState(false);
  const heights = { sm: 32, md: 40, lg: 46 };
  const h = heights[size] || 40;
  const borderColor = error ? 'var(--color-danger)' : focused ? 'var(--color-primary)' : 'var(--border-default)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: h, padding: '0 12px',
      background: disabled ? 'var(--neutral-50)' : 'var(--color-white)', border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)', boxShadow: focused ? 'var(--shadow-focus)' : 'none',
      transition: 'border-color var(--duration-fast), box-shadow var(--duration-fast)', ...style }}>
      {icon && <span style={{ display: 'inline-flex', color: 'var(--color-text-secondary)' }}>{icon}</span>}
      <input
        value={value} placeholder={placeholder} type={type} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-base)',
          fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}
        {...rest}
      />
    </div>
  );
}
