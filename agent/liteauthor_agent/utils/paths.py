from pathlib import Path


def read_file_safe(root: Path, rel: str, limit: int) -> str:
    p = (root / rel).resolve()
    if not str(p).startswith(str(root.resolve())):
        return ""
    if not p.is_file():
        return ""
    text = p.read_text(encoding="utf-8", errors="replace")
    return text[:limit]
