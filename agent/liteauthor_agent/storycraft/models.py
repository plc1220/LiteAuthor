from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Bucket = Literal["hook", "character", "conflict", "pacing", "payoff", "addiction", "dialogue", "world"]


class StorycraftRule(BaseModel):
    id: str
    slug: str
    name: str
    bucket: Bucket
    tags: list[str] = Field(default_factory=list)
    surfaces: list[str] = Field(default_factory=list)
    priority: float = 0.5
    trigger_hints: list[str] = Field(default_factory=list)
    instruction: str
    output_modes: list[str] = Field(default_factory=lambda: ["diagnosis", "revision", "alternatives"])
    source: str | None = None
    source_ref: str | None = None


class TextDiagnostics(BaseModel):
    """Lightweight text signals for routing; values are heuristics."""

    selection_word_count: int = 0
    paragraph_count: int = 0
    dialogue_ratio: float = 0.0
    avg_paragraph_length: float = 0.0
    question_density: float = 0.0
    exposition_density: float = 0.0
    named_character_hits: int = 0
    motif_hits: int = 0
    recent_conflict_flag_count: int = 0
    chapter_end_curiosity_score: float = 0.0
    scene_goal_signal: float = 0.0
    scene_obstacle_signal: float = 0.0
    payoff_candidate_count: int = 0


class StorycraftSelectResult(BaseModel):
    rules: list[StorycraftRule] = Field(default_factory=list)
    diagnosis: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    diagnostics: TextDiagnostics
