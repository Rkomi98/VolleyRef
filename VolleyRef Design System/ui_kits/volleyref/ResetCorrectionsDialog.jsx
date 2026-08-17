function ResetCorrectionsDialog({ open, onClose, onConfirm, editCount }) {
  const { Dialog, Button } = window.VolleyRefDesignSystem_4fa89f;
  return (
    <Dialog open={open} onClose={onClose} title="Ripristina dati estratti" size="sm"
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Annulla</Button><Button variant="danger" onClick={onConfirm}>Ripristina</Button></React.Fragment>}
    >
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.55 }}>
        {editCount > 0
          ? `Stai per eliminare ${editCount} correzion${editCount === 1 ? 'e' : 'i'} manuale${editCount === 1 ? '' : 'i'} e tornare ai dati originariamente estratti da VolleyRef. L'operazione non può essere annullata.`
          : 'Non ci sono correzioni manuali da eliminare in questa partita.'}
      </p>
    </Dialog>
  );
}
window.ResetCorrectionsDialog = ResetCorrectionsDialog;
