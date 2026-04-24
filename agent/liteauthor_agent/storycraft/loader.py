from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from .models import Bucket, StorycraftRule

_VALID_BUCKETS: frozenset[str] = frozenset(
    ("hook", "character", "conflict", "pacing", "payoff", "addiction", "dialogue", "world")
)

_DEFAULT_SURFACES = ("scene_doctor", "inline_suggestion", "agent_mode")

# Topic hints → bucket (for rules missing explicit bucket in frontmatter)
_KEYWORD_BUCKETS: list[tuple[re.Pattern[str], Bucket]] = [
    (re.compile(r"opening|hook|开文|开章|文案|入戏|开镜", re.I), "hook"),
    (re.compile(r"人物|角色|性格|cp|主角|配角|人设| pov", re.I), "character"),
    (re.compile(r"conflict|冲突|矛盾|撕|对打|压力|张|摩擦", re.I), "conflict"),
    (re.compile(r"pace|节奏|松紧|水|快|慢|转场|中盘", re.I), "pacing"),
    (re.compile(r"payoff|回报|伏|伏笔|兑现|收束|收线", re.I), "payoff"),
    (re.compile(r"addict|悬念|断章|钩子|上瘾|追读", re.I), "addiction"),
    (re.compile(r"dialogue|对白|对话|嘴|台词|吵架", re.I), "dialogue"),
    (re.compile(r"world|设定|世界观|背景|信息|exposition|说明", re.I), "world"),
]

_SLUG_BUCKET_HINTS: list[tuple[str, Bucket]] = [
    ("dialogue", "dialogue"),
    ("romance", "payoff"),
    ("opening", "hook"),
    ("outline", "pacing"),
    ("scene", "conflict"),
    ("chapter", "pacing"),
    ("character", "character"),
    ("pacing", "pacing"),
    ("tension", "conflict"),
    ("foreshadow", "payoff"),
    ("exposition", "world"),
    ("blurb", "hook"),
    ("end", "addiction"),
    ("cliff", "addiction"),
]


def infer_bucket(meta: dict[str, Any], slug: str, body: str) -> Bucket:
    raw = meta.get("bucket")
    if isinstance(raw, str) and raw in _VALID_BUCKETS:
        return raw  # type: ignore[return-value]
    blob = " ".join(
        [
            slug,
            str(meta.get("name", "")),
            str(meta.get("description", "")),
            " ".join(_as_str_list(meta.get("tags"))),
            body[:2000],
        ]
    )
    for rx, b in _KEYWORD_BUCKETS:
        if rx.search(blob):
            return b
    s = slug.lower()
    for hint, b in _SLUG_BUCKET_HINTS:
        if hint in s:
            return b
    return "conflict"


def _as_str_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        return [v]
    if isinstance(v, (list, tuple)):
        return [str(x) for x in v]
    return [str(v)]


def _parse_frontmatter(raw: str) -> tuple[dict[str, Any], str]:
    raw = raw.lstrip("\ufeff")
    if not raw.startswith("---"):
        return {}, raw
    end = raw.find("\n---", 3)
    if end == -1:
        return {}, raw
    fm = raw[3:end].strip()
    body = raw[end + 4 :].lstrip("\n")
    try:
        meta = yaml.safe_load(fm) or {}
    except yaml.YAMLError:
        meta = {}
    if not isinstance(meta, dict):
        meta = {}
    return meta, body


def _bullets_from_section(body: str, *titles: str) -> list[str]:
    lines: list[str] = []
    current = None
    for line in body.splitlines():
        if any(line.strip().startswith(t) for t in titles):
            current = True
            continue
        if line.startswith("## "):
            current = None
        if current and line.strip().startswith(("-", "*", "–")):
            t = re.sub(r"^[-*–]\s*", "", line.strip()).strip()
            if t:
                lines.append(t)
    return lines


def _instruction_for_rule(meta: dict[str, Any], body: str) -> str:
    if isinstance(meta.get("instruction"), str) and meta["instruction"].strip():
        return meta["instruction"].strip()
    desc = meta.get("description")
    if isinstance(desc, str) and desc.strip():
        base = desc.strip()
    else:
        first = body.strip()
        if "## " in first:
            first = first.split("##", 1)[0].strip()
        base = re.sub(r"\s+", " ", first)[:800].strip()
    if len(base) < 20 and body.strip():
        base = re.sub(r"\s+", " ", body.split("##", 1)[0])[:500].strip()
    return base


def _parse_one_file(path: Path) -> StorycraftRule | None:
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    meta, body = _parse_frontmatter(raw)
    slug = str(meta.get("slug") or path.stem).strip()
    if not slug:
        return None
    rid = str(meta.get("id") or slug).strip()
    name = str(meta.get("name") or meta.get("title") or slug).strip()
    if name.startswith('"') and name.endswith('"'):
        name = name[1:-1]
    bucket = infer_bucket(meta, slug, body)
    tags = [t.strip() for t in _as_str_list(meta.get("tags"))]
    raw_surfaces = _as_str_list(meta.get("surfaces"))
    surfaces = list(raw_surfaces) if raw_surfaces else list(_DEFAULT_SURFACES)
    try:
        priority = float(meta.get("priority", 0.5))
    except (TypeError, ValueError):
        priority = 0.5
    th = _as_str_list(meta.get("trigger_hints"))
    if not th:
        th = _bullets_from_section(body, "## Trigger Hints", "## 适用情况", "## 信号")
    instruction = _instruction_for_rule(meta, body)
    if not instruction:
        instruction = f"Apply the craft card «{name}» to the passage: tighten clarity and scene purpose."
    output_modes = _as_str_list(meta.get("output_modes")) or ["diagnosis", "revision", "alternatives"]
    return StorycraftRule(
        id=rid,
        slug=slug,
        name=name,
        bucket=bucket,
        tags=tags,
        surfaces=surfaces,
        priority=priority,
        trigger_hints=th,
        instruction=instruction,
        output_modes=output_modes,
        source=meta.get("source") if isinstance(meta.get("source"), str) else "builtin",
        source_ref=meta.get("source_ref") if isinstance(meta.get("source_ref"), str) else str(path.name),
    )


@lru_cache(maxsize=8)
def _load_from_dir_resolved(resolved: str) -> tuple[StorycraftRule, ...]:
    root = Path(resolved)
    if not root.is_dir():
        return ()
    out: list[StorycraftRule] = []
    for p in sorted(root.glob("*.md")):
        rule = _parse_one_file(p)
        if rule is not None:
            out.append(rule)
    return tuple(out)


def load_rules(skills_dir: Path | str | None) -> list[StorycraftRule]:
    """Load normalized rules from a directory of markdown artifacts."""
    if skills_dir is None:
        return []
    p = Path(skills_dir)
    if not p.is_dir():
        return []
    return list(_load_from_dir_resolved(str(p.resolve())))


def clear_rules_cache() -> None:
    _load_from_dir_resolved.cache_clear()
