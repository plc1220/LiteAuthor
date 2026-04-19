import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..database import connect_project_db, get_project_root
from ..schemas import SnapshotCreate

router = APIRouter(prefix="/api/projects/{project_id}/snapshots", tags=["snapshots"])


def _root(project_id: str) -> Path:
    return Path(get_project_root(project_id))


@router.get("")
def list_snapshots(project_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        rows = conn.execute("SELECT * FROM snapshots ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("")
def create_snapshot(project_id: str, body: SnapshotCreate):
    root = _root(project_id)
    sid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    snap_dir = root / "snapshots" / sid
    snap_dir.mkdir(parents=True, exist_ok=True)
    for name in ("manuscript", "story", "chapter_summaries"):
        src = root / name
        if src.is_dir():
            shutil.copytree(src, snap_dir / name, dirs_exist_ok=True)
    conn = connect_project_db(root)
    try:
        conn.execute(
            "INSERT INTO snapshots (id, label, snapshot_dir, created_at) VALUES (?, ?, ?, ?)",
            (sid, body.label or "", str(snap_dir.relative_to(root)), now),
        )
        conn.commit()
    finally:
        conn.close()
    return {"id": sid, "created_at": now}


@router.post("/{snapshot_id}/restore")
def restore_snapshot(project_id: str, snapshot_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        row = conn.execute("SELECT snapshot_dir FROM snapshots WHERE id = ?", (snapshot_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Snapshot not found")
        snap_dir = (root / row["snapshot_dir"]).resolve()
        if not str(snap_dir).startswith(str(root.resolve())) or not snap_dir.is_dir():
            raise HTTPException(404, "Snapshot files not found")
        backup_id = str(uuid.uuid4())
        backup_dir = root / "snapshots" / f"pre-restore-{backup_id}"
        backup_dir.mkdir(parents=True, exist_ok=True)
        for name in ("manuscript", "story", "chapter_summaries"):
            current = root / name
            if current.is_dir():
                shutil.copytree(current, backup_dir / name, dirs_exist_ok=True)
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO snapshots (id, label, snapshot_dir, created_at) VALUES (?, ?, ?, ?)",
            (backup_id, "Pre-restore backup", str(backup_dir.relative_to(root)), now),
        )
        for name in ("manuscript", "story", "chapter_summaries"):
            src = snap_dir / name
            dst = root / name
            if src.is_dir():
                if dst.exists():
                    shutil.rmtree(dst)
                shutil.copytree(src, dst)
        conn.commit()
    finally:
        conn.close()
    return {"ok": True, "backup_id": backup_id}


@router.delete("/{snapshot_id}")
def delete_snapshot(project_id: str, snapshot_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        row = conn.execute("SELECT snapshot_dir FROM snapshots WHERE id = ?", (snapshot_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Snapshot not found")
        snap_dir = (root / row["snapshot_dir"]).resolve()
        if str(snap_dir).startswith(str(root.resolve())) and snap_dir.is_dir():
            shutil.rmtree(snap_dir)
        conn.execute("DELETE FROM snapshots WHERE id = ?", (snapshot_id,))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}
