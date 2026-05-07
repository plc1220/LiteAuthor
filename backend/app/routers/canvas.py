import asyncio
import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from ..database import connect_project_db, get_project_root
from ..schemas import CanvasAnalyzeRequest, CanvasAutosortRequest, CanvasCaptureRequest, CaptureProposal, Canvas
from ..wiki_flow import apply_timeline, apply_wiki, proposals_from_canvas_nodes

router = APIRouter(prefix="/api/projects/{project_id}/canvas", tags=["canvas"])
logger = logging.getLogger(__name__)

CANVAS_REL = Path("story") / "canvases" / "story.canvas"

TYPE_COLORS = {
    "Artifact": "#f5ead7",
    "Theme": "#f3d2c1",
    "Premise": "#d7e7d1",
    "AntiPremise": "#ead2d8",
    "Stance": "#d9d4f2",
    "Character": "#d7e7d1",
    "Timeline": "#d4e2f2",
    "Scene": "#f8df9f",
    "Worldbuilding": "#d9d4f2",
    "Message": "#f0c8d2",
    "Mystery": "#efe3a5",
    "Motif": "#e8d8bd",
    "Question": "#efe3a5",
    "Reveal": "#c7e4df",
    "Rule": "#d7d3c8",
}

SEMANTIC_TARGETS = {
    "Premise": "story/premise.md",
    "Theme": "story/themes.md",
    "Mystery": "story/unresolved_threads.md",
    "AntiPremise": "story/premise.md",
    "Stance": "story/worldview.md",
    "Rule": "story/worldbuilding.md",
    "Worldbuilding": "story/worldbuilding.md",
    "Motif": "story/motifs.md",
    "Question": "story/unresolved_threads.md",
    "Reveal": "story/motifs.md",
    "Message": "story/motifs.md",
    "Timeline": "story/timeline.md",
    "Scene": "story/outline.md",
}


def _root(project_id: str) -> Path:
    return Path(get_project_root(project_id))


def _canvas_path(root: Path) -> Path:
    path = (root / CANVAS_REL).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        raise HTTPException(400, "Invalid canvas path")
    return path


def _safe_slug(text: str, fallback: str = "item") -> str:
    slug = "".join(c.lower() if c.isalnum() else "-" for c in text).strip("-")
    slug = re.sub(r"-+", "-", slug)
    return slug[:80] or fallback


def _empty_canvas() -> dict[str, Any]:
    return {"version": "liteauthor.canvas.v1", "nodes": [], "edges": [], "metadata": {}}


def _split_chunks(text: str) -> list[tuple[str, str]]:
    lines = text.replace("\r\n", "\n").split("\n")
    chunks: list[tuple[str, list[str]]] = []
    current_title = "Artifact"
    current: list[str] = []

    for line in lines:
        stripped = line.strip()
        is_heading = stripped.startswith("#") or (
            len(stripped) <= 48
            and stripped
            and not stripped.startswith(("*", "-", ">"))
            and (stripped.endswith("：") or stripped.startswith(("第一", "第二", "第三", "第四", "第五", "第六")))
        )
        if is_heading and current:
            chunks.append((current_title, current))
            current = []
        if is_heading:
            current_title = stripped.lstrip("#").strip().rstrip("：") or current_title
        else:
            current.append(line)

    if current or not chunks:
        chunks.append((current_title, current))

    normalized: list[tuple[str, str]] = []
    for title, body_lines in chunks:
        body = "\n".join(body_lines).strip()
        if body:
            normalized.append((title, body))
    return normalized[:48]


def _markdown_section_chunks(text: str) -> list[tuple[str, str]]:
    lines = text.replace("\r\n", "\n").split("\n")
    chunks: list[tuple[str, list[str]]] = []
    current_title = _first_nonempty_line(text)
    current: list[str] = []

    for line in lines:
        stripped = line.strip()
        heading = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if heading:
            level = len(heading.group(1))
            title = heading.group(2).strip()
            if level > 2:
                current.append(line)
                continue
            if current and (level <= 2 or len("\n".join(current)) > 500):
                chunks.append((current_title, current))
                current = []
            current_title = title or current_title
            continue
        if stripped == "---":
            if current:
                chunks.append((current_title, current))
                current = []
            continue
        current.append(line)

    if current:
        chunks.append((current_title, current))

    normalized: list[tuple[str, str]] = []
    for title, body_lines in chunks:
        body = "\n".join(body_lines).strip()
        if body and len(body) >= 20:
            normalized.append((title, body))
    return normalized[:36]


def _first_nonempty_line(text: str) -> str:
    for line in text.replace("\r\n", "\n").split("\n"):
        stripped = line.strip().lstrip("#").strip()
        if stripped:
            return stripped[:96]
    return "Raw outline"


def _sentences(text: str) -> list[str]:
    compact = re.sub(r"[ \t]+", " ", text.replace("\r\n", "\n")).strip()
    pieces = re.split(r"(?<=[。！？.!?])\s*|\n+", compact)
    return [piece.strip(" \t-•") for piece in pieces if piece.strip(" \t-•")]


def _extract_json_object(text: str) -> dict[str, Any] | None:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    try:
        data = json.loads(stripped)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        data = json.loads(stripped[start : end + 1])
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _normalize_model_cards(data: dict[str, Any]) -> list[dict[str, Any]]:
    raw_cards = data.get("cards")
    if not isinstance(raw_cards, list):
        return []
    allowed = {
        "Premise",
        "Theme",
        "Character",
        "Mystery",
        "Rule",
        "Timeline",
        "Scene",
        "Worldbuilding",
        "Motif",
        "Question",
        "AntiPremise",
        "Stance",
        "Message",
        "Reveal",
    }
    cards: list[dict[str, Any]] = []
    for item in raw_cards[:18]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        body = str(item.get("body") or item.get("content") or "").strip()
        if not title or not body:
            continue
        kind = str(item.get("type") or item.get("kind") or "Scene").strip()
        if kind not in allowed:
            kind = "Question" if "?" in title or "？" in title else "Scene"
        tags_raw = item.get("tags")
        tags = [str(tag).strip()[:32] for tag in tags_raw if str(tag).strip()] if isinstance(tags_raw, list) else [kind]
        try:
            confidence = float(item.get("confidence", 0.78))
        except (TypeError, ValueError):
            confidence = 0.78
        cards.append(
            {
                "type": kind,
                "title": title[:96],
                "body": body[:1800],
                "tags": tags[:5],
                "confidence": max(0.0, min(1.0, confidence)),
            }
        )
    return cards


async def _semantic_cards_bonsai(text: str) -> list[dict[str, Any]]:
    prompt = f"""
Extract movable Canvas cards from the supplied writing source packet. It may contain typed notes, pasted text, file text, or attachment descriptions.

Return JSON only, no markdown, matching this schema:
{{
  "cards": [
    {{
      "type": "Premise | Theme | Character | Mystery | Rule | Timeline | Scene | Worldbuilding | Motif | Question",
      "title": "short writer-facing title in the input language",
      "body": "the relevant source meaning, rewritten only enough to stand alone",
      "tags": ["short tags"],
      "confidence": 0.0
    }}
  ]
}}

Rules:
- Extract semantic meaning units, not line fragments.
- Keep section labels as context; do not make cards like "这是一个关于：" unless they contain a complete idea.
- Preserve the source language.
- Prefer 4-10 strong cards over many weak cards.
- Do not invent plot facts beyond the source packet.

SOURCE PACKET:
{text[:12000]}
""".strip()
    from liteauthor_agent.llm_gateway.mlx_client import canvas_extraction_mlx_sync

    result = await asyncio.wait_for(
        asyncio.to_thread(
            canvas_extraction_mlx_sync,
            [
                {"role": "system", "content": "You are a concise story-structure extraction engine. Return valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            1800,
        ),
        timeout=45,
    )
    data = _extract_json_object(result)
    return _normalize_model_cards(data or {})


def _semantic_cards_rule_fallback(text: str) -> list[dict[str, Any]]:
    """General rule fallback; the model path should handle real semantic extraction."""
    sentences = _sentences(text)
    source_title = _first_nonempty_line(text)
    cards: list[dict[str, Any]] = []

    def add(kind: str, title: str, body: str, tags: list[str], confidence: float) -> None:
        body = body.strip()
        if not body or any(card["title"] == title for card in cards):
            return
        cards.append(
            {
                "type": kind,
                "title": title[:96],
                "body": body,
                "tags": tags,
                "confidence": confidence,
            }
        )

    section_chunks = _markdown_section_chunks(text)
    if len(section_chunks) >= 2 or len(text) > 4000:
        for title, body in section_chunks:
            if title == source_title and len(body) < 120:
                continue
            kind, tags, confidence = _classify(title, body)
            lowered = f"{title}\n{body}".lower()
            if "Manuscript Part" in tags:
                kind = "Scene"
            elif any(word in lowered for word in ("主题", "意义", "theme")):
                kind = "Theme"
            elif any(word in lowered for word in ("时间", "2147", "2163", "6000", "10000", "一万年")):
                kind = "Timeline"
            elif any(word in lowered for word in ("设定", "天体", "量子", "引力", "cyg", "欧米伽", "mqg")):
                kind = "Worldbuilding"
            elif any(word in lowered for word in ("战争", "委员会", "派")):
                kind = "Rule"
            add(kind, title, body[:1800], tags or [kind], max(confidence, 0.66))
        if cards:
            return cards[:24]

    for sentence in sentences:
        if len(sentence) < 12 or sentence.endswith(("：", ":")):
            continue
        if sentence == source_title:
            continue
        heading_like = len(sentence) <= 28 and not re.search(r"[。！？.!?，,；;]", sentence)
        if heading_like and not any(word in sentence for word in ("是", "不是", "必须", "只能", "没有")):
            continue
        kind = "Question" if sentence.endswith(("？", "?")) or any(word in sentence for word in ("是否", "为什么", "如何")) else "Scene"
        if any(word in sentence for word in ("主题", "意义", "信念", "价值")):
            kind = "Theme"
        elif any(word in sentence for word in ("谜", "秘密", "真相", "不存在", "第一")):
            kind = "Mystery"
        elif any(word in sentence for word in ("必须", "只能", "不可", "规则", "代价")):
            kind = "Rule"
        elif any(word in sentence for word in ("世界", "宇宙", "城市", "文明", "王国", "系统")):
            kind = "Worldbuilding"
        elif any(word in sentence for word in ("主角", "她", "他", "角色", "母亲", "父亲")):
            kind = "Character"
        title = sentence[:42].rstrip("，,。.!！?？")
        add(kind, title, sentence, [kind], 0.62)
        if len(cards) >= 10:
            break

    if len(cards) >= 3:
        return cards

    for title, body in _split_chunks(text):
        kind, tags, confidence = _classify(title, body)
        if len(body) < 12 or body.rstrip().endswith("："):
            continue
        add(kind, title, body, tags or [kind], confidence)
    return cards[:12]


async def _semantic_cards(text: str) -> tuple[list[dict[str, Any]], str]:
    try:
        cards = await _semantic_cards_bonsai(text)
        if cards:
            return cards, "model"
    except Exception as exc:
        logger.info("Canvas Bonsai extraction unavailable; using rule fallback: %s", exc)
    return _semantic_cards_rule_fallback(text), "rule_fallback"


def _classify(title: str, body: str) -> tuple[str, list[str], float]:
    text = f"{title}\n{body}".lower()
    tags: list[str] = []
    kind = "Scene"
    confidence = 0.62

    checks = [
        ("Theme", ["主题", "意义", "空无", "伟大", "核心故事"]),
        ("Character", ["林阙", "凯尔", "主角", "自己", "锚点是人"]),
        ("Timeline", ["2147", "2163", "2200", "6000", "10000", "一万年", "时间线"]),
        ("Worldbuilding", ["cyg", "天体", "量子", "引力", "相干", "黑洞", "欧米伽", "莫比乌斯"]),
        ("Message", ["讯息", "观察天鹅座", "不要建造", "你来得比"]),
        ("Mystery", ["谁", "是否", "不存在", "真相", "发现", "谜"]),
        ("Reveal", ["终于明白", "后来才知道", "最后", "揭示", "真相"]),
        ("Rule", ["必须", "不可", "只能", "铁律", "规则", "代价"]),
    ]
    for label, needles in checks:
        if any(needle in text for needle in needles):
            tags.append(label)

    if tags:
        kind = tags[0]
        confidence = min(0.95, 0.68 + len(tags) * 0.06)
    if title.startswith(("第一部", "第二部", "第三部", "第四部", "第五部", "第六部")):
        kind = "Scene"
        tags = ["Manuscript Part", *tags]
        confidence = 0.9

    return kind, tags[:4], confidence


def _proposals_for_node(node: dict[str, Any]) -> list[dict[str, Any]]:
    meta = node.get("metadata") or {}
    title = str(node.get("label") or "Untitled").strip()
    body = str(node.get("text") or "").strip()
    kind = str(meta.get("semantic_type") or "Scene")
    node_id = str(node.get("id"))
    proposals: list[dict[str, Any]] = []

    if not body:
        return proposals

    if kind in SEMANTIC_TARGETS:
        target = SEMANTIC_TARGETS[kind]
        proposals.append(
            {
                "id": f"proposal-{node_id}",
                "kind": "wiki",
                "title": title,
                "target": target,
                "content": f"\n\n## {title}\n\n{body}\n\n_Source canvas node: {node_id}_\n",
                "source_node_ids": [node_id],
                "metadata": {"semantic_type": kind},
            }
        )

    if kind == "Character":
        slug = _safe_slug(title, "character")
        proposals.append(
            {
                "id": f"proposal-character-{node_id}",
                "kind": "wiki",
                "title": title,
                "target": f"story/characters/{slug}.md",
                "content": f"# {title}\n\n## Source Notes\n\n{body}\n\n_Source canvas node: {node_id}_\n",
                "source_node_ids": [node_id],
                "metadata": {"semantic_type": kind},
            }
        )

    if kind in {"Timeline", "Scene"} or "Manuscript Part" in (meta.get("tags") or []):
        proposals.append(
            {
                "id": f"proposal-event-{node_id}",
                "kind": "timeline_event",
                "title": title,
                "target": "timeline/events",
                "content": body[:1200],
                "source_node_ids": [node_id],
                "metadata": {"story_time": _extract_story_time(f"{title}\n{body}")},
            }
        )

    # Scene (and explicit manuscript sections) can be applied into the manuscript DB + files.
    # Previously only "Manuscript Part" tagged chunks got a chapter proposal, so normal Scene
    # cards never offered a path into ZenEditor/manuscript despite the UI showing "scene".
    if kind == "Scene" or "Manuscript Part" in (meta.get("tags") or []):
        proposals.append(
            {
                "id": f"proposal-chapter-{node_id}",
                "kind": "chapter",
                "title": title,
                "target": "manuscript",
                "content": f"# {title}\n\n{body}\n\n_Source canvas node: {node_id}_\n",
                "source_node_ids": [node_id],
                "metadata": {},
            }
        )

    return proposals


def _extract_story_time(text: str) -> str | None:
    match = re.search(r"(?:约)?\d{4,5}\s*(?:年|\\+)?(?:\s*[—-]\s*\d{4,5}\s*年?)?", text)
    return match.group(0) if match else None


def _autosort(canvas: dict[str, Any], mode: str) -> dict[str, Any]:
    nodes = list(canvas.get("nodes") or [])
    mode = mode or "type"

    def semantic(node: dict[str, Any]) -> str:
        return str((node.get("metadata") or {}).get("semantic_type") or node.get("type") or "Other")

    if mode == "timeline":
        def key(node: dict[str, Any]) -> tuple[int, str]:
            text = f"{node.get('label', '')} {node.get('text', '')}"
            match = re.search(r"\d{4,5}", text)
            return (int(match.group(0)) if match else 999999, str(node.get("label") or ""))

        ordered = sorted(nodes, key=key)
        for i, node in enumerate(ordered):
            node["x"] = 80 + i * 340
            node["y"] = 180 + (i % 2) * 210
    elif mode == "causal":
        ordered = sorted(nodes, key=lambda n: (semantic(n) not in {"Message", "Mystery", "Reveal"}, str(n.get("label") or "")))
        for i, node in enumerate(ordered):
            node["x"] = 90 + (i % 6) * 330
            node["y"] = 120 + (i // 6) * 240
    elif mode == "confidence":
        ordered = sorted(nodes, key=lambda n: -float((n.get("metadata") or {}).get("confidence") or 0))
        for i, node in enumerate(ordered):
            node["x"] = 100 + (i % 4) * 360
            node["y"] = 120 + (i // 4) * 220
    else:
        source_nodes = [node for node in nodes if semantic(node) == "Artifact"]
        if source_nodes:
            for node in source_nodes:
                node["x"] = 90
                node["y"] = 120
        buckets: dict[str, list[dict[str, Any]]] = {}
        for node in nodes:
            if semantic(node) == "Artifact":
                continue
            buckets.setdefault(semantic(node), []).append(node)
        for col, kind in enumerate(sorted(buckets)):
            for row, node in enumerate(buckets[kind]):
                node["x"] = 520 + col * 340
                node["y"] = 100 + row * 220

    canvas["nodes"] = nodes
    canvas.setdefault("metadata", {})["layout_mode"] = mode
    return canvas


@router.get("", response_model=Canvas)
def get_canvas(project_id: str):
    root = _root(project_id)
    path = _canvas_path(root)
    if not path.is_file():
        return _empty_canvas()
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(400, "Canvas file is invalid JSON")


@router.put("", response_model=Canvas)
def put_canvas(project_id: str, canvas: Canvas):
    root = _root(project_id)
    path = _canvas_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = canvas.model_dump()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data


def _ui_artifacts(canvas: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i, node in enumerate(canvas.get("nodes") or []):
        meta = node.get("metadata") or {}
        kind = str(meta.get("semantic_type") or "note").lower()
        if kind == "artifact":
            continue
        ui_kind = (
            "question"
            if kind == "mystery"
            else "thread"
            if kind in {"theme", "rule", "worldbuilding", "premise", "antipremise", "stance"}
            else "beat"
            if kind in {"message", "reveal"}
            else "scene"
        )
        text = str(node.get("text") or "")
        out.append(
            {
                "id": node.get("id"),
                "title": node.get("label") or f"Artifact {i + 1}",
                "content": text,
                "excerpt": text[:220],
                "kind": ui_kind,
                "score": int(float(meta.get("confidence") or 0.6) * 100),
                "tags": meta.get("tags") or [meta.get("semantic_type") or "Note"],
                "order": i,
                "status": "review" if ui_kind == "question" else "draft",
            }
        )
    return out


def _ui_hints(canvas: dict[str, Any]) -> list[dict[str, Any]]:
    hints: list[dict[str, Any]] = []
    for i, node in enumerate((canvas.get("nodes") or [])[:8]):
        meta = node.get("metadata") or {}
        if meta.get("semantic_type") == "Artifact":
            continue
        confidence = float(meta.get("confidence") or 0.6)
        hints.append(
            {
                "id": f"hint-{node.get('id')}",
                "label": str(meta.get("semantic_type") or "Signal"),
                "detail": f"{node.get('label') or 'Untitled'} · {round(confidence * 100)}% confidence",
                "x": 16 + (i % 4) * 22,
                "y": 14 + (i // 4) * 18,
                "tone": "alert" if confidence < 0.72 else "warm",
            }
        )
    return hints


@router.post("/analyze")
async def analyze_artifact(project_id: str, body: CanvasAnalyzeRequest):
    root = _root(project_id)
    cards, extraction_provider = await _semantic_cards(body.text)
    artifact_id = f"artifact-{uuid.uuid4().hex[:8]}"
    source_title = body.title if body.title != "Artifact" else _first_nonempty_line(body.text)
    nodes: list[dict[str, Any]] = [
        {
            "id": artifact_id,
            "type": "artifact",
            "x": 80,
            "y": 80,
            "width": 360,
            "height": 220,
            "label": source_title,
            "text": body.text[:8000],
            "color": TYPE_COLORS["Artifact"],
            "metadata": {"semantic_type": "Artifact", "status": "Source", "role": "Raw paste block"},
        }
    ]
    edges: list[dict[str, Any]] = []
    proposals: list[dict[str, Any]] = []

    for i, card in enumerate(cards):
        kind = str(card.get("type") or "Note")
        title = str(card.get("title") or f"Card {i + 1}")
        chunk = str(card.get("body") or "")
        tags = list(card.get("tags") or [kind])
        confidence = float(card.get("confidence") or 0.72)
        node_id = f"node-{uuid.uuid4().hex[:8]}"
        node = {
            "id": node_id,
            "type": "sticky",
            "x": 520 + (i % 3) * 330,
            "y": 80 + (i // 3) * 230,
            "width": 300,
            "height": 180,
            "label": title,
            "text": chunk,
            "color": TYPE_COLORS.get(kind, "#eee1cf"),
            "metadata": {
                "semantic_type": kind,
                "tags": tags,
                "confidence": confidence,
                "source_artifact_id": artifact_id,
                "suggested_targets": [SEMANTIC_TARGETS.get(kind, "story/unresolved_threads.md")],
            },
        }
        nodes.append(node)
        edges.append(
            {
                "id": f"edge-{uuid.uuid4().hex[:8]}",
                "fromNode": artifact_id,
                "toNode": node_id,
                "label": "extracts",
                "metadata": {},
            }
        )
        proposals.extend(_proposals_for_node(node))

    canvas = _autosort(
        {
            "version": "liteauthor.canvas.v1",
            "nodes": nodes,
            "edges": edges,
            "metadata": {"source": "artifact-analyze", "extraction_provider": extraction_provider},
        },
        "type",
    )
    _canvas_path(root).parent.mkdir(parents=True, exist_ok=True)
    _canvas_path(root).write_text(json.dumps(canvas, ensure_ascii=False, indent=2), encoding="utf-8")
    artifacts = _ui_artifacts(canvas)
    proposals = proposals_from_canvas_nodes(root, canvas.get("nodes") or [])
    logger.info(
        "Canvas analyze project=%s extractor=%s cards=%s proposals=%s",
        project_id,
        extraction_provider,
        len(artifacts),
        len(proposals),
    )
    return {
        "canvas": canvas,
        "proposals": proposals,
        "artifacts": artifacts,
        "hints": _ui_hints(canvas),
        "summary": f"{len(artifacts)} cards · {len(proposals)} capture proposals · extractor: {extraction_provider}",
        "capture": "Review cards on the board. In Suggested updates, select proposals then Apply. Scene cards can add a manuscript chapter; other kinds update the wiki or timeline.",
        "extraction_provider": extraction_provider,
    }


@router.post("/autosort")
def autosort_canvas(project_id: str, body: dict[str, Any]):
    root = _root(project_id)
    mode = str(body.get("mode") or "type")
    if isinstance(body.get("artifacts"), list):
        artifacts = list(body["artifacts"])
        if mode in {"semantic", "type"}:
            artifacts.sort(key=lambda a: (str(a.get("kind") or ""), -int(a.get("score") or 0)))
        elif mode in {"chronological", "timeline"}:
            artifacts.sort(key=lambda a: int(a.get("order") or 0))
        elif mode in {"density", "confidence"}:
            artifacts.sort(key=lambda a: -len(str(a.get("content") or a.get("excerpt") or "")))
        return {"artifacts": artifacts, "summary": f"Autosorted {len(artifacts)} cards by {mode}."}

    canvas_body = body.get("canvas") or _empty_canvas()
    canvas = _autosort(canvas_body, mode)
    path = _canvas_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(canvas, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"canvas": canvas, "artifacts": _ui_artifacts(canvas), "hints": _ui_hints(canvas), "summary": f"Autosorted {len(canvas.get('nodes') or [])} canvas blocks by {mode}."}


@router.post("/capture")
def capture_canvas(project_id: str, body: dict[str, Any]):
    root = _root(project_id)
    if isinstance(body.get("artifacts"), list):
        selected = set(body.get("selected_ids") or [])
        artifacts = [a for a in body["artifacts"] if not selected or a.get("id") in selected]
        title = "Canvas capture"
        if artifacts:
            title = str(artifacts[0].get("title") or title)
        note = str(body.get("notes") or "").strip()
        review = note or "\n\n".join(str(a.get("excerpt") or a.get("content") or "") for a in artifacts[:3]).strip()
        return {
            "capture": f"{title}: {review}" if review else title,
            "summary": f"{len(artifacts)} selected card(s) ready for promotion.",
        }

    parsed = CanvasCaptureRequest(**body)
    if not parsed.apply:
        return {"applied": False, "proposals": [p.model_dump() for p in parsed.proposals]}

    applied: list[dict[str, str]] = []
    for proposal in parsed.proposals:
        if proposal.kind == "wiki":
            try:
                applied.append(apply_wiki(root, proposal))
            except ValueError as exc:
                raise HTTPException(400, str(exc)) from exc
        elif proposal.kind == "timeline_event":
            applied.append(apply_timeline(root, proposal))
        elif proposal.kind == "chapter":
            applied.append(_apply_chapter(root, proposal))
    return {"applied": True, "items": applied}


def _apply_wiki(root: Path, proposal: CaptureProposal) -> dict[str, str]:
    rel = proposal.target.lstrip("/").replace("..", "")
    if not rel.startswith("story/") or not rel.endswith(".md"):
        raise HTTPException(400, f"Invalid wiki target: {proposal.target}")
    path = (root / rel).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        raise HTTPException(400, "Invalid wiki target")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        existing = path.read_text(encoding="utf-8", errors="replace")
        path.write_text(existing.rstrip() + "\n" + proposal.content, encoding="utf-8")
    else:
        path.write_text(proposal.content.lstrip(), encoding="utf-8")
    return {"kind": "wiki", "target": rel}


def _apply_timeline(root: Path, proposal: CaptureProposal) -> dict[str, str]:
    eid = str(uuid.uuid4())
    conn = connect_project_db(root)
    try:
        max_order = conn.execute("SELECT COALESCE(MAX(narrative_order), 0) FROM events").fetchone()[0]
        conn.execute(
            """
            INSERT INTO events (id, title, story_time, narrative_order, pov, participants_json, dependencies_json, notes, has_conflict, scene_id)
            VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 0, NULL)
            """,
            (
                eid,
                proposal.title,
                proposal.metadata.get("story_time"),
                max_order + 1,
                json.dumps([]),
                json.dumps([]),
                proposal.content,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return {"kind": "timeline_event", "target": eid}


def _apply_chapter(root: Path, proposal: CaptureProposal) -> dict[str, str]:
    ch_id = str(uuid.uuid4())
    sc_id = str(uuid.uuid4())
    conn = connect_project_db(root)
    try:
        max_ord = conn.execute("SELECT COALESCE(MAX(sort_order), -1) FROM chapters").fetchone()[0]
        ch_slug = f"canvas-{_safe_slug(proposal.title, 'chapter')}"
        sc_slug = "scene-1"
        rel = f"manuscript/{ch_slug}/{sc_slug}.md"
        scene_path = root / rel
        scene_path.parent.mkdir(parents=True, exist_ok=True)
        scene_path.write_text(proposal.content, encoding="utf-8")
        conn.execute(
            "INSERT INTO chapters (id, sort_order, title, slug) VALUES (?, ?, ?, ?)",
            (ch_id, max_ord + 1, proposal.title, ch_slug),
        )
        conn.execute(
            "INSERT INTO scenes (id, chapter_id, sort_order, title, slug, file_rel_path) VALUES (?, ?, 0, ?, ?, ?)",
            (sc_id, ch_id, "Imported notes", sc_slug, rel),
        )
        conn.commit()
    finally:
        conn.close()
    return {"kind": "chapter", "target": ch_id}
