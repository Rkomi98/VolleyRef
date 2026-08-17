function RegionOverlay({ id, top, left, width, height, active, highlighted, onClick, label }) {
  return (
    <button
      onClick={() => onClick(id)}
      title={label}
      aria-label={`Zona riconosciuta: ${label}`}
      style={{
        position: 'absolute', top, left, width, height,
        border: `1.5px solid ${highlighted ? 'var(--color-primary)' : 'rgba(0,170,234,0.55)'}`,
        background: highlighted ? 'rgba(0,170,234,0.22)' : active ? 'rgba(0,170,234,0.08)' : 'transparent',
        borderRadius: 6, cursor: 'pointer', padding: 0,
        opacity: active ? 1 : 0,
        transition: 'background var(--duration-base) var(--ease-standard), opacity var(--duration-base)',
        boxShadow: highlighted ? '0 0 0 4px rgba(0,170,234,0.18)' : 'none',
      }}
    />
  );
}
window.RegionOverlay = RegionOverlay;
