# Graph Report - .  (2026-04-23)

## Corpus Check
- 66 files · ~33,682 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 273 nodes · 426 edges · 41 communities detected
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]

## God Nodes (most connected - your core abstractions)
1. `connect_project_db()` - 31 edges
2. `get_project_root()` - 13 edges
3. `_root()` - 9 edges
4. `analyze_artifact()` - 9 edges
5. `connect_registry()` - 8 edges
6. `execute_sample_agent_job()` - 8 edges
7. `create_project_files()` - 7 edges
8. `_root()` - 7 edges
9. `_root()` - 7 edges
10. `normalizeArtifact()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `SceneExcerpt` --uses--> `Continuity → planner → editor chain. Returns (steps_for_ui, raw_result_dict).`  [INFERRED]
  agent/liteauthor_agent/schemas/context.py → /Users/licheng/Documents/LiteAuthor/agent/liteauthor_agent/orchestrator/sample_job.py
- `connect_project_db()` --calls--> `_apply_timeline()`  [INFERRED]
  backend/app/database.py → /Users/licheng.phan/Documents/LiteAuthor/backend/app/routers/canvas.py
- `connect_project_db()` --calls--> `_apply_chapter()`  [INFERRED]
  backend/app/database.py → /Users/licheng.phan/Documents/LiteAuthor/backend/app/routers/canvas.py
- `get_project_root()` --calls--> `_root()`  [INFERRED]
  backend/app/database.py → /Users/licheng.phan/Documents/LiteAuthor/backend/app/routers/canvas.py
- `ChapterOut` --calls--> `outline()`  [INFERRED]
  /Users/licheng.phan/Documents/LiteAuthor/backend/app/schemas.py → backend/app/routers/manuscript.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (27): _first_scene_excerpt(), get_job(), _root(), run_agent_job(), start_job(), _update_job(), connect_project_db(), create_chapter() (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (24): BaseModel, AgentJobCreate, AutocompleteRequest, CanvasAnalyzeRequest, CanvasAutosortRequest, CanvasCaptureRequest, CanvasEdge, CanvasNode (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (17): connect_registry(), create_project_files(), ensure_data_dirs(), get_project_root(), init_project_db(), init_registry(), list_projects(), api_create_project() (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (12): buildHintsFromText(), buildLocalAnalysis(), excerptFromBlock(), extractTags(), inferKind(), normalizeArtifact(), normalizeWhitespace(), scoreBlock() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.23
Nodes (19): analyze_artifact(), _apply_chapter(), _apply_timeline(), _apply_wiki(), _autosort(), autosort_canvas(), _canvas_path(), capture_canvas() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (8): agent_worker_system(), build_scene_packet(), continuity_user_prompt(), editor_followup_prompt(), read_file_safe(), execute_sample_agent_job(), Continuity → planner → editor chain. Returns (steps_for_ui, raw_result_dict)., planner_followup_prompt()

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (12): autocomplete_ai(), _autocomplete_prompt(), _clean_inline_completion(), _scene_excerpt(), zen_ai(), chat_completion(), chat_completion_sync(), inline_completion() (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.2
Nodes (3): handleToolbarAction(), instructionFor(), runAi()

### Community 8 - "Community 8"
Cohesion: 0.24
Nodes (4): continueWizard(), finish(), goToStep(), skipStep()

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (4): getSettingString(), projectDate(), projectMatchesFilter(), projectStatus()

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (7): _root(), _safe_rel(), wiki_get_file(), wiki_new_character(), wiki_new_location(), wiki_put_file(), wiki_tree()

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (2): renderContent(), renderDiff()

### Community 12 - "Community 12"
Cohesion: 0.4
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 0.4
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 0.6
Nodes (4): extractText(), markdownToTipTapDoc(), paragraphFromText(), tipTapDocToMarkdown()

### Community 15 - "Community 15"
Cohesion: 0.7
Nodes (4): create_flag(), list_flags(), patch_flag(), _root()

### Community 16 - "Community 16"
Cohesion: 0.4
Nodes (1): Small agent-side helpers (not FastAPI CRUD — that stays in backend).

### Community 17 - "Community 17"
Cohesion: 0.5
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.5
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 0.67
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

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **1 isolated node(s):** `Resolved manuscript slice for retrieval (built from backend SQLite).`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 23`** (2 nodes): `App()`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `AgentMode()`, `AgentMode.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `TimelineView.tsx`, `TimelineView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `SecondaryPageNav.tsx`, `SecondaryPageNav()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `AppScaffold()`, `AppScaffold.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `SelectionToolbar.tsx`, `SelectionToolbar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `health()`, `main.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `projectStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `SuggestionReview.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `config.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `config.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connect_project_db()` connect `Community 0` to `Community 2`, `Community 4`, `Community 6`, `Community 15`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Why does `get_project_root()` connect `Community 2` to `Community 0`, `Community 4`, `Community 6`, `Community 10`, `Community 15`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `zen_ai()` connect `Community 6` to `Community 2`, `Community 5`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Are the 28 inferred relationships involving `connect_project_db()` (e.g. with `list_snapshots()` and `create_snapshot()`) actually correct?**
  _`connect_project_db()` has 28 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `get_project_root()` (e.g. with `_root()` and `_root()`) actually correct?**
  _`get_project_root()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Resolved manuscript slice for retrieval (built from backend SQLite).` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._