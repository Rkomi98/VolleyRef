import React, { useState } from 'react';

export function Card({ children, padding = 20, interactive = false, style, ...rest }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => interactive && setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
        padding, boxShadow: hover ? 'var(--shadow-md)' : 'var(--shadow-xs)', transition: 'box-shadow var(--duration-base) var(--ease-standard)', ...style }}
      {...rest}>
      {children}
    </div>
  );
}
