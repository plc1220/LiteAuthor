import asyncio
import json
from typing import Any

import httpx

from liteauthor_agent.llm_gateway.config import LLM_PROVIDER, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_AUTOCOMPLETE_MODEL, OPENAI_MODEL


def _payload(messages: list[dict[str, str]], max_tokens: int, temperature: float = 0.7, model: str | None = None) -> dict[str, Any]:
    return {
        "model": model or OPENAI_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }


def chat_completion_sync(messages: list[dict[str, str]], max_tokens: int = 2048) -> str:
    if LLM_PROVIDER == "mlx":
        from liteauthor_agent.llm_gateway.mlx_client import chat_completion_mlx_sync

        return chat_completion_mlx_sync(messages, max_tokens=max_tokens)

    if LLM_PROVIDER == "google_genai":
        from liteauthor_agent.llm_gateway import google_genai_client

        return google_genai_client.chat_completion_sync(messages, max_tokens=max_tokens)

    url = OPENAI_BASE_URL.rstrip("/") + "/chat/completions"
    payload = _payload(messages, max_tokens)
    with httpx.Client(timeout=120.0) as client:
        r = client.post(
            url,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
            content=json.dumps(payload),
        )
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"] or ""


async def chat_completion(messages: list[dict[str, str]], max_tokens: int = 2048) -> str:
    if LLM_PROVIDER == "mlx":
        from liteauthor_agent.llm_gateway.mlx_client import chat_completion_mlx_sync

        return await asyncio.to_thread(chat_completion_mlx_sync, messages, max_tokens)

    if LLM_PROVIDER == "google_genai":
        from liteauthor_agent.llm_gateway import google_genai_client

        return await google_genai_client.chat_completion(messages, max_tokens=max_tokens)

    url = OPENAI_BASE_URL.rstrip("/") + "/chat/completions"
    payload = _payload(messages, max_tokens)
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            url,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
            content=json.dumps(payload),
        )
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"] or ""


async def inline_completion(prompt: str, max_tokens: int = 24) -> str:
    if LLM_PROVIDER == "mlx":
        from liteauthor_agent.llm_gateway.mlx_client import inline_completion_mlx_sync

        return await asyncio.to_thread(inline_completion_mlx_sync, prompt, max_tokens)

    if LLM_PROVIDER == "google_genai":
        from liteauthor_agent.llm_gateway import google_genai_client

        return await google_genai_client.inline_completion(prompt, max_tokens=max_tokens)

    url = OPENAI_BASE_URL.rstrip("/") + "/chat/completions"
    payload = _payload(
        [{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=0.6,
        model=OPENAI_AUTOCOMPLETE_MODEL,
    )
    payload["top_p"] = 0.9
    payload["stop"] = ["\n", "\n\n"]
    async with httpx.AsyncClient(timeout=12.0) as client:
        r = await client.post(
            url,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
            content=json.dumps(payload),
        )
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"] or ""
