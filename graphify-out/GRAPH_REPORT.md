# Graph Report - /Users/licheng/Documents/LiteAuthor  (2026-04-22)

## Corpus Check
- 63 files · ~49,361 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 212 nodes · 323 edges · 37 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]

## God Nodes (most connected - your core abstractions)
1. `connect_project_db()` - 29 edges
2. `get_project_root()` - 12 edges
3. `_root()` - 9 edges
4. `connect_registry()` - 8 edges
5. `execute_sample_agent_job()` - 8 edges
6. `create_project_files()` - 7 edges
7. `_root()` - 7 edges
8. `_root()` - 6 edges
9. `outline()` - 6 edges
10. `zen_ai()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `connect_project_db()` --calls--> `list_snapshots()`  [INFERRED]
  /Users/licheng/Documents/LiteAuthor/backend/app/database.py → /Users/licheng/Documents/LiteAuthor/backend/app/routers/snapshots.py
- `connect_project_db()` --calls--> `create_snapshot()`  [INFERRED]
  /Users/licheng/Documents/LiteAuthor/backend/app/database.py → /Users/licheng/Documents/LiteAuthor/backend/app/routers/snapshots.py
- `connect_project_db()` --calls--> `restore_snapshot()`  [INFERRED]
  /Users/licheng/Documents/LiteAuthor/backend/app/database.py → /Users/licheng/Documents/LiteAuthor/backend/app/routers/snapshots.py
- `connect_project_db()` --calls--> `delete_snapshot()`  [INFERRED]
  /Users/licheng/Documents/LiteAuthor/backend/app/database.py → /Users/licheng/Documents/LiteAuthor/backend/app/routers/snapshots.py
- `connect_project_db()` --calls--> `outline()`  [INFERRED]
  /Users/licheng/Documents/LiteAuthor/backend/app/database.py → /Users/licheng/Documents/LiteAuthor/backend/app/routers/manuscript.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (16): agent_worker_system(), _scene_excerpt(), zen_ai(), build_scene_packet(), chat_completion(), chat_completion_sync(), _payload(), Resolved manuscript slice for retrieval (built from backend SQLite). (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.21
Nodes (20): _first_scene_excerpt(), get_job(), _root(), run_agent_job(), start_job(), _update_job(), connect_project_db(), create_chapter() (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.2
Nodes (13): connect_registry(), create_project_files(), ensure_data_dirs(), get_project_root(), init_project_db(), init_registry(), list_projects(), api_create_project() (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (17): BaseModel, outline(), AgentJobCreate, ChapterOut, ContinuityFlagCreate, ContinuityFlagPatch, EventCreate, OutlineOut (+9 more)

### Community 4 - "Community 4"
Cohesion: 0.24
Nodes (4): continueWizard(), finish(), goToStep(), skipStep()

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (4): getSettingString(), projectDate(), projectMatchesFilter(), projectStatus()

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (2): instructionFor(), runAi()

### Community 7 - "Community 7"
Cohesion: 0.5
Nodes (7): _root(), _safe_rel(), wiki_get_file(), wiki_new_character(), wiki_new_location(), wiki_put_file(), wiki_tree()

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (2): renderContent(), renderDiff()

### Community 9 - "Community 9"
Cohesion: 0.6
Nodes (5): create_snapshot(), delete_snapshot(), list_snapshots(), restore_snapshot(), _root()

### Community 10 - "Community 10"
Cohesion: 0.6
Nodes (5): EventOut, create_event(), delete_event(), list_events(), _root()

### Community 11 - "Community 11"
Cohesion: 0.4
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 0.4
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 0.6
Nodes (4): extractText(), markdownToTipTapDoc(), paragraphFromText(), tipTapDocToMarkdown()

### Community 14 - "Community 14"
Cohesion: 0.7
Nodes (4): create_flag(), list_flags(), patch_flag(), _root()

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (1): Small agent-side helpers (not FastAPI CRUD — that stays in backend).

### Community 16 - "Community 16"
Cohesion: 0.5
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 0.5
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **1 isolated node(s):** `Resolved manuscript slice for retrieval (built from backend SQLite).`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 21`** (2 nodes): `AgentMode()`, `AgentMode.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `TimelineView()`, `TimelineView.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `SecondaryPageNav()`, `SecondaryPageNav.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `SelectionToolbar()`, `SelectionToolbar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `apiFetch()`, `api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `projectStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `ManuscriptEditor.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `SuggestionReview.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `config.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `config.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connect_project_db()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 9`, `Community 10`, `Community 14`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `execute_sample_agent_job()` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `zen_ai()` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Are the 26 inferred relationships involving `connect_project_db()` (e.g. with `list_snapshots()` and `create_snapshot()`) actually correct?**
  _`connect_project_db()` has 26 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `get_project_root()` (e.g. with `_root()` and `_root()`) actually correct?**
  _`get_project_root()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `connect_registry()` (e.g. with `api_create_project()` and `api_get_project()`) actually correct?**
  _`connect_registry()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Resolved manuscript slice for retrieval (built from backend SQLite).` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._