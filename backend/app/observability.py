from __future__ import annotations

import time
from collections import deque
from contextlib import contextmanager
from threading import Lock
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

_MAX_SAMPLES = 2000
_lock = Lock()
_series: dict[str, deque[float]] = {}
_counts: dict[str, int] = {}
_errors: dict[str, int] = {}


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    idx = int(round((len(values) - 1) * pct))
    return values[min(max(idx, 0), len(values) - 1)]


def record_latency(name: str, duration_ms: float, *, error: bool = False) -> None:
    with _lock:
        samples = _series.setdefault(name, deque(maxlen=_MAX_SAMPLES))
        samples.append(duration_ms)
        _counts[name] = _counts.get(name, 0) + 1
        if error:
            _errors[name] = _errors.get(name, 0) + 1


@contextmanager
def observe(name: str):
    started = time.perf_counter()
    error = False
    try:
        yield
    except Exception:
        error = True
        raise
    finally:
        record_latency(name, (time.perf_counter() - started) * 1000, error=error)


def _snapshot_one(name: str, samples: deque[float]) -> dict[str, Any]:
    values = sorted(samples)
    count = _counts.get(name, 0)
    errors = _errors.get(name, 0)
    total = sum(values)
    return {
        "count": count,
        "errors": errors,
        "error_rate": (errors / count) if count else 0.0,
        "samples": len(values),
        "avg_ms": (total / len(values)) if values else 0.0,
        "max_ms": values[-1] if values else 0.0,
        "p50_ms": _percentile(values, 0.50),
        "p90_ms": _percentile(values, 0.90),
        "p95_ms": _percentile(values, 0.95),
        "p99_ms": _percentile(values, 0.99),
    }


def metrics_snapshot() -> dict[str, Any]:
    with _lock:
        return {
            "window_samples": _MAX_SAMPLES,
            "metrics": {name: _snapshot_one(name, samples) for name, samples in sorted(_series.items())},
        }


def metrics_prometheus() -> str:
    snap = metrics_snapshot()
    lines = [
        "# HELP liteauthor_latency_ms Rolling latency summary in milliseconds.",
        "# TYPE liteauthor_latency_ms gauge",
        "# HELP liteauthor_requests_total Total observed requests or operations.",
        "# TYPE liteauthor_requests_total counter",
        "# HELP liteauthor_errors_total Total observed errors.",
        "# TYPE liteauthor_errors_total counter",
    ]
    for name, stats in snap["metrics"].items():
        label = name.replace("\\", "\\\\").replace('"', '\\"')
        labels = f'name="{label}"'
        lines.append(f'liteauthor_requests_total{{{labels}}} {stats["count"]}')
        lines.append(f'liteauthor_errors_total{{{labels}}} {stats["errors"]}')
        for key in ("avg_ms", "max_ms", "p50_ms", "p90_ms", "p95_ms", "p99_ms"):
            quantile = key.removesuffix("_ms")
            lines.append(f'liteauthor_latency_ms{{{labels},stat="{quantile}"}} {stats[key]:.3f}')
    return "\n".join(lines) + "\n"


class RequestMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            route = request.scope.get("route")
            path = getattr(route, "path", request.url.path)
            if path not in ("/metrics", "/api/metrics"):
                record_latency(
                    f"http.{request.method}.{path}",
                    (time.perf_counter() - started) * 1000,
                    error=status_code >= 500,
                )
