from pathlib import Path

from fastapi import APIRouter

from ..database import get_project_root

router = APIRouter(prefix="/api/projects/{project_id}/search", tags=["search"])


@router.get("")
def search_project(project_id: str, q: str, limit: int = 20):
    root = Path(get_project_root(project_id))
    q_lower = q.lower()
    hits: list[dict] = []
    for p in root.rglob("*.md"):
        if "snapshot" in p.parts:
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if q_lower in text.lower() or q_lower in p.name.lower():
            rel = str(p.relative_to(root))
            line_no = None
            for i, line in enumerate(text.splitlines(), start=1):
                if q_lower in line.lower():
                    line_no = i
                    snippet = line.strip()[:200]
                    break
            else:
                snippet = text[:200].replace("\n", " ")
            hits.append({"path": rel, "line": line_no, "snippet": snippet})
            if len(hits) >= limit:
                break
    return {"hits": hits}
