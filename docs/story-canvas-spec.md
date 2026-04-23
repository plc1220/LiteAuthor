# Story Canvas / Brain Dump Import Spec

## Overview
Story Canvas is a project-scoped intake space for turning messy notes into structured story material.
It sits between freeform capture and the existing manuscript/wiki/timeline surfaces:

- `Manuscript` remains the drafting surface.
- `Story Wiki` remains the canonical reference surface.
- `Timeline` remains the ordered event surface.
- `Story Canvas` is the place where raw material lands, gets clustered, and is reviewed before it is promoted anywhere else.

The product goal is speed first, structure second. Users should be able to dump in ideas with almost no friction, then sort and triage them later.

## Primary User Flow
1. Open a project and navigate to Story Canvas.
2. Paste, drag in, or type brain-dump material.
3. The app creates one or more capture items from the input.
4. The canvas assigns semantic hints and a provisional sort order.
5. The user reviews captures, edits labels, merges duplicates, or moves items into buckets.
6. Approved items can be promoted to wiki pages, timeline events, or manuscript notes.

The default interaction should feel like throwing papers onto a desk and letting the desk organize itself just enough to be useful.

## Artifact Intake
Story Canvas should accept several artifact types:

- Plain text paste from notes, chats, outlines, and drafts.
- Multi-paragraph brain dumps with mixed topics.
- Delimited imports, where each paragraph, bullet, or heading can become a capture item.
- Optional file drop for text-based sources in later phases.

Intake rules:

- Preserve the raw source text exactly.
- Generate a normalized text version for search and clustering.
- Split into candidate captures on blank lines, bullet boundaries, headings, or explicit separators.
- Never throw away a user’s original wording during intake.
- If parsing is uncertain, keep the text as a single capture and flag it for review rather than over-splitting it.

## Floating Semantic Hints
Semantic hints are lightweight, non-destructive overlays that explain why an item appears where it does.

Examples:

- `Character: Mara`
- `Location: floodgate`
- `Thread: inheritance`
- `Time: pre-heist`
- `Tone: tense`

Behavior:

- Hints appear as floating chips near a capture card or along the canvas margin.
- Hints are advisory only until the user accepts them.
- Hints can be dismissed, pinned, or edited.
- A pinned hint becomes a hard signal for sorting and future imports.
- Multiple hints may stack, but the UI should collapse low-value duplicates.

Hints should answer one question only: "why is this here?"

## Autosort Modes
Autosort is a routing layer, not a final truth. The user can always override it.

Supported modes for MVP:

1. `Manual`
   - No automatic rearrangement.
   - User places items directly.
2. `By Thread`
   - Groups captures by recurring story concern, conflict, or idea cluster.
   - Good for thematic brain dumps.
3. `By Character`
   - Groups captures around named characters and relationships.
   - Good for cast-heavy notes.
4. `By Time`
   - Orders captures by explicit or inferred chronology.
   - Good for planning beats and cause/effect.
5. `By Location`
   - Groups captures by place or scene setting.
   - Good for travel-heavy or multi-scene planning.

Rules:

- A capture can belong to multiple potential groups, but only one primary sort lane.
- The user can lock a card so autosort will not move it again.
- Autosort should prefer stable, explainable placements over cleverness.
- If confidence is low, leave the item near the intake lane and surface a hint instead of forcing placement.

## Capture Review
Capture review is the checkpoint between raw intake and durable story structure.

Review actions:

- Edit the capture text.
- Rename or retag the item.
- Accept the suggested group.
- Move the item to a different lane.
- Merge with another capture.
- Split a capture into smaller items.
- Reject a capture and keep it archived.
- Promote the capture into wiki, timeline, or manuscript work.

Review states:

- `new`
- `suggested`
- `reviewed`
- `promoted`
- `archived`

The review panel should show the original source, inferred hints, and the current destination so the user never loses provenance.

## Data Model
The MVP should use a small project-local model that maps cleanly to the existing SQLite + file-based project structure.

### Capture
Represents one imported unit of thought.

| Field | Purpose |
|---|---|
| `id` | Stable capture identifier |
| `project_id` | Owning project |
| `source_type` | `paste`, `file`, `manual`, `import_batch` |
| `source_ref` | Optional file name, paste batch id, or external origin |
| `raw_text` | Exact imported text |
| `normalized_text` | Searchable / comparable version |
| `status` | Review state |
| `primary_sort_mode` | Current autosort mode used for placement |
| `lane_key` | Current group, bucket, or lane |
| `is_locked` | Prevents autosort from moving the item |
| `created_at`, `updated_at` | Audit trail |

### Hint

| Field | Purpose |
|---|---|
| `id` | Stable hint identifier |
| `capture_id` | Owning capture |
| `kind` | Character, location, thread, time, tone, etc. |
| `label` | Display string |
| `confidence` | Relative strength of the hint |
| `is_pinned` | User-approved durable signal |
| `created_by` | `system` or `user` |

### Bucket / Lane

| Field | Purpose |
|---|---|
| `id` | Stable lane identifier |
| `project_id` | Owning project |
| `mode` | Which autosort mode produced it |
| `label` | Human-readable name |
| `sort_order` | Visual position |

### Review Event

| Field | Purpose |
|---|---|
| `id` | Stable review action id |
| `capture_id` | Target capture |
| `action` | Accept, reject, merge, split, promote, relabel |
| `before_json` | Snapshot before change |
| `after_json` | Snapshot after change |
| `created_at` | Audit timestamp |

## MVP Scope
Include:

- Story Canvas screen with paste-first intake.
- Capture cards with raw text, inferred hints, and status.
- At least three autosort modes: by thread, by character, by time.
- Manual drag-and-drop override.
- Review queue with accept, reject, edit, merge, and promote actions.
- Provenance preserved for every capture.
- Local-only persistence compatible with project-scoped storage.

Exclude for MVP:

- Full document OCR.
- Image understanding.
- Cross-project memory.
- Deep LLM rewrite generation.
- Automatic promotion into manuscript prose.

## Future LLM Integration
LLM support should remain optional and additive.

Near-term LLM uses:

- Extract candidate entities from raw captures.
- Suggest semantic hints and likely lanes.
- Detect duplicate or near-duplicate captures.
- Summarize large brain dumps into reviewable clusters.
- Propose promotions into timeline events or wiki entries.

Design constraints for later integration:

- The user must be able to disable LLM assistance.
- Every LLM suggestion should be explainable from source text.
- LLM output should never overwrite raw capture text without explicit user approval.
- Model calls should be bounded by size, with graceful fallback to deterministic heuristics.

## Success Criteria
Story Canvas is successful when a user can paste a chaotic page of notes, get useful clusters within seconds, and leave with a smaller, cleaner set of captures that are ready for wiki, timeline, or manuscript work.
