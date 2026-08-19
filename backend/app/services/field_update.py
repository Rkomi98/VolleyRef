"""Correzione manuale di un campo estratto: valida, ricalcola i derivati,
rivalida col motore di `app.volleyball.validator` e persiste (backend §13-§16).

Questo modulo NON reimplementa la logica di validazione pallavolistica: la
richiama sempre da `app.volleyball.validator.validate_set`, che è il motore
deterministico già testato in `tests/test_volleyball_validator.py`. Il lavoro
di questo file è tutto "attorno": localizzare il campo, validarne tipo/range,
applicarlo, ricalcolare `points_scored` quando serve, e tenere traccia della
correzione (`field_edits`, backend §14).

Due livelli di utilizzo, deliberatamente unificati sulla stessa funzione core
`apply_manual_correction`:

1. Diretto su `ParsedSet` (il vero output di `app.volleyball.parser`) — usato
   dai test che esercitano l'intera pipeline reale (RawObservation -> parser
   -> validator -> correzione -> validator). È qui che la correzione di
   un'ambiguità fa sparire il check `ambiguous-reading`, perché `ParsedSet`
   porta con sé `resolutions` (backend §26) e la correzione manuale marca la
   risoluzione come confermata.
2. Sulla `SetData` pubblica dentro un'`Analysis` persistita come blob JSON.
   `SetData` non porta `resolutions` — quella provenienza esiste solo
   nell'output del parser e non fa parte del contratto pubblico (backend §7) —
   quindi per rivalidare si costruisce un `ParsedSet` "shim" con risoluzioni
   sintetiche (una per campo, non ambigue, confidence presa da
   `ExtractedValue.confidence`) che permette comunque di richiamare
   `validate_set` invece di duplicarne la logica.

   Con la pipeline reale collegata (`app.services.extraction_pipeline`) questa
   resta una degradazione **parziale e nota**, e vale la pena essere precisi su
   quale: al momento dell'estrazione il parser produce le `CandidateResolution`
   vere e `validate_set` gira su quelle, quindi i check `ambiguous-reading` /
   `domain-compatibility` / `low-confidence` del primo risultato sono corretti e
   vengono persistiti dentro `SetData.validation`. Ciò che non sopravvive è la
   *struttura*: alla prima rivalidazione (una correzione manuale, un
   reset-corrections) lo shim ricostruisce risoluzioni non ambigue e quei tre
   check tornano `VALID` anche per campi che erano ambigui e che nessuno ha
   toccato. La confidence per campo, che è dentro `ExtractedValue`, non si perde
   mai: `low-confidence` continua quindi a funzionare, mentre "ambiguità risolta
   da un vincolo" è un'informazione che il modello pubblico non conserva.

   Chiuderla richiederebbe persistere le risoluzioni accanto all'`Analysis`
   (una struttura satellite nel blob JSON, non un campo nuovo in `ExtractedValue`,
   che è contratto congelato) — deliberatamente fuori da questo modulo.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Union

from fastapi import BackgroundTasks, Request

from app.models.analysis import Analysis, AnalysisGlobalStatus
from app.models.common import CheckStatus, ExtractedValue
from app.models.match import RotationLabel, ServiceTurn, SetData, ValidationCheck, ValidationResult
from app.repositories.analysis_repository import AnalysisRepository
from app.repositories.field_edit_repository import FieldEditRepository, SqliteFieldEditRepository
from app.services.analysis_service import (
    AnalysisNotFoundError,
    AnalysisService,
    InvalidFieldValueError,
)
from app.volleyball import constraints as C
from app.volleyball.parser import CandidateResolution, ParsedSet, worst_status
from app.volleyball.validator import validate_set

# ---------------------------------------------------------------------------
# Localizzazione del campo dentro un ParsedSet o una SetData — le due forme
# condividono gli stessi nomi di attributo (team_a_starting_six,
# team_b_starting_six, service_turns), quindi questa funzione è duck-typed
# e funziona su entrambe senza bisogno di convertire.
# ---------------------------------------------------------------------------

FieldKind = str  # "starting_six" | "turn_player" | "turn_rotation" | "turn_score_start" | "turn_score_end"

_POSITIONS = C.POSITION_ORDER
REASON_MANUALLY_CONFIRMED = "manually-confirmed"


@dataclass
class FieldLocation:
    kind: FieldKind
    extracted_value: ExtractedValue
    turn: Optional[ServiceTurn] = None


SetLike = Union[ParsedSet, SetData]


def _locate_field(container: SetLike, field_id: str) -> Optional[FieldLocation]:
    for six in (container.team_a_starting_six, container.team_b_starting_six):
        for position in _POSITIONS:
            ev = getattr(six, position)
            if ev.id == field_id:
                return FieldLocation(kind="starting_six", extracted_value=ev)
    for turn in container.service_turns:
        if turn.player.id == field_id:
            return FieldLocation(kind="turn_player", extracted_value=turn.player, turn=turn)
        if turn.rotation.id == field_id:
            return FieldLocation(kind="turn_rotation", extracted_value=turn.rotation, turn=turn)
        if turn.score_start.id == field_id:
            return FieldLocation(kind="turn_score_start", extracted_value=turn.score_start, turn=turn)
        if turn.score_end.id == field_id:
            return FieldLocation(kind="turn_score_end", extracted_value=turn.score_end, turn=turn)
    return None


# ---------------------------------------------------------------------------
# Validazione di tipo/range del nuovo valore (backend §13.2) — a seconda del
# tipo di campo in `ExtractedValue`. La compatibilità di dominio più fine
# (sestetto duplicato, rotazione sbagliata...) resta compito del validator,
# mai di questo controllo: qui si rifiuta solo un valore strutturalmente
# incoerente col tipo del campo.
# ---------------------------------------------------------------------------


def _coerce_value(kind: FieldKind, raw_value: object, field_id: str) -> object:
    if kind in ("starting_six", "turn_player"):
        if raw_value is None:
            return None
        if isinstance(raw_value, bool) or not isinstance(raw_value, int):
            raise InvalidFieldValueError(
                f"Il campo '{field_id}' richiede un numero di maglia intero.",
                details={"field_id": field_id, "value": raw_value},
            )
        if not C.is_plausible_player_number(raw_value):
            raise InvalidFieldValueError(
                f"Il numero di maglia {raw_value} non è plausibile "
                f"(deve essere tra {C.MIN_PLAYER_NUMBER} e {C.MAX_PLAYER_NUMBER}).",
                details={"field_id": field_id, "value": raw_value},
            )
        return raw_value

    if kind == "turn_rotation":
        if not isinstance(raw_value, str):
            raise InvalidFieldValueError(
                f"Il campo '{field_id}' richiede un'etichetta di rotazione (I-VI).",
                details={"field_id": field_id, "value": raw_value},
            )
        try:
            return RotationLabel(raw_value.strip().upper())
        except ValueError as exc:
            raise InvalidFieldValueError(
                f"'{raw_value}' non è un'etichetta di rotazione valida (I, II, III, IV, V, VI).",
                details={"field_id": field_id, "value": raw_value},
            ) from exc

    if kind in ("turn_score_start", "turn_score_end"):
        if not isinstance(raw_value, (list, tuple)) or len(raw_value) != 2:
            raise InvalidFieldValueError(
                f"Il campo '{field_id}' richiede un punteggio [squadra_a, squadra_b].",
                details={"field_id": field_id, "value": raw_value},
            )
        try:
            a, b = int(raw_value[0]), int(raw_value[1])
        except (TypeError, ValueError) as exc:
            raise InvalidFieldValueError(
                f"Il punteggio del campo '{field_id}' deve contenere due interi.",
                details={"field_id": field_id, "value": raw_value},
            ) from exc
        if a < 0 or b < 0:
            raise InvalidFieldValueError(
                f"Il punteggio del campo '{field_id}' non può essere negativo.",
                details={"field_id": field_id, "value": raw_value},
            )
        return (a, b)

    raise InvalidFieldValueError(
        f"Campo '{field_id}' di tipo non gestito.", details={"field_id": field_id}
    )


def _json_safe(value: object) -> object:
    if isinstance(value, RotationLabel):
        return value.value
    if isinstance(value, tuple):
        return list(value)
    return value


def _recompute_turn_points(turn: ServiceTurn, *, team_a_id: str) -> None:
    """Ricalcola `points_scored` (campo derivato, backend §11) dal delta di
    punteggio — non va mai preso dall'OCR, ricalcolato ogni volta che
    `score_start`/`score_end` cambiano, anche dopo una correzione manuale."""

    team_index = 0 if turn.team_id == team_a_id else 1
    turn.points_scored = C.points_scored_by(team_index, turn.score_start.value, turn.score_end.value)


# ---------------------------------------------------------------------------
# Funzione core: applica la correzione, ricalcola i derivati, marca come
# risolta l'eventuale ambiguità residua tracciata dal parser. Funziona sia su
# `ParsedSet` (ha `resolution_for`) sia su `SetData` (non lo ha: la
# neutralizzazione dell'ambiguità è no-op, coerente col fatto che quella
# provenienza semplicemente non esiste per un'Analysis persistita).
# ---------------------------------------------------------------------------


def apply_manual_correction(
    container: SetLike, field_id: str, raw_value: object, *, team_a_id: str
) -> tuple[object, object]:
    """Ritorna `(valore_precedente, valore_applicato)`. Alza `InvalidFieldValueError`
    se il campo non esiste o il valore non è valido per il suo tipo."""

    location = _locate_field(container, field_id)
    if location is None:
        raise InvalidFieldValueError(
            f"Campo '{field_id}' non trovato.", details={"field_id": field_id}
        )

    coerced = _coerce_value(location.kind, raw_value, field_id)
    previous_value = location.extracted_value.value

    location.extracted_value.value = coerced
    location.extracted_value.manually_confirmed = True

    if location.kind in ("turn_score_start", "turn_score_end") and location.turn is not None:
        _recompute_turn_points(location.turn, team_a_id=team_a_id)

    resolution_for = getattr(container, "resolution_for", None)
    if callable(resolution_for):
        resolution: Optional[CandidateResolution] = resolution_for(field_id)
        if resolution is not None:
            # Un umano ha scelto il valore: un'ambiguità residua non ha più
            # senso, va segnalata come confermata invece che come warning
            # ancora aperto (backend §26 riguarda letture non confermate).
            resolution.ambiguous = False
            resolution.resolved_by_constraint = False
            resolution.constraint = None
            resolution.status = CheckStatus.VALID
            resolution.reason = REASON_MANUALLY_CONFIRMED
            resolution.selected_value = str(coerced) if coerced is not None else None

    return previous_value, coerced


# ---------------------------------------------------------------------------
# Shim ParsedSet per rivalidare una SetData persistita senza `resolutions`
# (vedi nota di modulo). Le risoluzioni sintetiche non sono mai ambigue: è
# una degradazione nota, non un tentativo di inventare provenienza che non
# c'è.
# ---------------------------------------------------------------------------


def _shim_resolution(ev: ExtractedValue) -> CandidateResolution:
    return CandidateResolution(
        field_id=ev.id,
        selected_value=str(_json_safe(ev.value)) if ev.value is not None else None,
        selected_confidence=ev.confidence,
        ambiguous=False,
        resolved_by_constraint=False,
        status=CheckStatus.VALID,
        reason=REASON_MANUALLY_CONFIRMED if ev.manually_confirmed else "persisted-value",
    )


def _build_validation_shim(set_data: SetData, *, team_a_id: str, team_b_id: str) -> ParsedSet:
    resolutions: list[CandidateResolution] = []
    for six in (set_data.team_a_starting_six, set_data.team_b_starting_six):
        for position in _POSITIONS:
            resolutions.append(_shim_resolution(getattr(six, position)))
    for turn in set_data.service_turns:
        for ev in (turn.player, turn.rotation, turn.score_start, turn.score_end):
            resolutions.append(_shim_resolution(ev))

    return ParsedSet(
        number=set_data.number,
        team_a_id=team_a_id,
        team_b_id=team_b_id,
        starting_team_id=set_data.starting_team_id,
        team_a_starting_six=set_data.team_a_starting_six,
        team_b_starting_six=set_data.team_b_starting_six,
        service_turns=set_data.service_turns,
        reported_final_score=set_data.final_score,
        resolutions=resolutions,
    )


def revalidate_set_data(set_data: SetData, *, team_a_id: str, team_b_id: str) -> ValidationResult:
    """Rilancia il validator sul set interessato (backend §13.7) e aggiorna
    anche lo stato per-turno che il validator porta sui `ServiceTurn`."""

    shim = _build_validation_shim(set_data, team_a_id=team_a_id, team_b_id=team_b_id)
    result = validate_set(shim)
    # `_escalate_turn_status` dentro validate_set muta gli oggetti ServiceTurn
    # dello shim: sono gli stessi oggetti di set_data.service_turns (passati
    # per riferimento), ma li resincronizziamo esplicitamente per non
    # dipendere da un dettaglio implementativo di pydantic.
    for turn, shim_turn in zip(set_data.service_turns, shim.service_turns):
        turn.status = shim_turn.status
    set_data.validation = result
    return result


def recompute_global_validation(analysis: Analysis) -> None:
    """Rilancia, se necessario, la validazione globale della partita (backend
    §13.8): aggrega lo stato peggiore e tutti i check di tutti i set."""

    if not analysis.sets:
        analysis.overall_validation = CheckStatus.VALID
        analysis.validation = ValidationResult(status=CheckStatus.VALID, checks=[])
        return

    all_checks: list[ValidationCheck] = []
    for set_data in analysis.sets:
        all_checks.extend(set_data.validation.checks)
    status = worst_status(set_data.validation.status for set_data in analysis.sets)
    analysis.overall_validation = status
    analysis.validation = ValidationResult(status=status, checks=all_checks)


# ---------------------------------------------------------------------------
# FieldUpdateService — orchestrazione lato API (repository + field_edits).
# ---------------------------------------------------------------------------


class FieldUpdateService:
    """Implementazione reale di PATCH campo / reset-corrections / reanalyze
    (backend §13, §15, §16) sopra lo scaffold mock di B1.

    Riusa `AnalysisService` solo per le parti che non competono a questo
    task (accesso al record via repository, riavvio della pipeline mock per
    `reanalyze`) — non ne reimplementa la logica di persistenza di base, la
    estende con ricalcolo dei derivati, rivalidazione e log delle correzioni.
    """

    def __init__(self, analysis_service: AnalysisService, field_edits: FieldEditRepository) -> None:
        self._analysis_service = analysis_service
        # `AnalysisService._repository` è privato: lo leggiamo invece di
        # duplicare il wiring del repository, perché `analysis_service.py`
        # resta fuori dal perimetro di modifica di questo task (vedi nota di
        # modulo). Nessuno stato viene mutato qui, solo letto.
        self._repository: AnalysisRepository = analysis_service._repository  # type: ignore[attr-defined]
        self._field_edits = field_edits

    def _get_record_or_raise(self, analysis_id: str):
        record = self._repository.get(analysis_id)
        if record is None:
            raise AnalysisNotFoundError(f"Analysis '{analysis_id}' non trovata.")
        return record

    # -- PATCH /fields/{field_id} (backend §13) ---------------------------

    def patch_field(self, analysis_id: str, field_id: str, value: object) -> Analysis:
        record = self._get_record_or_raise(analysis_id)
        if record.status != AnalysisGlobalStatus.READY.value:
            raise InvalidFieldValueError(
                "L'analisi non è ancora pronta: attendere lo stato READY prima di "
                "correggere un campo.",
                details={"analysis_id": analysis_id, "status": record.status},
            )

        analysis = Analysis.model_validate(record.analysis_json or {})
        location = _locate_field_in_analysis(analysis, field_id)
        if location is None:
            raise InvalidFieldValueError(
                f"Campo '{field_id}' non trovato.", details={"field_id": field_id}
            )
        set_index, _ = location

        previous_value, coerced = apply_manual_correction(
            analysis.sets[set_index], field_id, value, team_a_id=analysis.match.team_a.id
        )

        revalidate_set_data(
            analysis.sets[set_index],
            team_a_id=analysis.match.team_a.id,
            team_b_id=analysis.match.team_b.id,
        )
        recompute_global_validation(analysis)

        self._repository.update_analysis_json(analysis_id, analysis.model_dump(mode="json"))
        self._field_edits.record(
            analysis_id=analysis_id,
            field_id=field_id,
            previous_value=_json_safe(previous_value),
            new_value=_json_safe(coerced),
        )
        return analysis

    # -- POST /reset-corrections (backend §15) -----------------------------

    def reset_corrections(self, analysis_id: str) -> Analysis:
        record = self._get_record_or_raise(analysis_id)
        analysis = Analysis.model_validate(record.analysis_json or {})

        for set_data in analysis.sets:
            for six in (set_data.team_a_starting_six, set_data.team_b_starting_six):
                for position in _POSITIONS:
                    ev = getattr(six, position)
                    ev.value = ev.original_value
                    ev.manually_confirmed = False
            for turn in set_data.service_turns:
                for ev in (turn.player, turn.rotation, turn.score_start, turn.score_end):
                    ev.value = ev.original_value
                    ev.manually_confirmed = False
                _recompute_turn_points(turn, team_a_id=analysis.match.team_a.id)
            revalidate_set_data(
                set_data,
                team_a_id=analysis.match.team_a.id,
                team_b_id=analysis.match.team_b.id,
            )
        recompute_global_validation(analysis)

        self._repository.update_analysis_json(analysis_id, analysis.model_dump(mode="json"))
        self._field_edits.clear_for_analysis(analysis_id)
        return analysis

    # -- POST /reanalyze (backend §16) --------------------------------------

    def reanalyze(self, analysis_id: str, background_tasks: BackgroundTasks) -> None:
        # Il riavvio della pipeline (mock in B1, parser reale in futuro) resta
        # responsabilità di `AnalysisService.reanalyze` — qui aggiungiamo solo
        # ciò che compete a questo task: azzerare lo storico delle correzioni
        # manuali, che con la rianalisi non hanno più senso (backend §16:
        # "per l'MVP è accettabile azzerare le correzioni dopo la conferma
        # del frontend" — la conferma è già responsabilità del frontend
        # prima di chiamare questo endpoint).
        self._analysis_service.reanalyze(analysis_id, background_tasks)
        self._field_edits.clear_for_analysis(analysis_id)


def _locate_field_in_analysis(analysis: Analysis, field_id: str) -> Optional[tuple[int, FieldLocation]]:
    for set_index, set_data in enumerate(analysis.sets):
        location = _locate_field(set_data, field_id)
        if location is not None:
            return set_index, location
    return None


# ---------------------------------------------------------------------------
# Dipendenza FastAPI — costruisce il servizio senza toccare `main.py`: la
# session factory SQLAlchemy è la stessa già usata da
# `SqliteAnalysisRepository` (stesso file DB), letta dall'istanza esistente.
# ---------------------------------------------------------------------------


def _field_edit_repository_for(analysis_service: AnalysisService) -> FieldEditRepository:
    repository = analysis_service._repository  # type: ignore[attr-defined]
    session_factory = getattr(repository, "_session_factory", None)
    if session_factory is None:
        raise RuntimeError(
            "AnalysisRepository non espone una session factory SQLAlchemy compatibile "
            "con SqliteFieldEditRepository."
        )
    return SqliteFieldEditRepository(session_factory)


def get_field_update_service(request: Request) -> FieldUpdateService:
    analysis_service: AnalysisService = request.app.state.analysis_service
    field_edits = _field_edit_repository_for(analysis_service)
    return FieldUpdateService(analysis_service, field_edits)
