from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SceneExcerpt:
    """Resolved manuscript slice for retrieval (built from backend SQLite)."""

    file_rel_path: str | None
    chapter_title: str | None
