from typing import Any, Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    genres: list[str] = Field(default_factory=list)
    target_words: int = Field(default=80000, ge=1000, le=500000)


class ProjectOut(BaseModel):
    id: str
    name: str
    root_path: str
    settings: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class ChapterOut(BaseModel):
    id: str
    sort_order: int
    title: str
    slug: str


class SceneOut(BaseModel):
    id: str
    chapter_id: str
    sort_order: int
    title: str
    slug: str
    file_rel_path: str


class OutlineOut(BaseModel):
    chapters: list[ChapterOut]
    scenes: list[SceneOut]


class SceneContentUpdate(BaseModel):
    markdown: str


class WikiFileOut(BaseModel):
    path: str
    is_dir: bool


class WikiWrite(BaseModel):
    content: str


class EventCreate(BaseModel):
    title: str
    story_time: Optional[str] = None
    narrative_order: Optional[int] = None
    pov: Optional[str] = None
    participants: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    notes: Optional[str] = None
    has_conflict: bool = False
    scene_id: Optional[str] = None


class EventOut(BaseModel):
    id: str
    title: str
    story_time: Optional[str]
    narrative_order: Optional[int]
    pov: Optional[str]
    participants: list[str]
    dependencies: list[str]
    notes: Optional[str]
    has_conflict: bool
    scene_id: Optional[str]


class ZenAIRequest(BaseModel):
    scene_id: str
    task: str
    selection: str
    instruction: str
    role: str = "literary_editor"


class SuggestionCreate(BaseModel):
    scene_id: str
    range_from: int
    range_to: int
    original_text: str
    proposed_text: str
    explanation: Optional[str] = None
    role: str = "literary_editor"


class SuggestionPatch(BaseModel):
    status: str  # accepted | rejected


class AgentJobCreate(BaseModel):
    job_type: str = "continuity_pass"
    chapter_range: Optional[str] = None


class SnapshotCreate(BaseModel):
    label: Optional[str] = None


class ContinuityFlagCreate(BaseModel):
    title: str
    detail: str
    scene_id: Optional[str] = None
    event_id: Optional[str] = None


class ContinuityFlagPatch(BaseModel):
    status: str
