import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..database import connect_project_db, get_project_root
from ..schemas import SuggestionCreate, SuggestionPatch

router = APIRouter(prefix="/api/projects/{project_id}/suggestions", tags=["suggestions"])


def _root(project_id: str) -> Path:
    return Path(get_project_root(project_id))


@router.get("")
def list_suggestions(project_id: str, scene_id: str | None = None):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        if scene_id:
            rows = conn.execute(
                "SELECT * FROM suggestions WHERE scene_id = ? ORDER BY created_at DESC",
                (scene_id,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM suggestions ORDER BY created_at DESC LIMIT 50").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("")
def create_suggestion(project_id: str, body: SuggestionCreate):
    root = _root(project_id)
    sid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = connect_project_db(root)
    try:
        conn.execute(
            """
            INSERT INTO suggestions (id, scene_id, range_from, range_to, original_text, proposed_text, explanation, role, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """,
            (
                sid,
                body.scene_id,
                body.range_from,
                body.range_to,
                body.original_text,
                body.proposed_text,
                body.explanation or "",
                body.role,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return {"id": sid}


@router.patch("/{suggestion_id}")
def patch_suggestion(project_id: str, suggestion_id: str, body: SuggestionPatch):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        conn.execute("UPDATE suggestions SET status = ? WHERE id = ?", (body.status, suggestion_id))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}
