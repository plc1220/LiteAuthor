from __future__ import annotations

from liteauthor_agent.llm_gateway.config import (
    GEMINI_API_KEY,
    GEMINI_AUTOCOMPLETE_MODEL,
    GEMINI_CHAT_ENABLE_GOOGLE_SEARCH,
    GEMINI_CHAT_MODEL,
    GEMINI_CHAT_THINKING_LEVEL,
    GEMINI_REQUEST_TIMEOUT_MS,
)

_client = None


def _genai_client():
    global _client  # noqa: PLW0603

    if _client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError(
                "GEMINI_API_KEY is required when LITEAUTHOR_LLM_PROVIDER=google_genai. "
                "Set it to your Gemini API key string (Google AI Studio or GCP Console → APIs & Services → Credentials)."
            )
        from google import genai
        from google.genai import types

        _client = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options=types.HttpOptions(timeout=GEMINI_REQUEST_TIMEOUT_MS),
        )
    return _client


def _thinking_config():
    from google.genai import types

    level = GEMINI_CHAT_THINKING_LEVEL
    if not level:
        return None
    mapping = {
        "MINIMAL": types.ThinkingLevel.MINIMAL,
        "LOW": types.ThinkingLevel.LOW,
        "MEDIUM": types.ThinkingLevel.MEDIUM,
        "HIGH": types.ThinkingLevel.HIGH,
    }
    thinking_level = mapping.get(level)
    if thinking_level is None:
        return None
    return types.ThinkingConfig(thinking_level=thinking_level)


def _chat_tools():
    from google.genai import types

    if not GEMINI_CHAT_ENABLE_GOOGLE_SEARCH:
        return None
    return [types.Tool(google_search=types.GoogleSearch())]


def _messages_to_system_and_contents(messages: list[dict[str, str]]) -> tuple[str | None, list]:
    from google.genai import types

    system_chunks: list[str] = []
    contents: list = []
    for m in messages:
        role = (m.get("role") or "user").strip().lower()
        text = m.get("content") or ""
        if role == "system":
            system_chunks.append(text)
            continue
        gemini_role = "model" if role == "assistant" else "user"
        contents.append(
            types.Content(role=gemini_role, parts=[types.Part.from_text(text=text)]),
        )
    system_instruction = "\n\n".join(system_chunks) if system_chunks else None
    return system_instruction, contents


def _response_text(resp) -> str:
    t = resp.text
    return (t or "").strip()


def chat_completion_sync(messages: list[dict[str, str]], max_tokens: int = 2048) -> str:
    from google.genai import types

    client = _genai_client()
    system_instruction, contents = _messages_to_system_and_contents(messages)
    thinking = _thinking_config()
    tools = _chat_tools()
    config_kwargs: dict = {
        "max_output_tokens": max_tokens,
        "temperature": 0.7,
    }
    if system_instruction:
        config_kwargs["system_instruction"] = system_instruction
    if thinking:
        config_kwargs["thinking_config"] = thinking
    if tools:
        config_kwargs["tools"] = tools
    config = types.GenerateContentConfig(**config_kwargs)
    resp = client.models.generate_content(
        model=GEMINI_CHAT_MODEL,
        contents=contents,
        config=config,
    )
    return _response_text(resp)


async def chat_completion(messages: list[dict[str, str]], max_tokens: int = 2048) -> str:
    from google.genai import types

    client = _genai_client()
    system_instruction, contents = _messages_to_system_and_contents(messages)
    thinking = _thinking_config()
    tools = _chat_tools()
    config_kwargs: dict = {
        "max_output_tokens": max_tokens,
        "temperature": 0.7,
    }
    if system_instruction:
        config_kwargs["system_instruction"] = system_instruction
    if thinking:
        config_kwargs["thinking_config"] = thinking
    if tools:
        config_kwargs["tools"] = tools
    config = types.GenerateContentConfig(**config_kwargs)
    resp = await client.aio.models.generate_content(
        model=GEMINI_CHAT_MODEL,
        contents=contents,
        config=config,
    )
    return _response_text(resp)


async def inline_completion(prompt: str, max_tokens: int = 24) -> str:
    from google.genai import types

    client = _genai_client()
    contents = [
        types.Content(role="user", parts=[types.Part.from_text(text=prompt)]),
    ]
    config = types.GenerateContentConfig(
        max_output_tokens=max_tokens,
        temperature=0.6,
        top_p=0.9,
        stop_sequences=["\n", "\n\n"],
    )
    resp = await client.aio.models.generate_content(
        model=GEMINI_AUTOCOMPLETE_MODEL,
        contents=contents,
        config=config,
    )
    return _response_text(resp)
