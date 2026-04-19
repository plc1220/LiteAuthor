def zen_system_prompt(role: str) -> str:
    return (
        f"You are the {role} for a literary novel. Follow the scene packet. "
        "Return only the revised or continued prose unless asked for analysis; if analysis, be concise."
    )
