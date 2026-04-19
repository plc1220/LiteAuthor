import json
from typing import Any

import httpx

from liteauthor_agent.llm_gateway.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL


def _payload(messages: list[dict[str, str]], max_tokens: int) -> dict[str, Any]:
    return {
        "model": OPENAI_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }


def chat_completion_sync(messages: list[dict[str, str]], max_tokens: int = 2048) -> str:
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
