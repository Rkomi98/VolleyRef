function PdfToolbar({ zoom, onZoomIn, onZoomOut, onFitWidth, rotation, onRotate, showOverlay, onToggleOverlay, fullscreen, onToggleFullscreen, onHidePanel }) {
  const { IconButton, Tooltip } = window.VolleyRefDesignSystem_4fa89f;
  const Icon = window.VRIcons;
  const divider = <span style={{ width: 1, height: 22, background: 'var(--border-default)', margin: '0 4px' }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border-default)', background: 'var(--color-white)', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', fontWeight: 600, marginRight: 4 }}>Pagina 1/1</span>
      {divider}
      <IconButton icon={<Icon.ZoomOut size={16} />} label="Riduci zoom" onClick={onZoomOut} />
      <span style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
      <IconButton icon={<Icon.ZoomIn size={16} />} label="Aumenta zoom" onClick={onZoomIn} />
      <IconButton icon={<Icon.Maximize size={16} />} label="Adatta alla larghezza" onClick={onFitWidth} />
      <IconButton icon={<Icon.RotateCw size={16} />} label="Ruota pagina" onClick={onRotate} />
      {divider}
      <Tooltip content={showOverlay ? 'Nascondi zone riconosciute' : 'Mostra zone riconosciute'}>
        <IconButton icon={showOverlay ? <Icon.Eye size={16} /> : <Icon.EyeOff size={16} />} label="Mostra zone riconosciute" active={showOverlay} onClick={onToggleOverlay} />
      </Tooltip>
      <IconButton icon={<Icon.Maximize size={16} />} label={fullscreen ? 'Esci da schermo intero' : 'Schermo intero'} active={fullscreen} onClick={onToggleFullscreen} />
      <div style={{ flex: 1 }} />
      {onHidePanel && <IconButton icon={<Icon.PanelLeft size={16} />} label="Nascondi referto" onClick={onHidePanel} />}
    </div>
  );
}
window.PdfToolbar = PdfToolbar;
