"""Orchestratore dell'estrazione REALE: PDF caricato → `Analysis` pubblica.

Questo modulo è il pezzo che mancava fra i componenti già implementati e
l'applicazione. Collega, nell'ordine di backend §18-§28:

    inspect_pdf                      (app/pdf/inspector)
      ├─ text layer utilizzabile  →  app/extraction/text  (generic + header)
      └─ altrimenti               →  app/extraction/raster (render + layout + OCR)
                                     ↓
                              list[RawObservation]        (app/domain)
                                     ↓
                              parse_set → ParsedSet       (app/volleyball/parser)
                                     ↓
                              validate_set                (app/volleyball/validator)
                                     ↓
                              Analysis / SetData / SourceRegion  (app/models)

## Che cosa la pipeline reale estrae davvero, oggi

| dato                            | text layer | raster/OCR |
|---------------------------------|-----------|------------|
| sestetti iniziali I-VI          | sì        | sì         |
| punteggio finale di ogni set    | sì        | sì         |
| nomi squadra                    | sì (testo esatto) | approssimativo (OCR della fascia titolo) |
| campionato/gara/data/ora/luogo  | sì        | no         |
| sostituzioni                    | **no**    | **no**     |
| punteggio al cambio di campo    | **no**    | **no**     |
| turni di servizio               | **no**    | **no**     |
| prima squadra al servizio       | **no**    | **no**     |

I campi non estratti **restano vuoti**: `service_turns` è una lista vuota,
`starting_team_id` è la stringa vuota, `MatchInfo` ha `None` dove non c'è
lettura. Nessuno viene riempito con valori generati o plausibili — un dato
inventato presentato come estratto è il bug peggiore possibile per un prodotto
che vive di verificabilità (backend §25, ultima riga). Ogni set porta un
`ValidationCheck` `fields-not-extracted` che dice esplicitamente cosa manca, in
modo che il frontend possa mostrare "non disponibile" invece di un buco muto.

## Associazione formazione ↔ squadra

Il referto FIPAV stampa due formazioni affiancate per ogni riquadro set, e le
squadre si scambiano di campo fra i set: la formazione di *sinistra* non è
sempre la stessa squadra. L'estrazione produce quindi "slot" posizionali (A =
sinistra, B = destra) che vanno associati alle squadre:

1. nel primo set giocato, slot A ⇒ squadra A del referto (assunzione verificata
   su entrambe le fixture reali, dove il riquadro del Set 1 ha a sinistra la
   squadra marcata "A" nell'header pagina);
2. nei set successivi l'associazione è dedotta dai **numeri di maglia**: si
   scelgono le due assegnazioni che massimizzano la sovrapposizione complessiva
   con i sestetti del primo set. È un criterio molto più solido dell'OCR dei
   nomi squadra (che sul percorso raster è troncato) e su entrambe le fixture
   separa i due casi con largo margine;
3. a parità di sovrapposizione si usa come spareggio la somiglianza fra i nomi
   letti nella fascia titolo del riquadro, e se anche quella è muta si mantiene
   l'ordine posizionale segnalandolo con un check di validazione.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Sequence

from app.core.logging import get_logger
from app.domain.raw_observation import ExpectedType, ObservationCandidate, RawObservation
from app.models.analysis import Analysis, AnalysisGlobalStatus
from app.models.common import CheckStatus, ExtractionMethod, SourceRegion
from app.models.match import (
    MatchInfo,
    SetData,
    Team,
    ValidationCheck,
    ValidationResult,
)
from app.pdf.inspector import PdfCapabilities, inspect_pdf
from app.volleyball import constraints as C
from app.volleyball.parser import parse_set, worst_status
from app.volleyball.validator import validate_set

logger = get_logger(__name__)

TEAM_A_ID = "team-a"
TEAM_B_ID = "team-b"

#: Nome mostrato quando la squadra non è stata letta. Deliberatamente NON un
#: nome plausibile: l'utente deve vedere che il campo è vuoto, non fidarsi.
UNKNOWN_TEAM_NAME = "—"

#: Sotto questa confidence il nome squadra è dichiarato "da verificare".
TEAM_NAME_VERIFY_THRESHOLD = 0.75

_SLOT_A = "A"
_SLOT_B = "B"
_SLOTS = (_SLOT_A, _SLOT_B)

#: `region-p0-set1-team-0-III` (percorso text layer, app/extraction/text/generic.py)
_TEXT_FORMATION_RE = re.compile(
    r"^region-p(?P<page>\d+)-set(?P<set>\d+)-team-(?P<slot>[01])-(?P<position>VI|IV|III|II|V|I)$"
)
#: `p1-set1-formation-a-III` (percorso raster, app/layout/detector.py)
_RASTER_FORMATION_RE = re.compile(
    r"^p(?P<page>\d+)-set(?P<set>\d+)-formation-(?P<slot>[ab])-(?P<position>VI|IV|III|II|V|I)$"
)
#: `p1-final_result-set1-score-a`
_RASTER_SCORE_RE = re.compile(r"-set(?P<set>\d+)-score-(?P<slot>[ab])$")
#: `p1-set1-team-a`
_RASTER_TEAM_NAME_RE = re.compile(r"^p(?P<page>\d+)-set(?P<set>\d+)-team-(?P<slot>[ab])$")


class ExtractionFailedError(RuntimeError):
    """L'estrazione reale non ha prodotto nulla di utilizzabile.

    Non è un errore tecnico (quelli si propagano come sono): è il caso "questo
    PDF non è un referto che sappiamo leggere". Chi chiama decide se fallire o
    ripiegare, ma non deve mai spacciare per reale un risultato che non c'è.
    """


# ---------------------------------------------------------------------------
# Rappresentazione intermedia comune ai due percorsi di estrazione
# ---------------------------------------------------------------------------


@dataclass
class SlotFormation:
    """Sestetto letto per uno slot posizionale (A = sinistra, B = destra)."""

    #: posizione I-VI → candidati di lettura, nell'ordine prodotto dall'estrattore
    positions: dict[str, list[ObservationCandidate]] = field(default_factory=dict)
    #: posizione I-VI → id della SourceRegion da cui viene la lettura
    region_ids: dict[str, str] = field(default_factory=dict)

    def numbers(self) -> set[int]:
        """Numeri di maglia della lettura migliore, per il confronto fra set."""

        out: set[int] = set()
        for candidates in self.positions.values():
            if not candidates:
                continue
            best = max(candidates, key=lambda c: c.confidence)
            number = C.parse_player_number(best.value)
            if C.is_plausible_player_number(number):
                out.add(number)  # type: ignore[arg-type]
        return out


@dataclass
class SetBoxReading:
    """Tutto ciò che è stato letto per un riquadro set, ancora in slot A/B."""

    set_number: int
    formations: dict[str, SlotFormation] = field(default_factory=dict)
    #: punteggio finale del set nell'ordine (squadra A, squadra B) — viene dalla
    #: tabella "RISULTATO FINALE", le cui colonne sono per squadra e NON per
    #: lato di campo (vedi `_score_for_teams`)
    score: Optional[tuple[int, int]] = None
    #: nome squadra letto nella fascia titolo del riquadro, per slot
    team_names: dict[str, ObservationCandidate] = field(default_factory=dict)

    def has_content(self) -> bool:
        """Un riquadro senza nemmeno un numero letto e senza punteggio è un set
        non giocato: non deve comparire nell'`Analysis` come set vuoto."""

        any_number = any(formation.numbers() for formation in self.formations.values())
        return any_number or self.score is not None


@dataclass
class MatchMeta:
    competition: Optional[str] = None
    match_number: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    venue: Optional[str] = None


@dataclass
class DocumentReading:
    """Esito neutro di un percorso di estrazione, prima dell'interpretazione."""

    method: ExtractionMethod
    sets: list[SetBoxReading] = field(default_factory=list)
    regions: list[SourceRegion] = field(default_factory=list)
    #: nomi squadra a livello di pagina (header "SQUADRE"), per slot A/B
    match_team_names: dict[str, ObservationCandidate] = field(default_factory=dict)
    meta: MatchMeta = field(default_factory=MatchMeta)
    diagnostics: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Percorso text layer
# ---------------------------------------------------------------------------


def _read_text_layer(pdf_path: Path) -> DocumentReading:
    from app.extraction.text.generic import extract_generic_text_observations
    from app.extraction.text.header import extract_header_context

    generic = extract_generic_text_observations(pdf_path)
    header = extract_header_context(pdf_path)

    boxes: dict[int, SetBoxReading] = {}
    for observation in generic.observations:
        match = _TEXT_FORMATION_RE.match(observation.region_id)
        if match is None:
            continue
        set_number = int(match.group("set"))
        slot = _SLOT_A if match.group("slot") == "0" else _SLOT_B
        box = boxes.setdefault(set_number, SetBoxReading(set_number=set_number))
        formation = box.formations.setdefault(slot, SlotFormation())
        position = match.group("position")
        formation.positions[position] = list(observation.candidates)
        formation.region_ids[position] = observation.region_id

    for reading in header.set_scores:
        box = boxes.setdefault(reading.set_number, SetBoxReading(set_number=reading.set_number))
        box.score = (reading.score_a, reading.score_b)

    match_names = {
        reading.slot: ObservationCandidate(value=reading.value, confidence=reading.confidence)
        for reading in header.team_names
    }

    return DocumentReading(
        method=ExtractionMethod.PDF_TEXT,
        sets=[boxes[number] for number in sorted(boxes)],
        regions=list(generic.regions) + list(header.regions),
        match_team_names=match_names,
        meta=MatchMeta(
            competition=header.meta.competition,
            match_number=header.meta.match_number,
            date=header.meta.date,
            time=header.meta.time,
            venue=header.meta.venue,
        ),
        diagnostics={
            "path": "text-layer",
            "n_observations": len(generic.observations),
            "n_regions": len(generic.regions) + len(header.regions),
            "set_boxes": sorted(boxes),
        },
    )


# ---------------------------------------------------------------------------
# Percorso raster / OCR
# ---------------------------------------------------------------------------


def _read_raster(pdf_path: Path, *, debug: bool) -> DocumentReading:
    from app.extraction.raster.pipeline import extract_raster

    result = extract_raster(pdf_path, debug=debug)

    boxes: dict[int, SetBoxReading] = {}
    for observation in result.observations:
        region_id = observation.region_id
        formation = _RASTER_FORMATION_RE.match(region_id)
        if formation is not None:
            set_number = int(formation.group("set"))
            slot = formation.group("slot").upper()
            box = boxes.setdefault(set_number, SetBoxReading(set_number=set_number))
            slot_formation = box.formations.setdefault(slot, SlotFormation())
            position = formation.group("position")
            slot_formation.positions[position] = list(observation.candidates)
            slot_formation.region_ids[position] = region_id
            continue

        name = _RASTER_TEAM_NAME_RE.match(region_id)
        if name is not None and observation.candidates:
            set_number = int(name.group("set"))
            slot = name.group("slot").upper()
            box = boxes.setdefault(set_number, SetBoxReading(set_number=set_number))
            box.team_names[slot] = max(observation.candidates, key=lambda c: c.confidence)
            continue

    # I punteggi vivono nella macroregione "RISULTATO FINALE", non nel riquadro
    # set: si raccolgono a parte e si riuniscono per numero di set.
    scores: dict[int, dict[str, int]] = {}
    for observation in result.observations:
        if observation.expected_type is not ExpectedType.SCORE:
            continue
        match = _RASTER_SCORE_RE.search(observation.region_id)
        if match is None or not observation.candidates:
            continue
        best = max(observation.candidates, key=lambda c: c.confidence)
        if not best.value.isdigit():
            continue
        scores.setdefault(int(match.group("set")), {})[match.group("slot").upper()] = int(best.value)
    for set_number, slots in scores.items():
        if _SLOT_A in slots and _SLOT_B in slots:
            box = boxes.setdefault(set_number, SetBoxReading(set_number=set_number))
            box.score = (slots[_SLOT_A], slots[_SLOT_B])

    return DocumentReading(
        method=ExtractionMethod.OCR,
        sets=[boxes[number] for number in sorted(boxes)],
        regions=list(result.regions),
        # Il percorso raster non legge l'header pagina: i nomi squadra vengono
        # solo dalle fasce titolo dei riquadri set, slot per slot.
        match_team_names={},
        meta=MatchMeta(),
        diagnostics={"path": "raster-ocr", **result.diagnostics},
    )


# ---------------------------------------------------------------------------
# Associazione slot ↔ squadra
# ---------------------------------------------------------------------------


def _name_similarity(candidate: Optional[ObservationCandidate], name: Optional[str]) -> float:
    """Somiglianza grezza fra un nome letto e un nome noto: frazione di prefisso
    condiviso, sulle sole lettere maiuscole. Serve solo come spareggio."""

    if candidate is None or not name:
        return 0.0
    a = re.sub(r"[^A-Z]", "", candidate.value.upper())
    b = re.sub(r"[^A-Z]", "", name.upper())
    if not a or not b:
        return 0.0
    shared = 0
    for x, y in zip(a, b):
        if x != y:
            break
        shared += 1
    return shared / max(len(a), len(b))


def _assign_slots(
    boxes: Sequence[SetBoxReading],
) -> tuple[dict[int, dict[str, str]], list[int]]:
    """slot A/B → team id, per ogni set. Ritorna anche i set assegnati per
    ordine posizionale perché nessun criterio ha saputo decidere."""

    played = [box for box in boxes if box.has_content()]
    assignment: dict[int, dict[str, str]] = {}
    ambiguous: list[int] = []
    if not played:
        return assignment, ambiguous

    reference = played[0]
    assignment[reference.set_number] = {_SLOT_A: TEAM_A_ID, _SLOT_B: TEAM_B_ID}
    reference_numbers = {
        TEAM_A_ID: reference.formations.get(_SLOT_A, SlotFormation()).numbers(),
        TEAM_B_ID: reference.formations.get(_SLOT_B, SlotFormation()).numbers(),
    }
    reference_names = {
        TEAM_A_ID: reference.team_names.get(_SLOT_A),
        TEAM_B_ID: reference.team_names.get(_SLOT_B),
    }

    for box in played[1:]:
        numbers = {
            slot: box.formations.get(slot, SlotFormation()).numbers() for slot in _SLOTS
        }
        straight = len(numbers[_SLOT_A] & reference_numbers[TEAM_A_ID]) + len(
            numbers[_SLOT_B] & reference_numbers[TEAM_B_ID]
        )
        swapped = len(numbers[_SLOT_A] & reference_numbers[TEAM_B_ID]) + len(
            numbers[_SLOT_B] & reference_numbers[TEAM_A_ID]
        )
        if straight == swapped:
            # Spareggio sui nomi letti nella fascia titolo del riquadro.
            straight_score = _name_similarity(
                box.team_names.get(_SLOT_A),
                reference_names[TEAM_A_ID].value if reference_names[TEAM_A_ID] else None,
            ) + _name_similarity(
                box.team_names.get(_SLOT_B),
                reference_names[TEAM_B_ID].value if reference_names[TEAM_B_ID] else None,
            )
            swapped_score = _name_similarity(
                box.team_names.get(_SLOT_A),
                reference_names[TEAM_B_ID].value if reference_names[TEAM_B_ID] else None,
            ) + _name_similarity(
                box.team_names.get(_SLOT_B),
                reference_names[TEAM_A_ID].value if reference_names[TEAM_A_ID] else None,
            )
            if swapped_score > straight_score:
                swapped = straight + 1
            elif straight_score == swapped_score:
                ambiguous.append(box.set_number)

        if swapped > straight:
            assignment[box.set_number] = {_SLOT_A: TEAM_B_ID, _SLOT_B: TEAM_A_ID}
        else:
            assignment[box.set_number] = {_SLOT_A: TEAM_A_ID, _SLOT_B: TEAM_B_ID}

    return assignment, ambiguous


# ---------------------------------------------------------------------------
# Costruzione dei set pubblici
# ---------------------------------------------------------------------------

NOT_EXTRACTED_CHECK_ID = "fields-not-extracted"
SLOT_AMBIGUOUS_CHECK_ID = "team-side-ambiguous"
TEAM_NAME_CHECK_ID = "team-name-uncertain"
FALLBACK_CHECK_ID = "pipeline-fallback"

#: Aree del referto che nessuno dei due percorsi estrae ancora. Elencarle
#: esplicitamente nel risultato è il modo di dire "non disponibile" invece di
#: lasciare che l'assenza passi per un dato letto e vuoto.
_NEVER_EXTRACTED = (
    "turni di servizio",
    "sostituzioni",
    "punteggio al cambio di campo",
    "indicatore della prima squadra al servizio",
)


def _observations_for(
    box: SetBoxReading, slot_to_team: dict[str, str], method: ExtractionMethod
) -> list[RawObservation]:
    """Rinomina le letture nella convenzione di id attesa dal parser.

    Il parser individua squadra e posizione leggendo l'id/region_id
    dell'osservazione (`app/volleyball/parser.py`), con una convenzione diversa
    da quella dei due estrattori. Qui si costruiscono osservazioni nuove con id
    canonico e **lo stesso `region_id` originale**, così che
    `ExtractedValue.source_region_id` continui a puntare alla `SourceRegion`
    reale del documento.
    """

    observations: list[RawObservation] = []
    for slot, formation in sorted(box.formations.items()):
        team_id = slot_to_team.get(slot)
        if team_id is None:
            continue
        for position in C.POSITION_ORDER:
            candidates = formation.positions.get(position)
            if not candidates:
                continue
            observations.append(
                RawObservation(
                    id=f"obs-set{box.set_number}-{team_id}-position-{position}",
                    region_id=formation.region_ids.get(position, ""),
                    expected_type=ExpectedType.PLAYER_NUMBER,
                    method=method,
                    candidates=list(candidates),
                )
            )
    return observations


def _not_extracted_check(*, missing_score: bool) -> ValidationCheck:
    missing = list(_NEVER_EXTRACTED)
    if missing_score:
        missing.insert(0, "punteggio finale del set")
    return ValidationCheck(
        id=NOT_EXTRACTED_CHECK_ID,
        label="Dati non estratti dal referto",
        status=CheckStatus.WARNING,
        message=(
            "la pipeline reale non estrae ancora: "
            + ", ".join(missing)
            + ". I campi corrispondenti sono vuoti, non stimati."
        ),
        field_ids=[],
    )


def _build_set_data(
    box: SetBoxReading,
    slot_to_team: dict[str, str],
    method: ExtractionMethod,
    *,
    side_ambiguous: bool,
) -> SetData:
    observations = _observations_for(box, slot_to_team, method)
    score_ab = _score_for_teams(box)

    parsed = parse_set(
        observations,
        set_number=box.set_number,
        team_a_id=TEAM_A_ID,
        team_b_id=TEAM_B_ID,
        reported_final_score=score_ab,
    )
    validation = validate_set(parsed)

    checks = list(validation.checks)
    checks.append(_not_extracted_check(missing_score=score_ab is None))
    if side_ambiguous:
        checks.append(
            ValidationCheck(
                id=SLOT_AMBIGUOUS_CHECK_ID,
                label="Lato di campo delle squadre incerto",
                status=CheckStatus.WARNING,
                message=(
                    "non è stato possibile stabilire quale formazione appartiene a quale "
                    "squadra: si è mantenuto l'ordine sinistra→A, destra→B, da verificare."
                ),
                field_ids=[],
            )
        )

    return SetData(
        number=box.set_number,
        # Non estratto da nessuno dei due percorsi: stringa vuota, MAI la
        # squadra A per default (sarebbe un dato inventato al 50%).
        starting_team_id="",
        team_a_starting_six=parsed.team_a_starting_six,
        team_b_starting_six=parsed.team_b_starting_six,
        # Non estratti: lista vuota, non turni sintetici.
        service_turns=[],
        final_score=score_ab if score_ab is not None else (0, 0),
        validation=ValidationResult(
            status=worst_status(check.status for check in checks), checks=checks
        ),
    )


def _score_for_teams(box: SetBoxReading) -> Optional[tuple[int, int]]:
    """Punteggio del set nell'ordine (squadra A, squadra B).

    Attenzione a non "correggere" questo ordine con l'assegnazione dei lati:
    i punteggi arrivano dalla tabella "RISULTATO FINALE", che ha due colonne
    fisse `SQUADRA A` / `SQUADRA B` valide per tutta la partita, mentre i lati
    delle formazioni dentro i riquadri set si scambiano ad ogni set. Le due
    cose non vanno mescolate: la colonna A della tabella è sempre la squadra A,
    qualunque lato occupasse in quel set.

    Vale su entrambi i percorsi: nel text layer le colonne sono ancorate
    all'intestazione stampata della tabella, nel percorso raster alle celle
    della macroregione `FINAL_RESULT` (`app/layout/detector.set_score_cells`),
    che è quella stessa tabella.
    """

    return box.score


# ---------------------------------------------------------------------------
# Nomi squadra
# ---------------------------------------------------------------------------


def _resolve_team_names(
    reading: DocumentReading, assignment: dict[int, dict[str, str]]
) -> tuple[dict[str, tuple[str, Optional[float]]], list[ValidationCheck]]:
    """`team_id → (nome, confidence)` + i check che dichiarano l'incertezza.

    Priorità all'header pagina (testo esatto del PDF); in mancanza, si
    aggregano le letture OCR delle fasce titolo dei riquadri set, scegliendo per
    ciascuna squadra la lettura più affidabile e, a pari confidence, la più
    lunga (l'OCR di quella cella tronca il nome più spesso di quanto lo
    corrompa). Nessun nome viene mai completato o corretto a mano.
    """

    resolved: dict[str, tuple[str, Optional[float]]] = {}

    header = reading.match_team_names
    if _SLOT_A in header and _SLOT_B in header:
        resolved[TEAM_A_ID] = (header[_SLOT_A].value, header[_SLOT_A].confidence)
        resolved[TEAM_B_ID] = (header[_SLOT_B].value, header[_SLOT_B].confidence)
    else:
        per_team: dict[str, list[ObservationCandidate]] = {TEAM_A_ID: [], TEAM_B_ID: []}
        for box in reading.sets:
            slot_to_team = assignment.get(box.set_number)
            if slot_to_team is None:
                continue
            for slot, candidate in box.team_names.items():
                team_id = slot_to_team.get(slot)
                if team_id is not None:
                    per_team[team_id].append(candidate)
        for team_id, candidates in per_team.items():
            if not candidates:
                continue
            best = max(candidates, key=lambda c: (round(c.confidence, 2), len(c.value)))
            resolved[team_id] = (best.value, best.confidence)

    checks: list[ValidationCheck] = []
    uncertain: list[str] = []
    for team_id, label in ((TEAM_A_ID, "A"), (TEAM_B_ID, "B")):
        if team_id not in resolved:
            resolved[team_id] = (UNKNOWN_TEAM_NAME, None)
            uncertain.append(f"squadra {label}: nome non letto dal referto")
            continue
        name, confidence = resolved[team_id]
        if confidence is None or confidence < TEAM_NAME_VERIFY_THRESHOLD:
            uncertain.append(
                f"squadra {label}: '{name}' letto con confidence "
                f"{confidence if confidence is not None else 0.0:.2f}"
            )
        elif reading.method is ExtractionMethod.OCR:
            # Documentato in tests/test_pdf_raster.py: il ritaglio della fascia
            # titolo contiene anche "SQ.", l'orario e i cerchietti A/B, e l'OCR
            # tronca facilmente l'ultima parola. Anche con confidence alta il
            # valore va verificato.
            uncertain.append(
                f"squadra {label}: '{name}' letto via OCR dalla fascia titolo "
                "(lettura potenzialmente troncata)"
            )
    if uncertain:
        checks.append(
            ValidationCheck(
                id=TEAM_NAME_CHECK_ID,
                label="Nomi squadra da verificare",
                status=CheckStatus.WARNING,
                message="; ".join(uncertain),
                field_ids=[],
            )
        )
    return resolved, checks


def _final_result(sets: Sequence[SetData]) -> tuple[int, int]:
    """Set vinti per squadra — campo DERIVATO dai punteggi dei set estratti,
    non letto dal referto: se i punteggi mancano resta 0-0."""

    won_a = sum(1 for s in sets if s.final_score[0] > s.final_score[1])
    won_b = sum(1 for s in sets if s.final_score[1] > s.final_score[0])
    return won_a, won_b


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


@dataclass
class PipelineResult:
    analysis: Analysis
    method: ExtractionMethod
    capabilities: PdfCapabilities
    diagnostics: dict


def _debug_enabled() -> bool:
    return os.environ.get("VOLLEYREF_EXTRACTION_DEBUG", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def run_real_pipeline(
    pdf_path: str | Path, analysis_id: str, *, debug: Optional[bool] = None
) -> PipelineResult:
    """Estrae `pdf_path` e ne costruisce l'`Analysis` pubblica.

    Alza `ExtractionFailedError` se non è stato possibile ricostruire nemmeno un
    set: meglio un errore esplicito che un'`Analysis` vuota che sembra un
    referto senza dati.
    """

    path = Path(pdf_path)
    capabilities = inspect_pdf(path)
    if debug is None:
        debug = _debug_enabled()

    if capabilities.has_usable_text_layer:
        reading = _read_text_layer(path)
    else:
        reading = _read_raster(path, debug=bool(debug))

    logger.info(
        "estrazione completata",
        extra={
            "analysis_id": analysis_id,
            "method": reading.method.value,
            "has_usable_text_layer": capabilities.has_usable_text_layer,
            "diagnostics": reading.diagnostics,
        },
    )

    played = [box for box in reading.sets if box.has_content()]
    if not played:
        raise ExtractionFailedError(
            "nessun riquadro set utilizzabile trovato nel documento "
            f"(percorso {reading.method.value})"
        )

    assignment, ambiguous_sets = _assign_slots(played)
    team_names, name_checks = _resolve_team_names(reading, assignment)

    sets = [
        _build_set_data(
            box,
            assignment[box.set_number],
            reading.method,
            side_ambiguous=box.set_number in ambiguous_sets,
        )
        for box in played
    ]

    all_checks: list[ValidationCheck] = list(name_checks)
    for set_data in sets:
        all_checks.extend(set_data.validation.checks)
    overall = worst_status(check.status for check in all_checks)

    analysis = Analysis(
        id=analysis_id,
        status=AnalysisGlobalStatus.READY,
        overall_validation=overall,
        match=MatchInfo(
            competition=reading.meta.competition,
            match_number=reading.meta.match_number,
            date=reading.meta.date,
            time=reading.meta.time,
            venue=reading.meta.venue,
            team_a=Team(id=TEAM_A_ID, name=team_names[TEAM_A_ID][0]),
            team_b=Team(id=TEAM_B_ID, name=team_names[TEAM_B_ID][0]),
            final_result=_final_result(sets),
        ),
        sets=sets,
        source_regions=list(reading.regions),
        validation=ValidationResult(status=overall, checks=all_checks),
    )

    return PipelineResult(
        analysis=analysis,
        method=reading.method,
        capabilities=capabilities,
        diagnostics={
            **reading.diagnostics,
            "sets_extracted": [s.number for s in sets],
            "slot_assignment": {str(k): v for k, v in assignment.items()},
            "ambiguous_sides": ambiguous_sets,
        },
    )


def fallback_check(reason: str) -> ValidationCheck:
    """Check che marca un risultato come NON proveniente dal referto caricato.

    Status `INVALID` di proposito: dei numeri fabbricati mostrati come se
    fossero stati letti sono peggio di un'analisi mancante, quindi l'anomalia
    deve essere del livello più alto e non un warning fra tanti.
    """

    return ValidationCheck(
        id=FALLBACK_CHECK_ID,
        label="Dati simulati: estrazione reale non eseguita",
        status=CheckStatus.INVALID,
        message=(
            "questi valori NON provengono dal PDF caricato ma dalla pipeline di "
            f"fallback (motivo: {reason}). Non usarli come dati di refertazione."
        ),
        field_ids=[],
    )
