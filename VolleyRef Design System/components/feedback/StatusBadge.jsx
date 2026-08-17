import React from 'react';

const CheckIcon = (p) => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" {...p}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const AlertIcon = (p) => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" {...p}><path d="M12 9v4M12 17h.01M10.3 3.9L2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const ErrorIcon = (p) => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" {...p}><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5l5 5m0-5l-5 5" strokeLinecap="round"/></svg>);
const DotIcon = (p) => (<svg width="10" height="10" viewBox="0 0 10 10" {...p}><circle cx="5" cy="5" r="5" fill="currentColor"/></svg>);

const MAP = {
  validated: { label: 'Validato', bg: 'var(--color-success-subtle)', fg: 'var(--color-success)', Icon: CheckIcon },
  review: { label: 'Da verificare', bg: 'var(--color-warning-subtle)', fg: 'var(--color-warning-hover)', Icon: AlertIcon },
  inconsistent: { label: 'Incoerente', bg: 'var(--color-danger-subtle)', fg: 'var(--color-danger)', Icon: ErrorIcon },
  processing: { label: 'In elaborazione', bg: 'var(--color-primary-subtle)', fg: 'var(--color-primary-dark)', Icon: DotIcon },
};

export function StatusBadge({ status = 'validated', children, size = 'md' }) {
  const m = MAP[status] || MAP.validated;
  const pad = size === 'sm' ? '3px 9px' : '5px 12px';
  const fontSize = size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: pad, borderRadius: 'var(--radius-full)',
      background: m.bg, color: m.fg, fontSize, fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-body)' }}>
      <m.Icon style={{ flexShrink: 0 }} />
      {children || m.label}
    </span>
  );
}
