function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function UploadDropzone({ onAnalyze }) {
  const { Button, IconButton, SegmentedControl } = window.VolleyRefDesignSystem_4fa89f;
  const Icon = window.VRIcons;
  const [file, setFile] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [outcome, setOutcome] = React.useState('success');
  const inputRef = React.useRef(null);

  const pick = (f) => { if (f) setFile(f); };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files && e.dataTransfer.files[0]); }}
          style={{
            border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--border-strong)'}`,
            borderRadius: 'var(--radius-lg)', background: dragOver ? 'var(--color-primary-subtle)' : 'var(--color-white)',
            padding: '56px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            transition: 'all var(--duration-base) var(--ease-standard)',
          }}
        >
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-dark)' }}>
            <Icon.Upload size={26} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, color: 'var(--color-text-primary)' }}>Trascina qui il referto PDF</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>oppure seleziona un file dal computer</div>
          <Button onClick={() => inputRef.current && inputRef.current.click()}>Seleziona PDF</Button>
          <input ref={inputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => pick(e.target.files[0])} />
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon.FileText size={13} /> PDF · elaborazione locale
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', background: 'var(--color-white)', padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--color-danger-subtle)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon.FileText size={19} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{formatSize(file.size)}</div>
            </div>
            <IconButton icon={<Icon.X size={16} />} label="Rimuovi file" onClick={() => setFile(null)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Esito simulato (demo)</span>
              <SegmentedControl size="sm" options={[{ value: 'success', label: 'Successo' }, { value: 'error', label: 'Errore' }]} value={outcome} onChange={setOutcome} />
            </div>
            <Button onClick={() => onAnalyze(file, outcome)}>Analizza referto</Button>
          </div>
        </div>
      )}
    </div>
  );
}
window.UploadDropzone = UploadDropzone;
