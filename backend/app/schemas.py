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


class TitleUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=500)


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


class EventPatch(BaseModel):
    title: Optional[str] = None
    story_time: Optional[str] = None
    narrative_order: Optional[int] = None
    pov: Optional[str] = None
    participants: Optional[list[str]] = None
    dependencies: Optional[list[str]] = None
    notes: Optional[str] = None
    has_conflict: Optional[bool] = None
    scene_id: Optional[str] = None


class ZenAIRequest(BaseModel):
    scene_id: str
    task: str
    selection: str
    instruction: str
    role: str = "literary_editor"


class AutocompleteRequest(BaseModel):
    before: str = Field(max_length=6000)
    after: str = Field(default="", max_length=1200)
    previousParagraph: str = Field(default="", max_length=2400)
    documentMemory: str = Field(default="", max_length=1200)


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


class CanvasNode(BaseModel):
    id: str
    type: str = "text"
    x: float = 0
    y: float = 0
    width: float = 280
    height: float = 160
    text: Optional[str] = None
    label: Optional[str] = None
    color: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CanvasEdge(BaseModel):
    id: str
    fromNode: str
    toNode: str
    label: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Canvas(BaseModel):
    version: str = "liteauthor.canvas.v1"
    nodes: list[CanvasNode] = Field(default_factory=list)
    edges: list[CanvasEdge] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CanvasAnalyzeRequest(BaseModel):
    title: str = "Artifact"
    text: str = Field(min_length=1, max_length=120000)


class CanvasAutosortRequest(BaseModel):
    canvas: Canvas
    mode: str = "type"


class CaptureProposal(BaseModel):
    id: str
    kind: str
    title: str
    target: str
    content: str
    source_node_ids: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CanvasCaptureRequest(BaseModel):
    proposals: list[CaptureProposal]
    apply: bool = False


class WikiPopulateRequest(BaseModel):
    source: str = "manuscript"  # manuscript | canvas | text
    scene_id: Optional[str] = None
    title: Optional[str] = None
    text: Optional[str] = Field(default=None, max_length=120000)
    canvas: Optional[Canvas] = None


class WikiApplyRequest(BaseModel):
    proposals: list[CaptureProposal]
    apply: bool = True


class StorycraftRuleOut(BaseModel):
    id: str
    name: str
    bucket: str


class StorycraftRequest(BaseModel):
    scene_id: str
    surface: str = "inline_suggestion"
    intent: str = "rewrite_with_intent"
    selection: str = ""
    chapter_position: str | None = None
    run_model: bool = True


class StorycraftAnalyzeOut(BaseModel):
    diagnosis: list[str]
    rules: list[StorycraftRuleOut]
    warnings: list[str]
    diagnostics: dict[str, Any]


class StorycraftRewriteOut(StorycraftAnalyzeOut):
    rewrite: str
    packet_meta: dict[str, Any] = Field(default_factory=dict)
