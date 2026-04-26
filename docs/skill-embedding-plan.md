# LiteAuthor Skill Embedding Plan

## Goal

Materialize an internal "storycraft skills" layer in LiteAuthor that powers:

- Zen Mode outcome actions such as "sharpen dialogue", "strengthen opening", and "make this ending more addictive"
- Agent Mode analysis such as scene diagnosis, chapter critique, character consistency review, and payoff tracking
- Archive/knowledge mode storage of reusable craft rules without exposing a raw "391 skills" UI to writers

The product surface should expose outcomes, not a skill library.

## Short Answer On AI Creator Code

You do **not** need to bring the AI Creator code into this repo to start.

Recommended approach:

- Treat AI Creator as a reference corpus and extraction source
- Port only the reusable skill artifacts or rewritten derivatives
- Rebuild the runtime in LiteAuthor-native shapes

Bring AI Creator code into this repo only if you want one of these:

- to batch-convert all 391 markdown skills with scripts copied or adapted from that repo
- to preserve provenance during a large migration effort
- to compare behavior against their recommendation pipeline while implementing parity

For the MVP, copying their whole codebase would add more noise than leverage.

## What To Import vs Rebuild

### Import

- Skill concepts
- Skill markdown content, if licensing and attribution are acceptable
- Slugs, names, descriptions, and rough tags as migration input

### Rebuild In LiteAuthor

- Skill storage schema
- Trigger/rule engine
- Skill selection logic
- Zen Mode action mapping
- Agent Mode orchestration
- UI surfaces

## Constraints From LiteAuthor Today

Existing seams we should build on:

- Zen AI entrypoint: `backend/app/routers/ai.py`
- Agent jobs entrypoint: `backend/app/routers/agent.py`
- Scene packet assembly: `agent/liteauthor_agent/context_engine/builder.py`
- Suggestion persistence: `backend/app/routers/suggestions.py`
- Continuity flags: `backend/app/routers/continuity.py`
- Existing motif analysis precedent: `frontend/src/components/MotifTrackerPanel.tsx`
- Main writing surface: `frontend/src/screens/ZenEditor.tsx`

Implication:

- Zen Mode should use a lightweight deterministic skill selector
- Agent Mode should use a richer analysis pass that can combine multiple skills
- Continuity flags and wiki/manuscript artifacts should become inputs to storycraft diagnostics

## Product Model

Expose 8 user-facing outcome buckets:

1. Hook / Opening
2. Character Drive
3. Conflict / Tension
4. Pacing / Rhythm
5. Emotion / Payoff
6. Serial Addiction
7. Dialogue
8. Worldbuilding / Exposition

Hide the underlying skill IDs from normal UI.

## LiteAuthor Feature Modules

Phase 1 feature modules:

1. Scene Doctor
2. Dialogue Doctor
3. Chapter Ending Enhancer
4. Rewrite With Intent

Phase 2 feature modules:

1. Opening Doctor
2. Pacing Analyzer
3. Character Engine
4. Payoff Tracker

Phase 3 feature modules:

1. Lore Compression
2. Chapter Addiction Score
3. Character Consistency Checker
4. Planning Mode story architect workflows

## Target Architecture

### 1. Source-of-Truth Artifacts

Create a repo-owned skill artifact directory, for example:

`storycraft/skills/`

Each artifact should start as markdown with frontmatter:

```md
---
id: tension_001
slug: every-scene-needs-friction
name: Every scene needs friction
bucket: conflict
tags: [scene, conflict, tension]
surfaces: [scene_doctor, inline_suggestion, agent_mode]
priority: 0.85
source: migrated
source_ref: ai_creator/daily-scene-conflict
---

## Trigger Hints
- scene_conflict_score < 0.4
- paragraph_count > 3

## Instruction
Add a concrete obstacle, disagreement, or risk that blocks the character's current goal.

## Output Mode
- diagnosis
- revision
- alternatives
```

Why markdown first:

- easy to review in git
- easy to edit by hand
- easy to migrate from AI Creator's current format

### 2. Normalized Runtime Schema

At app startup or on demand, normalize markdown artifacts into typed records.

Suggested Python model:

```python
class StorycraftRule(BaseModel):
    id: str
    slug: str
    name: str
    bucket: Literal[
        "hook",
        "character",
        "conflict",
        "pacing",
        "payoff",
        "addiction",
        "dialogue",
        "world",
    ]
    tags: list[str] = []
    surfaces: list[str] = []
    priority: float = 0.5
    trigger_hints: list[str] = []
    instruction: str
    output_modes: list[str] = []
    source: str | None = None
    source_ref: str | None = None
```

### 3. Scene/Chapter Diagnostics Layer

Add a deterministic analyzer that computes lightweight signals from the current selection, scene, and chapter.

Initial metrics:

- `selection_word_count`
- `paragraph_count`
- `dialogue_ratio`
- `avg_paragraph_length`
- `question_density`
- `exposition_density`
- `named_character_hits`
- `motif_hits`
- `recent_conflict_flag_count`
- `chapter_end_curiosity_score`
- `scene_goal_signal`
- `scene_obstacle_signal`
- `payoff_candidate_count`

Important:

- This does not need to be perfect
- It only needs to be good enough to route the right 3 to 5 rules into the prompt

### 4. Rule Selector

Build a selector that takes:

- requested outcome or feature
- diagnostics
- current surface
- selection length
- chapter/scene metadata

And returns:

- top ranked rules
- a short diagnosis summary
- optional warnings

### 5. Prompt Assembly

Extend the scene packet builder so prompts can include:

- current task
- selected text
- story context
- top selected rules
- optional diagnostics summary

Prompt shape:

```md
# Task
Strengthen this chapter ending.

# Diagnosis
- Momentum drops in the last 2 paragraphs
- Resolution arrives too cleanly
- Curiosity gap is weak at the final line

# Active Storycraft Rules
1. End chapter with a curiosity gap.
2. Delay easy resolution before payoff.
3. Make victory create a new problem.

# Selected Passage
...
```

## Proposed File Layout

### Backend / Agent

- `agent/liteauthor_agent/storycraft/__init__.py`
- `agent/liteauthor_agent/storycraft/models.py`
- `agent/liteauthor_agent/storycraft/loader.py`
- `agent/liteauthor_agent/storycraft/diagnostics.py`
- `agent/liteauthor_agent/storycraft/selector.py`
- `agent/liteauthor_agent/storycraft/prompts.py`
- `storycraft/skills/*.md`

### Frontend

- `frontend/src/lib/storycraft.ts`
- `frontend/src/components/storycraft/`
- `frontend/src/screens/` additions only where needed

## API Plan

### Phase 1 API

Add a new router, for example:

- `POST /api/projects/{project_id}/storycraft/analyze`
- `POST /api/projects/{project_id}/storycraft/rewrite`

Request shape:

```json
{
  "scene_id": "abc",
  "surface": "scene_doctor",
  "intent": "increase_tension",
  "selection": "selected text",
  "chapter_position": "ending"
}
```

Response shape:

```json
{
  "diagnosis": [
    "Conflict softens after the midpoint.",
    "The protagonist's immediate goal is present, but resistance is weak."
  ],
  "rules": [
    {
      "id": "tension_001",
      "name": "Every scene needs friction",
      "bucket": "conflict"
    }
  ],
  "rewrite": "..."
}
```

### Why Not Fold This Into `/ai/zen` Immediately

You could, but a separate router is cleaner while the system is stabilizing.

Benefits:

- easier to debug and inspect
- easier to evolve per-feature behavior
- less risk of muddying the generic Zen action path

After the contract settles, the underlying selector can be reused by `/ai/zen`.

## UI Plan

### Zen Mode

Add outcome buttons, not skill buttons.

Good first buttons:

- Make dialogue sharper
- Add tension
- Strengthen chapter ending
- Rewrite with intent

These should appear:

- in the selection toolbar
- in the writing tools rail
- in the suggestion panel context when relevant

### Agent Mode

Add 4 explicit analyses:

- Scene Doctor
- Chapter Critique
- Character Consistency
- Payoff Review

Each should return:

- diagnosis
- strongest 3 rules applied
- rewrite targets or flags

### Story Bible / Planning Surfaces

Add later:

- payoff tracking view
- unresolved setups
- character contradiction warnings
- chapter addiction score

## Migration Plan From AI Creator

### Stage 0. Decision

Choose one of these:

1. Manual curation of the first 20 to 40 skills
2. Scripted migration of all 391 skills into LiteAuthor artifact format

Recommendation:

- manually curate the first 20 to 40
- script the rest only after the first surfaces prove valuable

### Stage 1. Seed Set

Curate an initial set across the 8 buckets.

Suggested counts:

- Hook: 4
- Character: 6
- Conflict: 6
- Pacing: 5
- Payoff: 5
- Addiction: 5
- Dialogue: 5
- World: 4

Target: 40 rules max

### Stage 2. Rewrite For LiteAuthor

Do not import the AI Creator markdown verbatim into the runtime.

For each migrated skill:

- simplify the title into an outcome-oriented rule
- add bucket
- add surfaces
- add trigger hints
- shorten the instruction into a model-friendly operational form

### Stage 3. Provenance

Keep provenance fields for internal tracking:

- `source = migrated`
- `source_ref = ai_creator/<slug>`

## Concrete Milestones

### Milestone 1. Artifact Foundation

Deliverables:

- `storycraft/skills/` directory
- markdown artifact format
- loader and typed schema
- 20 curated seed rules

Success criteria:

- rules load locally
- rules can be listed in tests
- no UI changes yet

### Milestone 2. Diagnostics + Selector

Deliverables:

- deterministic text diagnostics
- ranking/selection logic
- unit tests for rule selection

Success criteria:

- given a sample scene, selector returns stable top rules
- diagnostics are inspectable in logs or dev output

### Milestone 3. Rewrite API

Deliverables:

- storycraft analyze/rewrite router
- prompt assembly with active rules
- response schema with diagnosis + rewrite

Success criteria:

- one endpoint returns diagnosis and revised text for a selected passage

### Milestone 4. Zen Mode Integration

Deliverables:

- new selection toolbar actions
- writing tools rail actions
- suggestion panel integration

Success criteria:

- user can select text and invoke Dialogue Doctor or Scene Doctor style actions

### Milestone 5. Agent Mode Integration

Deliverables:

- scene critique job
- chapter critique job
- character consistency pass

Success criteria:

- longer-running review paths can combine multiple rules and produce structured output

### Milestone 6. Payoff Tracker

Deliverables:

- storage model for unresolved setups
- detection heuristics
- continuity flag integration
- Story Bible or Continuity panel view

Success criteria:

- users can see unresolved setups and candidate payoffs

## Data Model Additions

Potential additions in project DB:

- `storycraft_events`
- `storycraft_findings`
- `storycraft_setups`
- `storycraft_rule_runs`

Start smaller if possible:

- reuse `suggestions` for text rewrites
- reuse `continuity_flags` for unresolved payoff/setup findings

Recommended first step:

- avoid new tables in Milestones 1 to 4
- add new tables only when Payoff Tracker needs persistence

## Testing Plan

### Unit Tests

- skill frontmatter parsing
- diagnostics scoring
- selector ranking
- prompt assembly

### Integration Tests

- rewrite endpoint with sample scene
- selection toolbar action to backend response
- persistence of accepted/rejected storycraft suggestions

### Product QA

Manually verify:

- rewrite quality feels materially different from generic rephrase
- active rules match the user's requested outcome
- prompts stay compact
- UI never exposes noisy internal rule metadata

## Risks

### Risk 1. Overfitting To Webnovel Advice

Mitigation:

- tag rules by style/genre later
- keep the first seed set broadly useful
- do not route every request through addiction-oriented rules

### Risk 2. Too Much Prompt Noise

Mitigation:

- cap active rules at 3 to 5
- keep instructions short and operational
- separate recommendation from invocation logic

### Risk 3. Weak Diagnostics

Mitigation:

- use heuristics only for routing
- rely on the model for final judgment
- inspect misfires and tune selector thresholds

### Risk 4. Licensing / Provenance Ambiguity

Mitigation:

- verify AI Creator license before bulk artifact migration
- if unclear, rewrite skills into original LiteAuthor phrasing rather than copying content verbatim

## Recommendation On Bringing AI Creator In

You probably do **not** need to vendor the AI Creator repo into LiteAuthor.

Recommended workflow:

1. Keep AI Creator external
2. Curate a seed spreadsheet or markdown list of candidate skills
3. Rewrite them into LiteAuthor's artifact schema
4. Implement the runtime in LiteAuthor

Bring code over only if:

- you want a one-time migration script checked into this repo
- you want to preserve a frozen snapshot of their skill corpus for internal conversion work

If you do bring anything in, prefer:

- a one-time export file
- or a small `references/ai_creator_skills/` snapshot

Avoid:

- vendoring their entire monorepo
- coupling LiteAuthor to their backend abstractions

## Recommended Immediate Next Steps

1. Approve the artifact format and file layout in this document.
2. Decide whether we are manually curating 20 to 40 seed rules or batch-importing 391.
3. If manual first, start with these modules:
   - Scene Doctor
   - Dialogue Doctor
   - Chapter Ending Enhancer
   - Rewrite With Intent
4. Implement Milestones 1 through 3 before any large UI sweep.

## If You Want Maximum Speed

Fastest path:

- do **not** import AI Creator code
- do **not** migrate all 391 at once
- curate 24 to 32 rules
- wire them into a separate `storycraft` backend endpoint
- ship 4 outcome buttons in Zen Mode

That gets LiteAuthor to a usable "invisible skill machinery" product without dragging in another app's architecture.

## Implementation status (as of 2026-04-24)

This section records what is **implemented in the repo** versus what remains **planned** relative to the milestones above. Source-of-truth skill files live under **`backend/builtin-skills/`** (markdown with frontmatter; loader infers `bucket` and instruction text when a rule omits extended fields from the “normalized runtime schema” example earlier in this doc).

### Shipped

| Area | What exists |
|------|-------------|
| **Milestone 1 — Artifacts, loader, schema** | `agent/liteauthor_agent/storycraft/`: `models.py`, `loader.py`, `diagnostics.py`, `selector.py`, `prompts.py`. Rules load at runtime from `backend/builtin-skills` (hundreds of `.md` files; count may grow). PyYAML parses frontmatter (see `agent/pyproject.toml`). |
| **Milestone 2 — Diagnostics + selector** | `TextDiagnostics` heuristics, `select_rules` (up to 5 rules by intent, surface, signals), unit tests in `agent/tests/test_storycraft.py` (`python3 -m unittest discover -s agent/tests`). **Phase 2 and Phase 3 intents** (bucket + diagnostic boosts) are in `selector.py` + `diagnostics.py`; `test_phase2_intents_stable` and `test_phase3_intents_stable` lock basic behavior. |
| **Milestone 3 — Rewrite API** | `POST /api/projects/{project_id}/storycraft/analyze` (no model; returns diagnosis, selected rules, warnings, diagnostics). `POST /api/projects/{project_id}/storycraft/rewrite` (assembles scene packet with diagnosis + active rules, calls the LLM, returns `rewrite` + `packet_meta`). Router: `backend/app/routers/storycraft.py` (`_INTENT_TASK` includes all Zen intents below), registered in `backend/app/main.py`. |
| **Scene packet** | `build_scene_packet` in `agent/liteauthor_agent/context_engine/builder.py` supports optional `diagnosis` and `active_storycraft_rules` sections. |
| **Milestone 4 — Zen outcomes + writing-tools rail (partial for suggestion panel)** | **AI studio** selection toolbar in `frontend/src/components/SelectionToolbar.tsx`: **Outcomes** (Phase 1) — *Add tension* (`increase_tension`), *Sharper dialogue* (`sharpen_dialogue`), *Stronger ending* (`strengthen_chapter_ending` + `chapter_position: "ending"`), *Rewrite w/ intent* (`rewrite_with_intent`); **More craft** (Phase 2) — *Opening doctor*, *Pacing tune*, *Character drive*, *Setup & payoff*; **Deeper craft** (Phase 3) — *Lore compress* (`lore_compression`), *Addiction beat* (`chapter_addiction`), *Char match* (`character_consistency`), *Story plan* (`planning_architect`). `frontend/src/screens/ZenEditor.tsx` calls `api.storycraftRewrite` for each. **Writing tools** rail: **Craft** group (same four Phase 3 actions as quick entry points). `frontend/src/lib/storycraft.ts` types; `api.storycraftAnalyze` / `api.storycraftRewrite` in `frontend/src/lib/api.ts`. |

### Not done yet (still per plan or later milestones)

- **Folding storycraft into `/ai/zen`** (optional consolidation once contracts are stable).
- **Suggestion panel**: no separate storycraft-only affordances; accepted rewrites still flow through the existing proposal/suggestion path (not a unique storycraft type in the panel).
- **Milestone 5 — Agent Mode**: long-running “Scene Doctor / chapter critique / character consistency / payoff” jobs in the agent orchestrator (rules can be `intent`-aligned today but are not wired as named agent jobs).
- **Milestone 6 — Payoff tracker** and new DB tables (plan suggested deferring until needed; continuity/suggestions reuse still TBD for storycraft runs). *Note: the Zen “Setup & payoff” and “Addiction beat” actions are rewrite-time craft routing, not a persisted tracker UI.*
- **Seeding policy**: the repo may load a large built-in set; curation to “20–40 seed rules” is a product/migration choice, not enforced by the runtime.
- **Phase 3 / planning**: “Planning Mode story architect” as a *separate* planning surface (outside the Zen editor) is not built; the **Story plan** action only revises the **selected** passage with `planning_architect` rules.

To run the API locally, use the existing backend entrypoint; storycraft paths are `…/storycraft/analyze` and `…/storycraft/rewrite` as above.
