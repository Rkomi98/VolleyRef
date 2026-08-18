"""Vincoli di dominio pallavolistici — nucleo puro condiviso da parser e validator.

Sta in un modulo separato per una ragione precisa: il parser (backend §24) deve
poter usare gli *stessi* vincoli che il validator (backend §25) applica a
posteriori, per risolvere le ambiguità OCR (backend §26) senza che i due moduli
si importino a vicenda.

Qui non si costruisce niente e non si valida niente: ci sono solo predicati e
funzioni di derivazione, senza stato e senza I/O.
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Optional

from app.models.match import RotationLabel, StartingSix

# --- Numeri di maglia -------------------------------------------------------

MIN_PLAYER_NUMBER = 1
MAX_PLAYER_NUMBER = 99

# --- Rotazione --------------------------------------------------------------

POSITION_ORDER: tuple[str, ...] = ("I", "II", "III", "IV", "V", "VI")
"""Ordine delle posizioni in campo, che è anche l'ordine di servizio.

Il battitore è sempre il giocatore in posizione I. Quando una squadra
riconquista il servizio ruota di uno, quindi il k-esimo turno di servizio di una
squadra è servito dal giocatore che nel sestetto iniziale occupava
`POSITION_ORDER[k % 6]`.
"""

ROTATION_ORDER: tuple[RotationLabel, ...] = tuple(RotationLabel(p) for p in POSITION_ORDER)


class Constraint(str, Enum):
    """Nome del vincolo che ha scartato un candidato OCR.

    Viene conservato dentro la struttura di risoluzione (parser.CandidateResolution)
    così che la scelta sia sempre spiegabile e verificabile a posteriori.
    """

    PLAUSIBLE_PLAYER_NUMBER = "plausible-player-number"
    UNIQUE_JERSEY_IN_STARTING_SIX = "unique-jersey-in-starting-six"
    PLAUSIBLE_ROTATION_LABEL = "plausible-rotation-label"
    ROTATION_FOLLOWS_CYCLE = "rotation-follows-cycle"
    SERVER_MATCHES_ROTATION = "server-matches-rotation"
    PLAUSIBLE_SCORE = "plausible-score"
    SCORE_IS_MONOTONIC = "score-is-monotonic"
    SCORE_IS_CONTINUOUS = "score-is-continuous"


_NUMBER_RE = re.compile(r"^\D*?(\d{1,3})\D*$")
_SCORE_RE = re.compile(r"^\D*?(\d{1,3})\s*[-–:/]\s*(\d{1,3})\D*$")


def parse_player_number(text: Optional[str]) -> Optional[int]:
    """Estrae un numero di maglia da una lettura grezza. `None` se illeggibile."""
    if text is None:
        return None
    match = _NUMBER_RE.match(text.strip())
    if match is None:
        return None
    return int(match.group(1))


def is_plausible_player_number(number: Optional[int]) -> bool:
    return number is not None and MIN_PLAYER_NUMBER <= number <= MAX_PLAYER_NUMBER


def parse_score(text: Optional[str]) -> Optional[tuple[int, int]]:
    """Legge un punteggio nella forma `12-9` / `12:9`. `None` se illeggibile."""
    if text is None:
        return None
    match = _SCORE_RE.match(text.strip())
    if match is None:
        return None
    return int(match.group(1)), int(match.group(2))


def parse_rotation_label(text: Optional[str]) -> Optional[RotationLabel]:
    if text is None:
        return None
    normalized = text.strip().upper().replace(".", "")
    try:
        return RotationLabel(normalized)
    except ValueError:
        return None


def rotation_for_turn_index(turn_index: int) -> RotationLabel:
    """Etichetta di rotazione del `turn_index`-esimo turno di servizio (0-based)
    di una squadra. L'ordine è ciclico su sei posizioni (backend §25.2)."""
    return ROTATION_ORDER[turn_index % len(ROTATION_ORDER)]


def rotation_index(label: Optional[RotationLabel]) -> Optional[int]:
    if label is None:
        return None
    return ROTATION_ORDER.index(label)


def starting_six_numbers(six: StartingSix) -> dict[str, Optional[int]]:
    """Mappa posizione → numero di maglia assegnato (o `None` se vuota)."""
    return {position: getattr(six, position).value for position in POSITION_ORDER}


def missing_positions(six: StartingSix) -> list[str]:
    """Posizioni senza numero: violano il vincolo «sei posizioni» (backend §25.1)."""
    return [position for position, number in starting_six_numbers(six).items() if number is None]


def duplicate_numbers(six: StartingSix) -> dict[int, list[str]]:
    """Numeri di maglia che compaiono in più posizioni dello stesso sestetto.

    Un giocatore non può occupare due posizioni contemporaneamente: è il vincolo
    che disambigua le letture OCR confondibili (3/8, 6/8, 1/7...).
    """
    by_number: dict[int, list[str]] = {}
    for position, number in starting_six_numbers(six).items():
        if number is None:
            continue
        by_number.setdefault(number, []).append(position)
    return {number: positions for number, positions in by_number.items() if len(positions) > 1}


def expected_server(six: StartingSix, rotation: Optional[RotationLabel]) -> Optional[int]:
    """Giocatore che deve trovarsi in posizione I data la rotazione corrente."""
    if rotation is None:
        return None
    return getattr(six, rotation.value).value


def is_in_starting_six(six: StartingSix, number: Optional[int]) -> bool:
    if number is None:
        return False
    return number in {n for n in starting_six_numbers(six).values() if n is not None}


def score_is_monotonic(previous: tuple[int, int], current: tuple[int, int]) -> bool:
    """Il punteggio non torna mai indietro (backend §25.5)."""
    return current[0] >= previous[0] and current[1] >= previous[1]


def points_scored_by(team_index: int, score_start: tuple[int, int], score_end: tuple[int, int]) -> int:
    """Punti prodotti nel turno dalla squadra al servizio — CAMPO DERIVATO.

    Formula (backend §11): differenza fra punteggio finale e iniziale *della
    squadra al servizio*. Non è mai ground truth OCR: va ricalcolato ogni volta
    che `score_start`/`score_end` cambiano, anche dopo una correzione manuale.
    """
    return score_end[team_index] - score_start[team_index]


def opponent_index(team_index: int) -> int:
    return 1 - team_index
