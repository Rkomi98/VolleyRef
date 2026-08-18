"""Volleyball Validator — controlli deterministici sul set ricostruito (backend §25).

Ogni controllo produce un `ValidationCheck` con i `field_ids` dei campi coinvolti:
è con quegli id che il frontend salta direttamente sull'anomalia (backend §12).

Regole implementate (numerazione del prompt §25):

1. `starting-six-complete`      — ogni sestetto iniziale ha sei posizioni compilate
   `starting-six-distinct`      — nessun giocatore occupa due posizioni
2. `rotation-order`             — l'ordine di servizio è ciclico su I…VI
3/4. `service-alternation`      — chi mantiene il servizio resta nello stesso turno,
                                  quindi turni consecutivi appartengono a squadre diverse
5. `score-monotonic`            — il punteggio non torna mai indietro
   `score-continuity`           — il turno riprende dal punteggio dove finiva il precedente
6. `rally-increments`           — ogni rally incrementa di 1 il punteggio di una sola squadra
7. `final-score`                — la sequenza termina sul punteggio finale riportato
8. `server-eligibility`         — i battitori sono compatibili con sestetto e sostituzioni
9. `ambiguous-reading`          — letture ambigue: WARNING anche se risolte
   `low-confidence`             — valori sotto soglia da verificare
   `points-scored-derived`      — `points_scored` coerente col delta di punteggio

Nessun controllo modifica un valore: un dato ambiguo o incompatibile viene
segnalato, mai corretto in silenzio (backend §25, ultima riga).
"""

from __future__ import annotations

from typing import Iterable, Optional

from app.models.common import CheckStatus
from app.models.match import ServiceTurn, ValidationCheck, ValidationResult
from app.volleyball import constraints as C
from app.volleyball.parser import (
    LOW_CONFIDENCE_THRESHOLD,
    ParsedSet,
    REASON_AMBIGUITY_UNRESOLVED,
    starting_six_field_id,
    worst_status,
)


def _check(
    check_id: str,
    label: str,
    *,
    problems: list[str],
    field_ids: Iterable[str] = (),
    status: CheckStatus = CheckStatus.INVALID,
    ok_message: Optional[str] = None,
) -> ValidationCheck:
    if not problems:
        return ValidationCheck(id=check_id, label=label, status=CheckStatus.VALID, message=ok_message)
    return ValidationCheck(
        id=check_id,
        label=label,
        status=status,
        message="; ".join(problems),
        field_ids=list(dict.fromkeys(field_ids)),
    )


# ---------------------------------------------------------------------------
# 1. Sestetti iniziali
# ---------------------------------------------------------------------------


def check_starting_six_complete(parsed: ParsedSet) -> ValidationCheck:
    problems: list[str] = []
    field_ids: list[str] = []
    for team_id in (parsed.team_a_id, parsed.team_b_id):
        missing = C.missing_positions(parsed.starting_six_for(team_id))
        if missing:
            problems.append(f"{team_id}: posizioni non compilate {', '.join(missing)}")
            field_ids.extend(
                starting_six_field_id(parsed.number, team_id, position) for position in missing
            )
    return _check(
        "starting-six-complete",
        "Sestetti iniziali completi",
        problems=problems,
        field_ids=field_ids,
    )


def check_starting_six_distinct(parsed: ParsedSet) -> ValidationCheck:
    problems: list[str] = []
    field_ids: list[str] = []
    for team_id in (parsed.team_a_id, parsed.team_b_id):
        for number, positions in C.duplicate_numbers(parsed.starting_six_for(team_id)).items():
            problems.append(f"{team_id}: il numero {number} compare in {', '.join(positions)}")
            field_ids.extend(
                starting_six_field_id(parsed.number, team_id, position) for position in positions
            )
    return _check(
        "starting-six-distinct",
        "Numeri di maglia distinti nel sestetto",
        problems=problems,
        field_ids=field_ids,
    )


# ---------------------------------------------------------------------------
# 2/3/4. Rotazione e alternanza dei turni
# ---------------------------------------------------------------------------


def check_service_alternation(parsed: ParsedSet) -> ValidationCheck:
    problems: list[str] = []
    field_ids: list[str] = []
    previous: Optional[ServiceTurn] = None
    for turn in parsed.service_turns:
        if previous is not None and previous.team_id == turn.team_id:
            problems.append(
                f"turno {turn.sequence}: due turni consecutivi per {turn.team_id} "
                "(chi mantiene il servizio resta nello stesso turno)"
            )
            field_ids.extend([previous.id, turn.id])
        previous = turn
    return _check(
        "service-alternation",
        "Alternanza dei turni di servizio",
        problems=problems,
        field_ids=field_ids,
    )


def check_rotation_order(parsed: ParsedSet) -> ValidationCheck:
    """L'ordine di servizio è ciclico: il k-esimo turno di una squadra è servito
    dalla posizione `ROTATION_ORDER[k % 6]`."""
    problems: list[str] = []
    field_ids: list[str] = []
    turns_per_team: dict[str, int] = {}
    for turn in parsed.service_turns:
        index = turns_per_team.get(turn.team_id, 0)
        expected = C.rotation_for_turn_index(index)
        if turn.rotation.value != expected:
            problems.append(
                f"turno {turn.sequence} ({turn.team_id}): rotazione {turn.rotation.value} "
                f"invece di {expected.value}"
            )
            field_ids.append(turn.rotation.id)
        turns_per_team[turn.team_id] = index + 1
    return _check("rotation-order", "Ordine delle rotazioni", problems=problems, field_ids=field_ids)


# ---------------------------------------------------------------------------
# 5/6/7. Punteggio
# ---------------------------------------------------------------------------


def check_score_monotonic(parsed: ParsedSet) -> ValidationCheck:
    problems: list[str] = []
    field_ids: list[str] = []
    for turn in parsed.service_turns:
        if not C.score_is_monotonic(turn.score_start.value, turn.score_end.value):
            problems.append(
                f"turno {turn.sequence}: il punteggio torna indietro "
                f"({turn.score_start.value} → {turn.score_end.value})"
            )
            field_ids.extend([turn.score_start.id, turn.score_end.id])
    return _check("score-monotonic", "Punteggio monotono", problems=problems, field_ids=field_ids)


def check_score_continuity(parsed: ParsedSet) -> ValidationCheck:
    problems: list[str] = []
    field_ids: list[str] = []
    previous: Optional[ServiceTurn] = None
    for turn in parsed.service_turns:
        expected = previous.score_end.value if previous is not None else (0, 0)
        if turn.score_start.value != expected:
            problems.append(
                f"turno {turn.sequence}: inizia da {turn.score_start.value} "
                f"invece di {expected}"
            )
            field_ids.append(turn.score_start.id)
            if previous is not None:
                field_ids.append(previous.score_end.id)
        previous = turn
    return _check(
        "score-continuity",
        "Continuità del punteggio fra turni",
        problems=problems,
        field_ids=field_ids,
    )


def check_rally_increments(parsed: ParsedSet) -> ValidationCheck:
    """Ogni rally incrementa di esattamente 1 il punteggio di UNA sola squadra.

    Dentro un turno di servizio la squadra al servizio accumula `points_scored`
    punti; il turno si chiude perché l'avversario vince un rally, quindi
    l'avversario guadagna esattamente 1 punto — tranne nell'ultimo turno del set,
    che può chiudersi con il punto decisivo della squadra al servizio (avversario
    a +0).
    """
    problems: list[str] = []
    field_ids: list[str] = []
    turns = parsed.service_turns
    for position, turn in enumerate(turns):
        team_index = parsed.team_index(turn.team_id)
        opponent = C.opponent_index(team_index)
        own_delta = turn.score_end.value[team_index] - turn.score_start.value[team_index]
        opponent_delta = turn.score_end.value[opponent] - turn.score_start.value[opponent]
        is_last = position == len(turns) - 1
        if own_delta < 0 or opponent_delta < 0:
            continue  # già coperto da score-monotonic
        if opponent_delta > 1:
            problems.append(
                f"turno {turn.sequence}: l'avversario guadagna {opponent_delta} punti in un solo "
                f"rally ({turn.score_start.value} → {turn.score_end.value})"
            )
            field_ids.extend([turn.score_start.id, turn.score_end.id])
        elif opponent_delta == 0 and not is_last:
            problems.append(
                f"turno {turn.sequence}: {turn.team_id} perde il servizio senza che "
                "l'avversario segni"
            )
            field_ids.extend([turn.score_start.id, turn.score_end.id])
    return _check(
        "rally-increments",
        "Ogni rally vale un punto",
        problems=problems,
        field_ids=field_ids,
    )


def check_points_scored_derived(parsed: ParsedSet) -> ValidationCheck:
    """`points_scored` è derivato: deve sempre coincidere col delta di punteggio
    della squadra al servizio (backend §11)."""
    problems: list[str] = []
    field_ids: list[str] = []
    for turn in parsed.service_turns:
        expected = C.points_scored_by(
            parsed.team_index(turn.team_id), turn.score_start.value, turn.score_end.value
        )
        if turn.points_scored != expected:
            problems.append(
                f"turno {turn.sequence}: points_scored={turn.points_scored} "
                f"ma il delta di punteggio vale {expected}"
            )
            field_ids.extend([turn.score_start.id, turn.score_end.id])
    return _check(
        "points-scored-derived",
        "Punti del turno coerenti col punteggio",
        problems=problems,
        field_ids=field_ids,
    )


def check_final_score(parsed: ParsedSet) -> ValidationCheck:
    if parsed.reported_final_score is None or not parsed.service_turns:
        return ValidationCheck(
            id="final-score",
            label="Punteggio finale del set",
            status=CheckStatus.WARNING if parsed.service_turns else CheckStatus.VALID,
            message=None if not parsed.service_turns else "punteggio finale del set non riportato",
        )
    last = parsed.service_turns[-1]
    problems: list[str] = []
    if last.score_end.value != parsed.reported_final_score:
        problems.append(
            f"la sequenza termina su {last.score_end.value} invece del punteggio riportato "
            f"{parsed.reported_final_score}"
        )
    return _check(
        "final-score",
        "Punteggio finale del set",
        problems=problems,
        field_ids=[last.score_end.id],
    )


# ---------------------------------------------------------------------------
# 8. Battitori
# ---------------------------------------------------------------------------


def check_server_eligibility(
    parsed: ParsedSet,
    *,
    available_substitutes: Optional[dict[str, set[int]]] = None,
) -> ValidationCheck:
    """I battitori devono essere compatibili con sestetto e sostituzioni.

    Un battitore diverso da quello atteso alla rotazione corrente è un WARNING
    (può essere una sostituzione non ancora letta dal referto); un battitore che
    non appartiene né al sestetto né ai sostituti dichiarati è INVALID.
    """
    warnings: list[str] = []
    invalid: list[str] = []
    field_ids: list[str] = []
    for turn in parsed.service_turns:
        six = parsed.starting_six_for(turn.team_id)
        player = turn.player.value
        substitutes = (available_substitutes or {}).get(turn.team_id)
        if player is None:
            warnings.append(f"turno {turn.sequence}: battitore non letto")
            field_ids.append(turn.player.id)
            continue
        in_six = C.is_in_starting_six(six, player)
        if not in_six and substitutes is not None and player not in substitutes:
            invalid.append(
                f"turno {turn.sequence}: il numero {player} non è nel sestetto di "
                f"{turn.team_id} né fra i sostituti"
            )
            field_ids.append(turn.player.id)
            continue
        if not in_six:
            warnings.append(
                f"turno {turn.sequence}: il numero {player} non è nel sestetto iniziale di "
                f"{turn.team_id} (sostituzione?)"
            )
            field_ids.append(turn.player.id)
            continue
        expected = C.expected_server(six, turn.rotation.value)
        if expected is not None and player != expected:
            warnings.append(
                f"turno {turn.sequence}: al servizio {player} ma la rotazione "
                f"{turn.rotation.value} attende {expected}"
            )
            field_ids.append(turn.player.id)
    if invalid:
        return _check(
            "server-eligibility",
            "Battitori compatibili col sestetto",
            problems=invalid + warnings,
            field_ids=field_ids,
            status=CheckStatus.INVALID,
        )
    return _check(
        "server-eligibility",
        "Battitori compatibili col sestetto",
        problems=warnings,
        field_ids=field_ids,
        status=CheckStatus.WARNING,
    )


# ---------------------------------------------------------------------------
# 9. Ambiguità e confidence
# ---------------------------------------------------------------------------


def check_ambiguous_readings(parsed: ParsedSet) -> ValidationCheck:
    """Un'ambiguità reale resta un WARNING anche quando i vincoli l'hanno risolta:
    il valore è stato scelto dal dominio, non letto con certezza (backend §26)."""
    resolved = [r for r in parsed.resolutions if r.ambiguous and r.resolved_by_constraint]
    unresolved = [r for r in parsed.resolutions if r.ambiguous and not r.resolved_by_constraint]
    if not resolved and not unresolved:
        return ValidationCheck(
            id="ambiguous-reading",
            label="Letture ambigue",
            status=CheckStatus.VALID,
        )
    messages: list[str] = []
    if unresolved:
        messages.append(f"{len(unresolved)} valori restano ambigui e richiedono verifica")
    if resolved:
        messages.append(
            f"{len(resolved)} valori risolti tramite vincoli di dominio, da confermare: "
            + ", ".join(
                f"{r.field_id} → {r.selected_value} ({r.constraint})" for r in resolved
            )
        )
    return ValidationCheck(
        id="ambiguous-reading",
        label="Letture ambigue",
        status=CheckStatus.WARNING,
        message="; ".join(messages),
        field_ids=[r.field_id for r in (unresolved + resolved)],
    )


def check_incompatible_readings(parsed: ParsedSet) -> ValidationCheck:
    """Letture univoche ma incompatibili con i vincoli di dominio: nessun candidato
    era fattibile, il valore OCR è stato conservato senza correzioni (backend §25.9)."""
    broken = [
        r
        for r in parsed.resolutions
        if r.status is not CheckStatus.VALID and not r.ambiguous and r.constraint is not None
    ]
    problems = [
        f"{r.field_id}: '{r.selected_value}' viola il vincolo {r.constraint}" for r in broken
    ]
    return _check(
        "domain-compatibility",
        "Letture compatibili con i vincoli di gioco",
        problems=problems,
        field_ids=[r.field_id for r in broken],
        status=CheckStatus.WARNING,
    )


def check_low_confidence(
    parsed: ParsedSet,
    *,
    threshold: float = LOW_CONFIDENCE_THRESHOLD,
) -> ValidationCheck:
    field_ids = [
        r.field_id
        for r in parsed.resolutions
        if r.selected_confidence is not None and r.selected_confidence < threshold
    ]
    if not field_ids:
        return ValidationCheck(id="low-confidence", label="Dati incerti", status=CheckStatus.VALID)
    return ValidationCheck(
        id="low-confidence",
        label="Dati incerti",
        status=CheckStatus.WARNING,
        message=f"{len(field_ids)} valori richiedono verifica",
        field_ids=field_ids,
    )


def check_missing_readings(parsed: ParsedSet) -> ValidationCheck:
    missing = [r for r in parsed.resolutions if r.reason == "missing-observation"]
    problems = [f"{r.field_id}: nessuna osservazione utilizzabile" for r in missing]
    return _check(
        "missing-readings",
        "Campi non letti",
        problems=problems,
        field_ids=[r.field_id for r in missing],
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def validate_set(
    parsed: ParsedSet,
    *,
    available_substitutes: Optional[dict[str, set[int]]] = None,
    low_confidence_threshold: float = LOW_CONFIDENCE_THRESHOLD,
    update_turn_status: bool = True,
) -> ValidationResult:
    """Applica tutti i controlli deterministici e aggrega lo stato del set."""
    checks: list[ValidationCheck] = [
        check_starting_six_complete(parsed),
        check_starting_six_distinct(parsed),
        check_rotation_order(parsed),
        check_service_alternation(parsed),
        check_score_monotonic(parsed),
        check_score_continuity(parsed),
        check_rally_increments(parsed),
        check_points_scored_derived(parsed),
        check_final_score(parsed),
        check_server_eligibility(parsed, available_substitutes=available_substitutes),
        check_missing_readings(parsed),
        check_incompatible_readings(parsed),
        check_ambiguous_readings(parsed),
        check_low_confidence(parsed, threshold=low_confidence_threshold),
    ]

    if update_turn_status:
        _escalate_turn_status(parsed, checks)

    return ValidationResult(status=worst_status(check.status for check in checks), checks=checks)


def _escalate_turn_status(parsed: ParsedSet, checks: list[ValidationCheck]) -> None:
    """Porta sul singolo `ServiceTurn` lo stato peggiore fra i check che toccano
    uno dei suoi campi: il frontend colora il turno senza rifare il join."""
    for turn in parsed.service_turns:
        turn_field_ids = {
            turn.id,
            turn.player.id,
            turn.rotation.id,
            turn.score_start.id,
            turn.score_end.id,
        }
        statuses = [turn.status]
        for check in checks:
            if check.status is CheckStatus.VALID:
                continue
            if turn_field_ids & set(check.field_ids):
                statuses.append(check.status)
        turn.status = worst_status(statuses)


def unresolved_ambiguity_field_ids(parsed: ParsedSet) -> list[str]:
    """Campi in cui più interpretazioni restano equamente plausibili (backend §26)."""
    return [r.field_id for r in parsed.resolutions if r.reason == REASON_AMBIGUITY_UNRESOLVED]
