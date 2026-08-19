"""Storico delle correzioni manuali sui campi di un'Analysis.

Specifica di riferimento: 02_volleyref_backend_prompt.md §14 (Undo) — mantiene
una tabella opzionale `field_edits` con `analysis_id`, `field_id`,
`previous_value`, `new_value`, `timestamp`. Non è event sourcing: serve solo
da log/audit trail per una correzione, non per ricostruire lo stato.

Nota di confine (task B3): questo file NON tocca `app/repositories/analysis_repository.py`.
Riusa la stessa `Base` declarativa SQLAlchemy definita lì, così la tabella
`field_edits` viene creata automaticamente dalla `create_tables(engine)` già
cablata in `main.py` — basta che questo modulo sia importato prima che
`create_tables` venga eseguita (lo è: `app/api/analyses.py` importa
`app/services/field_update.py`, che importa questo modulo, e `main.py`
importa il router `analyses` come primissimo import in testa al file).
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, delete, select
from sqlalchemy.orm import Mapped, Session, mapped_column, sessionmaker

from app.repositories.analysis_repository import Base


class FieldEditModel(Base):
    """Riga di persistenza per una singola correzione manuale di un campo."""

    __tablename__ = "field_edits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analysis_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    field_id: Mapped[str] = mapped_column(String, nullable=False)
    previous_value_json: Mapped[str] = mapped_column(String, nullable=False)
    new_value_json: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


@dataclass
class FieldEditRecord:
    """DTO di dominio scambiato tra `FieldUpdateService` e il repository."""

    id: int
    analysis_id: str
    field_id: str
    previous_value: object
    new_value: object
    created_at: datetime


class FieldEditRepository(ABC):
    """Interfaccia astratta — stesso pattern di `AnalysisRepository`."""

    @abstractmethod
    def record(
        self, *, analysis_id: str, field_id: str, previous_value: object, new_value: object
    ) -> FieldEditRecord:
        """Registra una correzione manuale (chi/quando/valore vecchio/nuovo)."""

    @abstractmethod
    def list_for_analysis(self, analysis_id: str) -> list[FieldEditRecord]:
        """Storico ordinato cronologicamente delle correzioni di un'Analysis."""

    @abstractmethod
    def clear_for_analysis(self, analysis_id: str) -> int:
        """Elimina lo storico di un'Analysis (reset-corrections/reanalyze). Ritorna
        il numero di righe eliminate."""


class SqliteFieldEditRepository(FieldEditRepository):
    """Implementazione SQLite/SQLAlchemy, sulla stessa engine/session factory
    usata da `SqliteAnalysisRepository` (stesso file DB)."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    @staticmethod
    def _to_record(row: FieldEditModel) -> FieldEditRecord:
        return FieldEditRecord(
            id=row.id,
            analysis_id=row.analysis_id,
            field_id=row.field_id,
            previous_value=json.loads(row.previous_value_json),
            new_value=json.loads(row.new_value_json),
            created_at=row.created_at,
        )

    def record(
        self, *, analysis_id: str, field_id: str, previous_value: object, new_value: object
    ) -> FieldEditRecord:
        with self._session_factory() as session:
            row = FieldEditModel(
                analysis_id=analysis_id,
                field_id=field_id,
                previous_value_json=json.dumps(previous_value),
                new_value_json=json.dumps(new_value),
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            return self._to_record(row)

    def list_for_analysis(self, analysis_id: str) -> list[FieldEditRecord]:
        with self._session_factory() as session:
            rows = session.scalars(
                select(FieldEditModel)
                .where(FieldEditModel.analysis_id == analysis_id)
                .order_by(FieldEditModel.id)
            ).all()
            return [self._to_record(row) for row in rows]

    def clear_for_analysis(self, analysis_id: str) -> int:
        with self._session_factory() as session:
            result = session.execute(
                delete(FieldEditModel).where(FieldEditModel.analysis_id == analysis_id)
            )
            session.commit()
            return result.rowcount or 0
