Modal shell (overlay + panel + optional footer). Closes on Escape or backdrop click. Backs ExportDialog and ResetCorrectionsDialog.

```jsx
<Dialog open={open} onClose={close} title="Esporta analisi" footer={<Button onClick={download}>Scarica Excel</Button>}>
  …content…
</Dialog>
```
