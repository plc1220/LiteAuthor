import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("LITEAUTHOR_DATA_DIR", Path(__file__).resolve().parent.parent.parent / "data")).resolve()
PROJECTS_ROOT = DATA_DIR / "projects"
REGISTRY_PATH = DATA_DIR / "registry.sqlite"
