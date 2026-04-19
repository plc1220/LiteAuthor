from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from ..database import get_project_root
from ..schemas import WikiFileOut, WikiWrite

router = APIRouter(prefix="/api/projects/{project_id}/wiki", tags=["wiki"])

CHARACTER_TEMPLATE = """# Character Name

## Core
- Role:
- Desire:
- Fear:
- Wound:

## Current State
- Emotion:
- Current Goal:
- Recent Shift:

## Knowledge
- Knows:
- Suspects:
- Does Not Know:

## Relationships

## Recurring Imagery

## Voice Notes
- Speech rhythm:
- Vocabulary:
- Things to avoid:
"""


def _root(project_id: str) -> Path:
    return Path(get_project_root(project_id))


def _safe_rel(rel: str) -> Path:
    rel = rel.lstrip("/").replace("..", "")
    return Path(rel)


@router.get("/tree", response_model=list[WikiFileOut])
def wiki_tree(project_id: str):
    base = _root(project_id)
    story = base / "story"
    if not story.is_dir():
        return []
    out: list[WikiFileOut] = []
    for p in sorted(story.rglob("*")):
        rel = str(p.relative_to(base))
        if p.is_dir():
            out.append(WikiFileOut(path=rel, is_dir=True))
        elif p.suffix == ".md":
            out.append(WikiFileOut(path=rel, is_dir=False))
    return out


@router.get("/file")
def wiki_get_file(project_id: str, path: str):
    root = _root(project_id)
    p = (root / _safe_rel(path)).resolve()
    if not str(p).startswith(str(root.resolve())) or not p.is_file():
        raise HTTPException(404, "File not found")
    return {"path": path, "content": p.read_text(encoding="utf-8")}


@router.put("/file")
def wiki_put_file(project_id: str, path: str, body: WikiWrite):
    root = _root(project_id)
    p = (root / _safe_rel(path)).resolve()
    if not str(p).startswith(str(root.resolve())):
        raise HTTPException(400, "Invalid path")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body.content, encoding="utf-8")
    return {"ok": True}


@router.post("/characters")
def wiki_new_character(project_id: str, slug: str = Query(..., min_length=1)):
    root = _root(project_id)
    safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in slug).strip("-").lower() or "character"
    rel = f"story/characters/{safe}.md"
    p = (root / rel).resolve()
    if not str(p).startswith(str(root.resolve())):
        raise HTTPException(400, "Invalid slug")
    if p.exists():
        raise HTTPException(409, "Character exists")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(CHARACTER_TEMPLATE, encoding="utf-8")
    return {"path": rel}


@router.post("/locations")
def wiki_new_location(project_id: str, slug: str = Query(..., min_length=1)):
    root = _root(project_id)
    safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in slug).strip("-").lower() or "location"
    rel = f"story/locations/{safe}.md"
    p = (root / rel).resolve()
    if not str(p).startswith(str(root.resolve())):
        raise HTTPException(400, "Invalid slug")
    if p.exists():
        raise HTTPException(409, "Location exists")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(f"# {slug}\n\n", encoding="utf-8")
    return {"path": rel}
