import {useEffect, useMemo, useState} from 'react';
import {
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  ClipboardPaste,
  Clock3,
  Layers3,
  RefreshCw,
  ScanSearch,
  Sparkles,
  SlidersHorizontal,
  TriangleAlert,
  WandSparkles,
} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import {api} from '../lib/api';

type SortMode = 'semantic' | 'chronological' | 'density';
type ArtifactKind = 'scene' | 'beat' | 'thread' | 'question' | 'promise' | 'note';
type ArtifactStatus = 'draft' | 'review' | 'locked';

type CanvasArtifact = {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  kind: ArtifactKind;
  score: number;
  tags: string[];
  order: number;
  status: ArtifactStatus;
};

type CanvasHint = {
  id: string;
  label: string;
  detail: string;
  x: number;
  y: number;
  tone: 'calm' | 'warm' | 'alert' | 'ink';
};

type CanvasAnalysis = {
  summary: string;
  artifacts: CanvasArtifact[];
  hints: CanvasHint[];
  capture?: string;
};

type CanvasApiResult = Partial<CanvasAnalysis> & {
  artifacts?: Array<Partial<CanvasArtifact> | Record<string, unknown>>;
  hints?: Array<Partial<CanvasHint> | Record<string, unknown>>;
  semantic_hints?: Array<Partial<CanvasHint> | Record<string, unknown>>;
  capture?: string;
  review?: string;
  summary?: string;
  message?: string;
};

type CanvasApiClient = typeof api & {
  canvasAnalyze?: (
    projectId: string,
    body: {text: string; project_id?: string; source?: string; mode?: SortMode},
  ) => Promise<CanvasApiResult>;
  canvasAutosort?: (
    projectId: string,
    body: {text: string; project_id?: string; mode: SortMode; artifacts?: CanvasArtifact[]},
  ) => Promise<CanvasApiResult>;
  canvasCapture?: (
    projectId: string,
    body: {text: string; project_id?: string; mode: SortMode; selected_ids?: string[]; notes?: string; artifacts?: CanvasArtifact[]},
  ) => Promise<CanvasApiResult>;
};

type CaptureEntry = {
  id: string;
  title: string;
  detail: string;
  at: string;
};

const canvasApi = api as CanvasApiClient;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'then',
  'than',
  'when',
  'what',
  'your',
  'their',
  'there',
  'about',
  'after',
  'before',
  'scene',
  'chapter',
  'project',
  'story',
  'canvas',
  'note',
  'notes',
  'idea',
  'ideas',
  'draft',
  'artifact',
  'artifacts',
  'beat',
  'beats',
  'thread',
  'threads',
  'maybe',
  'should',
  'would',
  'could',
  'have',
  'has',
  'had',
  'will',
  'was',
  'were',
  'you',
  'we',
  'they',
  'it',
  'its',
  'our',
  'also',
  'but',
  'not',
  'too',
  'very',
  'more',
  'most',
  'less',
  'like',
  'just',
  'etc',
]);

const HINT_POSITIONS = [
  {x: 14, y: 14},
  {x: 82, y: 18},
  {x: 86, y: 52},
  {x: 18, y: 78},
  {x: 57, y: 84},
];

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function splitBlocks(text: string) {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) return [];

  const paragraphBlocks = cleaned
    .split(/\n{2,}(?=(?:#{1,6}\s+|[-*•]\s+|\d+[.)]\s+|\p{Lu}[\s\w'’,-]{3,80}:))/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphBlocks.length > 1) return paragraphBlocks;

  return cleaned
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function stripHeading(line: string) {
  return line.replace(/^(?:#{1,6}\s+|[-*•]\s+|\d+[.)]\s+)/, '').trim();
}

function titleFromBlock(block: string, fallback: number) {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  const heading = lines.find((line) => /^#{1,6}\s+/.test(line) || /^[-*•]\s+/.test(line));
  if (heading) {
    const title = stripHeading(heading);
    if (title) return title.slice(0, 64);
  }

  const firstLine = lines[0] ?? '';
  const firstSentence = firstLine.split(/(?<=[.!?])\s+/)[0] ?? '';
  const cleaned = stripHeading(firstSentence || firstLine);
  if (cleaned) return cleaned.slice(0, 64);

  return `Artifact ${fallback + 1}`;
}

function excerptFromBlock(block: string) {
  const compact = normalizeWhitespace(block.replace(/^#{1,6}\s+/gm, '').replace(/^[-*•]\s+/gm, ''));
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

function words(text: string) {
  return text
    .toLowerCase()
    .match(/\b[\p{L}\p{N}'’]+\b/gu)
    ?.map((word) => word.replace(/^['’]+|['’]+$/g, ''))
    .filter(Boolean) ?? [];
}

function scoreBlock(block: string) {
  const tokens = words(block);
  const sentenceCount = Math.max(1, block.split(/[.!?]+/).filter((part) => part.trim().length > 0).length);
  const questionMarks = (block.match(/\?/g) ?? []).length;
  const emdashes = (block.match(/—|-/g) ?? []).length;
  return Math.min(100, Math.round(tokens.length * 0.9 + sentenceCount * 2 + questionMarks * 4 + emdashes * 1.5));
}

function inferKind(block: string): ArtifactKind {
  const lower = block.toLowerCase();
  if (lower.includes('?') || lower.includes('unclear') || lower.includes('why ') || lower.includes('what if')) return 'question';
  if (lower.includes('promise') || lower.includes('setup') || lower.includes('payoff') || lower.includes('foreshadow')) return 'promise';
  if (lower.includes('scene') || lower.includes('dialogue') || lower.includes('pov') || lower.includes('moment')) return 'scene';
  if (lower.includes('beat') || lower.includes('turn') || lower.includes('shift') || lower.includes('reveal')) return 'beat';
  if (lower.includes('thread') || lower.includes('throughline') || lower.includes('motive')) return 'thread';
  return 'note';
}

function kindRank(kind: ArtifactKind) {
  switch (kind) {
    case 'scene':
      return 0;
    case 'beat':
      return 1;
    case 'thread':
      return 2;
    case 'promise':
      return 3;
    case 'question':
      return 4;
    default:
      return 5;
  }
}

function extractTags(block: string) {
  const counts = new Map<string, number>();
  for (const word of words(block)) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([tag]) => tag);
}

function normalizeArtifact(input: Partial<CanvasArtifact> | Record<string, unknown>, fallbackIndex: number): CanvasArtifact {
  const content = typeof input.content === 'string' ? input.content : typeof input.excerpt === 'string' ? input.excerpt : '';
  const order = typeof input.order === 'number' ? input.order : fallbackIndex;
  return {
    id: typeof input.id === 'string' && input.id.trim() ? input.id : `artifact-${fallbackIndex + 1}`,
    title: typeof input.title === 'string' && input.title.trim() ? input.title : titleFromBlock(content || 'Untitled artifact', fallbackIndex),
    content,
    excerpt: typeof input.excerpt === 'string' && input.excerpt.trim() ? input.excerpt : excerptFromBlock(content),
    kind: (typeof input.kind === 'string' && ['scene', 'beat', 'thread', 'question', 'promise', 'note'].includes(input.kind)
      ? input.kind
      : inferKind(content || String(input.title ?? ''))) as ArtifactKind,
    score: typeof input.score === 'number' ? input.score : scoreBlock(content || String(input.title ?? '')),
    tags: Array.isArray(input.tags)
      ? input.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 4)
      : extractTags(content || String(input.title ?? '')),
    order,
    status: (typeof input.status === 'string' && ['draft', 'review', 'locked'].includes(input.status) ? input.status : 'draft') as ArtifactStatus,
  };
}

function normalizeHint(input: Partial<CanvasHint> | Record<string, unknown>, fallbackIndex: number): CanvasHint {
  const defaults = HINT_POSITIONS[fallbackIndex % HINT_POSITIONS.length];
  return {
    id: typeof input.id === 'string' && input.id.trim() ? input.id : `hint-${fallbackIndex + 1}`,
    label: typeof input.label === 'string' && input.label.trim() ? input.label : 'Semantic hint',
    detail: typeof input.detail === 'string' && input.detail.trim() ? input.detail : 'No detail returned yet.',
    x: typeof input.x === 'number' ? input.x : defaults.x,
    y: typeof input.y === 'number' ? input.y : defaults.y,
    tone: (typeof input.tone === 'string' && ['calm', 'warm', 'alert', 'ink'].includes(input.tone) ? input.tone : 'calm') as CanvasHint['tone'],
  };
}

function buildHintsFromText(text: string, artifacts: CanvasArtifact[]) {
  const counts = new Map<string, number>();
  for (const word of words(text)) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const topKeywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);

  if (topKeywords.length === 0) {
    return [
      {
        id: 'hint-empty',
        label: 'Paste text to begin',
        detail: 'The canvas will surface recurring motifs, beats, and unresolved questions here.',
        x: 18,
        y: 18,
        tone: 'ink' as const,
      },
    ];
  }

  return topKeywords.map(([keyword, count], index) => {
    const tone: CanvasHint['tone'] = count >= 4 ? 'alert' : artifacts.some((artifact) => artifact.tags.includes(keyword)) ? 'warm' : 'calm';
    const sourceArtifact = artifacts.find((artifact) => artifact.tags.includes(keyword));
    const position = HINT_POSITIONS[index % HINT_POSITIONS.length];
    return {
      id: `hint-${keyword}-${index}`,
      label: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      detail: sourceArtifact ? `Shared by ${sourceArtifact.title}` : `Seen ${count} times across the paste`,
      x: position.x,
      y: position.y,
      tone,
    };
  });
}

function buildLocalAnalysis(text: string): CanvasAnalysis {
  const blocks = splitBlocks(text);
  const artifacts = blocks.map((block, index) => {
    const content = normalizeWhitespace(block);
    return {
      id: `artifact-${index + 1}`,
      title: titleFromBlock(content, index),
      content,
      excerpt: excerptFromBlock(content),
      kind: inferKind(content),
      score: scoreBlock(content),
      tags: extractTags(content),
      order: index,
      status: (content.includes('TODO') || content.includes('?') ? 'review' : 'draft') as ArtifactStatus,
    };
  });

  const totalWords = words(text).length;
  const questions = (text.match(/\?/g) ?? []).length;
  const promises = artifacts.filter((artifact) => artifact.kind === 'promise').length;
  const summary =
    artifacts.length === 0
      ? 'No artifacts yet. Paste a scene packet, note dump, or beat sheet to populate the canvas.'
      : `${artifacts.length} artifacts · ${totalWords} words · ${questions} questions · ${promises} promises`;

  return {
    summary,
    artifacts,
    hints: buildHintsFromText(text, artifacts),
    capture: artifacts.length > 0 ? `Ready to capture ${artifacts.length} artifact${artifacts.length === 1 ? '' : 's'} into a review pass.` : 'Capture becomes useful once there is text to review.',
  };
}

function sortArtifacts(artifacts: CanvasArtifact[], mode: SortMode) {
  const list = [...artifacts];
  if (mode === 'chronological') {
    return list.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }

  if (mode === 'density') {
    return list.sort((a, b) => b.content.length - a.content.length || b.score - a.score || a.title.localeCompare(b.title));
  }

  return list.sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || b.score - a.score || a.title.localeCompare(b.title));
}

function toneClasses(tone: CanvasHint['tone']) {
  switch (tone) {
    case 'warm':
      return 'border-amber-wax/35 bg-amber-wax/10 text-primary';
    case 'alert':
      return 'border-red-400/35 bg-red-500/10 text-red-100';
    case 'ink':
      return 'border-oak-variant bg-sepia-highest/70 text-ink';
    default:
      return 'border-teal-500/25 bg-teal-500/10 text-ink';
  }
}

function kindClasses(kind: ArtifactKind) {
  switch (kind) {
    case 'scene':
      return 'border-primary/25 bg-primary/5 text-primary';
    case 'beat':
      return 'border-amber-wax/30 bg-amber-wax/10 text-amber-wax';
    case 'thread':
      return 'border-teal-500/30 bg-teal-500/10 text-teal-200';
    case 'question':
      return 'border-red-400/30 bg-red-500/10 text-red-100';
    case 'promise':
      return 'border-indigo-400/30 bg-indigo-500/10 text-indigo-100';
    default:
      return 'border-oak-variant bg-sepia-highest/70 text-ink-muted';
  }
}

function currentTimeLabel() {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}

export default function StoryCanvas({onNavigate}: NavigationProps) {
  const activeProject = useProjectStore((s) => s.activeProject);

  const [artifactText, setArtifactText] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('semantic');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [captureNotes, setCaptureNotes] = useState('');
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState('Local parse ready.');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAutosorting, setIsAutosorting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const storageKey = activeProject ? `liteauthor.story-canvas.${activeProject.id}` : null;

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    const savedText = window.localStorage.getItem(storageKey);
    const savedNotes = window.localStorage.getItem(`${storageKey}.capture-notes`);
    const savedSort = window.localStorage.getItem(`${storageKey}.sort-mode`);
    setArtifactText(savedText ?? '');
    setCaptureNotes(savedNotes ?? '');
    setSortMode(savedSort === 'chronological' || savedSort === 'density' ? savedSort : 'semantic');
    setSelectedId(null);
    setCaptures([]);
    setAnalysisStatus('Local parse ready.');
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, artifactText);
  }, [artifactText, storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    window.localStorage.setItem(`${storageKey}.capture-notes`, captureNotes);
  }, [captureNotes, storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    window.localStorage.setItem(`${storageKey}.sort-mode`, sortMode);
  }, [sortMode, storageKey]);

  const localAnalysis = useMemo(() => buildLocalAnalysis(artifactText), [artifactText]);

  const [analysis, setAnalysis] = useState<CanvasAnalysis>(() => buildLocalAnalysis(''));

  useEffect(() => {
    setAnalysis(localAnalysis);
  }, [localAnalysis]);

  const artifacts = useMemo(() => sortArtifacts(analysis.artifacts, sortMode), [analysis.artifacts, sortMode]);
  const selectedArtifact = useMemo(() => artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0] ?? null, [artifacts, selectedId]);

  useEffect(() => {
    if (artifacts.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !artifacts.some((artifact) => artifact.id === selectedId)) {
      setSelectedId(artifacts[0].id);
    }
  }, [artifacts, selectedId]);

  const keywordLine = useMemo(() => {
    if (artifacts.length === 0) return 'No artifacts detected yet.';
    const kinds = artifacts.reduce<Record<ArtifactKind, number>>(
      (acc, artifact) => {
        acc[artifact.kind] += 1;
        return acc;
      },
      {scene: 0, beat: 0, thread: 0, question: 0, promise: 0, note: 0},
    );
    return `${kinds.scene} scenes · ${kinds.beat} beats · ${kinds.thread} threads · ${kinds.question} questions`;
  }, [artifacts]);

  const syncAnalysis = async () => {
    if (!activeProject) return;
    setIsAnalyzing(true);
    setAnalysisStatus('Analyzing canvas...');
    try {
      const result = await canvasApi.canvasAnalyze?.(activeProject.id, {
        text: artifactText,
        project_id: activeProject.id,
        source: 'story_canvas',
        mode: sortMode,
      });

      if (result) {
        const remoteArtifacts = Array.isArray(result.artifacts) ? result.artifacts.map((item, index) => normalizeArtifact(item, index)) : [];
        const remoteHints = Array.isArray(result.hints)
          ? result.hints.map((item, index) => normalizeHint(item, index))
          : Array.isArray(result.semantic_hints)
            ? result.semantic_hints.map((item, index) => normalizeHint(item, index))
            : [];
        setAnalysis({
          summary: result.summary ?? result.message ?? localAnalysis.summary,
          artifacts: remoteArtifacts.length > 0 ? remoteArtifacts : localAnalysis.artifacts,
          hints: remoteHints.length > 0 ? remoteHints : localAnalysis.hints,
          capture: result.capture ?? result.review ?? localAnalysis.capture,
        });
        setAnalysisStatus('Canvas analysis updated.');
        return;
      }

      setAnalysis(localAnalysis);
      setAnalysisStatus('Local analysis refreshed.');
    } catch {
      setAnalysis(localAnalysis);
      setAnalysisStatus('Local analysis refreshed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const autosort = async (mode: SortMode) => {
    if (!activeProject) return;
    setSortMode(mode);
    setIsAutosorting(true);
    setAnalysisStatus(`Sorting by ${mode}...`);
    try {
      const result = await canvasApi.canvasAutosort?.(activeProject.id, {
        text: artifactText,
        project_id: activeProject.id,
        mode,
        artifacts,
      });
      if (result) {
        const remoteArtifacts = Array.isArray(result.artifacts) ? result.artifacts.map((item, index) => normalizeArtifact(item, index)) : [];
        if (remoteArtifacts.length > 0) {
          setAnalysis((current) => ({
            ...current,
            summary: result.summary ?? result.message ?? current.summary,
            artifacts: remoteArtifacts,
            hints: Array.isArray(result.hints)
              ? result.hints.map((item, index) => normalizeHint(item, index))
              : Array.isArray(result.semantic_hints)
                ? result.semantic_hints.map((item, index) => normalizeHint(item, index))
                : current.hints,
            capture: result.capture ?? result.review ?? current.capture,
          }));
        }
        setAnalysisStatus(`Autosort ready for ${mode}.`);
        return;
      }
      setAnalysisStatus(`Autosort set to ${mode}.`);
    } catch {
      setAnalysisStatus(`Autosort set to ${mode}.`);
    } finally {
      setIsAutosorting(false);
    }
  };

  const captureReview = async () => {
    if (!activeProject) return;
    setIsCapturing(true);
    setAnalysisStatus('Capturing review...');
    const selectedIds = selectedArtifact ? [selectedArtifact.id] : [];
    const detail = captureNotes.trim() || selectedArtifact?.excerpt || analysis.summary;

    try {
      const result = await canvasApi.canvasCapture?.(activeProject.id, {
        text: artifactText,
        project_id: activeProject.id,
        mode: sortMode,
        selected_ids: selectedIds,
        notes: captureNotes.trim(),
        artifacts,
      });

      const captureText =
        (result?.capture ?? result?.review ?? result?.summary ?? '').trim() ||
        `${selectedArtifact ? `${selectedArtifact.title} · ` : ''}${detail}`;

      setCaptures((current) => [
        {
          id: `capture-${Date.now()}`,
          title: selectedArtifact?.title ?? 'Canvas capture',
          detail: captureText,
          at: currentTimeLabel(),
        },
        ...current,
      ]);
      setAnalysis((current) => ({
        ...current,
        capture: captureText,
      }));
      setAnalysisStatus('Capture saved to the review rail.');
    } catch {
      const captureText = `${selectedArtifact ? `${selectedArtifact.title} · ` : ''}${detail}`;
      setCaptures((current) => [
        {
          id: `capture-${Date.now()}`,
          title: selectedArtifact?.title ?? 'Canvas capture',
          detail: captureText,
          at: currentTimeLabel(),
        },
        ...current,
      ]);
      setAnalysisStatus('Capture saved locally.');
    } finally {
      setIsCapturing(false);
    }
  };

  const pasteClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim()) {
        setArtifactText(clip);
        setAnalysisStatus('Clipboard text loaded into the canvas.');
      }
    } catch {
      setAnalysisStatus('Clipboard access was blocked by the browser.');
    }
  };

  if (!activeProject) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment text-ink px-6 text-center">
        <div className="max-w-md">
          <p className="font-serif text-lg italic mb-4">Select a project before opening Story Canvas.</p>
          <button
            type="button"
            className="inline-flex items-center gap-2 font-sans text-xs uppercase px-4 py-2 bg-primary text-parchment rounded-sm border-none cursor-pointer"
            onClick={() => onNavigate('StoryWikiHub', 'push_back')}
          >
            <BookOpen className="w-4 h-4" />
            Project Desk
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment text-ink">
      <header className="sticky top-0 z-40 border-b border-oak-variant bg-parchment-bright/95 backdrop-blur px-5 py-4 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-oak-variant bg-sepia-low">
              <Layers3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-sans uppercase tracking-[0.28em] text-ink-muted">Canvas</p>
              <h1 className="text-2xl font-serif italic text-primary">Story Canvas</h1>
              <p className="text-xs text-ink-muted">{activeProject.name}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-sm border border-oak-variant bg-sepia-low px-3 py-2 text-[10px] font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
              onClick={() => onNavigate('StoryWikiHub', 'push_back')}
            >
              <BookOpen className="w-4 h-4" />
              Project Desk
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-sm border border-oak-variant bg-sepia-low px-3 py-2 text-[10px] font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
              onClick={() => void syncAnalysis()}
              disabled={isAnalyzing}
            >
              <ScanSearch className="w-4 h-4" />
              {isAnalyzing ? 'Analyzing' : 'Analyze canvas'}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-2 text-[10px] font-sans uppercase tracking-widest text-parchment hover:bg-amber-wax disabled:opacity-60"
              onClick={() => void captureReview()}
              disabled={isCapturing}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isCapturing ? 'Capturing' : 'Capture review'}
            </button>
          </div>
        </div>
      </header>

      <main className="grid min-h-[calc(100vh-80px)] grid-cols-1 xl:grid-cols-[350px_minmax(0,1fr)_360px]">
        <aside className="border-r border-oak-variant bg-sepia-low/70">
          <div className="flex h-full flex-col gap-6 p-5 md:p-6">
            <section className="space-y-4 rounded-sm border border-oak-variant bg-parchment-bright p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted">Paste artifact text</p>
                  <h2 className="mt-1 text-lg font-serif italic text-primary">Feed the board</h2>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-sm border border-oak-variant bg-sepia-low px-3 py-2 text-[10px] font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                  onClick={() => void pasteClipboard()}
                >
                  <ClipboardPaste className="w-4 h-4" />
                  Paste
                </button>
              </div>

              <textarea
                className="min-h-[280px] w-full resize-y rounded-sm border border-oak-variant bg-parchment px-3 py-3 text-sm leading-relaxed outline-none placeholder:text-ink-muted/70 focus:border-primary"
                placeholder="Paste a beat sheet, scene packet, a cluster of notes, or raw artifact text here."
                value={artifactText}
                onChange={(e) => setArtifactText(e.target.value)}
              />

              <div className="flex flex-wrap gap-2">
                {(['semantic', 'chronological', 'density'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-sans uppercase tracking-widest ${
                      sortMode === mode ? 'border-primary bg-amber-wax-container text-parchment' : 'border-oak-variant bg-sepia-high text-ink-muted'
                    }`}
                    onClick={() => void autosort(mode)}
                  >
                    {mode === 'semantic' ? <Sparkles className="w-3.5 h-3.5" /> : mode === 'chronological' ? <ArrowUpDown className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
                    {mode}
                  </button>
                ))}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-oak-variant bg-sepia-high px-3 py-1.5 text-[10px] font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                  onClick={() => {
                    setArtifactText('');
                    setAnalysisStatus('Canvas cleared.');
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </section>

            <section className="rounded-sm border border-oak-variant bg-parchment-bright p-4">
              <div className="flex items-center gap-2">
                <WandSparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Canvas read</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{analysis.summary}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-sm border border-oak-variant bg-sepia-low p-3">
                  <div className="text-[10px] uppercase tracking-widest text-ink-muted">Artifacts</div>
                  <div className="mt-1 text-lg font-semibold text-primary">{artifacts.length}</div>
                </div>
                <div className="rounded-sm border border-oak-variant bg-sepia-low p-3">
                  <div className="text-[10px] uppercase tracking-widest text-ink-muted">Mode</div>
                  <div className="mt-1 text-lg font-semibold text-primary capitalize">{sortMode}</div>
                </div>
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-ink-muted">{keywordLine}</p>
              <p className="mt-2 text-[11px] text-ink-muted">{analysisStatus}</p>
            </section>

            <section className="mt-auto rounded-sm border border-oak-variant bg-parchment-bright p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-oak" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Capture note</h3>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-ink-muted">Review rail</span>
              </div>
              <textarea
                className="mt-3 min-h-[120px] w-full resize-y rounded-sm border border-oak-variant bg-parchment px-3 py-3 text-sm leading-relaxed outline-none placeholder:text-ink-muted/70 focus:border-primary"
                placeholder="Write the review angle, the continuity warning, or the next editorial action."
                value={captureNotes}
                onChange={(e) => setCaptureNotes(e.target.value)}
              />
            </section>
          </div>
        </aside>

        <section className="relative overflow-hidden bg-parchment-dim">
          <div className="border-b border-oak-variant bg-parchment/70 px-5 py-4 md:px-8">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div>
                <p className="text-[10px] font-sans uppercase tracking-[0.28em] text-ink-muted">Semantic surface</p>
                <p className="mt-1 text-sm text-ink-muted">{analysis.capture ?? 'Capture review becomes richer after you select a card and add a note.'}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-oak-variant bg-sepia-low px-3 py-1.5 text-[10px] font-sans uppercase tracking-widest text-ink-muted">
                <TriangleAlert className="w-3.5 h-3.5" />
                {artifacts.some((artifact) => artifact.kind === 'question') ? 'Questions need review' : 'No urgent gaps detected'}
              </div>
            </div>
          </div>

          <div className="relative min-h-[calc(100vh-208px)] p-5 md:p-8">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {analysis.hints.map((hint) => (
                <div
                  key={hint.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 shadow-sm backdrop-blur ${toneClasses(hint.tone)}`}
                  style={{left: `${hint.x}%`, top: `${hint.y}%`}}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-sans uppercase tracking-widest">{hint.label}</span>
                  </div>
                  <div className="mt-0.5 max-w-[12rem] text-[11px] leading-tight opacity-80">{hint.detail}</div>
                </div>
              ))}
            </div>

            {artifacts.length === 0 ? (
              <div className="relative z-10 flex min-h-[60vh] items-center justify-center rounded-sm border border-dashed border-oak-variant bg-parchment-bright/60 p-8 text-center">
                <div className="max-w-lg">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-oak-variant bg-sepia-low">
                    <ScanSearch className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="mt-4 text-2xl font-serif italic text-primary">Paste your artifact text</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    The canvas will split the paste into cards, infer the signal in each block, float semantic hints across the board, and
                    prepare the capture rail for review.
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative z-10 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {artifacts.map((artifact) => {
                  const selected = artifact.id === selectedArtifact?.id;
                  return (
                    <button
                      key={artifact.id}
                      type="button"
                      onClick={() => setSelectedId(artifact.id)}
                      className={`group flex min-h-[210px] flex-col rounded-sm border p-4 text-left transition-transform hover:-translate-y-0.5 ${
                        selected ? 'border-primary bg-parchment-bright shadow-sm' : 'border-oak-variant bg-parchment-bright/80 hover:border-primary/45'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-sans uppercase tracking-widest ${kindClasses(artifact.kind)}`}>
                            {artifact.kind}
                          </div>
                          <h3 className="mt-3 text-xl font-serif font-semibold leading-tight text-ink group-hover:text-primary">{artifact.title}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-widest text-ink-muted">Score</div>
                          <div className="mt-1 text-lg font-semibold text-primary">{artifact.score}</div>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-muted">{artifact.excerpt}</p>

                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                        {artifact.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full border border-oak-variant bg-sepia-low px-2.5 py-1 text-[10px] font-sans uppercase tracking-widest text-ink-muted">
                            {tag}
                          </span>
                        ))}
                        {artifact.status === 'review' ? (
                          <span className="rounded-full border border-amber-wax/40 bg-amber-wax/10 px-2.5 py-1 text-[10px] font-sans uppercase tracking-widest text-amber-wax">
                            Review
                          </span>
                        ) : artifact.status === 'locked' ? (
                          <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[10px] font-sans uppercase tracking-widest text-teal-200">
                            Locked
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="border-l border-oak-variant bg-sepia-low/70">
          <div className="flex h-full flex-col gap-6 p-5 md:p-6">
            <section className="rounded-sm border border-oak-variant bg-parchment-bright p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted">Selected card</p>
                  <h2 className="mt-1 text-lg font-serif italic text-primary">{selectedArtifact?.title ?? 'Nothing selected'}</h2>
                </div>
                <div className="flex items-center gap-2 text-ink-muted">
                  <Layers3 className="w-4 h-4" />
                </div>
              </div>

              {selectedArtifact ? (
                <div className="mt-4 space-y-4">
                  <p className="text-sm leading-relaxed text-ink-muted">{selectedArtifact.excerpt}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-sm border border-oak-variant bg-sepia-low p-3">
                      <div className="text-[10px] uppercase tracking-widest text-ink-muted">Kind</div>
                      <div className="mt-1 capitalize text-primary">{selectedArtifact.kind}</div>
                    </div>
                    <div className="rounded-sm border border-oak-variant bg-sepia-low p-3">
                      <div className="text-[10px] uppercase tracking-widest text-ink-muted">Status</div>
                      <div className="mt-1 capitalize text-primary">{selectedArtifact.status}</div>
                    </div>
                  </div>
                  <div className="rounded-sm border border-oak-variant bg-sepia-low p-3">
                    <div className="text-[10px] uppercase tracking-widest text-ink-muted">Tags</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedArtifact.tags.length > 0 ? (
                        selectedArtifact.tags.map((tag) => (
                          <span key={tag} className="rounded-full border border-oak-variant bg-parchment px-2.5 py-1 text-[10px] font-sans uppercase tracking-widest text-ink-muted">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-ink-muted">No tags extracted.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-ink-muted">Select a card to inspect its signal, tags, and review status.</p>
              )}
            </section>

            <section className="rounded-sm border border-oak-variant bg-parchment-bright p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Capture review</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Review captures can preserve the board state, the selected card, and the note you wrote before you move on.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-xs font-sans uppercase tracking-widest text-parchment hover:bg-amber-wax disabled:opacity-60"
                onClick={() => void captureReview()}
                disabled={isCapturing}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isCapturing ? 'Capturing' : 'Capture review'}
              </button>
            </section>

            <section className="flex-1 rounded-sm border border-oak-variant bg-parchment-bright p-4">
              <div className="flex items-center gap-2">
                <TriangleAlert className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Capture log</h3>
              </div>
              <div className="mt-4 space-y-3">
                {captures.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-oak-variant bg-sepia-low p-4 text-sm text-ink-muted">
                    No captures yet. Use the review button after you select a card.
                  </div>
                ) : (
                  captures.map((entry) => (
                    <article key={entry.id} className="rounded-sm border border-oak-variant bg-sepia-low p-3">
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="text-sm font-semibold text-primary">{entry.title}</h4>
                        <span className="text-[10px] uppercase tracking-widest text-ink-muted">{entry.at}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{entry.detail}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </aside>
      </main>
    </div>
  );
}
