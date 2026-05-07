from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from ..database import connect_project_db, get_project_root
from ..schemas import CaptureProposal, WikiApplyRequest, WikiPopulateRequest, WikiFileOut, WikiWrite
from ..wiki_flow import apply_timeline, apply_wiki, proposals_from_canvas_nodes, proposals_from_manuscript_scene, wiki_proposal

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


@router.post("/populate")
def wiki_populate(project_id: str, body: WikiPopulateRequest):
    root = _root(project_id)
    proposals: list[dict] = []
    if body.source == "canvas":
        nodes = [node.model_dump() for node in (body.canvas.nodes if body.canvas else [])]
        proposals = proposals_from_canvas_nodes(root, nodes)
    elif body.source == "manuscript":
        if not body.scene_id:
            raise HTTPException(400, "scene_id is required for manuscript source")
        conn = connect_project_db(root)
        try:
            row = conn.execute("SELECT title, file_rel_path FROM scenes WHERE id = ?", (body.scene_id,)).fetchone()
            if not row:
                raise HTTPException(404, "Scene not found")
            path = (root / row["file_rel_path"]).resolve()
            path.relative_to(root.resolve())
            text = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
            proposals = proposals_from_manuscript_scene(root, body.scene_id, text, row["title"])
        finally:
            conn.close()
    else:
        text = (body.text or "").strip()
        if not text:
            raise HTTPException(400, "text is required")
        proposal = wiki_proposal(root, source=body.source or "text", source_id="", kind="Worldbuilding", title=body.title or "Story note", body=text)
        proposals = [proposal] if proposal else []

    return {
        "proposals": proposals,
        "summary": f"{len(proposals)} Wiki update proposal(s).",
    }


@router.post("/populate/apply")
def wiki_populate_apply(project_id: str, body: WikiApplyRequest):
    root = _root(project_id)
    if not body.apply:
        return {"applied": False, "proposals": [proposal.model_dump() for proposal in body.proposals]}
    items: list[dict[str, str]] = []
    for proposal in body.proposals:
        try:
            if proposal.kind == "wiki":
                items.append(apply_wiki(root, proposal))
            elif proposal.kind == "timeline_event":
                items.append(apply_timeline(root, proposal))
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    applied = sum(1 for item in items if item.get("status") == "applied")
    skipped = sum(1 for item in items if item.get("status") == "skipped")
    return {"applied": True, "items": items, "summary": f"{applied} applied · {skipped} skipped"}


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
