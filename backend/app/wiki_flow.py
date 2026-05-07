import hashlib
import json
import re
import uuid
from pathlib import Path
from typing import Any

from .database import connect_project_db
from .schemas import CaptureProposal


WIKI_TARGETS = {
    "Premise": "story/premise.md",
    "Theme": "story/themes.md",
    "Mystery": "story/unresolved_threads.md",
    "Question": "story/unresolved_threads.md",
    "Rule": "story/worldbuilding.md",
    "Worldbuilding": "story/worldbuilding.md",
    "Timeline": "story/timeline.md",
    "Scene": "story/outline.md",
    "Character": "story/characters/{slug}.md",
    "Location": "story/locations/{slug}.md",
    "Motif": "story/motifs.md",
    "Message": "story/motifs.md",
    "Reveal": "story/motifs.md",
}

_LORE_HINTS = (
    "天体",
    "理论",
    "实验",
    "量子",
    "引力",
    "相干",
    "Cyg",
    "欧米伽",
    "莫比乌斯",
    "MQG",
    "因果湍流",
    "热时间",
)
_EVENT_HINTS = ("第一部", "第二部", "第三部", "第四部", "第五部", "第六部", "阶段", "战争", "灾难", "发现", "建造", "收到")


def safe_slug(text: str, fallback: str = "item") -> str:
    slug = "".join(c.lower() if c.isalnum() else "-" for c in text).strip("-")
    slug = re.sub(r"-+", "-", slug)
    return slug[:80] or fallback


def extract_story_time(text: str) -> str | None:
    match = re.search(r"(?:约)?\d{4,5}\s*(?:年|\\+)?(?:\s*[—-]\s*\d{4,5}\s*年?)?", text)
    return match.group(0) if match else None


def source_fingerprint(source: str, title: str, body: str) -> str:
    payload = f"{source}\n{title.strip().lower()}\n{body.strip()[:4000]}"
    return hashlib.sha1(payload.encode("utf-8", errors="replace")).hexdigest()[:16]


def proposal_id(source: str, target: str, title: str, body: str) -> str:
    return f"proposal-{source_fingerprint(source + target, title, body)}"


def normalize_kind(kind: str, title: str, body: str) -> str:
    text = f"{title}\n{body}"
    if kind == "Timeline" and "时间跨度" in title:
        return "Timeline"
    if kind == "Timeline" and any(hint in text for hint in _LORE_HINTS) and not any(hint in title for hint in _EVENT_HINTS):
        return "Worldbuilding"
    if kind in {"Message", "Reveal"}:
        return "Motif"
    return kind if kind in WIKI_TARGETS else "Worldbuilding"


def compact_body(body: str, limit: int = 1400) -> str:
    cleaned = re.sub(r"\n{3,}", "\n\n", body.strip())
    if len(cleaned) <= limit:
        return cleaned
    cut = cleaned[:limit].rsplit("\n", 1)[0].strip()
    return (cut or cleaned[:limit]).rstrip() + "\n\n..."


def wiki_target(kind: str, title: str) -> str:
    target = WIKI_TARGETS.get(kind, "story/worldbuilding.md")
    if "{slug}" in target:
        target = target.format(slug=safe_slug(title, kind.lower()))
    return target


def existing_contains(root: Path, target: str, title: str, fingerprint: str) -> bool:
    path = root / target
    if not path.exists():
        return False
    existing = path.read_text(encoding="utf-8", errors="replace")
    normalized_heading = re.escape(title.strip())
    return f"source-fingerprint: {fingerprint}" in existing or re.search(rf"^##\s+{normalized_heading}\s*$", existing, re.M) is not None


def wiki_content(title: str, body: str, *, source: str, source_id: str, fingerprint: str, kind: str) -> str:
    return (
        f"\n\n## {title}\n\n"
        f"{compact_body(body)}\n\n"
        f"_Source: {source}"
        f"{f' · {source_id}' if source_id else ''}_\n"
        f"<!-- source-fingerprint: {fingerprint}; semantic-type: {kind} -->\n"
    )


def wiki_proposal(root: Path, *, source: str, source_id: str, kind: str, title: str, body: str) -> dict[str, Any] | None:
    title = title.strip() or "Untitled"
    body = body.strip()
    if not body:
        return None
    normalized = normalize_kind(kind, title, body)
    target = wiki_target(normalized, title)
    fingerprint = source_fingerprint(source, title, body)
    if existing_contains(root, target, title, fingerprint):
        return None
    return {
        "id": proposal_id(source, target, title, body),
        "kind": "wiki",
        "title": title,
        "target": target,
        "content": wiki_content(title, body, source=source, source_id=source_id, fingerprint=fingerprint, kind=normalized),
        "source_node_ids": [source_id] if source_id else [],
        "metadata": {"semantic_type": normalized, "source": source, "fingerprint": fingerprint},
    }


def should_create_timeline_event(kind: str, title: str, body: str) -> bool:
    text = f"{title}\n{body}"
    if "时间跨度" in title:
        return False
    if not extract_story_time(text):
        return False
    if kind == "Scene":
        return True
    if kind == "Timeline" and any(hint in title for hint in _EVENT_HINTS):
        return True
    return False


def timeline_event_proposal(*, source: str, source_id: str, kind: str, title: str, body: str) -> dict[str, Any] | None:
    if not should_create_timeline_event(kind, title, body):
        return None
    story_time = extract_story_time(f"{title}\n{body}")
    return {
        "id": proposal_id(source + ":event", "timeline/events", title, body),
        "kind": "timeline_event",
        "title": title,
        "target": "timeline/events",
        "content": compact_body(body, 900),
        "source_node_ids": [source_id] if source_id else [],
        "metadata": {"story_time": story_time, "semantic_type": kind, "source": source},
    }


def manuscript_entities(text: str) -> list[tuple[str, str]]:
    known = ["林阙", "凯尔", "委员会", "线性派", "回声派", "鸦巢", "K-42", "Cyg-X9b", "欧米伽天体", "莫比乌斯天体"]
    found: list[tuple[str, str]] = []
    for name in known:
        if name in text:
            kind = "Character" if name in {"林阙", "凯尔"} else "Worldbuilding"
            found.append((kind, name))
    return found


def proposals_from_canvas_nodes(root: Path, nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    proposals: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for node in nodes:
        meta = node.get("metadata") or {}
        raw_kind = str(meta.get("semantic_type") or node.get("type") or "Worldbuilding")
        if raw_kind == "Artifact":
            continue
        title = str(node.get("label") or "Untitled").strip()
        body = str(node.get("text") or "").strip()
        source_id = str(node.get("id") or "")
        for proposal in (
            wiki_proposal(root, source="canvas", source_id=source_id, kind=raw_kind, title=title, body=body),
            timeline_event_proposal(source="canvas", source_id=source_id, kind=raw_kind, title=title, body=body),
        ):
            if proposal and proposal["id"] not in seen_ids:
                seen_ids.add(proposal["id"])
                proposals.append(proposal)
    return proposals


def proposals_from_manuscript_scene(root: Path, scene_id: str, markdown: str, title: str) -> list[dict[str, Any]]:
    proposals: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    body = markdown.strip()
    if body:
        summary = compact_body(body, 1200)
        proposal = wiki_proposal(root, source="manuscript", source_id=scene_id, kind="Scene", title=title, body=summary)
        if proposal:
            proposal["target"] = "story/outline.md"
            proposal["metadata"]["semantic_type"] = "Scene"
            proposals.append(proposal)
            seen_ids.add(proposal["id"])
        event = timeline_event_proposal(source="manuscript", source_id=scene_id, kind="Scene", title=title, body=body)
        if event:
            proposals.append(event)
            seen_ids.add(event["id"])

    for kind, name in manuscript_entities(markdown):
        context_lines = [line.strip() for line in markdown.splitlines() if name in line][:4]
        context = "\n".join(f"- {line}" for line in context_lines) or f"- Mentioned in manuscript scene: {title}"
        proposal = wiki_proposal(root, source="manuscript", source_id=scene_id, kind=kind, title=name, body=context)
        if proposal and proposal["id"] not in seen_ids:
            seen_ids.add(proposal["id"])
            proposals.append(proposal)

    if "?" in markdown or "？" in markdown:
        proposal = wiki_proposal(root, source="manuscript", source_id=scene_id, kind="Question", title=f"Open question from {title}", body=compact_body(markdown, 900))
        if proposal and proposal["id"] not in seen_ids:
            proposals.append(proposal)
    return proposals


def apply_wiki(root: Path, proposal: CaptureProposal) -> dict[str, str]:
    rel = proposal.target.lstrip("/").replace("..", "")
    if not rel.startswith("story/") or not rel.endswith(".md"):
        raise ValueError(f"Invalid wiki target: {proposal.target}")
    path = (root / rel).resolve()
    path.relative_to(root.resolve())
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
    fingerprint = str(proposal.metadata.get("fingerprint") or "")
    title = proposal.title.strip()
    if fingerprint and f"source-fingerprint: {fingerprint}" in existing:
        return {"kind": "wiki", "target": rel, "status": "skipped"}
    if title and re.search(rf"^##\s+{re.escape(title)}\s*$", existing, re.M):
        return {"kind": "wiki", "target": rel, "status": "skipped"}
    path.write_text(existing.rstrip() + "\n" + proposal.content, encoding="utf-8")
    return {"kind": "wiki", "target": rel, "status": "applied"}


def apply_timeline(root: Path, proposal: CaptureProposal) -> dict[str, str]:
    conn = connect_project_db(root)
    try:
        existing = conn.execute("SELECT id FROM events WHERE title = ? AND COALESCE(story_time, '') = COALESCE(?, '')", (proposal.title, proposal.metadata.get("story_time"))).fetchone()
        if existing:
            return {"kind": "timeline_event", "target": existing["id"], "status": "skipped"}
        eid = str(uuid.uuid4())
        max_order = conn.execute("SELECT COALESCE(MAX(narrative_order), 0) FROM events").fetchone()[0]
        conn.execute(
            """
            INSERT INTO events (id, title, story_time, narrative_order, pov, participants_json, dependencies_json, notes, has_conflict, scene_id)
            VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 0, ?)
            """,
            (
                eid,
                proposal.title,
                proposal.metadata.get("story_time"),
                max_order + 1,
                json.dumps([]),
                json.dumps([]),
                proposal.content,
                proposal.source_node_ids[0] if str(proposal.metadata.get("source")) == "manuscript" and proposal.source_node_ids else None,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return {"kind": "timeline_event", "target": eid, "status": "applied"}
