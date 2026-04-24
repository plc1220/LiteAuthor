from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from liteauthor_agent.context_engine.builder import build_scene_packet
from liteauthor_agent.llm_gateway.client import chat_completion
from liteauthor_agent.schemas.context import SceneExcerpt
from liteauthor_agent.storycraft import load_rules, select_rules
from liteauthor_agent.storycraft.prompts import format_active_rules_block, storycraft_system_prompt
from liteauthor_agent.utils.paths import read_file_safe

from ..database import connect_project_db, get_project_root
from ..schemas import StorycraftAnalyzeOut, StorycraftRequest, StorycraftRewriteOut, StorycraftRuleOut

router = APIRouter(prefix="/api/projects/{project_id}/storycraft", tags=["storycraft"])

_BUILTIN_SKILLS = Path(__file__).resolve().parent.parent / "builtin-skills"
_RULES_CACHE: list | None = None


def _all_rules():
    global _RULES_CACHE
    if _RULES_CACHE is None:
        _RULES_CACHE = load_rules(_BUILTIN_SKILLS)
    return _RULES_CACHE


def _scene_excerpt(root: Path, scene_id: str) -> SceneExcerpt | None:
    conn = connect_project_db(root)
    try:
        row = conn.execute(
            """
            SELECT s.file_rel_path, c.title as chapter_title
            FROM scenes s JOIN chapters c ON c.id = s.chapter_id
            WHERE s.id = ?
            """,
            (scene_id,),
        ).fetchone()
        if not row:
            return None
        return SceneExcerpt(file_rel_path=row["file_rel_path"], chapter_title=row["chapter_title"])
    finally:
        conn.close()


def _motif_hints(root: Path) -> tuple[str, ...]:
    text = read_file_safe(root, "story/motifs.md", 4000)
    if not text:
        return ()
    parts: list[str] = []
    for m in re.findall(r"[\w\u4e00-\u9fff]{2,24}", text):
        if len(m) > 1:
            parts.append(m)
    return tuple(list(dict.fromkeys(parts))[:12])


_INTENT_TASK = {
    "increase_tension": "Strengthen on-page tension: friction, risk, and resistance without changing the plot facts.",
    "sharpen_dialogue": "Make dialogue sharper: subtext, rhythm, and contrast while preserving voice and continuity.",
    "strengthen_chapter_ending": "Strengthen the chapter ending: momentum, a curiosity gap, and a forward pull.",
    "rewrite_with_intent": "Revise the selection with a cleaner scene purpose, preserving facts and voice.",
    "scene_doctor": "Diagnose and improve this scene moment for clarity, purpose, and dramatization.",
    "chapter_critique": "Assess the passage as part of a chapter: pacing, payoff, and forward motion.",
    "character_consistency": "Align character behavior and voice with the established persona.",
    "payoff_review": "Evaluate setup/payoff, promises, and reader satisfaction in this slice.",
    "opening_doctor": "Tighten the opening beat: hook, orientation, and forward pull without new plot facts unless essential.",
    "pacing_analyzer": "Adjust pacing: sentence variety, scene turns, and compression; preserve voice and story facts.",
    "character_engine": "Strengthen character drive: want, cost, and reaction-consistent action in the selection.",
    "payoff_tracker": "Clarify or sharpen setup, promise, and payoff in this beat; do not change canon unless explicitly improving echo.",
}


def _out_rules(rules) -> list[StorycraftRuleOut]:
    return [StorycraftRuleOut(id=r.id, name=r.name, bucket=r.bucket) for r in rules]


def _run_select(root: Path, body: StorycraftRequest, rules):
    motifs = _motif_hints(root)
    return select_rules(
        rules,
        selection=body.selection,
        intent=body.intent,
        surface=body.surface,
        motif_substrings=motifs,
        chapter_position=body.chapter_position,
    )


@router.post("/analyze", response_model=StorycraftAnalyzeOut)
def storycraft_analyze(project_id: str, body: StorycraftRequest) -> StorycraftAnalyzeOut:
    root = Path(get_project_root(project_id))
    rules = _all_rules()
    result = _run_select(root, body, rules)
    d = result.diagnostics.model_dump()
    return StorycraftAnalyzeOut(
        diagnosis=result.diagnosis,
        rules=_out_rules(result.rules),
        warnings=result.warnings,
        diagnostics=d,
    )


@router.post("/rewrite", response_model=StorycraftRewriteOut)
async def storycraft_rewrite(project_id: str, body: StorycraftRequest) -> StorycraftRewriteOut:
    root = Path(get_project_root(project_id))
    scene = _scene_excerpt(root, body.scene_id)
    if scene is None:
        raise HTTPException(404, "Scene not found")
    rules = _all_rules()
    result = _run_select(root, body, rules)
    task = _INTENT_TASK.get(body.intent, _INTENT_TASK["rewrite_with_intent"])
    rules_block = [format_active_rules_block(result.rules)]
    instruction = (
        "Revise the **Selected Passage** in the context packet. "
        "Keep POV, tense, and established story facts. Return only the revised prose."
    )
    packet = build_scene_packet(
        root,
        scene,
        task,
        body.selection,
        instruction,
        diagnosis=result.diagnosis,
        active_storycraft_rules=rules_block,
    )
    if not body.run_model or not (body.selection or "").strip():
        return StorycraftRewriteOut(
            diagnosis=result.diagnosis,
            rules=_out_rules(result.rules),
            warnings=result.warnings + (["No selection text; skipping model."] if not (body.selection or "").strip() else []),
            diagnostics=result.diagnostics.model_dump(),
            rewrite="",
            packet_meta={"approx_tokens": packet["approx_tokens"], "chunks_used": packet["chunks_used"], "skipped_model": True},
        )
    system = storycraft_system_prompt("literary_editor")
    try:
        text = await chat_completion(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": packet["markdown"]},
            ],
            max_tokens=2048,
        )
    except Exception as e:
        raise HTTPException(502, f"Model error: {e!s}") from e
    return StorycraftRewriteOut(
        diagnosis=result.diagnosis,
        rules=_out_rules(result.rules),
        warnings=result.warnings,
        diagnostics=result.diagnostics.model_dump(),
        rewrite=text.strip(),
        packet_meta={"approx_tokens": packet["approx_tokens"], "chunks_used": packet["chunks_used"]},
    )
