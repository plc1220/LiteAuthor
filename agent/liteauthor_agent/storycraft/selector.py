from __future__ import annotations

from .diagnostics import diagnosis_lines_from_diagnostics, compute_diagnostics
from .models import StorycraftRule, StorycraftSelectResult, TextDiagnostics, Bucket

_MAX_RULES = 5

# intent → primary buckets to boost
_INTENT_BUCKETS: dict[str, tuple[Bucket, ...]] = {
    "increase_tension": ("conflict", "pacing", "addiction"),
    "sharpen_dialogue": ("dialogue", "pacing", "conflict"),
    "strengthen_chapter_ending": ("addiction", "payoff", "hook", "pacing"),
    "rewrite_with_intent": ("conflict", "dialogue", "pacing"),
    "scene_doctor": ("conflict", "pacing", "dialogue", "payoff"),
    "chapter_critique": ("pacing", "payoff", "addiction", "conflict"),
    "character_consistency": ("character", "dialogue", "payoff"),
    "payoff_review": ("payoff", "addiction", "pacing", "world"),
    # Phase 2 (product modules)
    "opening_doctor": ("hook", "character", "conflict", "pacing"),
    "pacing_analyzer": ("pacing", "conflict", "dialogue", "addiction"),
    "character_engine": ("character", "dialogue", "conflict", "payoff"),
    "payoff_tracker": ("payoff", "addiction", "pacing", "hook"),
    # Phase 3 (product modules)
    "lore_compression": ("world", "pacing", "dialogue", "conflict"),
    "chapter_addiction": ("addiction", "hook", "pacing", "payoff"),
    "planning_architect": ("pacing", "conflict", "world", "character", "hook"),
    "default": ("conflict", "pacing", "dialogue"),
}

_SURFACE_DEFAULT = "inline_suggestion"


def _surface_filter(rule: StorycraftRule, surface: str) -> bool:
    if not rule.surfaces:
        return True
    return surface in rule.surfaces or _SURFACE_DEFAULT in rule.surfaces


def _bucket_boost(rule: StorycraftRule, primary: tuple[Bucket, ...]) -> float:
    if rule.bucket in primary:
        return 0.35
    if rule.bucket in ("conflict", "pacing") and any(b in primary for b in ("conflict", "pacing")):
        return 0.1
    return 0.0


def _diagnostic_boost(
    rule: StorycraftRule,
    d: TextDiagnostics,
    *,
    intent: str,
    chapter_position: str | None,
) -> float:
    b = 0.0
    pos = (chapter_position or "").lower()
    opening_ctx = intent == "opening_doctor" or pos in ("opening", "beginning", "start", "early")
    if opening_ctx and rule.bucket == "hook":
        b += 0.12
    if d.dialogue_ratio < 0.2 and (rule.bucket == "dialogue" or "对话" in "".join(rule.tags) or "dialogue" in rule.slug):
        b += 0.12
    if d.scene_obstacle_signal < 0.2 and rule.bucket in ("conflict", "pacing", "addiction"):
        b += 0.1
    if d.exposition_density > 2.0 and rule.bucket in ("world", "pacing", "conflict"):
        b += 0.08
    if d.chapter_end_curiosity_score < 0.3 and rule.bucket in ("addiction", "payoff", "hook"):
        b += 0.1
    if d.payoff_candidate_count >= 2 and rule.bucket == "payoff":
        b += 0.1
    if intent == "pacing_analyzer" and rule.bucket == "pacing":
        b += 0.1
    if intent == "character_engine" and rule.bucket == "character":
        b += 0.1
    if intent in ("payoff_tracker", "payoff_review") and rule.bucket in ("payoff", "addiction"):
        b += 0.06
    if intent == "lore_compression" and rule.bucket in ("world", "pacing", "dialogue"):
        b += 0.08
    if intent == "chapter_addiction" and rule.bucket in ("addiction", "hook", "pacing"):
        b += 0.1
    if intent == "planning_architect" and rule.bucket in ("pacing", "conflict", "world"):
        b += 0.08
    if intent == "character_consistency" and rule.bucket == "character":
        b += 0.1
    return b


def _rule_score(
    rule: StorycraftRule,
    intent: str,
    primary: tuple[Bucket, ...],
    d: TextDiagnostics,
    chapter_position: str | None,
) -> float:
    return rule.priority + _bucket_boost(rule, primary) + _diagnostic_boost(
        rule, d, intent=intent, chapter_position=chapter_position
    )


def select_rules(
    all_rules: list[StorycraftRule],
    *,
    selection: str,
    intent: str = "default",
    surface: str = "inline_suggestion",
    motif_substrings: tuple[str, ...] = (),
    recent_conflict_flag_count: int = 0,
    chapter_position: str | None = None,
    chapter_is_late: bool = False,
) -> StorycraftSelectResult:
    is_ending_ctx = (
        chapter_is_late
        or (chapter_position in ("ending", "late", "end"))
        or (intent == "strengthen_chapter_ending")
    )
    d = compute_diagnostics(
        selection,
        motif_substrings=motif_substrings,
        recent_conflict_flag_count=recent_conflict_flag_count,
        chapter_is_late=is_ending_ctx,
    )

    primary = _INTENT_BUCKETS.get(intent) or _INTENT_BUCKETS["default"]
    filtered: list[StorycraftRule] = [r for r in all_rules if _surface_filter(r, surface)]
    if not filtered:
        filtered = list(all_rules)

    cp = chapter_position
    scored = [(_rule_score(r, intent, primary, d, cp), r) for r in filtered]
    scored.sort(key=lambda x: -x[0])
    top = [r for _, r in scored[:_MAX_RULES]]

    dx = diagnosis_lines_from_diagnostics(d, intent=intent, selection=selection)
    warnings: list[str] = []
    if not all_rules:
        warnings.append("No storycraft rules loaded; add markdown skills under the builtin skills directory.")
    if len((selection or "").split()) < 3 and (selection or "").strip():
        warnings.append("Selection is very short; the model will lean on the chosen outcome, not the passage alone.")

    return StorycraftSelectResult(rules=top, diagnosis=dx, warnings=warnings, diagnostics=d)
