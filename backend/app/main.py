from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_registry
from .routers import agent, ai, canvas, continuity, manuscript, projects, search, snapshots, suggestions, timeline, wiki

init_registry()

app = FastAPI(title="LiteAuthor API", version="0.1.0")

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


@app.get("/api/health")
def health():
    return {"status": "ok"}
