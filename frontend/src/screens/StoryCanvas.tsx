import {useEffect, useMemo, useRef, useState} from 'react';
import type {PointerEvent, WheelEvent} from 'react';
import {
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  ClipboardPaste,
  Clock3,
  Home,
  Layers3,
  Link2,
  Maximize2,
  Minus,
  Move,
  Plus,
  RefreshCw,
  ScanSearch,
  Sparkles,
  StickyNote,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  WandSparkles,
} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import {api} from '../lib/api';
import type {CanvasNode, CaptureProposal, StoryCanvas as StoryCanvasData} from '../lib/api';

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
  canvas?: StoryCanvasData;
  artifacts?: Array<Partial<CanvasArtifact> | Record<string, unknown>>;
  hints?: Array<Partial<CanvasHint> | Record<string, unknown>>;
  semantic_hints?: Array<Partial<CanvasHint> | Record<string, unknown>>;
  proposals?: CaptureProposal[];
  capture?: string;
  review?: string;
  summary?: string;
  message?: string;
  applied?: boolean;
  items?: {kind: string; target: string}[];
  extraction_provider?: string;
};

type CanvasApiClient = typeof api & {
  canvasAnalyze?: (
    projectId: string,
    body: {text: string; project_id?: string; source?: string; mode?: SortMode},
  ) => Promise<CanvasApiResult>;
  canvasAutosort?: (
    projectId: string,
    body: {text: string; project_id?: string; mode: SortMode; artifacts?: CanvasArtifact[]; canvas?: StoryCanvasData},
  ) => Promise<CanvasApiResult>;
  canvasCapture?: (
    projectId: string,
    body:
      | {text: string; project_id?: string; mode: SortMode; selected_ids?: string[]; notes?: string; artifacts?: CanvasArtifact[]}
      | {proposals: CaptureProposal[]; apply: boolean},
  ) => Promise<CanvasApiResult>;
  getCanvas?: (projectId: string) => Promise<StoryCanvasData>;
  putCanvas?: (projectId: string, canvas: StoryCanvasData) => Promise<StoryCanvasData>;
};

type CaptureEntry = {
  id: string;
  title: string;
  detail: string;
  at: string;
};

type AppliedOrderItem = {
  kind: string;
  target: string;
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

function artifactFromNode(node: CanvasNode, fallbackIndex: number): CanvasArtifact {
  const meta = node.metadata ?? {};
  const semanticType = typeof meta.semantic_type === 'string' ? meta.semantic_type : node.type;
  const content = node.text ?? '';
  const uiKind: ArtifactKind =
    semanticType === 'Mystery' || semanticType === 'Question'
      ? 'question'
      : ['Theme', 'Premise', 'AntiPremise', 'Stance', 'Rule', 'Worldbuilding', 'Motif'].includes(semanticType)
        ? 'thread'
        : ['Message', 'Reveal'].includes(semanticType)
          ? 'beat'
          : semanticType === 'Artifact'
            ? 'note'
            : 'scene';
  return {
    id: node.id,
    title: node.label ?? `Card ${fallbackIndex + 1}`,
    content,
    excerpt: excerptFromBlock(content),
    kind: uiKind,
    score: Math.round(Number(meta.confidence ?? 0.65) * 100),
    tags: Array.isArray(meta.tags) ? meta.tags.map(String).slice(0, 4) : [semanticType],
    order: fallbackIndex,
    status: semanticType === 'Mystery' ? 'review' : 'draft',
  };
}

function canvasArtifacts(canvas: StoryCanvasData | null) {
  return (canvas?.nodes ?? [])
    .filter((node) => (node.metadata?.semantic_type ?? node.type) !== 'Artifact')
    .map((node, index) => artifactFromNode(node, index));
}

function selectedCardInsights(artifact: CanvasArtifact | null) {
  if (!artifact) {
    return {
      role: 'Nothing selected',
      notes: ['Select a block to see extracted story notes.'],
      suggestions: ['Read Chaos', 'Create Sticky'],
    };
  }
  const text = `${artifact.title}\n${artifact.content}`;
  const role =
    artifact.tags.find((tag) => ['Theme', 'Premise', 'Mystery', 'AntiPremise', 'Stance'].includes(tag)) ??
    (artifact.kind === 'question' ? 'Mystery / Open question' : artifact.kind === 'thread' ? 'Story concept' : 'Canvas note');
  const notes = _clientStoryNotes(text);
  const suggestions =
    artifact.kind === 'question'
      ? ['Add to Open Questions', 'Link to Time Logic', 'Find contradiction']
      : artifact.tags.includes('Theme')
        ? ['Add to Story Bible -> Themes', 'Link to Motifs', 'Use as writing constraint']
        : artifact.tags.includes('Premise')
          ? ['Add to Story Bible -> Core Premise', 'Suggest related cards', 'Connect to central mystery']
          : ['Add to Story Bible', 'Suggest links', 'Keep on canvas'];
  return {role, notes, suggestions};
}

function _clientStoryNotes(text: string) {
  const sentences = text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[。！？.!?])\s*|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 6 && !line.endsWith('：'))
    .slice(0, 5);
  return sentences.length > 0 ? sentences : [excerptFromBlock(text)];
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

function buildDraftAnalysis(text: string): CanvasAnalysis {
  const hasText = text.trim().length > 0;
  return {
    summary: hasText ? 'Paste loaded. Press Read Chaos to extract movable story cards.' : 'No artifacts yet. Paste story material to begin.',
    artifacts: [],
    hints: [],
    capture: hasText ? 'Read Chaos will keep the raw paste as a source block, then extract candidate cards around it.' : undefined,
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

function proposalKindLabel(kind: string) {
  if (kind === 'timeline_event') return 'Timeline';
  if (kind === 'wiki') return 'Story Bible';
  if (kind === 'chapter') return 'Manuscript';
  return kind.replace(/_/g, ' ');
}

function proposalPreview(content: string) {
  const compact = normalizeWhitespace(content.replace(/^#+\s+/gm, '').replace(/_Source canvas node:[^_]+_/g, ''));
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact;
}

export default function StoryCanvas({onNavigate}: NavigationProps) {
  const activeProject = useProjectStore((s) => s.activeProject);

  const [artifactText, setArtifactText] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('semantic');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [captureNotes, setCaptureNotes] = useState('');
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);
  const [orderProposals, setOrderProposals] = useState<CaptureProposal[]>([]);
  const [selectedProposalIds, setSelectedProposalIds] = useState<Set<string>>(() => new Set());
  const [lastAppliedItems, setLastAppliedItems] = useState<AppliedOrderItem[]>([]);
  const [canvas, setCanvas] = useState<StoryCanvasData | null>(null);
  const [viewport, setViewport] = useState({x: 0, y: 0, scale: 1});
  const [contextMenu, setContextMenu] = useState<{nodeId: string; x: number; y: number} | null>(null);
  const [lastReadText, setLastReadText] = useState('');
  const [analysisStatus, setAnalysisStatus] = useState('Local parse ready.');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAutosorting, setIsAutosorting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isApplyingOrder, setIsApplyingOrder] = useState(false);
  const suggestedOrderRef = useRef<HTMLElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<StoryCanvasData | null>(null);
  const dragRef = useRef<
    | {kind: 'node'; id: string; dx: number; dy: number}
    | {kind: 'pan'; startX: number; startY: number; originX: number; originY: number}
    | null
  >(null);

  const storageKey = activeProject ? `liteauthor.story-canvas.${activeProject.id}` : null;

  useEffect(() => {
    canvasRef.current = canvas;
  }, [canvas]);

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
    setOrderProposals([]);
    setSelectedProposalIds(new Set());
    setLastAppliedItems([]);
    setCanvas(null);
    setContextMenu(null);
    setViewport({x: 0, y: 0, scale: 1});
    setLastReadText(savedText ?? '');
    setAnalysisStatus('Local parse ready.');
  }, [storageKey]);

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    void canvasApi
      .getCanvas?.(activeProject.id)
      .then((remoteCanvas) => {
        if (cancelled || !remoteCanvas.nodes?.length) return;
        setCanvas(remoteCanvas);
        const remoteArtifacts = canvasArtifacts(remoteCanvas);
        setAnalysis((current) => ({
          ...current,
          artifacts: remoteArtifacts.length > 0 ? remoteArtifacts : current.artifacts,
          summary: remoteArtifacts.length > 0 ? `${remoteArtifacts.length} canvas blocks loaded.` : current.summary,
        }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

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

  const [analysis, setAnalysis] = useState<CanvasAnalysis>(() => buildDraftAnalysis(''));

  useEffect(() => {
    if (canvas?.nodes?.length) return;
    setAnalysis(buildDraftAnalysis(artifactText));
    setOrderProposals([]);
    setSelectedProposalIds(new Set());
    setLastAppliedItems([]);
  }, [artifactText, canvas?.nodes?.length]);

  const artifacts = useMemo(() => sortArtifacts(analysis.artifacts, sortMode), [analysis.artifacts, sortMode]);
  const selectedNode = useMemo(() => canvas?.nodes.find((node) => node.id === selectedId) ?? null, [canvas, selectedId]);
  const selectedArtifact = useMemo(() => {
    if (selectedNode) return artifactFromNode(selectedNode, 0);
    return artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0] ?? null;
  }, [artifacts, selectedId, selectedNode]);
  const hasInput = artifactText.trim().length > 0;
  const hasUnreadInput = hasInput && artifactText !== lastReadText;

  useEffect(() => {
    if (artifacts.length === 0) {
      if (selectedId !== null && !canvas?.nodes.some((node) => node.id === selectedId)) setSelectedId(null);
      return;
    }
    const selectedExists = artifacts.some((artifact) => artifact.id === selectedId) || canvas?.nodes.some((node) => node.id === selectedId);
    if (!selectedId || !selectedExists) {
      setSelectedId(artifacts[0].id);
    }
  }, [artifacts, canvas?.nodes, selectedId]);

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

  const selectedOrderProposals = useMemo(
    () => orderProposals.filter((proposal) => selectedProposalIds.has(proposal.id)),
    [orderProposals, selectedProposalIds],
  );

  const orderProposalSummary = useMemo(() => {
    if (orderProposals.length === 0) return 'No order suggestions yet.';
    const counts = orderProposals.reduce<Record<string, number>>((acc, proposal) => {
      const label = proposalKindLabel(proposal.kind);
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([label, count]) => `${count} ${label}`)
      .join(' · ');
  }, [orderProposals]);

  const appliedOrderSummary = useMemo(() => {
    if (lastAppliedItems.length === 0) return [];
    const counts = lastAppliedItems.reduce<Record<string, number>>((acc, item) => {
      const label = proposalKindLabel(item.kind);
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([label, count]) => `${count} ${label} update${count === 1 ? '' : 's'}`);
  }, [lastAppliedItems]);

  const canReadChaos = hasInput && !isAnalyzing;
  const canReviewSuggestedOrder = orderProposals.length > 0 && !isApplyingOrder;

  const reviewSuggestedOrder = () => {
    suggestedOrderRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
  };

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
        const remoteCanvas = result.canvas;
        const remoteArtifacts = Array.isArray(result.artifacts) ? result.artifacts.map((item, index) => normalizeArtifact(item, index)) : [];
        const nodeArtifacts = remoteCanvas ? canvasArtifacts(remoteCanvas) : [];
        const remoteHints = Array.isArray(result.hints)
          ? result.hints.map((item, index) => normalizeHint(item, index))
          : Array.isArray(result.semantic_hints)
            ? result.semantic_hints.map((item, index) => normalizeHint(item, index))
            : [];
        const nextProposals = Array.isArray(result.proposals) ? result.proposals : [];
        if (remoteCanvas) {
          setCanvas(remoteCanvas);
          setLastReadText(artifactText);
          window.requestAnimationFrame(() => fitToContent(remoteCanvas.nodes));
        }
        setAnalysis({
          summary: result.summary ?? result.message ?? localAnalysis.summary,
          artifacts: nodeArtifacts.length > 0 ? nodeArtifacts : remoteArtifacts.length > 0 ? remoteArtifacts : localAnalysis.artifacts,
          hints: remoteHints.length > 0 ? remoteHints : localAnalysis.hints,
          capture: result.capture ?? result.review ?? localAnalysis.capture,
        });
        setOrderProposals(nextProposals);
        setSelectedProposalIds(new Set(nextProposals.map((proposal) => proposal.id)));
        setLastAppliedItems([]);
        const provider = result.extraction_provider ?? String(remoteCanvas?.metadata?.extraction_provider ?? 'unknown');
        setAnalysisStatus(
          nextProposals.length > 0
            ? `Suggested ${nextProposals.length} order update(s). Extractor: ${provider}.`
            : `Canvas analysis updated. Extractor: ${provider}.`,
        );
        return;
      }

      setAnalysis(localAnalysis);
      setCanvas(null);
      setOrderProposals([]);
      setSelectedProposalIds(new Set());
      setLastAppliedItems([]);
      setAnalysisStatus('Local analysis refreshed.');
    } catch {
      setAnalysis(localAnalysis);
      setOrderProposals([]);
      setSelectedProposalIds(new Set());
      setLastAppliedItems([]);
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
        canvas: canvas ?? undefined,
        artifacts,
      });
      if (result) {
        if (result.canvas) {
          setCanvas(result.canvas);
          window.requestAnimationFrame(() => fitToContent(result.canvas?.nodes ?? []));
          const nodeArtifacts = canvasArtifacts(result.canvas);
          setAnalysis((current) => ({
            ...current,
            summary: result.summary ?? result.message ?? current.summary,
            artifacts: nodeArtifacts.length > 0 ? nodeArtifacts : current.artifacts,
          }));
          setAnalysisStatus(`Autosort ready for ${mode}.`);
          return;
        }
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
    setAnalysisStatus('Saving board note...');
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
      setAnalysisStatus('Board note saved to the log.');
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
      setAnalysisStatus('Board note saved locally.');
    } finally {
      setIsCapturing(false);
    }
  };

  const applyOrderProposals = async () => {
    if (!activeProject) return;
    if (orderProposals.length === 0) {
      await syncAnalysis();
      return;
    }
    if (selectedOrderProposals.length === 0) {
      setAnalysisStatus('Choose at least one suggested order update.');
      return;
    }

    setIsApplyingOrder(true);
    setAnalysisStatus('Applying selected story updates...');
    try {
      const result = await canvasApi.canvasCapture?.(activeProject.id, {
        proposals: selectedOrderProposals,
        apply: true,
      });
      const appliedItems = result?.items?.length
        ? result.items
        : selectedOrderProposals.map((proposal) => ({kind: proposal.kind, target: proposal.target}));
      const appliedCount = appliedItems.length;
      setOrderProposals((current) => current.filter((proposal) => !selectedProposalIds.has(proposal.id)));
      setSelectedProposalIds(new Set());
      setLastAppliedItems(appliedItems);
      setAnalysis((current) => ({
        ...current,
        capture: `${appliedCount} order update${appliedCount === 1 ? '' : 's'} applied to the project.`,
      }));
      setAnalysisStatus(`Applied ${appliedCount} story update${appliedCount === 1 ? '' : 's'}.`);
    } catch {
      setAnalysisStatus('Could not apply order updates.');
    } finally {
      setIsApplyingOrder(false);
    }
  };

  const pasteClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim()) {
        setArtifactText(clip);
        setCanvas(null);
        setLastReadText('');
        setOrderProposals([]);
        setSelectedProposalIds(new Set());
        setLastAppliedItems([]);
        setAnalysisStatus('Clipboard text loaded into the canvas.');
      }
    } catch {
      setAnalysisStatus('Clipboard access was blocked by the browser.');
    }
  };

  const persistCanvas = (nextCanvas: StoryCanvasData) => {
    if (!activeProject) return;
    void canvasApi.putCanvas?.(activeProject.id, nextCanvas).catch(() => undefined);
  };

  const fitToContent = (nodes = canvas?.nodes ?? []) => {
    const board = boardRef.current;
    if (!board || nodes.length === 0) return;
    const padding = 120;
    const minX = Math.min(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxX = Math.max(...nodes.map((node) => node.x + (node.width || 300)));
    const maxY = Math.max(...nodes.map((node) => node.y + (node.height || 180)));
    const contentWidth = Math.max(1, maxX - minX + padding * 2);
    const contentHeight = Math.max(1, maxY - minY + padding * 2);
    const scale = Math.max(0.55, Math.min(1.2, Math.min(board.clientWidth / contentWidth, board.clientHeight / contentHeight)));
    setViewport({
      scale,
      x: Math.round((board.clientWidth - (maxX + minX) * scale) / 2),
      y: Math.round((board.clientHeight - (maxY + minY) * scale) / 2),
    });
  };

  const deleteNode = (nodeId: string) => {
    if (!canvas) return;
    const next = {
      ...canvas,
      nodes: canvas.nodes.filter((node) => node.id !== nodeId),
      edges: canvas.edges.filter((edge) => edge.fromNode !== nodeId && edge.toNode !== nodeId),
    };
    setCanvas(next);
    setSelectedId(null);
    setContextMenu(null);
    setAnalysis((current) => ({
      ...current,
      artifacts: canvasArtifacts(next),
      summary: `${next.nodes.length} canvas block(s).`,
    }));
    persistCanvas(next);
  };

  const deleteSelectedNode = () => {
    if (!selectedId) return;
    deleteNode(selectedId);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isEditing || !selectedId || !canvas) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedNode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canvas, selectedId]);

  const updateCanvasNode = (nodeId: string, patch: Partial<CanvasNode>, persist = false) => {
    setCanvas((current) => {
      if (!current) return current;
      const next = {
        ...current,
        nodes: current.nodes.map((node) => (node.id === nodeId ? {...node, ...patch, metadata: patch.metadata ?? node.metadata} : node)),
      };
      if (persist) persistCanvas(next);
      setAnalysis((analysisCurrent) => ({...analysisCurrent, artifacts: canvasArtifacts(next)}));
      return next;
    });
  };

  const startNodeDrag = (event: PointerEvent, node: CanvasNode) => {
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {kind: 'pan', startX: event.clientX, startY: event.clientY, originX: viewport.x, originY: viewport.y};
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(node.id);
    const boardX = (event.clientX - viewport.x) / viewport.scale;
    const boardY = (event.clientY - viewport.y) / viewport.scale;
    dragRef.current = {kind: 'node', id: node.id, dx: boardX - node.x, dy: boardY - node.y};
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePointer = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === 'pan') {
      setViewport((current) => ({
        ...current,
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      }));
      return;
    }
    const x = (event.clientX - viewport.x) / viewport.scale - drag.dx;
    const y = (event.clientY - viewport.y) / viewport.scale - drag.dy;
    updateCanvasNode(drag.id, {x: Math.round(x), y: Math.round(y)});
  };

  const endPointer = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === 'node' && canvasRef.current) persistCanvas(canvasRef.current);
  };

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    setContextMenu(null);
    const target = event.target as HTMLElement;
    if (event.button !== 1 && (target.closest('[data-canvas-node="true"]') || target.closest('[data-canvas-control="true"]'))) return;
    dragRef.current = {kind: 'pan', startX: event.clientX, startY: event.clientY, originX: viewport.x, originY: viewport.y};
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const nextScale = Math.max(0.55, Math.min(1.8, Number((viewport.scale - event.deltaY * 0.001).toFixed(2))));
      setViewport((current) => ({...current, scale: nextScale}));
      return;
    }
    event.preventDefault();
    setViewport((current) => ({
      ...current,
      x: current.x - (event.shiftKey ? event.deltaY : event.deltaX),
      y: current.y - (event.shiftKey ? 0 : event.deltaY),
    }));
  };

  const createSticky = () => {
    const id = `node-${Date.now()}`;
    const node: CanvasNode = {
      id,
      type: 'sticky',
      x: Math.round((220 - viewport.x) / viewport.scale),
      y: Math.round((180 - viewport.y) / viewport.scale),
      width: 280,
      height: 170,
      label: 'New sticky',
      text: 'Write a story fragment here.',
      color: '#f8df9f',
      metadata: {semantic_type: 'Note', tags: ['Note'], confidence: 0.6},
    };
    const next = canvas
      ? {...canvas, nodes: [...canvas.nodes, node]}
      : {version: 'liteauthor.story-canvas.v1', nodes: [node], edges: [], metadata: {source: 'local-sticky'}};
    setCanvas(next);
    setAnalysis((current) => ({...current, artifacts: canvasArtifacts(next), summary: `${next.nodes.length} canvas block(s).`}));
    setSelectedId(id);
    persistCanvas(next);
  };

  const editSelectedCard = () => {
    if (!selectedId || !canvas) return;
    const node = canvas.nodes.find((item) => item.id === selectedId);
    if (!node) return;
    const nextText = window.prompt('Edit card text', node.text ?? '');
    if (nextText === null) return;
    updateCanvasNode(selectedId, {text: nextText}, true);
  };

  const duplicateNode = (nodeId: string) => {
    if (!canvas) return;
    const node = canvas.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const nextNode = {
      ...node,
      id: `node-${Date.now()}`,
      x: node.x + 36,
      y: node.y + 36,
      label: `${node.label ?? 'Card'} copy`,
    };
    const next = {...canvas, nodes: [...canvas.nodes, nextNode]};
    setCanvas(next);
    setSelectedId(nextNode.id);
    setContextMenu(null);
    setAnalysis((current) => ({...current, artifacts: canvasArtifacts(next), summary: `${next.nodes.length} canvas block(s).`}));
    persistCanvas(next);
  };

  const selectedInsights = selectedCardInsights(selectedArtifact);

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
            The Codex
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
              The Codex
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-2 text-[10px] font-sans uppercase tracking-widest text-parchment hover:bg-amber-wax disabled:cursor-not-allowed disabled:opacity-50"
              onClick={reviewSuggestedOrder}
              disabled={!canReviewSuggestedOrder}
            >
              <CheckCircle2 className="w-4 h-4" />
              {orderProposals.length > 0 ? 'Review Suggested Order' : 'Distill into Order'}
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
                  <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted">Input</p>
                  <h2 className="mt-1 text-lg font-serif italic text-primary">Paste or drop notes</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-sm border border-oak-variant bg-sepia-low px-3 py-2 text-[10px] font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                    onClick={() => void pasteClipboard()}
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    Paste
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[10px] font-sans uppercase tracking-widest ${
                      hasUnreadInput || !canvas?.nodes?.length
                        ? 'border-primary bg-primary text-parchment hover:bg-amber-wax'
                        : 'border-oak-variant bg-sepia-low text-ink-muted hover:border-primary hover:text-primary'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    onClick={() => void syncAnalysis()}
                    disabled={!canReadChaos}
                  >
                    <ScanSearch className="w-4 h-4" />
                    {isAnalyzing ? 'Reading' : canvas?.nodes?.length && !hasUnreadInput ? 'Re-read' : 'Read Chaos'}
                  </button>
                </div>
              </div>

              <textarea
                className="min-h-[280px] w-full resize-y rounded-sm border border-oak-variant bg-parchment px-3 py-3 text-sm leading-relaxed outline-none placeholder:text-ink-muted/70 focus:border-primary"
                placeholder="Feed the board with messy notes, fragments, outlines, or scenes."
                value={artifactText}
                onChange={(e) => {
                  setArtifactText(e.target.value);
                  setCanvas(null);
                  setLastReadText('');
                  setOrderProposals([]);
                  setSelectedProposalIds(new Set());
                  setLastAppliedItems([]);
                }}
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
                    setCanvas(null);
                    setLastReadText('');
                    setOrderProposals([]);
                    setSelectedProposalIds(new Set());
                    setLastAppliedItems([]);
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
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Read status</h3>
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
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-primary">{orderProposalSummary}</p>
              <p className="mt-2 text-[11px] text-ink-muted">{analysisStatus}</p>
            </section>

            <section className="mt-auto rounded-sm border border-oak-variant bg-parchment-bright p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-oak" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Note</h3>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-ink-muted">Private</span>
              </div>
              <textarea
                className="mt-3 min-h-[120px] w-full resize-y rounded-sm border border-oak-variant bg-parchment px-3 py-3 text-sm leading-relaxed outline-none placeholder:text-ink-muted/70 focus:border-primary"
                placeholder="Write a private review note before you apply story updates."
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
                <p className="text-[10px] font-sans uppercase tracking-[0.28em] text-ink-muted">Board</p>
                <p className="mt-1 text-sm text-ink-muted">{analysis.capture ?? 'Paste messy material, read the chaos, then review what belongs in canon, timeline, or manuscript.'}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-oak-variant bg-sepia-low px-3 py-1.5 text-[10px] font-sans uppercase tracking-widest text-ink-muted">
                <TriangleAlert className="w-3.5 h-3.5" />
                {artifacts.some((artifact) => artifact.kind === 'question') ? 'Questions need review' : 'No urgent gaps detected'}
              </div>
            </div>
          </div>

          <div
            ref={boardRef}
            className="relative min-h-[calc(100vh-208px)] cursor-grab overflow-hidden p-5 md:p-8"
            onPointerDown={startPan}
            onPointerMove={movePointer}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onWheel={handleWheel}
          >
            <div data-canvas-control="true" className="absolute right-5 top-5 z-30 flex flex-wrap items-center gap-2 rounded-sm border border-oak-variant bg-parchment-bright/95 p-2 shadow-sm">
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-sm border border-oak-variant px-2.5 text-[10px] font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                onClick={() => setViewport((current) => ({...current, scale: Math.max(0.55, Number((current.scale - 0.1).toFixed(2)))}))}
                title="Zoom out"
              >
                <Minus className="h-4 w-4" />
                Zoom
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-sm border border-oak-variant px-2.5 text-[10px] font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                onClick={() => setViewport((current) => ({...current, scale: Math.min(1.8, Number((current.scale + 0.1).toFixed(2)))}))}
                title="Zoom in"
              >
                <Plus className="h-4 w-4" />
                Zoom
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-sm border border-oak-variant px-2.5 text-[10px] font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                onClick={() => fitToContent()}
                title="Fit to content"
              >
                <Maximize2 className="h-4 w-4" />
                Fit
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-sm border border-oak-variant px-2.5 text-[10px] font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                onClick={() => setViewport({x: 0, y: 0, scale: 1})}
                title="Reset view"
              >
                <Home className="h-4 w-4" />
                Reset
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-sm border border-oak-variant px-2.5 text-[10px] font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                title="Drag empty board or middle mouse to pan"
              >
                <Move className="h-4 w-4" />
                Pan
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-sm border border-primary bg-primary px-2.5 text-[10px] font-sans uppercase tracking-widest text-parchment hover:bg-amber-wax"
                onClick={createSticky}
                title="New card"
              >
                <StickyNote className="h-4 w-4" />
                New Card
              </button>
            </div>
            {!canvas?.nodes?.length && analysis.hints.length > 0 ? (
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
            ) : null}

            {artifacts.length === 0 ? (
              <div className="relative z-10 flex min-h-[60vh] items-center justify-center rounded-sm border border-dashed border-oak-variant bg-parchment-bright/60 p-8 text-center">
                <div className="max-w-lg">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-oak-variant bg-sepia-low">
                    <ScanSearch className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="mt-4 text-2xl font-serif italic text-primary">Paste messy story material</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    Drop notes, fragments, outlines, or scenes here. LiteAuthor will split them into cards and suggest what belongs in your
                    canon, timeline, or manuscript.
                  </p>
                </div>
              </div>
            ) : canvas?.nodes?.length ? (
              <div
                className="absolute left-0 top-0 z-10 h-[1400px] w-[2200px] origin-top-left"
                style={{transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`}}
              >
                <div
                  className="absolute inset-0 opacity-50"
                  style={{
                    backgroundImage: 'radial-gradient(circle, rgba(80, 61, 44, 0.18) 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                  }}
                />
                <svg className="pointer-events-none absolute inset-0 h-full w-full">
                  {canvas.edges.map((edge) => {
                    const from = canvas.nodes.find((node) => node.id === edge.fromNode);
                    const to = canvas.nodes.find((node) => node.id === edge.toNode);
                    if (!from || !to) return null;
                    const x1 = from.x + from.width;
                    const y1 = from.y + from.height / 2;
                    const x2 = to.x;
                    const y2 = to.y + to.height / 2;
                    const mid = Math.max(40, Math.abs(x2 - x1) / 2);
                    return (
                      <g key={edge.id}>
                        <path
                          d={`M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke="rgba(117, 92, 63, 0.48)"
                          strokeWidth="2"
                        />
                        {edge.label ? (
                          <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} className="fill-ink-muted text-[11px] uppercase tracking-widest">
                            {edge.label}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </svg>
                {canvas.nodes.map((node, index) => {
                  const semanticType = String(node.metadata?.semantic_type ?? node.type);
                  const selected = node.id === selectedId;
                  const artifact = artifactFromNode(node, index);
                  return (
                    <article
                      key={node.id}
                      data-canvas-node="true"
                      className={`absolute cursor-move rounded-sm border p-4 text-left shadow-sm transition-shadow ${
                        selected ? 'border-primary bg-parchment-bright shadow-md' : 'border-oak-variant bg-parchment-bright/95 hover:border-primary/45'
                      }`}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: node.width,
                        minHeight: node.height,
                        borderTopColor: node.color ?? undefined,
                        borderTopWidth: 5,
                      }}
                      onPointerDown={(event) => startNodeDrag(event, node)}
                      onClick={() => setSelectedId(node.id)}
                      onDoubleClick={editSelectedCard}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setSelectedId(node.id);
                        setContextMenu({nodeId: node.id, x: event.clientX, y: event.clientY});
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-sans uppercase tracking-widest ${kindClasses(artifact.kind)}`}>
                          {semanticType === 'Artifact' ? 'Source' : semanticType}
                        </div>
                        {semanticType !== 'Artifact' ? <Link2 className="mt-1 h-3.5 w-3.5 text-ink-muted" /> : null}
                      </div>
                      <h3 className="mt-3 text-lg font-serif font-semibold leading-tight text-ink">{node.label}</h3>
                      <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{node.text}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {artifact.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full border border-oak-variant bg-sepia-low px-2 py-0.5 text-[10px] uppercase tracking-widest text-ink-muted">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
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

            {contextMenu ? (
              <div
                data-canvas-control="true"
                className="fixed z-50 w-44 rounded-sm border border-oak-variant bg-parchment-bright p-1 shadow-lg"
                style={{left: contextMenu.x, top: contextMenu.y}}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs text-ink-muted hover:bg-sepia-low hover:text-primary"
                  onClick={editSelectedCard}
                >
                  <Move className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs text-ink-muted hover:bg-sepia-low hover:text-primary"
                  onClick={() => duplicateNode(contextMenu.nodeId)}
                >
                  <StickyNote className="h-4 w-4" />
                  Duplicate
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-500/10"
                  onClick={() => deleteNode(contextMenu.nodeId)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            ) : null}
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
                  {canvas?.nodes?.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-sm border border-oak-variant bg-sepia-low px-3 py-2 text-[10px] font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                        onClick={editSelectedCard}
                      >
                        <Move className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-sm border border-red-500/45 bg-red-50 px-3 py-2 text-[10px] font-sans font-bold uppercase tracking-widest text-red-700 hover:border-red-600 hover:bg-red-100"
                        onClick={deleteSelectedNode}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  ) : null}
                  <p className="text-sm leading-relaxed text-ink-muted">{selectedArtifact.excerpt}</p>
                  <div className="rounded-sm border border-oak-variant bg-sepia-low p-3">
                    <div className="text-[10px] uppercase tracking-widest text-ink-muted">Detected role</div>
                    <div className="mt-1 text-sm font-semibold text-primary">{selectedInsights.role}</div>
                  </div>
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
                  <div className="rounded-sm border border-oak-variant bg-sepia-low p-3">
                    <div className="text-[10px] uppercase tracking-widest text-ink-muted">Extracted notes</div>
                    <ul className="mt-2 space-y-2 text-sm leading-relaxed text-ink-muted">
                      {selectedInsights.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-sm border border-oak-variant bg-sepia-low p-3">
                    <div className="text-[10px] uppercase tracking-widest text-ink-muted">Suggested Order</div>
                    <div className="mt-2 space-y-2">
                      {selectedInsights.suggestions.map((suggestion) => (
                        <label key={suggestion} className="flex items-center gap-2 text-sm text-ink-muted">
                          <input type="checkbox" className="h-4 w-4 accent-primary" defaultChecked={suggestion !== 'Find contradiction'} />
                          <span>{suggestion}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-ink-muted">Select a card to inspect its signal, tags, and review status.</p>
              )}
            </section>

            <section ref={suggestedOrderRef} className="rounded-sm border border-oak-variant bg-parchment-bright p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted">Suggested Order</p>
                  <h3 className="mt-1 text-lg font-serif italic text-primary">
                    {orderProposals.length > 0
                      ? `${orderProposals.length} suggestion${orderProposals.length === 1 ? '' : 's'} found`
                      : lastAppliedItems.length > 0
                        ? 'Order updated'
                        : hasInput
                          ? 'Ready to read'
                          : 'No suggestions yet'}
                  </h3>
                </div>
                <Sparkles className="h-4 w-4 text-primary" />
              </div>

              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {orderProposals.length > 0
                  ? 'Review what should become canon, timeline, or manuscript structure before applying it.'
                  : lastAppliedItems.length > 0
                    ? 'Added selected updates to the story memory. You can keep shaping the board or move into the updated workspaces.'
                    : 'Read Chaos to surface canon, timeline, and manuscript suggestions from the board.'}
              </p>

              {orderProposals.length > 0 ? (
                <>
                  <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {orderProposals.map((proposal) => {
                      const selected = selectedProposalIds.has(proposal.id);
                      return (
                        <label
                          key={proposal.id}
                          className={`block cursor-pointer rounded-sm border p-3 transition-colors ${
                            selected ? 'border-primary/45 bg-sepia-highest' : 'border-oak-variant bg-sepia-low hover:border-primary/40'
                          }`}
                        >
                          <span className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-primary"
                              checked={selected}
                              onChange={(event) => {
                                setSelectedProposalIds((current) => {
                                  const next = new Set(current);
                                  if (event.target.checked) next.add(proposal.id);
                                  else next.delete(proposal.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="min-w-0">
                              <span className="block font-sans text-[10px] font-bold uppercase tracking-widest text-primary">
                                {proposalKindLabel(proposal.kind)}
                              </span>
                              <span className="mt-1 block text-sm font-semibold leading-snug text-ink">{proposal.title}</span>
                              <span className="mt-1 block break-all font-mono text-[10px] text-ink-muted">{proposal.target}</span>
                              <span className="mt-2 line-clamp-3 block text-xs leading-relaxed text-ink-muted">{proposalPreview(proposal.content)}</span>
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-sm border border-oak-variant px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                      onClick={() => setSelectedProposalIds(new Set(orderProposals.map((proposal) => proposal.id)))}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-sm border border-oak-variant px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                      onClick={() => setSelectedProposalIds(new Set())}
                    >
                      None
                    </button>
                  </div>
                </>
              ) : null}

              {orderProposals.length === 0 && lastAppliedItems.length > 0 ? (
                <div className="mt-4 rounded-sm border border-oak-variant bg-sepia-low p-3">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Added</p>
                  <ul className="mt-2 space-y-1 text-sm text-ink-muted">
                    {appliedOrderSummary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      className="rounded-sm border border-oak-variant px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-primary hover:border-primary"
                      onClick={() => onNavigate('TimelineView', 'push')}
                    >
                      Open Timeline
                    </button>
                    <button
                      type="button"
                      className="rounded-sm border border-oak-variant px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-primary hover:border-primary"
                      onClick={() => onNavigate('StoryBible', 'push')}
                    >
                      Open Story Bible
                    </button>
                    <button
                      type="button"
                      className="rounded-sm bg-primary px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-parchment hover:bg-amber-wax"
                      onClick={() => onNavigate('ZenEditor', 'push')}
                    >
                      Continue Writing
                    </button>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-xs font-sans uppercase tracking-widest text-parchment hover:bg-amber-wax disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void (orderProposals.length > 0 ? applyOrderProposals() : syncAnalysis())}
                disabled={isAnalyzing || isApplyingOrder || (!hasInput && orderProposals.length === 0) || (orderProposals.length > 0 && selectedOrderProposals.length === 0)}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isApplyingOrder ? 'Applying' : orderProposals.length > 0 ? `Apply ${selectedOrderProposals.length} update${selectedOrderProposals.length === 1 ? '' : 's'}` : 'Read Chaos'}
              </button>
            </section>

            <section className="rounded-sm border border-oak-variant bg-parchment-bright p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Save board note</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Preserve the board state, selected card, and private note without applying canon or timeline updates.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-sm border border-oak-variant bg-sepia-low px-4 py-2.5 text-xs font-sans uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void captureReview()}
                disabled={isCapturing}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isCapturing ? 'Saving' : 'Save board note'}
              </button>
            </section>

            <section className="flex-1 rounded-sm border border-oak-variant bg-parchment-bright p-4">
              <div className="flex items-center gap-2">
                <TriangleAlert className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Apply log</h3>
              </div>
              <div className="mt-4 space-y-3">
                {lastAppliedItems.length > 0 ? (
                  <article className="rounded-sm border border-primary/35 bg-sepia-highest p-3">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-sm font-semibold text-primary">Latest story update</h4>
                      <span className="text-[10px] uppercase tracking-widest text-ink-muted">Applied</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-ink-muted">
                      {appliedOrderSummary.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </article>
                ) : null}
                {captures.length === 0 && lastAppliedItems.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-oak-variant bg-sepia-low p-4 text-sm text-ink-muted">
                    No applied updates or board notes yet.
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
