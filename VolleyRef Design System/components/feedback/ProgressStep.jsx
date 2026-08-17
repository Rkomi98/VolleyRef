import React from 'react';

export function ProgressStep({ label, status = 'pending', description, isLast = false }) {
  const colors = {
    pending: { dot: 'var(--neutral-200)', text: 'var(--color-text-secondary)', line: 'var(--neutral-200)' },
    processing: { dot: 'var(--color-primary)', text: 'var(--color-text-primary)', line: 'var(--neutral-200)' },
    completed: { dot: 'var(--color-success)', text: 'var(--color-text-primary)', line: 'var(--color-success)' },
    error: { dot: 'var(--color-danger)', text: 'var(--color-danger)', line: 'var(--neutral-200)' },
  };
  const c = colors[status] || colors.pending;
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ width: 22, height: 22, borderRadius: '50%', background: status === 'pending' ? 'var(--color-white)' : c.dot,
          border: `2px solid ${c.dot}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {status === 'completed' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.4"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          {status === 'processing' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-white)', animation: 'vr-pulse 1.1s ease-in-out infinite' }} />}
          {status === 'error' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round"/></svg>}
        </span>
        {!isLast && <span style={{ width: 2, flex: 1, minHeight: 22, background: c.line, marginTop: 2 }} />}
      </div>
      <div style={{ paddingBottom: isLast ? 0 : 22 }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: c.text }}>{label}</div>
        {description && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 2 }}>{description}</div>}
      </div>
    </div>
  );
}
