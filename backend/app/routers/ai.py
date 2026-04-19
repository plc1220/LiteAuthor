from pathlib import Path

from fastapi import APIRouter, HTTPException
from liteauthor_agent.context_engine.builder import build_scene_packet
from liteauthor_agent.llm_gateway.client import chat_completion
from liteauthor_agent.prompt_templates.zen import zen_system_prompt
from liteauthor_agent.schemas.context import SceneExcerpt

from ..database import connect_project_db, get_project_root
from ..schemas import ZenAIRequest

router = APIRouter(prefix="/api/projects/{project_id}/ai", tags=["ai"])


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


@router.post("/zen")
async def zen_ai(project_id: str, body: ZenAIRequest):
    root = Path(get_project_root(project_id))
    scene = _scene_excerpt(root, body.scene_id)
    packet = build_scene_packet(root, scene, body.task, body.selection, body.instruction)
    system = zen_system_prompt(body.role)
    user = packet["markdown"]
    try:
        text = await chat_completion(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=2048,
        )
    except Exception as e:
        raise HTTPException(502, f"Model error: {e!s}") from e
    return {
        "text": text,
        "packet_meta": {"approx_tokens": packet["approx_tokens"], "chunks_used": packet["chunks_used"]},
        "context_packet": {
            "markdown": packet["markdown"],
            "approx_tokens": packet["approx_tokens"],
            "chunks_used": packet["chunks_used"],
        },
    }
