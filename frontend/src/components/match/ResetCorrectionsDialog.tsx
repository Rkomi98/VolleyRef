"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"

export interface ResetCorrectionsDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  editCount: number
  confirming?: boolean
}

export function ResetCorrectionsDialog({ open, onClose, onConfirm, editCount, confirming = false }: ResetCorrectionsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ripristina dati estratti"
      size="sm"
      footer={
        <React.Fragment>
          <Button variant="secondary" onClick={onClose} disabled={confirming}>
            Annulla
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={editCount === 0} loading={confirming}>
            Ripristina
          </Button>
        </React.Fragment>
      }
    >
      <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-primary)", lineHeight: 1.55 }}>
        {editCount > 0
          ? `Vuoi eliminare tutte le correzioni manuali? Stai per eliminare ${editCount} correzion${editCount === 1 ? "e" : "i"} manuale${editCount === 1 ? "" : "i"} e tornare ai dati originariamente estratti da VolleyRef. L'operazione non può essere annullata.`
          : "Non ci sono correzioni manuali da eliminare in questa partita."}
      </p>
    </Dialog>
  )
}
