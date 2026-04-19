import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..database import create_project_files, get_project_root, list_projects, connect_registry
from ..schemas import ProjectCreate, ProjectOut

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def api_list_projects():
    rows = list_projects()
    out: list[ProjectOut] = []
    for r in rows:
        settings = {}
        if r.get("settings_json"):
            try:
                settings = json.loads(r["settings_json"])
            except json.JSONDecodeError:
                settings = {}
        out.append(
            ProjectOut(
                id=r["id"],
                name=r["name"],
                root_path=r["root_path"],
                settings=settings,
                created_at=r["created_at"],
            )
        )
    return out


@router.post("", response_model=ProjectOut)
def api_create_project(body: ProjectCreate):
    try:
        pid, root = create_project_files(body.name, body.genres, body.target_words)
    except FileExistsError:
        raise HTTPException(status_code=500, detail="Could not create project directory")
    reg = connect_registry()
    try:
        row = reg.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
        settings = json.loads(row["settings_json"] or "{}")
        return ProjectOut(
            id=row["id"],
            name=row["name"],
            root_path=row["root_path"],
            settings=settings,
            created_at=row["created_at"],
        )
    finally:
        reg.close()


@router.get("/{project_id}", response_model=ProjectOut)
def api_get_project(project_id: str):
    reg = connect_registry()
    try:
        row = reg.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Project not found")
        settings = json.loads(row["settings_json"] or "{}")
        return ProjectOut(
            id=row["id"],
            name=row["name"],
            root_path=row["root_path"],
            settings=settings,
            created_at=row["created_at"],
        )
    finally:
        reg.close()


@router.get("/{project_id}/stats")
def api_project_stats(project_id: str):
    root = Path(get_project_root(project_id))
    chars = 0
    for p in root.rglob("*.md"):
        if "snapshot" in p.parts:
            continue
        try:
            chars += len(p.read_text(encoding="utf-8", errors="replace"))
        except OSError:
            pass
    wiki_chars = 0
    story = root / "story"
    if story.is_dir():
        for p in story.rglob("*.md"):
            try:
                wiki_chars += len(p.read_text(encoding="utf-8", errors="replace"))
            except OSError:
                pass
    char_count = len(list((root / "story" / "characters").glob("*.md"))) if (root / "story" / "characters").is_dir() else 0
    return {"chars": chars, "wiki_chars": wiki_chars, "character_files": char_count}
