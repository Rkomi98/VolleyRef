"""Logging strutturato per il backend (backend §37).

Requisiti coperti:

- formato strutturato (JSON, una riga per record) invece di stringhe libere;
- `analysis_id` sempre presente nel payload di log quando disponibile nel
  contesto della richiesta/elaborazione corrente (via `contextvars`, così
  funziona sia nelle route sincrone che nei `BackgroundTasks` asincroni della
  pipeline, senza dover passare l'id esplicitamente in ogni chiamata di log);
- livello di log configurabile via env var `LOG_LEVEL` (default `INFO`).

Uso tipico:

    from app.core.logging import get_logger, bind_analysis_id

    logger = get_logger(__name__)

    with bind_analysis_id(analysis_id):
        logger.info("step completato", extra={"step": "DETECT_SETS"})

`app.core.errors` usa questo modulo per garantire che ogni risposta di
errore sia anche loggata con lo stesso `analysis_id` (quando estraibile dal
path della richiesta).
"""

from __future__ import annotations

import contextvars
import json
import logging
import os
import sys
from contextlib import contextmanager
from typing import Iterator, Optional

_ROOT_LOGGER_NAME = "volleyref"

_analysis_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "analysis_id", default=None
)

_configured = False


def current_analysis_id() -> Optional[str]:
    """Legge l'`analysis_id` attualmente legato al contesto (o None)."""

    return _analysis_id_var.get()


@contextmanager
def bind_analysis_id(analysis_id: Optional[str]) -> Iterator[None]:
    """Lega `analysis_id` al contesto di logging per la durata del blocco.

    Pensato per avvolgere l'intera elaborazione di una singola analysis
    (pipeline in background, handler di errore) così che ogni log emesso al
    suo interno riporti automaticamente l'id, senza doverlo ripetere in ogni
    chiamata.
    """

    token = _analysis_id_var.set(analysis_id)
    try:
        yield
    finally:
        _analysis_id_var.reset(token)


class _AnalysisIdFilter(logging.Filter):
    """Inietta `analysis_id` nel record, usando il contextvar come fallback
    se il chiamante non l'ha già passato esplicitamente via `extra=`."""

    def filter(self, record: logging.LogRecord) -> bool:
        if getattr(record, "analysis_id", None) is None:
            record.analysis_id = _analysis_id_var.get()
        return True


class _JsonFormatter(logging.Formatter):
    """Un record per riga, in JSON — analysis_id sempre presente (anche se
    None) per rendere i log grep-abili/filtrabili in modo uniforme."""

    _RESERVED = {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "message",
        "analysis_id",
        "taskName",
    }

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "analysis_id": getattr(record, "analysis_id", None),
        }
        extras = {
            key: value
            for key, value in record.__dict__.items()
            if key not in self._RESERVED and not key.startswith("_")
        }
        if extras:
            payload["extra"] = extras
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        try:
            return json.dumps(payload, default=str)
        except TypeError:
            # Non deve mai far fallire il logging stesso: fallback difensivo.
            return json.dumps({**payload, "extra": str(payload.get("extra"))}, default=str)


def configure_logging(level: Optional[str] = None) -> logging.Logger:
    """Configura (in modo idempotente) il logger radice `volleyref`.

    Il livello è preso da `level`, altrimenti dalla env var `LOG_LEVEL`,
    altrimenti `INFO`. Sicuro da richiamare più volte (es. una volta per ogni
    test che ricrea l'app): non duplica gli handler, si limita ad aggiornare
    il livello.
    """

    global _configured

    resolved_level = (level or os.environ.get("LOG_LEVEL") or "INFO").upper()
    logger = logging.getLogger(_ROOT_LOGGER_NAME)
    logger.setLevel(resolved_level)

    if not _configured:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_JsonFormatter())
        handler.addFilter(_AnalysisIdFilter())
        logger.addHandler(handler)
        logger.propagate = False
        _configured = True
    else:
        for handler in logger.handlers:
            handler.setLevel(resolved_level)

    return logger


def get_logger(name: str = _ROOT_LOGGER_NAME) -> logging.Logger:
    """Logger figlio di `volleyref` (o il root stesso). Configura al volo se
    nessuno l'ha ancora fatto, così i moduli possono chiamarlo a import time
    senza dipendere dall'ordine di avvio dell'app."""

    if not _configured:
        configure_logging()
    if name == _ROOT_LOGGER_NAME:
        return logging.getLogger(_ROOT_LOGGER_NAME)
    return logging.getLogger(_ROOT_LOGGER_NAME).getChild(name)
