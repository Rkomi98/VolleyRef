"""Persistenza delle Analysis dietro un'interfaccia astratta.

Specifica di riferimento: 02_volleyref_backend_prompt.md §1, §36 — lo storage
deve restare astratto per poter passare da SQLite a PostgreSQL/object storage
in futuro senza toccare `app/services`. Per questo MVP l'intera `Analysis`
normalizzata (backend §7) è salvata come blob JSON in una colonna, insieme a
id/status/nome file originale: non serve uno schema relazionale completo ora.

`AnalysisRepository` è l'interfaccia astratta (ABC) che i servizi conoscono.
`SqliteAnalysisRepository` è l'unica implementazione concreta oggi.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Integer, String, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.models.analysis import ProcessingStepId
from app.models.common import ErrorDetail


class Base(DeclarativeBase):
    pass


class AnalysisModel(Base):
    """Riga di persistenza per un'analisi.

    Per l'MVP l'`Analysis` normalizzata completa (backend §7) vive come blob
    JSON in `analysis_json`; non c'è uno schema relazionale per set/turni —
    un task futuro potrà normalizzarlo se necessario, senza toccare il
    contratto pubblico dell'API.
    """

    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    status: Mapped[str] = mapped_column(String, nullable=False)
    original_filename: Mapped[str] = mapped_column(String, nullable=False)
    pdf_path: Mapped[str] = mapped_column(String, nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    current_step: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    steps_json: Mapped[str] = mapped_column(String, nullable=False, default="[]")
    error_json: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    analysis_json: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


@dataclass
class AnalysisRecord:
    """DTO di dominio scambiato tra service e repository.

    Disaccoppia i servizi dallo schema SQLAlchemy (backend §1/§36): un domani
    l'implementazione Postgres potrà avere una riga diversa e restituire
    comunque questo stesso oggetto.
    """

    id: str
    status: str
    original_filename: str
    pdf_path: str
    progress: int = 0
    current_step: Optional[str] = None
    steps: list[dict] = field(default_factory=list)
    error: Optional[dict] = None
    analysis_json: Optional[dict] = None


def _default_steps() -> list[dict]:
    return [{"id": step.value, "status": "PENDING"} for step in ProcessingStepId]


class AnalysisRepository(ABC):
    """Interfaccia astratta — i servizi dipendono solo da questa."""

    @abstractmethod
    def create(
        self,
        analysis_id: str,
        original_filename: str,
        pdf_path: str,
        initial_analysis_json: dict,
    ) -> AnalysisRecord:
        """Crea una nuova riga con status=UPLOADED e steps tutti PENDING."""

    @abstractmethod
    def get(self, analysis_id: str) -> Optional[AnalysisRecord]:
        """Ritorna il record o None se l'id non esiste."""

    @abstractmethod
    def update_progress(
        self,
        analysis_id: str,
        *,
        status: str,
        progress: int,
        current_step: Optional[str],
        steps: list[dict],
        error: Optional[dict] = None,
    ) -> None:
        """Aggiorna lo stato di avanzamento della pipeline (non tocca analysis_json)."""

    @abstractmethod
    def save_result(self, analysis_id: str, *, status: str, analysis_json: dict) -> None:
        """Scrive il risultato normalizzato finale e il nuovo status globale."""

    @abstractmethod
    def update_analysis_json(self, analysis_id: str, analysis_json: dict) -> None:
        """Sovrascrive solo il blob normalizzato (usato da PATCH/reset)."""

    @abstractmethod
    def reset_for_reanalysis(self, analysis_id: str, initial_analysis_json: dict) -> None:
        """Riporta il record allo stato iniziale prima di rilanciare la pipeline."""


class SqliteAnalysisRepository(AnalysisRepository):
    """Implementazione SQLite/SQLAlchemy dell'interfaccia sopra."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    @staticmethod
    def _to_record(row: AnalysisModel) -> AnalysisRecord:
        return AnalysisRecord(
            id=row.id,
            status=row.status,
            original_filename=row.original_filename,
            pdf_path=row.pdf_path,
            progress=row.progress,
            current_step=row.current_step,
            steps=json.loads(row.steps_json) if row.steps_json else [],
            error=json.loads(row.error_json) if row.error_json else None,
            analysis_json=json.loads(row.analysis_json) if row.analysis_json else None,
        )

    def create(
        self,
        analysis_id: str,
        original_filename: str,
        pdf_path: str,
        initial_analysis_json: dict,
    ) -> AnalysisRecord:
        with self._session_factory() as session:
            row = AnalysisModel(
                id=analysis_id,
                status="UPLOADED",
                original_filename=original_filename,
                pdf_path=pdf_path,
                progress=0,
                current_step=None,
                steps_json=json.dumps(_default_steps()),
                error_json=None,
                analysis_json=json.dumps(initial_analysis_json),
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            return self._to_record(row)

    def get(self, analysis_id: str) -> Optional[AnalysisRecord]:
        with self._session_factory() as session:
            row = session.get(AnalysisModel, analysis_id)
            if row is None:
                return None
            return self._to_record(row)

    def update_progress(
        self,
        analysis_id: str,
        *,
        status: str,
        progress: int,
        current_step: Optional[str],
        steps: list[dict],
        error: Optional[dict] = None,
    ) -> None:
        with self._session_factory() as session:
            row = session.get(AnalysisModel, analysis_id)
            if row is None:
                return
            row.status = status
            row.progress = progress
            row.current_step = current_step
            row.steps_json = json.dumps(steps)
            row.error_json = json.dumps(error) if error is not None else None
            session.commit()

    def save_result(self, analysis_id: str, *, status: str, analysis_json: dict) -> None:
        with self._session_factory() as session:
            row = session.get(AnalysisModel, analysis_id)
            if row is None:
                return
            row.status = status
            row.analysis_json = json.dumps(analysis_json)
            session.commit()

    def update_analysis_json(self, analysis_id: str, analysis_json: dict) -> None:
        with self._session_factory() as session:
            row = session.get(AnalysisModel, analysis_id)
            if row is None:
                return
            row.analysis_json = json.dumps(analysis_json)
            session.commit()

    def reset_for_reanalysis(self, analysis_id: str, initial_analysis_json: dict) -> None:
        with self._session_factory() as session:
            row = session.get(AnalysisModel, analysis_id)
            if row is None:
                return
            row.status = "UPLOADED"
            row.progress = 0
            row.current_step = None
            row.steps_json = json.dumps(_default_steps())
            row.error_json = None
            row.analysis_json = json.dumps(initial_analysis_json)
            session.commit()


def create_engine_from_url(database_url: str) -> Engine:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, connect_args=connect_args)


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


def create_tables(engine: Engine) -> None:
    Base.metadata.create_all(bind=engine)
