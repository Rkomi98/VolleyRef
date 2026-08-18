"""Volleyball Parser — `list[RawObservation]` → pezzi del domain model (backend §24).

Responsabilità (backend §21, §24):

- associare i numeri di maglia alle posizioni I–VI dei due sestetti iniziali;
- riconoscere la squadra inizialmente al servizio;
- ricostruire la sequenza temporale dei turni di servizio, con numero di sequenza
  ed etichetta di rotazione;
- determinare il giocatore al servizio;
- calcolare `points_scored` come campo DERIVATO (backend §11).

Il parser non conosce né pixel né OCR: consuma solo `RawObservation` (backend §23).

Scelta del candidato (backend §26)
----------------------------------
Per ogni osservazione si parte dal candidato a confidence più alta, MA se i
vincoli di dominio (`app.volleyball.constraints`, gli stessi che applica il
validator) rendono infattibile quel candidato e ne resta esattamente uno
compatibile, vince quello. Il candidato scartato non viene mai buttato via in
silenzio: finisce in `CandidateResolution.rejected` insieme al nome del vincolo
che lo ha eliminato, e la risoluzione resta consultabile per `field_id` dentro
`ParsedSet.resolutions` (struttura satellite, perché `ExtractedValue` è
contratto congelato e non va esteso).

Se dopo i vincoli restano più candidati compatibili con confidence comparabile,
l'ambiguità NON è risolta: il valore migliore resta selezionato ma la
risoluzione è marcata `WARNING` (backend §26) e il validator emette il check
corrispondente. Un dato ambiguo non viene mai «corretto» in silenzio (backend §25).

Confidence finale (backend §27) — formula volutamente banale e documentata:

    finale = confidence_OCR
             − AMBIGUITY_PENALTY        se esisteva un'ambiguità reale
             + DOMAIN_AGREEMENT_BONUS   se un vincolo di dominio ha deciso
    e comunque ≤ AMBIGUOUS_CONFIDENCE_CAP se esisteva un'ambiguità reale
"""

from __future__ import annotations

import re
from typing import Callable, Iterable, Optional, Sequence

from pydantic import BaseModel

from app.domain.raw_observation import ExpectedType, ObservationCandidate, RawObservation
from app.models.common import CheckStatus, ExtractedValue
from app.models.match import (
    RotationLabel,
    ServiceTurn,
    SetData,
    StartingSix,
    ValidationResult,
)
from app.volleyball import constraints as C

AMBIGUITY_MARGIN = 0.15
"""Due candidati entro questo scarto di confidence sono «comparabili», quindi
l'osservazione è ambigua e va risolta con i vincoli di dominio."""

AMBIGUITY_PENALTY = 0.15
DOMAIN_AGREEMENT_BONUS = 0.20
AMBIGUOUS_CONFIDENCE_CAP = 0.90
LOW_CONFIDENCE_THRESHOLD = 0.60


REASON_SINGLE_CANDIDATE = "single-candidate"
REASON_HIGHEST_CONFIDENCE = "highest-confidence"
REASON_DOMAIN_CONSTRAINT = "domain-constraint"
REASON_AMBIGUITY_UNRESOLVED = "ambiguity-unresolved"
REASON_NO_FEASIBLE_CANDIDATE = "no-candidate-satisfies-constraints"
REASON_MISSING_OBSERVATION = "missing-observation"
REASON_DERIVED = "derived-from-domain"


# ---------------------------------------------------------------------------
# Field id: il frontend usa questi id per navigare all'anomalia (backend §12)
# ---------------------------------------------------------------------------


def starting_six_field_id(set_number: int, team_id: str, position: str) -> str:
    return f"set{set_number}-{team_id}-position-{position}"


def service_turn_id(set_number: int, sequence: int) -> str:
    return f"set{set_number}-turn-{sequence:03d}"


def service_turn_field_id(set_number: int, sequence: int, part: str) -> str:
    return f"{service_turn_id(set_number, sequence)}-{part}"


# ---------------------------------------------------------------------------
# Struttura satellite di tracciamento delle scelte
# ---------------------------------------------------------------------------


class RejectedCandidate(BaseModel):
    """Candidato OCR non selezionato, con il motivo per cui è stato scartato."""

    value: str
    confidence: float
    reason: str
    """Nome del vincolo (`constraints.Constraint`) che lo ha reso infattibile,
    oppure `lower-confidence` se è stato semplicemente battuto."""


class CandidateResolution(BaseModel):
    """Come è stato scelto il valore di un campo, e cosa è stato scartato.

    Vive fuori da `ExtractedValue` (contratto congelato) e si raggiunge per
    `field_id` con `ParsedSet.resolution_for()`.
    """

    field_id: str
    observation_id: Optional[str] = None
    region_id: Optional[str] = None
    selected_value: Optional[str] = None
    selected_confidence: Optional[float] = None
    ambiguous: bool = False
    """C'erano più candidati a confidence comparabile: un'ambiguità reale
    esisteva, anche se poi è stata risolta."""
    resolved_by_constraint: bool = False
    """Un vincolo di dominio ha eliminato le alternative lasciandone una sola."""
    constraint: Optional[str] = None
    status: CheckStatus = CheckStatus.VALID
    reason: str = REASON_SINGLE_CANDIDATE
    rejected: list[RejectedCandidate] = []


class ParsedSet(BaseModel):
    """Output del parser per un set: pezzi di domain model + tracciamento scelte."""

    number: int
    team_a_id: str
    team_b_id: str
    starting_team_id: Optional[str] = None
    team_a_starting_six: StartingSix
    team_b_starting_six: StartingSix
    service_turns: list[ServiceTurn] = []
    reported_final_score: Optional[tuple[int, int]] = None
    resolutions: list[CandidateResolution] = []

    def resolution_for(self, field_id: str) -> Optional[CandidateResolution]:
        for resolution in self.resolutions:
            if resolution.field_id == field_id:
                return resolution
        return None

    def starting_six_for(self, team_id: str) -> StartingSix:
        if team_id == self.team_a_id:
            return self.team_a_starting_six
        if team_id == self.team_b_id:
            return self.team_b_starting_six
        raise KeyError(f"squadra sconosciuta: {team_id}")

    def team_index(self, team_id: str) -> int:
        return 0 if team_id == self.team_a_id else 1

    def ambiguous_field_ids(self) -> list[str]:
        return [r.field_id for r in self.resolutions if r.ambiguous]


# ---------------------------------------------------------------------------
# Motore di risoluzione dei candidati
# ---------------------------------------------------------------------------

Feasibility = Callable[[str], tuple[bool, Optional[C.Constraint]]]
"""Predicato di dominio su una lettura grezza: `(fattibile, vincolo_violato)`."""


def _ranked(candidates: Iterable[ObservationCandidate]) -> list[ObservationCandidate]:
    """Ordina per confidence decrescente, con tie-break sul valore (determinismo)."""
    return sorted(candidates, key=lambda c: (-c.confidence, c.value))


def is_ambiguous(candidates: Sequence[ObservationCandidate]) -> bool:
    ranked = _ranked(candidates)
    if len(ranked) < 2:
        return False
    return (ranked[0].confidence - ranked[1].confidence) <= AMBIGUITY_MARGIN


def _final_confidence(base: float, *, ambiguous: bool, resolved_by_constraint: bool) -> float:
    confidence = base
    if ambiguous:
        confidence -= AMBIGUITY_PENALTY
    if resolved_by_constraint:
        confidence += DOMAIN_AGREEMENT_BONUS
    if ambiguous:
        confidence = min(confidence, AMBIGUOUS_CONFIDENCE_CAP)
    return round(max(0.0, min(1.0, confidence)), 4)


def resolve_observation(
    field_id: str,
    observation: Optional[RawObservation],
    *,
    is_feasible: Optional[Feasibility] = None,
) -> tuple[Optional[ObservationCandidate], CandidateResolution]:
    """Scegli un candidato applicando i vincoli di dominio, tracciando tutto.

    Ritorna `(candidato_scelto, risoluzione)`. Il candidato scelto può violare i
    vincoli (quando nessuno li soddisfa): in quel caso si conserva la lettura
    OCR così com'è — mai correzioni silenziose — e la risoluzione è `WARNING`.
    """
    if observation is None or not observation.candidates:
        return None, CandidateResolution(
            field_id=field_id,
            observation_id=observation.id if observation else None,
            region_id=observation.region_id if observation else None,
            status=CheckStatus.INVALID,
            reason=REASON_MISSING_OBSERVATION,
        )

    ranked = _ranked(observation.candidates)
    ambiguous = is_ambiguous(ranked)

    verdicts: list[tuple[ObservationCandidate, bool, Optional[C.Constraint]]] = []
    for candidate in ranked:
        if is_feasible is None:
            verdicts.append((candidate, True, None))
            continue
        feasible, violated = is_feasible(candidate.value)
        verdicts.append((candidate, feasible, violated))

    feasible = [candidate for candidate, ok, _ in verdicts if ok]
    eliminated = sum(1 for _, ok, _ in verdicts if not ok)

    if not feasible:
        selected = ranked[0]
        resolved_by_constraint = False
        constraint = next((v.value for _, ok, v in verdicts if not ok and v is not None), None)
        reason = REASON_NO_FEASIBLE_CANDIDATE
        status = CheckStatus.WARNING
    else:
        selected = feasible[0]
        resolved_by_constraint = eliminated > 0 and len(feasible) == 1 and len(ranked) > 1
        constraint = None
        if resolved_by_constraint:
            constraint = next(
                (v.value for candidate, ok, v in verdicts if not ok and v is not None),
                None,
            )
            reason = REASON_DOMAIN_CONSTRAINT
        elif ambiguous and len(feasible) > 1:
            reason = REASON_AMBIGUITY_UNRESOLVED
        elif len(ranked) == 1:
            reason = REASON_SINGLE_CANDIDATE
        else:
            reason = REASON_HIGHEST_CONFIDENCE
        # Un'ambiguità reale c'era: resta WARNING anche quando è stata risolta,
        # perché il valore va comunque messo sotto gli occhi dell'arbitro.
        status = CheckStatus.WARNING if ambiguous else CheckStatus.VALID

    rejected: list[RejectedCandidate] = []
    for candidate, ok, violated in verdicts:
        if candidate is selected:
            continue
        rejected.append(
            RejectedCandidate(
                value=candidate.value,
                confidence=candidate.confidence,
                reason=violated.value if (not ok and violated is not None) else "lower-confidence",
            )
        )

    resolution = CandidateResolution(
        field_id=field_id,
        observation_id=observation.id,
        region_id=observation.region_id,
        selected_value=selected.value,
        selected_confidence=_final_confidence(
            selected.confidence,
            ambiguous=ambiguous,
            resolved_by_constraint=resolved_by_constraint,
        ),
        ambiguous=ambiguous,
        resolved_by_constraint=resolved_by_constraint,
        constraint=constraint,
        status=status,
        reason=reason,
        rejected=rejected,
    )
    return selected, resolution


# ---------------------------------------------------------------------------
# Sestetti iniziali
# ---------------------------------------------------------------------------

_POSITION_SUFFIX_RE = re.compile(r"(?:^|[^A-Z])(VI|IV|III|II|V|I)$")
_TURN_PART_RE = re.compile(r"turn-(?P<sequence>\d+)-(?P<part>player|rotation|score-start|score-end)$")


def _position_of(observation: RawObservation) -> Optional[str]:
    for text in (observation.id, observation.region_id):
        match = _POSITION_SUFFIX_RE.search(text)
        if match is not None:
            return match.group(1)
    return None


def _mentions_team(observation: RawObservation, team_id: str) -> bool:
    pattern = re.compile(rf"(?:^|[^0-9A-Za-z]){re.escape(team_id)}(?:[^0-9A-Za-z]|$)")
    return any(pattern.search(text) is not None for text in (observation.id, observation.region_id))


def parse_starting_six(
    observations: Sequence[RawObservation],
    *,
    team_id: str,
    set_number: int = 1,
) -> tuple[StartingSix, list[CandidateResolution]]:
    """Assegna i numeri alle posizioni I–VI di una squadra.

    Due passate: la prima raccoglie come «ancore» i numeri letti senza ambiguità,
    la seconda risolve le posizioni ambigue sapendo che un giocatore non può
    occupare due posizioni (vincolo `unique-jersey-in-starting-six`).
    """
    by_position: dict[str, RawObservation] = {}
    for observation in observations:
        position = _position_of(observation)
        if position is not None:
            by_position.setdefault(position, observation)

    # Passata 1 — ancore: posizioni la cui lettura non è ambigua.
    assigned: dict[str, Optional[int]] = {}
    for position in C.POSITION_ORDER:
        observation = by_position.get(position)
        if observation is None or not observation.candidates:
            continue
        ranked = _ranked(observation.candidates)
        if is_ambiguous(ranked):
            continue
        assigned[position] = C.parse_player_number(ranked[0].value)

    # Passata 2 — risoluzione posizione per posizione.
    values: dict[str, ExtractedValue] = {}
    resolutions: list[CandidateResolution] = []
    for position in C.POSITION_ORDER:
        field_id = starting_six_field_id(set_number, team_id, position)
        observation = by_position.get(position)
        taken = {number for other, number in assigned.items() if other != position and number is not None}

        def is_feasible(value: str, taken: set[int] = taken) -> tuple[bool, Optional[C.Constraint]]:
            number = C.parse_player_number(value)
            if not C.is_plausible_player_number(number):
                return False, C.Constraint.PLAUSIBLE_PLAYER_NUMBER
            if number in taken:
                return False, C.Constraint.UNIQUE_JERSEY_IN_STARTING_SIX
            return True, None

        selected, resolution = resolve_observation(field_id, observation, is_feasible=is_feasible)
        number = C.parse_player_number(selected.value) if selected is not None else None
        assigned[position] = number
        resolutions.append(resolution)
        values[position] = ExtractedValue[Optional[int]](
            id=field_id,
            value=number,
            original_value=number,
            confidence=resolution.selected_confidence,
            source_region_id=observation.region_id if observation is not None else None,
        )

    return StartingSix(**values), resolutions


# ---------------------------------------------------------------------------
# Turni di servizio
# ---------------------------------------------------------------------------


class RawServiceTurnGroup(BaseModel):
    """Osservazioni grezze di un singolo turno di servizio, già raggruppate."""

    sequence: int
    team_id: Optional[str] = None
    player: Optional[RawObservation] = None
    rotation: Optional[RawObservation] = None
    score_start: Optional[RawObservation] = None
    score_end: Optional[RawObservation] = None

    def region_ids(self) -> list[str]:
        return [
            observation.region_id
            for observation in (self.player, self.rotation, self.score_start, self.score_end)
            if observation is not None
        ]


def group_service_turn_observations(
    observations: Sequence[RawObservation],
    *,
    team_ids: Sequence[str] = (),
) -> list[RawServiceTurnGroup]:
    """Raggruppa le osservazioni per turno di servizio leggendo `turn-<n>-<parte>`
    dall'id (o dal region_id) dell'osservazione, in ordine di sequenza."""
    groups: dict[int, RawServiceTurnGroup] = {}
    for observation in observations:
        match = None
        for text in (observation.id, observation.region_id):
            match = _TURN_PART_RE.search(text)
            if match is not None:
                break
        if match is None:
            continue
        sequence = int(match.group("sequence"))
        group = groups.setdefault(sequence, RawServiceTurnGroup(sequence=sequence))
        if group.team_id is None:
            group.team_id = next((tid for tid in team_ids if _mentions_team(observation, tid)), None)
        setattr(group, match.group("part").replace("-", "_"), observation)
    return [groups[sequence] for sequence in sorted(groups)]


def recompute_points_scored(turn: ServiceTurn, *, team_a_id: str) -> int:
    """Ricalcola `points_scored` dal delta di punteggio (backend §11)."""
    team_index = 0 if turn.team_id == team_a_id else 1
    return C.points_scored_by(team_index, turn.score_start.value, turn.score_end.value)


def parse_service_turns(
    groups: Sequence[RawServiceTurnGroup],
    *,
    set_number: int,
    team_a_id: str,
    team_b_id: str,
    starting_sixes: dict[str, StartingSix],
    starting_team_id: Optional[str] = None,
) -> tuple[list[ServiceTurn], list[CandidateResolution]]:
    """Ricostruisce la sequenza temporale dei turni di servizio.

    Per ogni turno deriva l'etichetta di rotazione dal conteggio dei turni già
    giocati da quella squadra (l'ordine di servizio è ciclico) e usa quella
    derivazione come vincolo per disambiguare rotazione e battitore. Se la
    lettura OCR è univoca ma incompatibile, il valore letto viene CONSERVATO e la
    risoluzione marcata `WARNING`: la segnalazione è compito del validator.
    """
    turns: list[ServiceTurn] = []
    resolutions: list[CandidateResolution] = []
    turns_per_team: dict[str, int] = {team_a_id: 0, team_b_id: 0}
    previous_team_id: Optional[str] = None
    previous_score: tuple[int, int] = (0, 0)

    for group in groups:
        team_id = group.team_id
        if team_id is None:
            # Nessun indicatore di squadra sulla cella: i turni si alternano
            # sempre (chi mantiene il servizio resta nello stesso turno).
            if previous_team_id is None:
                team_id = starting_team_id or team_a_id
            else:
                team_id = team_b_id if previous_team_id == team_a_id else team_a_id
        team_index = 0 if team_id == team_a_id else 1
        six = starting_sixes.get(team_id)

        turn_index = turns_per_team.get(team_id, 0)
        derived_rotation = C.rotation_for_turn_index(turn_index)

        # --- rotazione ---
        rotation_field_id = service_turn_field_id(set_number, group.sequence, "rotation")

        def rotation_feasible(value: str) -> tuple[bool, Optional[C.Constraint]]:
            label = C.parse_rotation_label(value)
            if label is None:
                return False, C.Constraint.PLAUSIBLE_ROTATION_LABEL
            if label != derived_rotation:
                return False, C.Constraint.ROTATION_FOLLOWS_CYCLE
            return True, None

        if group.rotation is None:
            rotation_value = derived_rotation
            rotation_resolution = CandidateResolution(
                field_id=rotation_field_id,
                selected_value=derived_rotation.value,
                status=CheckStatus.VALID,
                reason=REASON_DERIVED,
            )
        else:
            selected, rotation_resolution = resolve_observation(
                rotation_field_id, group.rotation, is_feasible=rotation_feasible
            )
            rotation_value = C.parse_rotation_label(selected.value) if selected else derived_rotation
        resolutions.append(rotation_resolution)

        # --- battitore ---
        expected_player = C.expected_server(six, rotation_value) if six is not None else None
        player_field_id = service_turn_field_id(set_number, group.sequence, "player")

        def player_feasible(value: str) -> tuple[bool, Optional[C.Constraint]]:
            number = C.parse_player_number(value)
            if not C.is_plausible_player_number(number):
                return False, C.Constraint.PLAUSIBLE_PLAYER_NUMBER
            if expected_player is not None and number != expected_player:
                return False, C.Constraint.SERVER_MATCHES_ROTATION
            return True, None

        selected_player, player_resolution = resolve_observation(
            player_field_id, group.player, is_feasible=player_feasible
        )
        resolutions.append(player_resolution)
        player_number = C.parse_player_number(selected_player.value) if selected_player else expected_player

        # --- punteggi ---
        score_start_field_id = service_turn_field_id(set_number, group.sequence, "score-start")
        score_end_field_id = service_turn_field_id(set_number, group.sequence, "score-end")

        def score_start_feasible(value: str) -> tuple[bool, Optional[C.Constraint]]:
            score = C.parse_score(value)
            if score is None:
                return False, C.Constraint.PLAUSIBLE_SCORE
            if not C.score_is_monotonic(previous_score, score):
                return False, C.Constraint.SCORE_IS_CONTINUOUS
            return True, None

        selected_start, start_resolution = resolve_observation(
            score_start_field_id, group.score_start, is_feasible=score_start_feasible
        )
        resolutions.append(start_resolution)
        score_start = C.parse_score(selected_start.value) if selected_start else None
        if score_start is None:
            score_start = previous_score

        def score_end_feasible(value: str, start: tuple[int, int] = score_start) -> tuple[bool, Optional[C.Constraint]]:
            score = C.parse_score(value)
            if score is None:
                return False, C.Constraint.PLAUSIBLE_SCORE
            if not C.score_is_monotonic(start, score):
                return False, C.Constraint.SCORE_IS_MONOTONIC
            return True, None

        selected_end, end_resolution = resolve_observation(
            score_end_field_id, group.score_end, is_feasible=score_end_feasible
        )
        resolutions.append(end_resolution)
        score_end = C.parse_score(selected_end.value) if selected_end else None
        if score_end is None:
            score_end = score_start

        turn_resolutions = [rotation_resolution, player_resolution, start_resolution, end_resolution]
        status = worst_status(resolution.status for resolution in turn_resolutions)

        turn = ServiceTurn(
            id=service_turn_id(set_number, group.sequence),
            sequence=group.sequence,
            team_id=team_id,
            player=ExtractedValue[Optional[int]](
                id=player_field_id,
                value=player_number,
                original_value=player_number,
                confidence=player_resolution.selected_confidence,
                source_region_id=group.player.region_id if group.player else None,
            ),
            rotation=ExtractedValue[Optional[RotationLabel]](
                id=rotation_field_id,
                value=rotation_value,
                original_value=rotation_value,
                confidence=rotation_resolution.selected_confidence,
                source_region_id=group.rotation.region_id if group.rotation else None,
            ),
            score_start=ExtractedValue[tuple[int, int]](
                id=score_start_field_id,
                value=score_start,
                original_value=score_start,
                confidence=start_resolution.selected_confidence,
                source_region_id=group.score_start.region_id if group.score_start else None,
            ),
            score_end=ExtractedValue[tuple[int, int]](
                id=score_end_field_id,
                value=score_end,
                original_value=score_end,
                confidence=end_resolution.selected_confidence,
                source_region_id=group.score_end.region_id if group.score_end else None,
            ),
            # Derivato, sempre ricalcolato: mai la lettura OCR (backend §11).
            points_scored=C.points_scored_by(team_index, score_start, score_end),
            status=status,
            source_region_ids=group.region_ids(),
        )
        turns.append(turn)

        turns_per_team[team_id] = turn_index + 1
        previous_team_id = team_id
        previous_score = score_end

    return turns, resolutions


# ---------------------------------------------------------------------------
# Squadra al servizio e punteggio finale
# ---------------------------------------------------------------------------


def resolve_starting_team(
    observations: Sequence[RawObservation],
    *,
    team_a_id: str,
    team_b_id: str,
) -> tuple[Optional[str], Optional[CandidateResolution]]:
    """Ricostruisce quale squadra ha iniziato al servizio, dall'indicatore
    apposito quando c'è (`SERVING_TEAM_INDICATOR`, backend §21)."""
    indicator = next(
        (o for o in observations if o.expected_type is ExpectedType.SERVING_TEAM_INDICATOR),
        None,
    )
    if indicator is None:
        return None, None

    aliases = {
        team_a_id.lower(): team_a_id,
        team_b_id.lower(): team_b_id,
        "a": team_a_id,
        "b": team_b_id,
        "left": team_a_id,
        "right": team_b_id,
    }

    def is_feasible(value: str) -> tuple[bool, Optional[C.Constraint]]:
        return value.strip().lower() in aliases, None

    selected, resolution = resolve_observation("serving-team-indicator", indicator, is_feasible=is_feasible)
    if selected is None:
        return None, resolution
    return aliases.get(selected.value.strip().lower()), resolution


def _reported_final_score(observations: Sequence[RawObservation]) -> Optional[tuple[int, int]]:
    for observation in observations:
        if observation.expected_type is not ExpectedType.SCORE:
            continue
        if "final" not in observation.id and "final" not in observation.region_id:
            continue
        ranked = _ranked(observation.candidates)
        if ranked:
            return C.parse_score(ranked[0].value)
    return None


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def worst_status(statuses: Iterable[CheckStatus]) -> CheckStatus:
    """INVALID > WARNING > VALID."""
    materialized = list(statuses)
    if any(status is CheckStatus.INVALID for status in materialized):
        return CheckStatus.INVALID
    if any(status is CheckStatus.WARNING for status in materialized):
        return CheckStatus.WARNING
    return CheckStatus.VALID


def parse_set(
    observations: Sequence[RawObservation],
    *,
    set_number: int = 1,
    team_a_id: str = "team-a",
    team_b_id: str = "team-b",
    reported_final_score: Optional[tuple[int, int]] = None,
) -> ParsedSet:
    """Converte le osservazioni grezze di un set in pezzi di domain model."""
    turn_observations = [
        observation
        for observation in observations
        if any(_TURN_PART_RE.search(text) for text in (observation.id, observation.region_id))
    ]
    turn_observation_ids = {observation.id for observation in turn_observations}

    starting_six_observations = [
        observation
        for observation in observations
        if observation.expected_type is ExpectedType.PLAYER_NUMBER
        and observation.id not in turn_observation_ids
    ]

    resolutions: list[CandidateResolution] = []
    sixes: dict[str, StartingSix] = {}
    for team_id in (team_a_id, team_b_id):
        team_observations = [o for o in starting_six_observations if _mentions_team(o, team_id)]
        six, six_resolutions = parse_starting_six(
            team_observations, team_id=team_id, set_number=set_number
        )
        sixes[team_id] = six
        resolutions.extend(six_resolutions)

    starting_team_id, indicator_resolution = resolve_starting_team(
        observations, team_a_id=team_a_id, team_b_id=team_b_id
    )
    if indicator_resolution is not None:
        resolutions.append(indicator_resolution)

    groups = group_service_turn_observations(turn_observations, team_ids=(team_a_id, team_b_id))
    if starting_team_id is None and groups:
        starting_team_id = groups[0].team_id

    turns, turn_resolutions = parse_service_turns(
        groups,
        set_number=set_number,
        team_a_id=team_a_id,
        team_b_id=team_b_id,
        starting_sixes=sixes,
        starting_team_id=starting_team_id,
    )
    resolutions.extend(turn_resolutions)

    return ParsedSet(
        number=set_number,
        team_a_id=team_a_id,
        team_b_id=team_b_id,
        starting_team_id=starting_team_id,
        team_a_starting_six=sixes[team_a_id],
        team_b_starting_six=sixes[team_b_id],
        service_turns=turns,
        reported_final_score=reported_final_score or _reported_final_score(observations),
        resolutions=resolutions,
    )


def to_set_data(parsed: ParsedSet, validation: ValidationResult) -> SetData:
    """Proietta il risultato del parser sul modello pubblico `SetData`."""
    final_score = parsed.reported_final_score
    if final_score is None:
        final_score = parsed.service_turns[-1].score_end.value if parsed.service_turns else (0, 0)
    return SetData(
        number=parsed.number,
        starting_team_id=parsed.starting_team_id or parsed.team_a_id,
        team_a_starting_six=parsed.team_a_starting_six,
        team_b_starting_six=parsed.team_b_starting_six,
        service_turns=parsed.service_turns,
        final_score=final_score,
        validation=validation,
    )
