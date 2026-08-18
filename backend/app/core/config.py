"""Configurazione applicativa minimale.

Specifica di riferimento: 02_volleyref_backend_prompt.md §32-§33, §40.
Un task successivo di hardening (sicurezza/logging) estenderà questo file
con dimensione massima upload, allowlist MIME, log level strutturato, ecc.
Qui basta il minimo per far girare CORS, storage e DB da env var.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Impostazioni lette da variabili d'ambiente (o file `.env`)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    frontend_origin: str = "http://localhost:3000"
    database_url: str = "sqlite:///./volleyref.db"
    storage_dir: str = "./storage"


@lru_cache
def get_settings() -> Settings:
    """Singleton di processo — evita di riparsare l'ambiente ad ogni richiesta."""

    return Settings()
