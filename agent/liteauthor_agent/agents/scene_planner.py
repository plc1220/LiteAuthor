def planner_followup_prompt(continuity_output: str) -> str:
    return "Given prior notes, outline next scene obligations in 5 bullets.\n\n" + continuity_output[:2000]
