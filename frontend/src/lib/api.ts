import type { StorycraftAnalyzeResult, StorycraftRequestBody, StorycraftRewriteResult } from './storycraft';

const API_BASE = '';

export type AutocompleteBody = {
  before: string;
  after?: string;
  previousParagraph?: string;
  documentMemory?: string;
};

type AutocompleteBridge = {
  complete: (body: AutocompleteBody) => Promise<{text: string} | string>;
  cancel?: () => void;
};

declare global {
  interface Window {
    liteauthorAutocomplete?: AutocompleteBridge;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function bridgeAutocomplete(body: AutocompleteBody, signal?: AbortSignal): Promise<{text: string} | null> {
  const bridge = typeof window !== 'undefined' ? window.liteauthorAutocomplete : undefined;
  if (!bridge) return null;
  if (signal?.aborted) throw new DOMException('Autocomplete request was cancelled.', 'AbortError');
  let abortListener: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    abortListener = () => {
      bridge.cancel?.();
      reject(new DOMException('Autocomplete request was cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', abortListener, {once: true});
  });
  try {
    const result = await Promise.race([bridge.complete(body), abortPromise]);
    return typeof result === 'string' ? {text: result} : result;
  } finally {
    if (abortListener) signal?.removeEventListener('abort', abortListener);
  }
}

export type Project = {
  id: string;
  name: string;
  root_path: string;
  settings: Record<string, unknown>;
  created_at: string;
};

export type Chapter = { id: string; sort_order: number; title: string; slug: string };
export type Scene = {
  id: string;
  chapter_id: string;
  sort_order: number;
  title: string;
  slug: string;
  file_rel_path: string;
};

export type CanvasNode = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string | null;
  label?: string | null;
  color?: string | null;
  metadata: Record<string, unknown>;
};

export type CanvasEdge = {
  id: string;
  fromNode: string;
  toNode: string;
  label?: string | null;
  metadata: Record<string, unknown>;
};

export type Canvas = {
  version: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  metadata: Record<string, unknown>;
};

export type CaptureProposal = {
  id: string;
  kind: string;
  title: string;
  target: string;
  content: string;
  source_node_ids: string[];
  metadata: Record<string, unknown>;
};

export type CanvasApiResult = {
  canvas?: Canvas;
  proposals?: CaptureProposal[];
  artifacts?: unknown[];
  hints?: unknown[];
  semantic_hints?: unknown[];
  summary?: string;
  message?: string;
  capture?: string;
  review?: string;
  applied?: boolean;
  items?: {kind: string; target: string}[];
  extraction_provider?: string;
};

export type MetricStats = {
  count: number;
  errors: number;
  error_rate: number;
  samples: number;
  avg_ms: number;
  max_ms: number;
  p50_ms: number;
  p90_ms: number;
  p95_ms: number;
  p99_ms: number;
};

export type MetricsSnapshot = {
  window_samples: number;
  metrics: Record<string, MetricStats>;
};

export const api = {
  health: () => apiFetch<{ status: string }>('/api/health'),
  metrics: () => apiFetch<MetricsSnapshot>('/api/metrics'),
  listProjects: () => apiFetch<Project[]>('/api/projects'),
  createProject: (body: { name: string; genres: string[]; target_words: number }) =>
    apiFetch<Project>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  getProject: (id: string) => apiFetch<Project>(`/api/projects/${id}`),
  projectStats: (id: string) =>
    apiFetch<{
      chars: number;
      wiki_chars: number;
      character_files: number;
      word_count: number;
      open_continuity_flags: number;
    }>(`/api/projects/${id}/stats`),
  outline: (projectId: string) =>
    apiFetch<{ chapters: Chapter[]; scenes: Scene[] }>(`/api/projects/${projectId}/manuscript/outline`),
  getSceneContent: (projectId: string, sceneId: string) =>
    apiFetch<{ markdown: string; updated_at: string }>(`/api/projects/${projectId}/manuscript/scenes/${sceneId}/content`),
  putSceneContent: (projectId: string, sceneId: string, markdown: string) =>
    apiFetch<{ ok: boolean; updated_at?: string }>(`/api/projects/${projectId}/manuscript/scenes/${sceneId}/content`, {
      method: 'PUT',
      body: JSON.stringify({ markdown }),
    }),
  createChapter: (projectId: string, title = 'New Chapter') =>
    apiFetch<{ id: string }>(`/api/projects/${projectId}/manuscript/chapters?title=${encodeURIComponent(title)}`, {
      method: 'POST',
    }),
  deleteChapter: (projectId: string, chapterId: string) =>
    apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/manuscript/chapters/${chapterId}`, {method: 'DELETE'}),
  createScene: (projectId: string, chapterId: string, title = 'New Scene') =>
    apiFetch<{ id: string; file_rel_path: string }>(
      `/api/projects/${projectId}/manuscript/chapters/${chapterId}/scenes?title=${encodeURIComponent(title)}`,
      { method: 'POST' },
    ),
  deleteScene: (projectId: string, sceneId: string) =>
    apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/manuscript/scenes/${sceneId}`, {method: 'DELETE'}),
  patchChapterTitle: (projectId: string, chapterId: string, title: string) =>
    apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/manuscript/chapters/${chapterId}`, {
      method: 'PATCH',
      body: JSON.stringify({title}),
    }),
  patchSceneTitle: (projectId: string, sceneId: string, title: string) =>
    apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/manuscript/scenes/${sceneId}`, {
      method: 'PATCH',
      body: JSON.stringify({title}),
    }),
  wikiTree: (projectId: string) => apiFetch<{ path: string; is_dir: boolean }[]>(`/api/projects/${projectId}/wiki/tree`),
  wikiGet: (projectId: string, path: string) =>
    apiFetch<{ path: string; content: string }>(`/api/projects/${projectId}/wiki/file?path=${encodeURIComponent(path)}`),
  wikiPut: (projectId: string, path: string, content: string) =>
    apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/wiki/file?path=${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  wikiNewCharacter: (projectId: string, slug: string) =>
    apiFetch<{ path: string }>(`/api/projects/${projectId}/wiki/characters?slug=${encodeURIComponent(slug)}`, {
      method: 'POST',
    }),
  wikiNewLocation: (projectId: string, slug: string) =>
    apiFetch<{ path: string }>(`/api/projects/${projectId}/wiki/locations?slug=${encodeURIComponent(slug)}`, {
      method: 'POST',
    }),
  listEvents: (projectId: string) =>
    apiFetch<
      {
        id: string;
        title: string;
        story_time: string | null;
        narrative_order: number | null;
        pov: string | null;
        participants: string[];
        dependencies: string[];
        notes: string | null;
        has_conflict: boolean;
        scene_id: string | null;
      }[]
    >(`/api/projects/${projectId}/timeline/events`),
  createEvent: (
    projectId: string,
    body: {
      title: string;
      story_time?: string | null;
      narrative_order?: number | null;
      pov?: string | null;
      participants?: string[];
      dependencies?: string[];
      notes?: string | null;
      has_conflict?: boolean;
      scene_id?: string | null;
    },
  ) =>
    apiFetch<unknown>(`/api/projects/${projectId}/timeline/events`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchEvent: (
    projectId: string,
    eventId: string,
    body: {
      title?: string;
      story_time?: string | null;
      narrative_order?: number | null;
      pov?: string | null;
      participants?: string[];
      dependencies?: string[];
      notes?: string | null;
      has_conflict?: boolean;
      scene_id?: string | null;
    },
  ) =>
    apiFetch<{
      id: string;
      title: string;
      story_time: string | null;
      narrative_order: number | null;
      pov: string | null;
      participants: string[];
      dependencies: string[];
      notes: string | null;
      has_conflict: boolean;
      scene_id: string | null;
    }>(`/api/projects/${projectId}/timeline/events/${eventId}`, {method: 'PATCH', body: JSON.stringify(body)}),
  getCanvas: (projectId: string) => apiFetch<Canvas>(`/api/projects/${projectId}/canvas`),
  putCanvas: (projectId: string, canvas: Canvas) =>
    apiFetch<Canvas>(`/api/projects/${projectId}/canvas`, {
      method: 'PUT',
      body: JSON.stringify(canvas),
    }),
  canvasAnalyze: (projectId: string, body: {title?: string; text: string; [key: string]: unknown}) =>
    apiFetch<CanvasApiResult>(
      `/api/projects/${projectId}/canvas/analyze`,
      {
        method: 'POST',
        body: JSON.stringify({title: body.title ?? 'Artifact', ...body}),
      },
    ),
  canvasAutosort: (projectId: string, body: {canvas?: Canvas; mode: string; [key: string]: unknown}) =>
    apiFetch<CanvasApiResult>(`/api/projects/${projectId}/canvas/autosort`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  canvasCapture: (projectId: string, body: {proposals?: CaptureProposal[]; apply?: boolean; [key: string]: unknown}) =>
    apiFetch<CanvasApiResult>(
      `/api/projects/${projectId}/canvas/capture`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),
  wikiPopulate: (
    projectId: string,
    body: {source: 'manuscript' | 'canvas' | 'text'; scene_id?: string; title?: string; text?: string; canvas?: Canvas},
  ) =>
    apiFetch<{proposals: CaptureProposal[]; summary?: string}>(`/api/projects/${projectId}/wiki/populate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  wikiApply: (projectId: string, body: {proposals: CaptureProposal[]; apply: boolean}) =>
    apiFetch<CanvasApiResult>(`/api/projects/${projectId}/wiki/populate/apply`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  zenAi: (
    projectId: string,
    body: {
      scene_id: string;
      task: string;
      selection: string;
      instruction: string;
      role?: string;
    },
  ) =>
    apiFetch<{
      text: string;
      packet_meta: { approx_tokens: number; chunks_used: number };
      context_packet?: { markdown: string; approx_tokens: number; chunks_used: number };
    }>(`/api/projects/${projectId}/ai/zen`, { method: 'POST', body: JSON.stringify(body) }),
  autocompleteAi: (
    projectId: string,
    body: AutocompleteBody,
    signal?: AbortSignal,
  ) => {
    const bridged = bridgeAutocomplete(body, signal);
    if (typeof window !== 'undefined' && window.liteauthorAutocomplete) return bridged as Promise<{text: string}>;
    return apiFetch<{ text: string }>(`/api/projects/${projectId}/ai/autocomplete`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    });
  },
  listSuggestions: (projectId: string, sceneId?: string) => {
    const q = sceneId ? `?scene_id=${encodeURIComponent(sceneId)}` : '';
    return apiFetch<Record<string, unknown>[]>(`/api/projects/${projectId}/suggestions${q}`);
  },
  createSuggestion: (
    projectId: string,
    body: {
      scene_id: string;
      range_from: number;
      range_to: number;
      original_text: string;
      proposed_text: string;
      explanation?: string | null;
      role?: string;
    },
  ) => apiFetch<{ id: string }>(`/api/projects/${projectId}/suggestions`, { method: 'POST', body: JSON.stringify(body) }),
  patchSuggestion: (projectId: string, suggestionId: string, status: string) =>
    apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/suggestions/${suggestionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  listFlags: (projectId: string) => apiFetch<Record<string, unknown>[]>(`/api/projects/${projectId}/continuity/flags`),
  createFlag: (projectId: string, body: { title: string; detail: string; scene_id?: string | null; event_id?: string | null }) =>
    apiFetch<{ id: string }>(`/api/projects/${projectId}/continuity/flags`, { method: 'POST', body: JSON.stringify(body) }),
  patchFlag: (projectId: string, flagId: string, status: 'open' | 'dismissed' | 'resolved' | 'intentional') =>
    apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/continuity/flags/${flagId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  search: (projectId: string, q: string) =>
    apiFetch<{ hits: { path: string; line: number | null; snippet: string }[] }>(
      `/api/projects/${projectId}/search?q=${encodeURIComponent(q)}`,
    ),
  startAgentJob: (projectId: string, job_type = 'continuity_pass') =>
    apiFetch<{ id: string }>(`/api/projects/${projectId}/agent/jobs`, {
      method: 'POST',
      body: JSON.stringify({ job_type }),
    }),
  getAgentJob: (projectId: string, jobId: string) =>
    apiFetch<Record<string, unknown>>(`/api/projects/${projectId}/agent/jobs/${jobId}`),
  listSnapshots: (projectId: string) => apiFetch<Record<string, unknown>[]>(`/api/projects/${projectId}/snapshots`),
  createSnapshot: (projectId: string, label?: string) =>
    apiFetch<{ id: string; created_at: string }>(`/api/projects/${projectId}/snapshots`, {
      method: 'POST',
      body: JSON.stringify({ label: label ?? null }),
    }),
  restoreSnapshot: (projectId: string, snapshotId: string) =>
    apiFetch<{ ok: boolean; backup_id: string }>(`/api/projects/${projectId}/snapshots/${snapshotId}/restore`, {
      method: 'POST',
    }),
  deleteSnapshot: (projectId: string, snapshotId: string) =>
    apiFetch<{ ok: boolean }>(`/api/projects/${projectId}/snapshots/${snapshotId}`, { method: 'DELETE' }),
  storycraftAnalyze: (projectId: string, body: StorycraftRequestBody) =>
    apiFetch<StorycraftAnalyzeResult>(`/api/projects/${projectId}/storycraft/analyze`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  storycraftRewrite: (projectId: string, body: StorycraftRequestBody) =>
    apiFetch<StorycraftRewriteResult>(`/api/projects/${projectId}/storycraft/rewrite`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
