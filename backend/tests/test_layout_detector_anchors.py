"""Ancoraggio del layout detector alle etichette stampate sul modulo.

Non serve né Tesseract né un PDF: qui si verifica la logica con cui il detector
decide che una striscia di testo *è* l'etichetta cercata. È la parte su cui
poggia la lettura dei nomi squadra dalla fascia "SQUADRE" dell'header pagina
(`LayoutDetector.match_header_team_name_cells`), cioè l'unico punto del referto
in cui il nome è stampato per intero.

Perché un confronto tollerante e non un `==`: l'OCR di una striscia larga perde
volentieri una lettera — sulla fixture Volano la stessa fascia si legge
"SQUADRE" a 300dpi e "SQDRE" a 400dpi. Con un confronto esatto l'ancoraggio
dipenderebbe dal dpi di rendering, mentre tutto questo modulo è costruito per
essere invariante al dpi.
"""

from __future__ import annotations

import pytest

from app.layout.detector import _contains_label


@pytest.mark.parametrize(
    "text",
    [
        "SQUADRE",
        "| °(A) ROTHOBLAAS VOLANO TN SQUADRE AZIMUT GIORGIONE TV (By |",
        # lettere perse dall'OCR: è il caso reale a 400dpi
        "| °(A) ROTHOBLAASVOLANOTN SQDRE AZIMUTGIORGIONETV |",
        "SQUADRE:",
        "squadre",
    ],
)
def test_etichetta_riconosciuta_anche_con_lettere_perse(text: str) -> None:
    assert _contains_label(text, "SQUADRE")


@pytest.mark.parametrize(
    "text",
    [
        "",
        "CAMPIONATO SERIE Serie B1 GARA N° 8411 MANIFESTAZIONE SERIE B1 C",
        "DIVISIONE MASCHILE FEMMINILE FASE",
        "LUOGO VOLANO CAMPO PALESTRA COMUNALE DI DATA 18/10/2025 ORA 20:30",
        "sq. ROTHOBLAAS",
        "RISULTATO FINALE",
    ],
)
def test_altre_etichette_del_modulo_non_passano_per_squadre(text: str) -> None:
    """Il criterio è la sottosequenza comune: lettere in più o in ordine diverso
    non valgono, altrimenti mezzo modulo sembrerebbe l'etichetta cercata."""

    assert not _contains_label(text, "SQUADRE")
