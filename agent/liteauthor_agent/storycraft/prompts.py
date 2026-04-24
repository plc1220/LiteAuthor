from __future__ import annotations

from .models import StorycraftRule


def storycraft_system_prompt(role: str) -> str:
    return (
        f"You are the {role} for a literary novel. "
        "The user message includes a task, a diagnosis, and short operational craft rules. "
        "Apply the rules to strengthen the selected passage. "
        "Return only the revised prose unless the task explicitly asks for bullets or analysis."
    )


def format_active_rules_block(rules: list[StorycraftRule]) -> str:
    if not rules:
        return "_No specific craft rules were routed; use solid scene craft and the task._"
    lines: list[str] = []
    for i, r in enumerate(rules, start=1):
        instr = (r.instruction or "").strip().replace("\n", " ")
        if len(instr) > 500:
            instr = instr[:500].rstrip() + "…"
        lines.append(f"{i}. **{r.name}** ({r.bucket}): {instr}")
    return "\n".join(lines)


def build_storycraft_instruction_prefix(
    *,
    task_line: str,
    diagnosis: list[str],
    rules: list[StorycraftRule],
) -> str:
    """Extra instruction block to prepend; combine with your style/extra user guidance."""
    dlines = "\n".join(f"- {x}" for x in diagnosis) if diagnosis else "- (none)"
    rules_md = format_active_rules_block(rules)
    return (
        f"## Outcome / task\n{task_line}\n\n"
        f"## Diagnosis (heuristic, for routing)\n{dlines}\n\n"
        f"## Active storycraft rules\n{rules_md}\n"
    )
