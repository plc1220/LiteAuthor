import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from liteauthor_agent.orchestrator.sample_job import execute_sample_agent_job
from liteauthor_agent.schemas.context import SceneExcerpt

from ..database import connect_project_db, get_project_root
from ..schemas import AgentJobCreate

router = APIRouter(prefix="/api/projects/{project_id}/agent", tags=["agent"])


def _root(project_id: str) -> Path:
    return Path(get_project_root(project_id))


def _update_job(root: Path, job_id: str, **kwargs):
    conn = connect_project_db(root)
    try:
        fields = []
        vals: list = []
        for k, v in kwargs.items():
            fields.append(f"{k} = ?")
            vals.append(v)
        vals.append(job_id)
        conn.execute(f"UPDATE agent_jobs SET {', '.join(fields)} WHERE id = ?", vals)
        conn.commit()
    finally:
        conn.close()


def _first_scene_excerpt(root: Path) -> SceneExcerpt | None:
    conn = connect_project_db(root)
    try:
        row = conn.execute(
            """
            SELECT s.file_rel_path, c.title as chapter_title
            FROM scenes s JOIN chapters c ON c.id = s.chapter_id
            ORDER BY c.sort_order, s.sort_order LIMIT 1
            """,
        ).fetchone()
        if not row:
            return None
        return SceneExcerpt(file_rel_path=row["file_rel_path"], chapter_title=row["chapter_title"])
    finally:
        conn.close()


def run_agent_job(project_id: str, job_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        row = conn.execute("SELECT * FROM agent_jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            return
    finally:
        conn.close()

    now = datetime.now(timezone.utc).isoformat()
    _update_job(root, job_id, status="running", progress=0.05, updated_at=now)

    try:
        scene = _first_scene_excerpt(root)
        steps, result = execute_sample_agent_job(root, scene)
        done = datetime.now(timezone.utc).isoformat()
        conn = connect_project_db(root)
        try:
            conn.execute(
                "UPDATE agent_jobs SET status = ?, progress = ?, steps_json = ?, result_json = ?, updated_at = ?, error = NULL WHERE id = ?",
                ("completed", 1.0, json.dumps(steps), json.dumps(result), done, job_id),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        conn = connect_project_db(root)
        try:
            conn.execute(
                "UPDATE agent_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?",
                ("failed", str(e), datetime.now(timezone.utc).isoformat(), job_id),
            )
            conn.commit()
        finally:
            conn.close()


@router.post("/jobs")
def start_job(project_id: str, body: AgentJobCreate, background_tasks: BackgroundTasks):
    root = _root(project_id)
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = connect_project_db(root)
    try:
        conn.execute(
            "INSERT INTO agent_jobs (id, job_type, status, progress, steps_json, result_json, error, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?)",
            (job_id, body.job_type, "queued", 0, now, now),
        )
        conn.commit()
    finally:
        conn.close()
    background_tasks.add_task(run_agent_job, project_id, job_id)
    return {"id": job_id}


@router.get("/jobs/{job_id}")
def get_job(project_id: str, job_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        row = conn.execute("SELECT * FROM agent_jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Job not found")
        d = dict(row)
        for k in ("steps_json", "result_json"):
            if d.get(k) and isinstance(d[k], str):
                try:
                    d[k] = json.loads(d[k])
                except json.JSONDecodeError:
                    pass
        return d
    finally:
        conn.close()
