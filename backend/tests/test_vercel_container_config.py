"""Regression tests for the Vercel container runtime contract."""

from __future__ import annotations

import json
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_DIR.parent


def test_vercel_container_uses_routed_port_and_writable_scratch_space() -> None:
    dockerfile = (BACKEND_DIR / "Dockerfile.vercel").read_text()

    # Vercel routes container traffic to port 80 when PORT is not configured.
    assert "${PORT:-80}" in dockerfile

    # Vercel Functions expose only /tmp as writable runtime scratch space.
    assert "DATABASE_URL=sqlite:////tmp/volleyref.db" in dockerfile
    assert "STORAGE_DIR=/tmp/volleyref-storage" in dockerfile


def test_vercel_backend_service_points_to_the_container_entrypoint() -> None:
    config = json.loads((REPOSITORY_ROOT / "vercel.json").read_text())
    backend = config["services"]["backend"]

    assert backend["runtime"] == "container"
    assert (REPOSITORY_ROOT / backend["root"] / backend["entrypoint"]).is_file()
