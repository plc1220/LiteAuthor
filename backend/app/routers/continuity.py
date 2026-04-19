import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..database import connect_project_db, get_project_root
from ..schemas import ContinuityFlagCreate, ContinuityFlagPatch

router = APIRouter(prefix="/api/projects/{project_id}/continuity", tags=["continuity"])


def _root(project_id: str) -> Path:
    return Path(get_project_root(project_id))


@router.get("/flags")
def list_flags(project_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        rows = conn.execute("SELECT * FROM continuity_flags ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/flags")
def create_flag(project_id: str, body: ContinuityFlagCreate):
    root = _root(project_id)
    fid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = connect_project_db(root)
    try:
        conn.execute(
            """
            INSERT INTO continuity_flags (id, title, detail, scene_id, event_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'open', ?)
            """,
            (fid, body.title, body.detail, body.scene_id, body.event_id, now),
        )
        conn.commit()
    finally:
        conn.close()
    return {"id": fid}


@router.patch("/flags/{flag_id}")
def patch_flag(project_id: str, flag_id: str, body: ContinuityFlagPatch):
    allowed = {"open", "dismissed", "resolved", "intentional"}
    if body.status not in allowed:
        raise HTTPException(400, "Invalid continuity flag status")
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        cur = conn.execute("UPDATE continuity_flags SET status = ? WHERE id = ?", (body.status, flag_id))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "Continuity flag not found")
    finally:
        conn.close()
    return {"ok": True}
