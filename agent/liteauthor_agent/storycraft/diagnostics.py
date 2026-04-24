from __future__ import annotations

import re
from typing import Iterable

from .models import TextDiagnostics

# Dialogue-ish lines: contain ASCII or CJK/typographic quotes
_RE_DIALOGUE = re.compile(r"[\u201c\u201d\u2018\u2019\u300c\u300d'\"「」]")
_RE_QUESTION = re.compile(r"[?？]")
_OBSTACLE = re.compile(
    r"\b(but|however|though|except|obstacle|block)\b|"
    r"(但|但是|可|却|不过|不过|虽然|只是|难|卡|顶|抗|争|挡)",
    re.I,
)
_GOALISH = re.compile(
    r"\b(need|must|want|trying|hoping|goal)\b|"
    r"(要|必须|想要|得|只有|为了|想|得把|要)|"
    r"不想",
    re.I,
)
_NAMED = re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b")


def _word_count(text: str) -> int:
    if not text.strip():
        return 0
    return max(1, len(re.findall(r"[\w\u4e00-\u9fff]+", text)))


def _paragraphs(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n{2,}", text.strip()) if p.strip()] or ([text] if text.strip() else [])


def compute_diagnostics(
    selection: str,
    *,
    motif_substrings: Iterable[str] = (),
    recent_conflict_flag_count: int = 0,
    chapter_is_late: bool = False,
) -> TextDiagnostics:
    """Heuristic story signals for skill routing. Values are not ground truth."""
    t = selection or ""
    w = _word_count(t)
    paras = _paragraphs(t)
    pc = max(1, len(paras))
    para_lens = [len(p) for p in paras] or [len(t) or 1]
    avg_para = float(sum(para_lens) / len(para_lens))

    dialogueish = 0
    for line in t.splitlines():
        s = line.strip()
        if not s:
            continue
        if _RE_DIALOGUE.search(s):
            dialogueish += 1
    line_count = max(1, len([l for l in t.splitlines() if l.strip()]))
    dialogue_ratio = min(1.0, dialogueish / line_count)

    questions = len(_RE_QUESTION.findall(t))
    question_density = (questions / w) * 100.0 if w else 0.0

    expos_markers = len(
        re.findall(
            r"\b(because|since|meanwhile|as a result|in order|due to|although)\b|"
            r"(因为|所以|由于|然而|同时|其实|当时|因此|为了)",
            t,
            re.I,
        )
    )
    exposition_density = (expos_markers / w) * 100.0 if w else 0.0

    named = len(_NAMED.findall(t)) if w > 40 else min(1, w // 20)

    motif_hits = 0
    low = t.lower()
    for m in motif_substrings:
        if m and m.lower() in low:
            motif_hits += 1

    end_snip = t[-220:] if len(t) > 220 else t
    cliff = 0.2 if _RE_QUESTION.search(end_snip) else 0.0
    if re.search(r"(\.{3}|…|!|!！|\?\?)", end_snip):
        cliff += 0.2
    if re.search(r"(还|没|不|能|要|要来了|会)$", end_snip):
        cliff += 0.15
    if chapter_is_late:
        cliff = min(1.0, cliff + 0.2)
    chapter_end_curiosity_score = min(1.0, cliff)

    g = 0.15 * len(_GOALISH.findall(t))
    o = 0.2 * len(_OBSTACLE.findall(t))
    scene_goal_signal = min(1.0, g)
    scene_obstacle_signal = min(1.0, o)
    if scene_obstacle_signal < 0.15 and w > 80 and dialogue_ratio < 0.25:
        scene_obstacle_signal = 0.1

    payoff_markers = len(
        re.findall(
            r"\b(foreshadow|promise|set[- ]?up|payoff|reveal|twist|secret)\b|"
            r"(伏|线|后文|后头|后文|会知道|要来了|要爆)",
            t,
            re.I,
        )
    )
    payoff_candidate_count = min(5, payoff_markers)

    return TextDiagnostics(
        selection_word_count=w,
        paragraph_count=pc,
        dialogue_ratio=dialogue_ratio,
        avg_paragraph_length=avg_para,
        question_density=round(question_density, 4),
        exposition_density=round(exposition_density, 4),
        named_character_hits=named,
        motif_hits=motif_hits,
        recent_conflict_flag_count=recent_conflict_flag_count,
        chapter_end_curiosity_score=round(chapter_end_curiosity_score, 3),
        scene_goal_signal=round(scene_goal_signal, 3),
        scene_obstacle_signal=round(scene_obstacle_signal, 3),
        payoff_candidate_count=payoff_candidate_count,
    )


def diagnosis_lines_from_diagnostics(
    d: TextDiagnostics, intent: str | None = None, selection: str = ""
) -> list[str]:
    """Narrate routing hints as human-readable lines (3–5 items)."""
    out: list[str] = []
    if intent == "opening_doctor":
        out.append("Priority: opening pull — want, trouble, and momentum in the first beat(s).")
    elif intent == "pacing_analyzer":
        out.append("Priority: rhythm — where to compress, stretch, and land turns.")
    elif intent == "character_engine":
        out.append("Priority: on-page want, reaction, and voice-consistent choice.")
    elif intent == "payoff_tracker":
        out.append("Priority: thread promise, setup clarity, and satisfaction or deferral.")
    elif intent == "lore_compression":
        out.append("Priority: deliver lore through scene—trim lecture, keep voice, preserve facts.")
    elif intent == "chapter_addiction":
        out.append("Priority: make the reader need the next page—curiosity, stakes, propulsion.")
    elif intent == "character_consistency":
        out.append("Priority: line behavior and voice up with the established character.")
    elif intent == "planning_architect":
        out.append("Priority: act intent, turn shape, and chapter spine (outline-level, still prose-true).")
    t = (selection or "").lower()
    if d.selection_word_count < 15:
        out.append("The selection is very short; diagnostics are noisy.")
    if d.dialogue_ratio < 0.18 and d.selection_word_count > 30:
        out.append("The passage is light on line-level dialogue; readers may get exposition-heavy beats.")
    if d.scene_obstacle_signal < 0.15 and d.selection_word_count > 100:
        out.append("On-page resistance reads soft; consider adding a clearer obstacle, disagreement, or risk.")
    if d.exposition_density > 2.5 and d.dialogue_ratio < 0.25:
        out.append("Expository markers are relatively dense; balance with scene action, reaction, and tension.")
    if (
        intent == "strengthen_chapter_ending"
        and d.chapter_end_curiosity_score < 0.35
        and d.selection_word_count > 40
    ):
        out.append("The final beat may not leave a strong curiosity or forward pull at chapter end.")
    if (
        intent == "opening_doctor"
        and d.exposition_density > 2.0
        and d.selection_word_count > 40
    ):
        out.append("The opening leans expository; consider dramatized entry and a sharper hook line.")
    if (
        intent == "pacing_analyzer"
        and d.avg_paragraph_length > 500
    ):
        out.append("Some paragraphs are long; look for where to break beats or refocus the lens.")
    if (
        intent == "character_engine"
        and d.scene_goal_signal < 0.2
        and d.selection_word_count > 30
    ):
        out.append("A clearer want or line of pursuit would sharpen character drive here.")
    if (
        intent == "payoff_tracker"
        and d.payoff_candidate_count == 0
        and d.selection_word_count > 50
    ):
        out.append("Few explicit setup or payoff signals in this slice; add or echo a story thread if appropriate.")
    if intent == "lore_compression" and d.exposition_density < 1.0 and d.selection_word_count > 40:
        out.append("Lore may already be fairly embedded; check for a tighter focal image or a single new hook line.")
    if intent == "chapter_addiction" and d.chapter_end_curiosity_score < 0.3 and d.selection_word_count > 30:
        out.append("The beat may land flat; consider a question, cost, or unfinished business before the break.")
    if (
        intent == "character_consistency"
        and d.dialogue_ratio > 0.45
        and d.named_character_hits < 1
    ):
        out.append("Dialogue-forward slice; watch for a distinct speech signature and idiom stability.")
    if (
        intent == "planning_architect"
        and d.paragraph_count < 2
        and d.selection_word_count < 40
    ):
        out.append("This selection is a tight slice; the model may need surrounding chapter context for a strong pass.")
    if d.motif_hits == 0 and d.selection_word_count > 200:
        out.append("Recurring image/motif callbacks are not obvious in this slice.")
    if d.payoff_candidate_count >= 2:
        out.append("Multiple setup/payoff or reveal markers appear; make sure the scene advances at least one thread.")
    if d.scene_goal_signal < 0.1 and d.selection_word_count > 50:
        out.append("A clearer immediate on-page want would help the scene read more driven.")
    if not out and d.selection_word_count > 20:
        out.append("Diagnostics are neutral; rely on the chosen outcome and the active craft rules for direction.")
    return out[:5]
