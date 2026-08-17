import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((message, opts = {}) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, actionLabel: opts.actionLabel, onAction: opts.onAction, tone: opts.tone || 'default' }]);
    setTimeout(() => dismiss(id), opts.duration || 4200);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', display: 'flex',
        flexDirection: 'column', gap: 8, zIndex: 200 }}>
        {toasts.map((t) => <Toast key={t.id} {...t} onDismiss={() => dismiss(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function Toast({ message, actionLabel, onAction, onDismiss, tone = 'default' }) {
  const border = tone === 'success' ? 'var(--color-success)' : tone === 'danger' ? 'var(--color-danger)' : 'var(--neutral-800)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--color-text-primary)', color: 'var(--color-white)',
      padding: '12px 16px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', fontSize: 'var(--text-sm)',
      fontFamily: 'var(--font-body)', minWidth: 260, borderLeft: `3px solid ${border}` }}>
      <span style={{ flex: 1 }}>{message}</span>
      {actionLabel && (
        <button onClick={() => { onAction && onAction(); onDismiss(); }} style={{ background: 'none', border: 'none',
          color: 'var(--color-primary)', fontWeight: 'var(--weight-semibold)', cursor: 'pointer', fontSize: 'var(--text-sm)', padding: 0 }}>
          {actionLabel}
        </button>
      )}
      <button onClick={onDismiss} aria-label="Chiudi" style={{ background: 'none', border: 'none', color: 'var(--neutral-400)',
        cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
    </div>
  );
}
