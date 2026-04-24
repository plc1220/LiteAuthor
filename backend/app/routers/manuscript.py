from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from ..database import connect_project_db, get_project_root
from ..schemas import OutlineOut, ChapterOut, SceneOut, SceneContentUpdate, TitleUpdate

router = APIRouter(prefix="/api/projects/{project_id}/manuscript", tags=["manuscript"])


def _root(project_id: str) -> Path:
    return Path(get_project_root(project_id))


def _safe_project_path(root: Path, rel_path: str) -> Path:
    resolved_root = root.resolve()
    path = (root / rel_path).resolve()
    try:
        path.relative_to(resolved_root)
    except ValueError:
        raise HTTPException(400, "Invalid path")
    return path


def _remove_scene_file(root: Path, rel_path: str) -> None:
    path = _safe_project_path(root, rel_path)
    try:
        if path.is_file():
            path.unlink()
        manuscript_root = (root / "manuscript").resolve()
        parent = path.parent
        if parent != manuscript_root:
            parent.resolve().relative_to(manuscript_root)
            parent.rmdir()
    except (OSError, ValueError):
        # Content cleanup should not roll back the database deletion.
        pass


@router.get("/outline", response_model=OutlineOut)
def outline(project_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        ch_rows = conn.execute("SELECT id, sort_order, title, slug FROM chapters ORDER BY sort_order, title").fetchall()
        sc_rows = conn.execute(
            "SELECT id, chapter_id, sort_order, title, slug, file_rel_path FROM scenes ORDER BY chapter_id, sort_order, title"
        ).fetchall()
        return OutlineOut(
            chapters=[ChapterOut(**dict(r)) for r in ch_rows],
            scenes=[SceneOut(**dict(r)) for r in sc_rows],
        )
    finally:
        conn.close()


@router.get("/scenes/{scene_id}/content")
def get_scene_content(project_id: str, scene_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        row = conn.execute("SELECT file_rel_path FROM scenes WHERE id = ?", (scene_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Scene not found")
        rel = row["file_rel_path"]
        path = _safe_project_path(root, rel)
        if not path.is_file():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("", encoding="utf-8")
        return {"markdown": path.read_text(encoding="utf-8")}
    finally:
        conn.close()


@router.put("/scenes/{scene_id}/content")
def put_scene_content(project_id: str, scene_id: str, body: SceneContentUpdate):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        row = conn.execute("SELECT file_rel_path FROM scenes WHERE id = ?", (scene_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Scene not found")
        rel = row["file_rel_path"]
        path = _safe_project_path(root, rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body.markdown, encoding="utf-8")
        return {"ok": True}
    finally:
        conn.close()


@router.post("/chapters")
def create_chapter(project_id: str, title: str = Query("New Chapter")):
    import uuid
    from datetime import datetime, timezone

    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        max_ord = conn.execute("SELECT COALESCE(MAX(sort_order), -1) FROM chapters").fetchone()[0]
        ch_id = str(uuid.uuid4())
        slug = f"chapter-{max_ord + 2}"
        conn.execute(
            "INSERT INTO chapters (id, sort_order, title, slug) VALUES (?, ?, ?, ?)",
            (ch_id, max_ord + 1, title, slug),
        )
        conn.commit()
        return {"id": ch_id}
    finally:
        conn.close()


@router.patch("/chapters/{chapter_id}")
def patch_chapter_title(project_id: str, chapter_id: str, body: TitleUpdate):
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(400, "Title cannot be empty")
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        row = conn.execute("SELECT id FROM chapters WHERE id = ?", (chapter_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Chapter not found")
        conn.execute("UPDATE chapters SET title = ? WHERE id = ?", (title, chapter_id))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.patch("/scenes/{scene_id}")
def patch_scene_title(project_id: str, scene_id: str, body: TitleUpdate):
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(400, "Title cannot be empty")
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        row = conn.execute("SELECT id FROM scenes WHERE id = ?", (scene_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Scene not found")
        conn.execute("UPDATE scenes SET title = ? WHERE id = ?", (title, scene_id))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/chapters/{chapter_id}")
def delete_chapter(project_id: str, chapter_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        chapter = conn.execute("SELECT id FROM chapters WHERE id = ?", (chapter_id,)).fetchone()
        if not chapter:
            raise HTTPException(404, "Chapter not found")
        chapter_count = conn.execute("SELECT COUNT(*) FROM chapters").fetchone()[0]
        if chapter_count <= 1:
            raise HTTPException(400, "Cannot delete the last chapter")

        scene_rows = conn.execute("SELECT id, file_rel_path FROM scenes WHERE chapter_id = ?", (chapter_id,)).fetchall()
        scene_ids = [row["id"] for row in scene_rows]
        scene_count = conn.execute("SELECT COUNT(*) FROM scenes").fetchone()[0]
        if scene_ids and scene_count <= len(scene_ids):
            raise HTTPException(400, "Cannot delete every scene in the manuscript")
        if scene_ids:
            placeholders = ",".join("?" for _ in scene_ids)
            conn.execute(f"DELETE FROM suggestions WHERE scene_id IN ({placeholders})", scene_ids)
            conn.execute(f"UPDATE events SET scene_id = NULL WHERE scene_id IN ({placeholders})", scene_ids)
            conn.execute(f"UPDATE continuity_flags SET scene_id = NULL WHERE scene_id IN ({placeholders})", scene_ids)
        conn.execute("DELETE FROM scenes WHERE chapter_id = ?", (chapter_id,))
        conn.execute("DELETE FROM chapters WHERE id = ?", (chapter_id,))
        conn.commit()

        for row in scene_rows:
            _remove_scene_file(root, row["file_rel_path"])
        return {"ok": True}
    finally:
        conn.close()


@router.post("/chapters/{chapter_id}/scenes")
def create_scene(project_id: str, chapter_id: str, title: str = Query("New Scene")):
    import uuid
    from datetime import datetime, timezone

    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        ch = conn.execute("SELECT slug FROM chapters WHERE id = ?", (chapter_id,)).fetchone()
        if not ch:
            raise HTTPException(404, "Chapter not found")
        max_ord = conn.execute(
            "SELECT COALESCE(MAX(sort_order), -1) FROM scenes WHERE chapter_id = ?", (chapter_id,)
        ).fetchone()[0]
        sc_id = str(uuid.uuid4())
        sc_slug = f"scene-{max_ord + 2}"
        rel = f"manuscript/{ch['slug']}/{sc_slug}.md"
        scene_dir = root / "manuscript" / ch["slug"]
        scene_dir.mkdir(parents=True, exist_ok=True)
        (root / rel).write_text(f"# {title}\n\n", encoding="utf-8")
        conn.execute(
            "INSERT INTO scenes (id, chapter_id, sort_order, title, slug, file_rel_path) VALUES (?, ?, ?, ?, ?, ?)",
            (sc_id, chapter_id, max_ord + 1, title, sc_slug, rel),
        )
        conn.commit()
        return {"id": sc_id, "file_rel_path": rel}
    finally:
        conn.close()


@router.delete("/scenes/{scene_id}")
def delete_scene(project_id: str, scene_id: str):
    root = _root(project_id)
    conn = connect_project_db(root)
    try:
        row = conn.execute("SELECT file_rel_path FROM scenes WHERE id = ?", (scene_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Scene not found")
        scene_count = conn.execute("SELECT COUNT(*) FROM scenes").fetchone()[0]
        if scene_count <= 1:
            raise HTTPException(400, "Cannot delete the last scene")

        conn.execute("DELETE FROM suggestions WHERE scene_id = ?", (scene_id,))
        conn.execute("UPDATE events SET scene_id = NULL WHERE scene_id = ?", (scene_id,))
        conn.execute("UPDATE continuity_flags SET scene_id = NULL WHERE scene_id = ?", (scene_id,))
        conn.execute("DELETE FROM scenes WHERE id = ?", (scene_id,))
        conn.commit()

        _remove_scene_file(root, row["file_rel_path"])
        return {"ok": True}
    finally:
        conn.close()
