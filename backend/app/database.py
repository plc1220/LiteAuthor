import json
import sqlite3
import uuid
from pathlib import Path
from typing import Any

from .config import DATA_DIR, PROJECTS_ROOT, REGISTRY_PATH


def ensure_data_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROJECTS_ROOT.mkdir(parents=True, exist_ok=True)


def connect_registry() -> sqlite3.Connection:
    ensure_data_dirs()
    conn = sqlite3.connect(REGISTRY_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_registry() -> None:
    conn = connect_registry()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                root_path TEXT NOT NULL UNIQUE,
                settings_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def connect_project_db(root_path: Path) -> sqlite3.Connection:
    db_path = root_path / "project.sqlite"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_project_db(root_path: Path) -> None:
    root_path.mkdir(parents=True, exist_ok=True)
    conn = connect_project_db(root_path)
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS chapters (
                id TEXT PRIMARY KEY,
                sort_order INTEGER NOT NULL,
                title TEXT NOT NULL,
                slug TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS scenes (
                id TEXT PRIMARY KEY,
                chapter_id TEXT NOT NULL,
                sort_order INTEGER NOT NULL,
                title TEXT NOT NULL,
                slug TEXT NOT NULL,
                file_rel_path TEXT NOT NULL,
                FOREIGN KEY (chapter_id) REFERENCES chapters(id)
            );
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                story_time TEXT,
                narrative_order INTEGER,
                pov TEXT,
                participants_json TEXT,
                dependencies_json TEXT,
                notes TEXT,
                has_conflict INTEGER DEFAULT 0,
                scene_id TEXT,
                FOREIGN KEY (scene_id) REFERENCES scenes(id)
            );
            CREATE TABLE IF NOT EXISTS suggestions (
                id TEXT PRIMARY KEY,
                scene_id TEXT,
                range_from INTEGER,
                range_to INTEGER,
                original_text TEXT,
                proposed_text TEXT,
                explanation TEXT,
                role TEXT,
                status TEXT DEFAULT 'pending',
                created_at TEXT,
                FOREIGN KEY (scene_id) REFERENCES scenes(id)
            );
            CREATE TABLE IF NOT EXISTS continuity_flags (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                detail TEXT,
                scene_id TEXT,
                event_id TEXT,
                status TEXT DEFAULT 'open',
                created_at TEXT,
                FOREIGN KEY (scene_id) REFERENCES scenes(id),
                FOREIGN KEY (event_id) REFERENCES events(id)
            );
            CREATE TABLE IF NOT EXISTS agent_jobs (
                id TEXT PRIMARY KEY,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL,
                progress REAL DEFAULT 0,
                steps_json TEXT,
                result_json TEXT,
                error TEXT,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS snapshots (
                id TEXT PRIMARY KEY,
                label TEXT,
                snapshot_dir TEXT NOT NULL,
                created_at TEXT
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


def create_project_files(name: str, genres: list[str], target_words: int) -> tuple[str, Path]:
    ensure_data_dirs()
    init_registry()
    pid = str(uuid.uuid4())
    root = PROJECTS_ROOT / pid
    root.mkdir(parents=True, exist_ok=False)
    init_project_db(root)

    # Folder layout
    (root / "manuscript").mkdir(exist_ok=True)
    (root / "story" / "characters").mkdir(parents=True, exist_ok=True)
    (root / "story" / "locations").mkdir(parents=True, exist_ok=True)
    (root / "chapter_summaries").mkdir(exist_ok=True)

    settings = {"genres": genres, "target_words": target_words}
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()

    reg = connect_registry()
    try:
        reg.execute(
            "INSERT INTO projects (id, name, root_path, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (pid, name, str(root), json.dumps(settings), now, now),
        )
        reg.commit()
    finally:
        reg.close()

    # Default wiki files
    (root / "story" / "style.md").write_text(
        "# Style Rules\n\n## Voice & Tone\nLyrical & spare.\n\n## Constraints\n- Avoid adverbs where possible\n- Prefer concrete sensory detail\n",
        encoding="utf-8",
    )
    (root / "story" / "motifs.md").write_text("# Motifs\n\n- \n", encoding="utf-8")
    (root / "story" / "timeline.md").write_text("# Timeline\n\nStory-time anchors for major beats.\n", encoding="utf-8")
    (root / "story" / "unresolved_threads.md").write_text("# Unresolved Threads\n\n", encoding="utf-8")

    # First chapter + scene
    ch_id = str(uuid.uuid4())
    sc_id = str(uuid.uuid4())
    ch_slug = "chapter-1"
    sc_slug = "scene-1"
    rel = f"manuscript/{ch_slug}/{sc_slug}.md"
    scene_dir = root / "manuscript" / ch_slug
    scene_dir.mkdir(parents=True, exist_ok=True)
    (root / rel).write_text("# Opening\n\n", encoding="utf-8")

    conn = connect_project_db(root)
    try:
        conn.execute(
            "INSERT INTO chapters (id, sort_order, title, slug) VALUES (?, 0, ?, ?)",
            (ch_id, "Chapter 1", ch_slug),
        )
        conn.execute(
            "INSERT INTO scenes (id, chapter_id, sort_order, title, slug, file_rel_path) VALUES (?, ?, 0, ?, ?, ?)",
            (sc_id, ch_id, "Scene 1", sc_slug, rel),
        )
        e1 = str(uuid.uuid4())
        e2 = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO events (id, title, story_time, narrative_order, pov, participants_json, dependencies_json, notes, has_conflict, scene_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                e1,
                "The Great Fire",
                "Spring, 1422",
                1,
                "Aria",
                json.dumps(["Aria"]),
                json.dumps([]),
                "Establishing catastrophe.",
                0,
                sc_id,
            ),
        )
        conn.execute(
            """INSERT INTO events (id, title, story_time, narrative_order, pov, participants_json, dependencies_json, notes, has_conflict, scene_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                e2,
                "The Secret Letter",
                "Summer, 1422",
                2,
                "Marcus",
                json.dumps(["Marcus", "Kara"]),
                json.dumps([e1]),
                "Letter referenced before arrival — sample conflict flag.",
                1,
                None,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return pid, root


def get_project_root(project_id: str) -> Path:
    reg = connect_registry()
    try:
        row = reg.execute("SELECT root_path FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise KeyError("project not found")
        return Path(row["root_path"])
    finally:
        reg.close()


def list_projects() -> list[dict[str, Any]]:
    init_registry()
    reg = connect_registry()
    try:
        rows = reg.execute("SELECT id, name, root_path, settings_json, created_at FROM projects ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]
    finally:
        reg.close()
