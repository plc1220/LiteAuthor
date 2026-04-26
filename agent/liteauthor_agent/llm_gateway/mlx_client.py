from __future__ import annotations

import threading
from functools import lru_cache
from typing import Any

from liteauthor_agent.llm_gateway.config import MLX_AUTOCOMPLETE_BACKEND, MLX_AUTOCOMPLETE_MODEL, MLX_MODEL

_model_lock = threading.RLock()


def _require_mlx_lm() -> Any:
    try:
        import mlx_lm
    except ImportError as exc:
        raise RuntimeError("MLX provider requires `pip install -e ./agent[mlx]`.") from exc
    return mlx_lm


def _require_mlx_vlm() -> tuple[Any, Any]:
    try:
        import mlx_vlm
        from mlx_vlm.prompt_utils import apply_chat_template
    except ImportError as exc:
        raise RuntimeError("MLX VLM autocomplete requires `pip install -e ./agent[mlx]`.") from exc
    return mlx_vlm, apply_chat_template


@lru_cache(maxsize=4)
def _load_lm(repo: str) -> tuple[Any, Any]:
    mlx_lm = _require_mlx_lm()
    return mlx_lm.load(repo)


@lru_cache(maxsize=2)
def _load_vlm(repo: str) -> tuple[Any, Any]:
    mlx_vlm, _ = _require_mlx_vlm()
    return mlx_vlm.load(repo)


def _format_lm_prompt(tokenizer: Any, messages: list[dict[str, str]]) -> str:
    if getattr(tokenizer, "chat_template", None) is not None:
        return tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_dict=False)
    return "\n\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages) + "\n\nASSISTANT:"


def chat_completion_mlx_sync(messages: list[dict[str, str]], max_tokens: int = 2048) -> str:
    mlx_lm = _require_mlx_lm()
    with _model_lock:
        model, tokenizer = _load_lm(MLX_MODEL)
        prompt = _format_lm_prompt(tokenizer, messages)
        return mlx_lm.generate(model, tokenizer, prompt=prompt, max_tokens=max_tokens, verbose=False) or ""


def inline_completion_mlx_sync(prompt: str, max_tokens: int = 24) -> str:
    if MLX_AUTOCOMPLETE_BACKEND == "lm":
        return _inline_completion_lm_sync(prompt, max_tokens=max_tokens)
    return _inline_completion_vlm_sync(prompt, max_tokens=max_tokens)


def _inline_completion_lm_sync(prompt: str, max_tokens: int = 24) -> str:
    mlx_lm = _require_mlx_lm()
    with _model_lock:
        model, tokenizer = _load_lm(MLX_AUTOCOMPLETE_MODEL)
        formatted = _format_lm_prompt(tokenizer, [{"role": "user", "content": prompt}])
        return mlx_lm.generate(model, tokenizer, prompt=formatted, max_tokens=max_tokens, verbose=False) or ""


def _inline_completion_vlm_sync(prompt: str, max_tokens: int = 24) -> str:
    mlx_vlm, apply_chat_template = _require_mlx_vlm()
    with _model_lock:
        model, processor = _load_vlm(MLX_AUTOCOMPLETE_MODEL)
        config = getattr(model, "config", None)
        formatted = apply_chat_template(processor, config, prompt, num_images=0)
        return mlx_vlm.generate(model, processor, formatted, max_tokens=max_tokens, verbose=False) or ""
