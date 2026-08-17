function buildCsv(match, sections) {
  const lines = [];
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  if (sections.info) {
    lines.push('INFORMAZIONI PARTITA');
    lines.push(['Squadra A', 'Squadra B', 'Competizione', 'Data', 'Luogo', 'Risultato'].map(esc).join(','));
    lines.push([match.teamA.name, match.teamB.name, match.competition, match.date, match.venue, `${match.finalScore.a}-${match.finalScore.b}`].map(esc).join(','));
    lines.push('');
  }
  if (sections.lineups) {
    lines.push('SESTETTI INIZIALI');
    lines.push(['Set', 'Squadra', 'I', 'II', 'III', 'IV', 'V', 'VI'].map(esc).join(','));
    match.sets.forEach((s) => {
      [match.teamA, match.teamB].forEach((team) => {
        lines.push([s.number, team.name, ...s.lineups[team.key]].map(esc).join(','));
      });
    });
    lines.push('');
  }
  if (sections.services) {
    lines.push('TURNI DI SERVIZIO');
    lines.push(['Set', '#', 'Squadra', 'Battitore', 'Rotazione', 'Inizio', 'Fine', 'Punti', 'Stato'].map(esc).join(','));
    match.sets.forEach((s) => {
      s.serviceTurns.forEach((t) => {
        const teamName = t.teamKey === match.teamA.key ? match.teamA.name : match.teamB.name;
        lines.push([s.number, t.index, teamName, t.server, t.rotation, t.start, t.end, t.points, t.status].map(esc).join(','));
      });
    });
  }
  return lines.join('\n');
}

function ExportDialog({ open, onClose, match }) {
  const { Dialog, Button, SegmentedControl } = window.VolleyRefDesignSystem_4fa89f;
  const { useToast } = window.VolleyRefDesignSystem_4fa89f;
  const [format, setFormat] = React.useState('xlsx');
  const [sections, setSections] = React.useState({ info: true, lineups: true, services: true });
  const { push } = useToast();

  const toggle = (key) => setSections((s) => ({ ...s, [key]: !s[key] }));

  const download = () => {
    if (format === 'csv') {
      const csv = buildCsv(match, sections);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `volleyref-${match.id}.csv`; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      push('CSV scaricato', { tone: 'success' });
    } else {
      push('Download avviato — volleyref-' + match.id + '.xlsx', { tone: 'success' });
    }
    onClose();
  };

  const checkRow = (key, label) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--color-text-primary)', cursor: 'pointer', padding: '6px 0' }}>
      <input type="checkbox" checked={sections[key]} onChange={() => toggle(key)} style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} />
      {label}
    </label>
  );

  return (
    <Dialog open={open} onClose={onClose} title="Esporta analisi" description="Scegli il formato e le sezioni da includere." size="md"
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Annulla</Button><Button onClick={download}>{format === 'csv' ? 'Scarica CSV' : 'Scarica Excel'}</Button></React.Fragment>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SegmentedControl options={[{ value: 'xlsx', label: 'Excel (.xlsx)' }, { value: 'csv', label: 'CSV' }]} value={format} onChange={setFormat} />
        {format === 'xlsx' && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Sezioni incluse</div>
            {checkRow('info', 'Informazioni partita')}
            {checkRow('lineups', 'Sestetti iniziali')}
            {checkRow('services', 'Turni di servizio')}
          </div>
        )}
      </div>
    </Dialog>
  );
}
window.ExportDialog = ExportDialog;
