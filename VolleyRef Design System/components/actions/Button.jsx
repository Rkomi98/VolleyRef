import React, { useState } from 'react';

export function Button({
  children, variant = 'primary', size = 'md', icon = null, iconPosition = 'left',
  disabled = false, loading = false, type = 'button', onClick, style, ...rest
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);

  const sizes = {
    sm: { padding: '6px 12px', fontSize: 'var(--text-sm)', gap: 6, height: 32 },
    md: { padding: '9px 16px', fontSize: 'var(--text-base)', gap: 8, height: 40 },
    lg: { padding: '12px 20px', fontSize: 'var(--text-md)', gap: 8, height: 48 },
  };

  const palette = {
    primary: { bg: 'var(--color-primary)', bgHover: 'var(--color-primary-hover)', bgActive: 'var(--color-primary-active)', fg: 'var(--text-on-primary)', border: 'transparent' },
    secondary: { bg: 'var(--color-white)', bgHover: 'var(--neutral-50)', bgActive: 'var(--neutral-100)', fg: 'var(--color-primary-dark)', border: 'var(--border-default)' },
    ghost: { bg: 'transparent', bgHover: 'var(--neutral-100)', bgActive: 'var(--neutral-150)', fg: 'var(--color-text-primary)', border: 'transparent' },
    danger: { bg: 'var(--color-danger)', bgHover: 'var(--color-danger-hover)', bgActive: 'var(--color-danger-hover)', fg: 'var(--color-white)', border: 'transparent' },
  };

  const p = palette[variant] || palette.primary;
  const s = sizes[size] || sizes.md;
  const bg = disabled ? 'var(--neutral-150)' : active ? p.bgActive : hover ? p.bgHover : p.bg;
  const fg = disabled ? 'var(--neutral-400)' : p.fg;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: s.gap,
        padding: s.padding, height: s.height, fontSize: s.fontSize, fontFamily: 'var(--font-body)',
        fontWeight: 'var(--weight-semibold)', color: fg, background: bg,
        border: `1px solid ${p.border === 'transparent' ? 'transparent' : (disabled ? 'var(--border-default)' : p.border)}`,
        borderRadius: 'var(--radius-md)', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast)',
        boxShadow: variant === 'primary' && !disabled ? 'var(--shadow-xs)' : 'none',
        whiteSpace: 'nowrap', ...style,
      }}
      {...rest}
    >
      {icon && iconPosition === 'left' && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {loading ? 'Attendere…' : children}
      {icon && iconPosition === 'right' && <span style={{ display: 'inline-flex' }}>{icon}</span>}
    </button>
  );
}
