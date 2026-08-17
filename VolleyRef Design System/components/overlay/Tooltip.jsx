import React, { useState } from 'react';

export function Tooltip({ content, children, side = 'top' }) {
  const [open, setOpen] = useState(false);
  if (!content) return children;
  const pos = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-6px)' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%) translateY(6px)' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%) translateX(-6px)' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%) translateX(6px)' },
  }[side];
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {children}
      {open && (
        <span role="tooltip" style={{ position: 'absolute', ...pos, background: 'var(--color-text-primary)', color: 'var(--color-white)',
          padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)',
          whiteSpace: 'nowrap', zIndex: 50, boxShadow: 'var(--shadow-md)', pointerEvents: 'none' }}>
          {content}
        </span>
      )}
    </span>
  );
}
