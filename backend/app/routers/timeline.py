import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..database import connect_project_db, get_project_root
from ..schemas import EventCreate, EventOut, EventPatch

router = APIRouter(prefix="/api/projects/{project_id}/timeline", tags=["timeline"])


def _root(project_id: str) -> Path:
    return Path(get_project_root(project_id))


def _row_to_event(d: dict) -> EventOut:
    return EventOut(
        id=d["id"],
        title=d["title"],
        story_time=d.get("story_time"),
        narrative_order=d.get("narrative_order"),
        pov=d.get("pov"),
        participants=json.loads(d.get("participants_json") or "[]"),
        dependencies=json.loads(d.get("dependencies_json") or "[]"),
        notes=d.get("notes"),
        has_conflict=bool(d.get("has_conflict")),
        scene_id=d.get("scene_id"),
    )


@router.get("/events", response_model=list[EventOut])
def list_events(project_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        rows = conn.execute("SELECT * FROM events ORDER BY narrative_order IS NULL, narrative_order, title").fetchall()
        return [_row_to_event(dict(r)) for r in rows]
    finally:
        conn.close()


@router.post("/events", response_model=EventOut)
def create_event(project_id: str, body: EventCreate):
    root = _root(project_id)
    eid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = connect_project_db(root)
    try:
        conn.execute(
            """
            INSERT INTO events (id, title, story_time, narrative_order, pov, participants_json, dependencies_json, notes, has_conflict, scene_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                eid,
                body.title,
                body.story_time,
                body.narrative_order,
                body.pov,
                json.dumps(body.participants),
                json.dumps(body.dependencies),
                body.notes,
                1 if body.has_conflict else 0,
                body.scene_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return EventOut(
        id=eid,
        title=body.title,
        story_time=body.story_time,
        narrative_order=body.narrative_order,
        pov=body.pov,
        participants=body.participants,
        dependencies=body.dependencies,
        notes=body.notes,
        has_conflict=body.has_conflict,
        scene_id=body.scene_id,
    )


@router.delete("/events/{event_id}")
def delete_event(project_id: str, event_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


@router.patch("/events/{event_id}", response_model=EventOut)
def patch_event(project_id: str, event_id: str, body: EventPatch):
    root = _root(project_id)
    u = None
    conn = connect_project_db(root)
    try:
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Event not found")
        d = dict(row)
        p = body.model_dump(exclude_unset=True)
        for key in ("title", "story_time", "narrative_order", "pov", "notes", "scene_id"):
            if key in p:
                d[key] = p[key]
        if "has_conflict" in p:
            d["has_conflict"] = 1 if p["has_conflict"] else 0
        parts = json.loads(d.get("participants_json") or "[]")
        if "participants" in p:
            parts = p["participants"]
        deps = json.loads(d.get("dependencies_json") or "[]")
        if "dependencies" in p:
            deps = p["dependencies"]
        hc = d.get("has_conflict", 0) or 0
        if not isinstance(hc, int):
            hc = 1 if hc else 0
        conn.execute(
            """
            UPDATE events
            SET title=?, story_time=?, narrative_order=?, pov=?,
                participants_json=?, dependencies_json=?, notes=?, has_conflict=?, scene_id=?
            WHERE id=?
            """,
            (
                d["title"],
                d.get("story_time"),
                d.get("narrative_order"),
                d.get("pov"),
                json.dumps(parts),
                json.dumps(deps),
                d.get("notes"),
                hc,
                d.get("scene_id"),
                event_id,
            ),
        )
        conn.commit()
        u = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    finally:
        conn.close()
    if not u:
        raise HTTPException(404, "Event not found")
    return _row_to_event(dict(u))
