const CHECK_TARGET_TAB = { score: 'services', rotation: 'services', sequence: 'services', lineup: 'lineups', confidence: 'lineups' };

function ValidationPanel({ set, onJump }) {
  const { Card } = window.VolleyRefDesignSystem_4fa89f;
  const Icon = window.VRIcons;

  const bannerMap = {
    validated: { label: 'VALIDATO', bg: 'var(--color-success-subtle)', fg: 'var(--color-success)', Icon: Icon.CheckCircle },
    review: { label: 'DA VERIFICARE', bg: 'var(--color-warning-subtle)', fg: 'var(--color-warning-hover)', Icon: Icon.AlertTriangle },
    inconsistent: { label: 'INCOERENTE', bg: 'var(--color-danger-subtle)', fg: 'var(--color-danger)', Icon: Icon.AlertCircle },
  };
  const banner = bannerMap[set.status] || bannerMap.validated;

  const iconFor = (status) => status === 'success' ? <Icon.Check size={15} style={{ color: 'var(--color-success)' }} />
    : status === 'warning' ? <Icon.AlertTriangle size={15} style={{ color: 'var(--color-warning-hover)' }} />
    : <Icon.AlertCircle size={15} style={{ color: 'var(--color-danger)' }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderRadius: 'var(--radius-lg)', background: banner.bg, color: banner.fg }}>
        <banner.Icon size={22} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '0.03em' }}>{banner.label}</span>
      </div>
      <Card padding={0}>
        {set.checks.map((c, i) => {
          const clickable = c.status !== 'success';
          return (
            <div key={c.id}
              onClick={() => clickable && onJump(CHECK_TARGET_TAB[c.id] || 'services')}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                borderBottom: i < set.checks.length - 1 ? '1px solid var(--border-default)' : 'none',
                cursor: clickable ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => clickable && (e.currentTarget.style.background = 'var(--neutral-50)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {iconFor(c.status)}
              <span style={{ flex: 1, fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 500 }}>{c.label}</span>
              {clickable && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-primary)' }}>Vai al dato →</span>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
window.ValidationPanel = ValidationPanel;
