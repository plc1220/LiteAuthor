from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from liteauthor_agent.agents.continuity import continuity_user_prompt
from liteauthor_agent.agents.literary_editor import editor_followup_prompt
from liteauthor_agent.agents.scene_planner import planner_followup_prompt
from liteauthor_agent.context_engine.builder import build_scene_packet
from liteauthor_agent.llm_gateway.client import chat_completion_sync
from liteauthor_agent.prompt_templates.agent_mode import agent_worker_system
from liteauthor_agent.schemas.context import SceneExcerpt

CompleteFn = Callable[[list[dict[str, str]], int], str]


def execute_sample_agent_job(
    root: Path,
    scene: SceneExcerpt | None,
    complete: CompleteFn | None = None,
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """
    Continuity → planner → editor chain. Returns (steps_for_ui, raw_result_dict).
    """
    do_complete = complete or chat_completion_sync
    system = agent_worker_system()

    def step(user: str, max_tokens: int = 1500) -> str:
        return do_complete(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
        )

    packet = build_scene_packet(
        root,
        scene,
        task="Continuity analysis across recent canon",
        selection="",
        instruction="List potential continuity risks as bullet points.",
    )
    t1 = step(continuity_user_prompt(packet["markdown"]))
    t2 = step(planner_followup_prompt(t1))
    t3 = step(editor_followup_prompt(t2))
    result = {"continuity": t1, "planner": t2, "editor": t3}
    steps = [
        {"name": "Continuity Analyst", "output": t1[:4000]},
        {"name": "Scene Planner", "output": t2[:4000]},
        {"name": "Literary Editor", "output": t3[:4000]},
    ]
    return steps, result
