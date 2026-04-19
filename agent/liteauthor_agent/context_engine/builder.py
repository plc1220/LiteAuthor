from __future__ import annotations

from pathlib import Path
from typing import Any

from liteauthor_agent.config import MAX_CONTEXT_CHARS
from liteauthor_agent.schemas.context import SceneExcerpt
from liteauthor_agent.utils.paths import read_file_safe
from liteauthor_agent.utils.tokens import approx_tokens


def build_scene_packet(
    root: Path,
    scene: SceneExcerpt | None,
    task: str,
    selection: str,
    instruction: str,
    max_chunks: int = 8,
) -> dict[str, Any]:
    chunks: list[dict[str, str]] = []
    budget = MAX_CONTEXT_CHARS

    def add_chunk(label: str, body: str, soft_cap: int = 2000) -> None:
        nonlocal budget
        if len(chunks) >= max_chunks or budget <= 0:
            return
        body = body.strip()
        if not body:
            return
        body = body[: min(soft_cap, budget)]
        chunks.append({"label": label, "body": body})
        budget -= len(body)

    ch_title = (scene.chapter_title or "") if scene else ""

    add_chunk("Selected Passage", selection, 1500)
    if scene and scene.file_rel_path:
        body = read_file_safe(root, scene.file_rel_path, 4000)
        add_chunk("Current Scene (excerpt)", body, 3500)

    add_chunk("Style", read_file_safe(root, "story/style.md", 2000), 1500)
    add_chunk("Motifs", read_file_safe(root, "story/motifs.md", 1500), 1200)
    add_chunk("Unresolved Threads", read_file_safe(root, "story/unresolved_threads.md", 1500), 1200)

    summaries_dir = root / "chapter_summaries"
    if summaries_dir.is_dir():
        parts: list[str] = []
        for p in sorted(summaries_dir.glob("*.md"))[:3]:
            parts.append(p.read_text(encoding="utf-8", errors="replace")[:800])
        add_chunk("Recent Chapter Summaries", "\n---\n".join(parts), 2500)

    char_dir = root / "story" / "characters"
    if char_dir.is_dir():
        for p in sorted(char_dir.glob("*.md"))[:3]:
            add_chunk(f"Character: {p.stem}", p.read_text(encoding="utf-8", errors="replace")[:1200], 1200)

    md_parts = [
        f"# Task\n{task}",
        f"# Instruction\n{instruction}",
    ]
    if ch_title:
        md_parts.append(f"# Chapter\n{ch_title}")
    for c in chunks:
        md_parts.append(f"# {c['label']}\n{c['body']}")
    packet = "\n\n".join(md_parts)
    if len(packet) > MAX_CONTEXT_CHARS:
        packet = packet[:MAX_CONTEXT_CHARS] + "\n\n[truncated]"
    return {
        "markdown": packet,
        "approx_tokens": approx_tokens(packet),
        "chunks_used": len(chunks),
    }
