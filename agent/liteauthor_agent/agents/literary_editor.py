def editor_followup_prompt(planner_output: str) -> str:
    return "Suggest one prose polish for the opening paragraph tone; keep brief.\n\n" + planner_output[:2000]
