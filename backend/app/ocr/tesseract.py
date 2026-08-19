"""Wrapper sottile su pytesseract, pensato per l'OCR *mirato* di piccole celle.

Backend §20 è esplicito: «Evita OCR indiscriminato della pagina intera quando
non necessario». Qui non esiste nessuna funzione che faccia l'OCR di una pagina:
l'unico ingresso è un ritaglio già individuato dal layout detector, insieme
all'`ExpectedType` che dice *cosa* ci si aspetta di leggere. L'`ExpectedType`
diventa un profilo Tesseract (page segmentation mode + whitelist di caratteri),
che è il singolo intervento che alza di più l'accuratezza su celle di 1-2
caratteri.

Ogni lettura restituisce più `ObservationCandidate` (backend §23): ogni profilo
prova due page segmentation mode e i risultati discordanti diventano candidati
alternativi invece di essere silenziosamente scartati. Risolverli è compito del
validator pallavolistico con i vincoli di dominio (backend §26), non nostro.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Optional, Sequence

import cv2
import numpy as np
import pytesseract

from app.domain.raw_observation import ExpectedType, ObservationCandidate

#: Numero di maglia ammesso dal regolamento FIPAV: 1-99, quindi 1 o 2 cifre.
_PLAYER_NUMBER_RE = re.compile(r"^\d{1,2}$")


@dataclass(frozen=True)
class OcrProfile:
    """Come leggere una certa classe di contenuto.

    `psms` sono i page segmentation mode da provare in ordine; `whitelist`
    limita l'alfabeto (vuota = nessun limite); `fallback_psms` viene usato solo
    se i primi non producono nulla — tipicamente `--psm 10` (carattere singolo),
    che su una cella con due cifre è dannoso ma su una cella con una sola cifra
    salva la lettura.
    """

    psms: tuple[int, ...]
    whitelist: str = ""
    fallback_psms: tuple[int, ...] = ()
    #: se True binarizza sempre (celle su fondo grigio, come la colonna "SET")
    force_binarize: bool = False


#: Un profilo per ExpectedType. Le whitelist sono deliberatamente strette: su
#: una cella "17" senza whitelist Tesseract propone volentieri "l7" o "1?".
PROFILES: dict[ExpectedType, OcrProfile] = {
    ExpectedType.PLAYER_NUMBER: OcrProfile(
        psms=(7, 8), whitelist="0123456789", fallback_psms=(10,)
    ),
    ExpectedType.SCORE: OcrProfile(psms=(7, 8), whitelist="0123456789:-"),
    ExpectedType.ROTATION_LABEL: OcrProfile(psms=(10, 7), whitelist="IVX"),
    ExpectedType.TEAM_NAME: OcrProfile(psms=(7, 6), whitelist=""),
    ExpectedType.MATCH_META: OcrProfile(psms=(6, 7), whitelist=""),
    ExpectedType.SERVING_TEAM_INDICATOR: OcrProfile(
        psms=(10,), whitelist="SRX", force_binarize=True
    ),
}

_DEFAULT_PROFILE = OcrProfile(psms=(7,), whitelist="")


@dataclass(frozen=True)
class OcrResult:
    """Esito della lettura di una singola regione.

    `candidates` è ordinato per confidence decrescente ed è già nella forma che
    finisce in `RawObservation.candidates`. `text` è la lettura migliore (stringa
    vuota se la cella è risultata vuota) e `confidence` la sua confidence.
    """

    text: str
    confidence: float
    candidates: list[ObservationCandidate] = field(default_factory=list)
    debug: dict = field(default_factory=dict)

    @property
    def is_empty(self) -> bool:
        return not self.text


class TesseractNotAvailable(RuntimeError):
    """Il binario `tesseract` non è raggiungibile sul PATH."""


@lru_cache(maxsize=1)
def tesseract_version() -> str:
    try:
        return str(pytesseract.get_tesseract_version())
    except Exception as exc:  # pragma: no cover - dipende dall'ambiente
        raise TesseractNotAvailable(str(exc)) from exc


def is_available() -> bool:
    try:
        tesseract_version()
    except TesseractNotAvailable:
        return False
    return True


def _normalize(text: str, expected_type: Optional[ExpectedType]) -> str:
    """Pulizia minima e *non distruttiva* della stringa OCR.

    Volutamente non "corregge" nulla di semantico (nessun 8→3, nessun O→0):
    backend §25 vieta di sistemare in silenzio dati ambigui. Ci limitiamo a
    togliere spazi e caratteri che il profilo non poteva comunque produrre.
    """

    text = text.strip().replace("\n", " ")
    if expected_type is ExpectedType.PLAYER_NUMBER:
        return re.sub(r"\D", "", text)
    if expected_type is ExpectedType.SCORE:
        return re.sub(r"[^\d:\-]", "", text)
    if expected_type is ExpectedType.ROTATION_LABEL:
        return re.sub(r"[^IVX]", "", text.upper())
    # Per i tipi testuali gli spazi separano i token e servono: si comprimono,
    # non si eliminano (altrimenti "SQ. AZIMUT GIO" diventa inseparabile).
    return re.sub(r"\s+", " ", text).strip()


def is_valid_player_number(value: str) -> bool:
    """Un candidato plausibile come numero di maglia (1-99, senza zeri iniziali).

    Usato anche dal layout detector per riconoscere *quale* riga della griglia
    è la riga dei giocatori titolari, senza dipendere da coordinate fisse.
    """

    if not _PLAYER_NUMBER_RE.match(value):
        return False
    return 1 <= int(value) <= 99


class TesseractOcr:
    """Motore OCR per regioni. Stateless a parte i parametri di preprocessing.

    Implementa anche il protocollo `LayoutProbe` di `app.layout.detector`
    (`read_text`), così il layout detector può ancorarsi al testo delle etichette
    del referto ("Giocatori titolari N°") invece che a coordinate assolute.
    """

    def __init__(
        self,
        *,
        lang: str = "eng",
        upscale: float = 3.0,
        border: int = 25,
        min_confidence: float = 0.0,
        max_side: int = 2200,
        cache_size: int = 4096,
    ) -> None:
        self.lang = lang
        self.upscale = upscale
        self.border = border
        self.min_confidence = min_confidence
        self.max_side = max_side
        # Il layout detector valuta finestre di colonne SOVRAPPOSTE per capire
        # quali sono le sei della formazione, e la pipeline rilegge poi le celle
        # scelte: la stessa cella arriva quindi a Tesseract più volte. La cache
        # sul contenuto del ritaglio è trasparente (nessun risultato cambia) ed
        # elimina il grosso del costo, che è dominato dai processi Tesseract.
        self.cache_size = cache_size
        self._cache: dict[tuple, OcrResult] = {}

    # ------------------------------------------------------------------ utils

    def _config(self, psm: int, whitelist: str) -> str:
        parts = [f"--oem 3 --psm {psm}"]
        if whitelist:
            parts.append(f"-c tessedit_char_whitelist={whitelist}")
        # Su celle piccolissime il dizionario inglese fa più danni che bene:
        # trasforma "17" in parole. Lo disattiviamo sempre.
        parts.append("-c load_system_dawg=0 -c load_freq_dawg=0")
        return " ".join(parts)

    def _preprocess(self, image: np.ndarray, profile: OcrProfile) -> np.ndarray:
        """Upscale + margine bianco (+ binarizzazione se serve).

        - l'upscale porta un glifo da ~35px a ~100px di altezza, la fascia in cui
          Tesseract è tarato;
        - il margine bianco evita che un glifo attaccato al bordo del ritaglio
          venga scartato come rumore;
        - la binarizzazione Otsu serve solo quando il fondo non è bianco (celle
          su fondo grigio): applicarla sempre peggiora le cifre sottili.
        """

        if image.size == 0:
            return image
        img = image
        if img.ndim == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        needs_binarize = profile.force_binarize or float(np.median(img)) < 200.0
        if needs_binarize:
            _, img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        # L'upscale serve alle celle piccole (una cifra di 30px diventa 90px).
        # Su un ritaglio già grande — le sonde di etichetta che il layout
        # detector usa per ancorarsi — è solo tempo di CPU buttato, e a 300dpi
        # quelle strisce sono già oltre la dimensione ottimale per Tesseract:
        # il fattore viene quindi limitato in modo che il lato lungo non superi
        # `max_side`.
        scale = self.upscale or 1.0
        if self.max_side:
            longest = max(img.shape[:2]) or 1
            scale = min(scale, max(1.0, self.max_side / longest))
        if scale > 1.0:
            img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        if self.border:
            img = cv2.copyMakeBorder(
                img,
                self.border,
                self.border,
                self.border,
                self.border,
                cv2.BORDER_CONSTANT,
                value=255,
            )
        return img

    def _run(self, image: np.ndarray, psm: int, whitelist: str) -> tuple[str, float]:
        """Una singola invocazione di Tesseract → (testo, confidence 0..1)."""

        data = pytesseract.image_to_data(
            image,
            lang=self.lang,
            config=self._config(psm, whitelist),
            output_type=pytesseract.Output.DICT,
        )
        words: list[str] = []
        confs: list[float] = []
        for word, conf in zip(data.get("text", []), data.get("conf", [])):
            word = str(word).strip()
            if not word:
                continue
            try:
                value = float(conf)
            except (TypeError, ValueError):
                continue
            if value < 0:  # -1 = Tesseract non ha assegnato confidence
                continue
            words.append(word)
            confs.append(value)
        if not words:
            return "", 0.0
        return " ".join(words), float(np.mean(confs)) / 100.0

    # ------------------------------------------------------------------- API

    def read(
        self,
        image: np.ndarray,
        expected_type: Optional[ExpectedType] = None,
        *,
        profile: Optional[OcrProfile] = None,
    ) -> OcrResult:
        """OCR di UN ritaglio di regione, con candidati e confidence.

        Formula della confidence (backend §27 chiede che sia semplice e
        documentata):

            confidence = conf_tesseract_max * (0.5 + 0.5 * voti / tentativi)

        dove `voti` è il numero di page segmentation mode che hanno letto quel
        valore. Un valore su cui tutti i psm concordano conserva la confidence
        di Tesseract; un valore letto da un solo psm su due viene scontato del
        25%. L'accordo tra letture indipendenti è l'unico segnale di affidabilità
        disponibile a questo livello — quello pallovolistico arriva dopo.
        """

        if profile is None:
            profile = PROFILES.get(expected_type, _DEFAULT_PROFILE) if expected_type else _DEFAULT_PROFILE
        if image is None or image.size == 0:
            return OcrResult(text="", confidence=0.0, candidates=[])

        cache_key: Optional[tuple] = None
        if self.cache_size:
            cache_key = (expected_type, profile, image.shape, hash(image.tobytes()))
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached

        prepared = self._preprocess(image, profile)
        readings: list[tuple[str, float, int]] = []
        for psm in profile.psms:
            raw, conf = self._run(prepared, psm, profile.whitelist)
            value = _normalize(raw, expected_type)
            if value:
                readings.append((value, conf, psm))
        if not readings:
            for psm in profile.fallback_psms:
                raw, conf = self._run(prepared, psm, profile.whitelist)
                value = _normalize(raw, expected_type)
                if value:
                    readings.append((value, conf, psm))

        attempts = max(1, len(profile.psms))
        grouped: dict[str, list[float]] = {}
        for value, conf, _psm in readings:
            grouped.setdefault(value, []).append(conf)

        candidates: list[ObservationCandidate] = []
        for value, confs in grouped.items():
            agreement = 0.5 + 0.5 * (len(confs) / attempts)
            score = max(confs) * min(1.0, agreement)
            if score >= self.min_confidence:
                candidates.append(ObservationCandidate(value=value, confidence=round(score, 4)))
        candidates.sort(key=lambda c: (-c.confidence, c.value))

        best = candidates[0] if candidates else None
        result = OcrResult(
            text=best.value if best else "",
            confidence=best.confidence if best else 0.0,
            candidates=candidates,
            debug={"readings": readings, "psms": list(profile.psms)},
        )
        if cache_key is not None:
            if len(self._cache) >= self.cache_size:
                self._cache.clear()
            self._cache[cache_key] = result
        return result

    def read_many(
        self, images: Sequence[np.ndarray], expected_type: ExpectedType
    ) -> list[OcrResult]:
        return [self.read(image, expected_type) for image in images]

    # ------------------------------------------- protocollo LayoutProbe

    def read_text(self, image: np.ndarray, *, multiline: bool = False) -> str:
        """Lettura testuale libera di un ritaglio, per l'ancoraggio del layout.

        Non passa da `_normalize` (che comprime gli spazi) perché qui il testo
        serve per il match delle etichette del referto, dove gli spazi contano.
        """

        if image is None or image.size == 0:
            return ""
        prepared = self._preprocess(image, _DEFAULT_PROFILE)
        raw, _conf = self._run(prepared, 6 if multiline else 7, "")
        return raw.strip()
