from pathlib import Path
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")
_log_level = os.environ.get("LITEAUTHOR_LOG_LEVEL", "INFO").upper()
logging.getLogger("app").setLevel(_log_level)
logging.getLogger("liteauthor_agent").setLevel(_log_level)

from .database import init_registry
from .observability import RequestMetricsMiddleware, metrics_prometheus, metrics_snapshot
from .routers import agent, ai, canvas, continuity, manuscript, projects, search, snapshots, storycraft, suggestions, timeline, wiki

init_registry()

app = FastAPI(title="LiteAuthor API", version="0.1.0")

app.add_middleware(RequestMetricsMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(manuscript.router)
app.include_router(wiki.router)
app.include_router(timeline.router)
app.include_router(canvas.router)
app.include_router(ai.router)
app.include_router(suggestions.router)
app.include_router(continuity.router)
app.include_router(agent.router)
app.include_router(snapshots.router)
app.include_router(search.router)
app.include_router(storycraft.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/metrics")
def api_metrics():
    return metrics_snapshot()


@app.get("/metrics")
def prometheus_metrics():
    return Response(metrics_prometheus(), media_type="text/plain; version=0.0.4")
