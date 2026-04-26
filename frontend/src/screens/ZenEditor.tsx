import {useCallback, useEffect, useRef, useState} from 'react';
import {
  BookOpen,
  Map as MapIcon,
  Package,
  Brain,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Pencil,
  Settings,
  Edit3,
  Save,
  Layers,
  ScrollText,
  Trash2,
  UserCheck,
  Waypoints,
  Zap,
} from 'lucide-react';
import {NavigationProps} from '../types';
import {AppScaffold} from '../components/AppScaffold';
import {useProjectStore} from '../stores/projectStore';
import {ManuscriptEditor, type AutocompleteContext, type ManuscriptEditorHandle} from '../components/ManuscriptEditor';
import {SelectionToolbar, type Action} from '../components/SelectionToolbar';
import {ContextInspector} from '../components/ContextInspector';
import {SuggestionPanel, type SuggestionAlternative} from '../components/SuggestionPanel';
import {api} from '../lib/api';

export default function ZenEditor({onNavigate}: NavigationProps) {
  const editorRef = useRef<ManuscriptEditorHandle>(null);
  const activeProject = useProjectStore((s) => s.activeProject);
  const outline = useProjectStore((s) => s.outline);
  const activeSceneId = useProjectStore((s) => s.activeSceneId);
  const setActiveScene = useProjectStore((s) => s.setActiveScene);
  const setWordCount = useProjectStore((s) => s.setWordCount);
  const wordCount = useProjectStore((s) => s.wordCount);
  const refreshOutline = useProjectStore((s) => s.refreshOutline);

  const [savedPulse, setSavedPulse] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [proposal, setProposal] = useState<{
    original: string;
    proposed: string;
    explanation?: string;
    task?: string;
    instruction?: string;
    contextPacket?: string;
    contextTokens?: number;
  } | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [lastSelection, setLastSelection] = useState({from: 0, to: 0, text: ''});
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [styleChoice, setStyleChoice] = useState('clearer');
  const [customInstruction, setCustomInstruction] = useState('');
  const [toolsOpen, setToolsOpen] = useState(() => localStorage.getItem('liteauthor.editor.toolsOpen') === 'true');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [zenFocus, setZenFocus] = useState(() => localStorage.getItem('liteauthor.editor.zenFocus') === 'true');
  const [memoryTerms, setMemoryTerms] = useState<string[]>([]);
  const [entityCard, setEntityCard] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{
    kind: 'chapter' | 'scene';
    id: string;
    value: string;
  } | null>(null);
  const skipNextRenameBlur = useRef(false);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const autocompleteAbort = useRef<AbortController | null>(null);
  const autocompleteRequestId = useRef(0);

  const flushBeforeNav = useCallback(async () => {
    try {
      await editorRef.current?.flushSave();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('liteauthor.editor.toolsOpen', String(toolsOpen));
  }, [toolsOpen]);

  useEffect(() => {
    localStorage.setItem('liteauthor.editor.zenFocus', String(zenFocus));
  }, [zenFocus]);

  useEffect(() => {
    if (zenFocus) setToolsOpen(false);
  }, [zenFocus]);

  useEffect(() => {
    if (!activeProject) {
      setMemoryTerms([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const tree = await api.wikiTree(activeProject.id);
        if (cancelled) return;
        const terms = tree
          .filter((e) => /\/(characters|locations)\/[^/]+\.md$/i.test(e.path))
          .map((e) => e.path.replace(/.*\//, '').replace(/\.md$/, ''))
          .map((s) => s.replace(/[-_]+/g, ' ').trim());
        setMemoryTerms([...new Set(terms)].filter((s) => s.length >= 2).slice(0, 50));
      } catch {
        if (!cancelled) setMemoryTerms([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id]);

  useEffect(() => {
    if (!zenFocus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZenFocus(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zenFocus]);

  if (!activeProject || !activeSceneId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-parchment text-ink px-8 text-center gap-4">
        <p className="font-serif text-xl italic text-ink-muted">Open or create a project to edit the manuscript.</p>
        <button
          type="button"
          className="font-sans text-xs uppercase tracking-widest px-6 py-3 bg-primary text-parchment rounded-sm"
          onClick={() => onNavigate('LibraryHome', 'push_back')}
        >
          Back to Library
        </button>
      </div>
    );
  }

  const scenesByChapter = new Map<string, NonNullable<typeof outline>['scenes']>();
  if (outline) {
    for (const sc of outline.scenes) {
      const arr = scenesByChapter.get(sc.chapter_id) ?? [];
      arr.push(sc);
      scenesByChapter.set(sc.chapter_id, arr);
    }
  }

  const styleInstruction = () => {
    if (pendingAction === 'custom' || styleChoice === 'custom') return customInstruction.trim() || 'Follow the custom writing direction.';
    switch (styleChoice) {
      case 'literary':
        return 'Style: more literary, with richer rhythm and imagery.';
      case 'concise':
        return 'Style: more concise, preserving meaning with fewer words.';
      case 'formal':
        return 'Style: more formal, polished, and controlled.';
      case 'tense':
        return 'Style: higher tension through sharper rhythm, detail, and subtext.';
      default:
        return 'Style: clearer, preserving voice and meaning.';
    }
  };

  const instructionFor = (action: Action, selection: string, style = styleInstruction()): {task: string; instruction: string; role: string} => {
    const base = `Selection:\n${selection || '(cursor position)'}`;
    switch (action) {
      case 'rephrase':
        return {task: 'Rephrase selected text', instruction: `${base}\nRewrite the selected text. Keep the original meaning. ${style}`, role: 'literary_editor'};
      case 'expand':
        return {task: 'Expand selected text', instruction: `${base}\nExpand the selected text with concrete detail while preserving meaning and voice.`, role: 'literary_editor'};
      case 'shorten':
        return {task: 'Shorten selected text', instruction: `${base}\nShorten the selected text. Preserve the core meaning, cadence, and story facts.`, role: 'literary_editor'};
      case 'tone':
        return {task: 'Change tone', instruction: `${base}\nRewrite the selected text with this direction: ${style}`, role: 'literary_editor'};
      case 'continue':
        return {task: 'Continue scene', instruction: `${base}\nContinue for 2–4 sentences in the same voice.`, role: 'literary_editor'};
      case 'custom':
        return {task: 'Custom transform', instruction: `${base}\n${customInstruction.trim() || 'Transform the selected text while preserving story continuity.'}`, role: 'literary_editor'};
      default:
        return {task: 'Assist', instruction: base, role: 'literary_editor'};
    }
  };

  const runStorycraft = async (action: Action) => {
    if (
      action !== 'story_tension' &&
      action !== 'story_dialogue' &&
      action !== 'story_ending' &&
      action !== 'story_intent' &&
      action !== 'story_opening' &&
      action !== 'story_pacing' &&
      action !== 'story_character' &&
      action !== 'story_payoff' &&
      action !== 'story_lore' &&
      action !== 'story_addiction' &&
      action !== 'story_cont_check' &&
      action !== 'story_planner'
    ) {
      return;
    }
    const handle = editorRef.current;
    if (!handle || !activeProject) return;
    handle.clearGhostText();
    const sel = handle.getSelection();
    setLastSelection(sel);
    const text = sel.text.trim();
    if (text.length < 2) {
      setProposal({
        original: '',
        proposed: '',
        explanation: 'Select a sentence or paragraph before running a storycraft outcome.',
      });
      return;
    }
    const cfg = {
      story_tension: {intent: 'increase_tension', chapter_position: null as string | null},
      story_dialogue: {intent: 'sharpen_dialogue', chapter_position: null as string | null},
      story_ending: {intent: 'strengthen_chapter_ending', chapter_position: 'ending' as const},
      story_intent: {intent: 'rewrite_with_intent', chapter_position: null as string | null},
      story_opening: {intent: 'opening_doctor', chapter_position: 'opening' as const},
      story_pacing: {intent: 'pacing_analyzer', chapter_position: null as string | null},
      story_character: {intent: 'character_engine', chapter_position: null as string | null},
      story_payoff: {intent: 'payoff_tracker', chapter_position: null as string | null},
      story_lore: {intent: 'lore_compression', chapter_position: null as string | null},
      story_addiction: {intent: 'chapter_addiction', chapter_position: null as string | null},
      story_cont_check: {intent: 'character_consistency', chapter_position: null as string | null},
      story_planner: {intent: 'planning_architect', chapter_position: null as string | null},
    }[action];
    setAiBusy(true);
    setProposal(null);
    setPendingAction(null);
    try {
      const res = await api.storycraftRewrite(activeProject.id, {
        scene_id: activeSceneId,
        surface: 'inline_suggestion',
        intent: cfg.intent,
        selection: text,
        chapter_position: cfg.chapter_position,
        run_model: true,
      });
      const hint = [res.rewrite && `~${res.packet_meta.approx_tokens ?? 0} tok`].filter(Boolean).join(' ');
      setProposal({
        original: text,
        proposed: (res.rewrite || '').trim(),
        explanation: [
          res.diagnosis.length ? res.diagnosis.join(' ') : null,
          res.warnings.length ? res.warnings.join(' ') : null,
          res.rules.length ? res.rules.map((r) => r.name).join(', ') : null,
          hint,
        ]
          .filter(Boolean)
          .join(' — '),
        task: 'Storycraft outcome',
        contextPacket: undefined,
        contextTokens: res.packet_meta.approx_tokens,
      });
    } catch (e) {
      setProposal({
        original: text,
        proposed: '',
        explanation: `Model error: ${(e as Error).message}`,
      });
    } finally {
      setAiBusy(false);
    }
  };

  const runAi = async (action: Action, style?: string) => {
    const handle = editorRef.current;
    if (!handle || !activeProject) return;
    handle.clearGhostText();
    const sel = handle.getSelection();
    setLastSelection(sel);
    const text = sel.text.trim();
    if (action !== 'continue' && text.length < 2) {
      setProposal({
        original: '',
        proposed: '',
        explanation: 'Select a sentence or paragraph before running this action.',
      });
      return;
    }
    const {task, instruction, role} = instructionFor(action, text, style);
    setAiBusy(true);
    setProposal(null);
    setPendingAction(null);
    try {
      const res = await api.zenAi(activeProject.id, {
        scene_id: activeSceneId,
        task,
        selection: text,
        instruction,
        role,
      });
      setProposal({
        original: text,
        proposed: res.text.trim(),
        explanation: `Context ~${res.packet_meta.approx_tokens} tok, ${res.packet_meta.chunks_used} chunks`,
        task,
        instruction,
        contextPacket: res.context_packet?.markdown,
        contextTokens: res.context_packet?.approx_tokens ?? res.packet_meta.approx_tokens,
      });
    } catch (e) {
      setProposal({
        original: text,
        proposed: '',
        explanation: `Model error: ${(e as Error).message}`,
      });
    } finally {
      setAiBusy(false);
    }
  };

  const handleToolbarAction = (action: Action) => {
    if (action === 'rephrase' || action === 'tone' || action === 'custom') {
      editorRef.current?.clearGhostText();
      setPendingAction(action);
      setProposal(null);
      return;
    }
    if (
      action === 'story_tension' ||
      action === 'story_dialogue' ||
      action === 'story_ending' ||
      action === 'story_intent' ||
      action === 'story_opening' ||
      action === 'story_pacing' ||
      action === 'story_character' ||
      action === 'story_payoff' ||
      action === 'story_lore' ||
      action === 'story_addiction' ||
      action === 'story_cont_check' ||
      action === 'story_planner'
    ) {
      void runStorycraft(action);
      return;
    }
    void runAi(action);
  };

  const requestAutocomplete = async (context: AutocompleteContext) => {
    if (!activeProject || aiBusy || proposal || pendingAction) return;
    autocompleteAbort.current?.abort();
    const requestId = ++autocompleteRequestId.current;
    const controller = new AbortController();
    autocompleteAbort.current = controller;
    try {
      const memory = [
        activeProject.name,
        activeChapter?.title,
        activeScene?.title,
        context.documentMemory,
      ]
        .filter(Boolean)
        .join(' · ');
      const res = await api.autocompleteAi(
        activeProject.id,
        {
          ...context,
          documentMemory: memory,
        },
        controller.signal,
      );
      if (requestId === autocompleteRequestId.current && !controller.signal.aborted) {
        editorRef.current?.setGhostText(res.text);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') editorRef.current?.clearGhostText();
    }
  };

  const acceptProposal = async () => {
    if (!proposal?.proposed || !activeProject) return;
    const handle = editorRef.current;
    if (!handle) return;
    const {from, to, text} = lastSelection;
    try {
      const created = await api.createSuggestion(activeProject.id, {
        scene_id: activeSceneId,
        range_from: from,
        range_to: to,
        original_text: text,
        proposed_text: proposal.proposed,
        explanation: proposal.explanation,
        role: 'literary_editor',
      });
      handle.replaceSelection(proposal.proposed);
      await api.patchSuggestion(activeProject.id, created.id, 'accepted');
    } catch {
      handle.replaceSelection(proposal.proposed);
    }
    setProposal(null);
    setContextOpen(false);
  };

  const rejectProposal = async () => {
    if (!proposal?.proposed || !activeProject) return;
    try {
      const created = await api.createSuggestion(activeProject.id, {
        scene_id: activeSceneId,
        range_from: lastSelection.from,
        range_to: lastSelection.to,
        original_text: lastSelection.text,
        proposed_text: proposal.proposed,
        explanation: proposal.explanation,
        role: 'literary_editor',
      });
      await api.patchSuggestion(activeProject.id, created.id, 'rejected');
    } catch {
      /* ignore */
    }
    setProposal(null);
    setContextOpen(false);
  };

  const handleDeleteScene = async (sceneId: string, title: string) => {
    if (!activeProject) return;
    if (!window.confirm(`Delete scene "${title}"? This removes the scene file and saved suggestions for it.`)) return;
    try {
      await api.deleteScene(activeProject.id, sceneId);
      await refreshOutline();
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  const handleDeleteChapter = async (chapterId: string, title: string) => {
    if (!activeProject) return;
    if (!window.confirm(`Delete chapter "${title}" and all of its scenes?`)) return;
    try {
      await api.deleteChapter(activeProject.id, chapterId);
      await refreshOutline();
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  const activeChapter = outline?.chapters.find((c) => scenesByChapter.get(c.id)?.some((s) => s.id === activeSceneId));
  const activeScene = outline?.scenes.find((s) => s.id === activeSceneId);
  const suggestionAlternative: SuggestionAlternative | null = proposal?.proposed
    ? {
        id: 'primary',
        label: proposal.task ?? 'Suggestion',
        proposedText: proposal.proposed,
        explanation: proposal.explanation,
      }
    : null;
  const formatLastSaved = (d: Date | null) => {
    if (!d) return '—';
    const s = d.getTime() / 1000;
    const n = Date.now() / 1000;
    if (n - s < 10) return 'Just now';
    return d.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
  };

  const exportSceneMarkdown = async () => {
    if (!activeScene) return;
    try {
      await editorRef.current?.flushSave();
      const md = editorRef.current?.getMarkdown() ?? '';
      const name = (activeScene.slug || activeScene.title || 'scene').replace(/[^a-z0-9-]+/gi, '-');
      const blob = new Blob([md], {type: 'text/markdown;charset=utf-8'});
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `${name}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  const goScreen = (screen: Parameters<NavigationProps['onNavigate']>[0], t: Parameters<NavigationProps['onNavigate']>[1]) => {
    void flushBeforeNav().then(() => onNavigate(screen, t));
  };

  const applyChapterTitle = async (chapterId: string, raw: string) => {
    if (!activeProject) return;
    const t = raw.trim();
    if (!t) {
      setRenaming(null);
      return;
    }
    const prev = outline?.chapters.find((c) => c.id === chapterId)?.title;
    if (t === prev) {
      setRenaming(null);
      return;
    }
    try {
      await api.patchChapterTitle(activeProject.id, chapterId, t);
      await refreshOutline();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setRenaming(null);
    }
  };

  const applySceneTitle = async (sceneId: string, raw: string) => {
    if (!activeProject) return;
    const t = raw.trim();
    if (!t) {
      setRenaming(null);
      return;
    }
    const prev = outline?.scenes.find((s) => s.id === sceneId)?.title;
    if (t === prev) {
      setRenaming(null);
      return;
    }
    try {
      await api.patchSceneTitle(activeProject.id, sceneId, t);
      await refreshOutline();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setRenaming(null);
    }
  };

  const toolGroups = [
    {
      label: 'Plan',
      items: [
        {
          label: 'The Codex',
          detail: 'Build zone: canvas and timeline',
          icon: <MapIcon className="h-4 w-4" />,
          onClick: () => goScreen('StoryWikiHub', 'push_back'),
        },
        {
          label: 'Story Bible',
          detail: 'Encyclopedia, lore, tracked motifs',
          icon: <BookOpen className="h-4 w-4" />,
          onClick: () => goScreen('StoryBible', 'push'),
        },
        {
          label: 'Canvas',
          detail: 'Loose notes and structure',
          icon: <Layers className="h-4 w-4" />,
          onClick: () => goScreen('StoryCanvas', 'push'),
        },
        {
          label: 'Timeline',
          detail: 'Events and reveal order',
          icon: <Calendar className="h-4 w-4" />,
          onClick: () => goScreen('TimelineView', 'push'),
        },
      ],
    },
    {
      label: 'Check',
      items: [
        {
          label: 'Continuity',
          detail: 'Unresolved story flags',
          icon: <BookOpen className="h-4 w-4" />,
          onClick: () => goScreen('ContinuityCheckPanel', 'push'),
        },
        {
          label: 'Agent pass',
          detail: 'Longer AI review jobs',
          icon: <Brain className="h-4 w-4" />,
          onClick: () => goScreen('AgentMode', 'push'),
        },
      ],
    },
    {
      label: 'Craft',
      items: [
        {
          label: 'Lore compress',
          detail: 'Select prose — embed worldbuilding in scene (storycraft)',
          icon: <ScrollText className="h-4 w-4" />,
          onClick: () => void runStorycraft('story_lore'),
        },
        {
          label: 'Addiction beat',
          detail: 'Make the next page feel inevitable (storycraft)',
          icon: <Zap className="h-4 w-4" />,
          onClick: () => void runStorycraft('story_addiction'),
        },
        {
          label: 'Char match',
          detail: 'Line voice up with character (storycraft)',
          icon: <UserCheck className="h-4 w-4" />,
          onClick: () => void runStorycraft('story_cont_check'),
        },
        {
          label: 'Story plan',
          detail: 'Tighten act or chapter spine in selection (storycraft)',
          icon: <Waypoints className="h-4 w-4" />,
          onClick: () => void runStorycraft('story_planner'),
        },
      ],
    },
    {
      label: 'Preserve',
      items: [
        {
          label: 'Versions',
          detail: 'Snapshots and history',
          icon: <Package className="h-4 w-4" />,
          onClick: () => goScreen('VersionHistory', 'push'),
        },
      ],
    },
  ];

  return (
    <AppScaffold
      active="manuscript"
      onNavigate={onNavigate}
      beforeNavigate={flushBeforeNav}
      minimalChrome={zenFocus}
      mainClassName="overflow-hidden"
      actions={
        <>
          <div className="hidden max-w-[10rem] flex-col text-right font-sans text-[10px] leading-tight text-ink-muted sm:flex" title="Latest successful save to disk">
            <span className="uppercase tracking-widest">Last saved</span>
            <span className="font-sans text-xs text-ink">{formatLastSaved(lastSavedAt)}</span>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-sm border border-oak-variant bg-sepia-mid px-2.5 py-1 font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink"
            onClick={() => void exportSceneMarkdown()}
            title="Download this scene as a Markdown file"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-sans text-[10px] uppercase tracking-widest ${
              zenFocus ? 'bg-primary text-parchment' : 'border border-oak-variant bg-sepia-mid text-ink-muted hover:text-ink'
            }`}
            onClick={() => setZenFocus((z) => !z)}
            title="Hide chrome and show only the page (Esc to exit)"
            aria-pressed={zenFocus}
          >
            Studio zen
            <span className="h-1.5 w-1.5 rounded-full bg-amber-wax" aria-hidden />
          </button>
          <span className="hidden text-ink-muted text-xs sm:inline">{wordCount.toLocaleString()} words</span>
          <button
            type="button"
            className="hidden rounded-sm border border-oak-variant bg-sepia-mid px-2 py-1 font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink lg:inline-flex"
            onClick={() => setToolsOpen((value) => !value)}
            aria-expanded={toolsOpen}
          >
            Tools
          </button>
          <button
            type="button"
            className="p-2 hover:bg-sepia-high rounded-sm"
            onClick={() => goScreen('VersionHistory', 'push')}
            title="Version history"
          >
            <History className="w-4 h-4 text-ink-muted hover:text-ink" />
          </button>
          <button type="button" className="p-2 hover:bg-sepia-high rounded-sm" onClick={() => goScreen('SettingsScreen', 'push')} title="Settings">
            <Settings className="w-4 h-4 text-ink-muted hover:text-ink" />
          </button>
        </>
      }
      footer={
        <footer className="relative z-50 flex h-8 items-center justify-between border-t border-oak-variant bg-sepia-high px-6 font-sans text-[10px] uppercase tracking-widest text-ink-muted">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`h-1.5 w-1.5 rounded-full ${savedPulse ? 'bg-amber-wax' : 'bg-green-600'}`} />
              <span>{savedPulse ? 'Saving...' : 'Saved'}</span>
            </div>
            <span className="text-oak">|</span>
            <span className="flex items-center gap-1.5 min-w-0" title="Scene and story context are sent with each AI call">
              <Brain className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Scene packet mode</span>
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="font-bold text-primary">Words: {wordCount.toLocaleString()}</span>
            {zenFocus ? <div className="rounded-sm bg-primary px-3 py-1 text-[9px] font-bold text-parchment">STUDIO ZEN</div> : null}
          </div>
        </footer>
      }
    >
      {zenFocus ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-end gap-2 p-3">
          <div className="pointer-events-auto flex max-w-sm flex-wrap items-center justify-end gap-2 rounded-sm border border-oak-variant/80 bg-sepia-high/95 px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-ink shadow-md backdrop-blur-sm">
            <span className="text-ink-muted">Last: {formatLastSaved(lastSavedAt)}</span>
            <button
              type="button"
              onClick={() => void exportSceneMarkdown()}
              className="inline-flex items-center gap-1 border border-oak-variant px-2 py-0.5 text-ink hover:bg-sepia-mid"
            >
              <Download className="h-3 w-3" />
              Export
            </button>
            <button
              type="button"
              onClick={() => setZenFocus(false)}
              className="bg-primary px-2 py-0.5 text-parchment hover:opacity-90"
            >
              Exit zen
            </button>
          </div>
        </div>
      ) : null}
      {zenFocus ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 font-sans text-[10px] uppercase tracking-widest text-ink-muted/90" aria-hidden>
          {wordCount.toLocaleString()} words
        </div>
      ) : null}
      <div className="flex h-full min-h-0 overflow-hidden">
        <aside
          className={`bg-sepia-low text-ink font-serif text-sm w-64 border-r border-oak-variant flex flex-col py-4 px-2 ${
            zenFocus ? 'hidden' : 'hidden lg:flex'
          }`}
        >
          <div className="px-4 mb-6">
            <h3 className="font-bold text-lg">Manuscript</h3>
            <p className="text-ink-muted text-xs italic truncate" title={activeProject.name}>
              {activeProject.name}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="font-sans text-[9px] uppercase tracking-widest px-2 py-1 border border-oak-variant rounded-sm"
                onClick={async () => {
                  const ch = outline?.chapters.slice().sort((a, b) => a.sort_order - b.sort_order).at(-1);
                  if (!activeProject || !ch) return;
                  const created = await api.createScene(activeProject.id, ch.id);
                  await refreshOutline();
                  setActiveScene(created.id);
                }}
              >
                + Scene
              </button>
              <button
                type="button"
                className="font-sans text-[9px] uppercase tracking-widest px-2 py-1 border border-oak-variant rounded-sm"
                onClick={async () => {
                  if (!activeProject) return;
                  await api.createChapter(activeProject.id);
                  await refreshOutline();
                }}
              >
                + Chapter
              </button>
            </div>
          </div>
          <div className="space-y-1 overflow-y-auto flex-1">
            <div className="flex items-center gap-3 px-3 py-2 text-ink-muted rounded-sm">
              <BookOpen className="w-4 h-4" />
              <span>Outline</span>
            </div>
            {outline?.chapters
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((ch) => (
                <div key={ch.id}>
                  <div className="group/chapter px-3 py-2 text-ink font-bold bg-sepia-high rounded-sm flex items-center gap-2 min-h-[40px]">
                    <Edit3 className="w-4 h-4 shrink-0" />
                    {renaming?.kind === 'chapter' && renaming.id === ch.id ? (
                      <input
                        className="min-w-0 flex-1 rounded-sm border border-primary bg-parchment-bright px-1.5 py-0.5 font-sans text-xs text-ink outline-none"
                        value={renaming.value}
                        onChange={(e) =>
                          setRenaming((r) => (r && r.id === ch.id && r.kind === 'chapter' ? { ...r, value: e.target.value } : r))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            skipNextRenameBlur.current = true;
                            setRenaming(null);
                            return;
                          }
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            skipNextRenameBlur.current = true;
                            void applyChapterTitle(ch.id, (e.currentTarget as HTMLInputElement).value);
                          }
                        }}
                        onBlur={(e) => {
                          if (skipNextRenameBlur.current) {
                            skipNextRenameBlur.current = false;
                            return;
                          }
                          void applyChapterTitle(ch.id, e.currentTarget.value);
                        }}
                        autoFocus
                        aria-label="Chapter title"
                      />
                    ) : (
                      <span
                        className="truncate flex-1 cursor-default"
                        onDoubleClick={() => setRenaming({ kind: 'chapter', id: ch.id, value: ch.title })}
                        title="double-click to rename"
                      >
                        {ch.title}
                      </span>
                    )}
                    {renaming?.kind === 'chapter' && renaming.id === ch.id ? null : (
                      <button
                        type="button"
                        className="shrink-0 rounded-sm p-1 text-ink-muted opacity-0 transition-opacity group-hover/chapter:opacity-100 hover:bg-sepia-mid hover:text-primary"
                        title="Rename chapter"
                        onClick={() => setRenaming({ kind: 'chapter', id: ch.id, value: ch.title })}
                        aria-label="Rename chapter"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="p-1 rounded-sm text-ink-muted hover:text-red-200 hover:bg-sepia-mid disabled:opacity-30 shrink-0"
                      title="Delete chapter"
                      disabled={(outline?.chapters.length ?? 0) <= 1}
                      onClick={() => void handleDeleteChapter(ch.id, ch.title)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="pl-8 space-y-1 mt-1 border-l border-oak-variant ml-3">
                    {(scenesByChapter.get(ch.id) ?? [])
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((sc) => (
                        <div
                          key={sc.id}
                          className={`group flex max-w-full items-center gap-0.5 rounded-sm ${
                            sc.id === activeSceneId ? 'text-primary font-bold border-l-2 border-primary -ml-3 pl-6' : 'text-ink-muted hover:text-primary'
                          }`}
                        >
                          {renaming?.kind === 'scene' && renaming.id === sc.id ? (
                            <input
                              className="min-w-0 max-w-full flex-1 rounded-sm border border-primary bg-parchment-bright px-1.5 py-1.5 text-xs text-ink outline-none"
                              value={renaming.value}
                              onChange={(e) =>
                                setRenaming((r) => (r && r.id === sc.id && r.kind === 'scene' ? { ...r, value: e.target.value } : r))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  skipNextRenameBlur.current = true;
                                  setRenaming(null);
                                  return;
                                }
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  skipNextRenameBlur.current = true;
                                  void applySceneTitle(sc.id, (e.currentTarget as HTMLInputElement).value);
                                }
                              }}
                              onBlur={(e) => {
                                if (skipNextRenameBlur.current) {
                                  skipNextRenameBlur.current = false;
                                  return;
                                }
                                void applySceneTitle(sc.id, e.currentTarget.value);
                              }}
                              autoFocus
                              aria-label="Scene title"
                            />
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setActiveScene(sc.id)}
                                onDoubleClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setRenaming({ kind: 'scene', id: sc.id, value: sc.title });
                                }}
                                className="min-w-0 flex-1 overflow-hidden text-ellipsis text-left px-1.5 py-1.5 text-xs"
                                title="Click to open · double-click to rename"
                              >
                                {sc.title}
                              </button>
                              <button
                                type="button"
                                className="shrink-0 rounded-sm p-1 text-ink-muted opacity-0 transition-opacity hover:bg-sepia-mid hover:text-primary group-hover:opacity-100"
                                title="Rename scene"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenaming({ kind: 'scene', id: sc.id, value: sc.title });
                                }}
                                aria-label="Rename scene"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="p-1 rounded-sm text-ink-muted hover:text-red-200 hover:bg-sepia-mid disabled:opacity-30 shrink-0"
                            title="Delete scene"
                            disabled={(outline?.scenes.length ?? 0) <= 1}
                            onClick={() => void handleDeleteScene(sc.id, sc.title)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </aside>

        <main
          ref={mainScrollRef}
          className="zen-editor-main flex min-w-0 flex-1 items-start justify-center overflow-y-auto relative"
        >
          <div className="manuscript-page w-full shrink-0 bg-parchment-bright shadow-xl relative paper-stack">
            <header className="mb-8 text-center">
              <p className="font-sans text-xs text-ink-muted uppercase tracking-widest mb-2 font-bold">
                {activeChapter?.title ?? 'Chapter'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                <h1 className="text-3xl font-semibold italic text-primary m-0">
                  {outline?.scenes.find((s) => s.id === activeSceneId)?.title ?? 'Scene'}
                </h1>
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-oak-variant/50 bg-sepia-high/50 text-ink-muted"
                  title="AI uses your scene and story context packet for each request (scene packet mode)"
                >
                  <Brain className="h-3.5 w-3.5" aria-hidden />
                </span>
              </div>
              <div className="w-16 h-px bg-oak-variant mx-auto mb-6" />
            </header>

            <SelectionToolbar disabled={aiBusy} onAction={handleToolbarAction} />

            {pendingAction ? (
              <div className="my-4 rounded-sm border border-oak-variant bg-sepia-high p-4">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-sans text-[10px] uppercase tracking-widest text-ink-muted">
                      {pendingAction === 'custom' ? 'Custom transform' : pendingAction === 'tone' ? 'Tone direction' : 'Rephrase style'}
                    </div>
                    <p className="mt-1 text-sm font-serif text-ink-muted">Choose a direction before asking the larger editor model.</p>
                  </div>
                  <button
                    type="button"
                    className="font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink"
                    onClick={() => setPendingAction(null)}
                  >
                    Close
                  </button>
                </div>
                {pendingAction !== 'custom' ? (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    {[
                      ['clearer', 'Clearer'],
                      ['literary', 'Literary'],
                      ['concise', 'Concise'],
                      ['formal', 'Formal'],
                      ['tense', 'Tense'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setStyleChoice(id)}
                        className={`rounded-sm border px-3 py-2 font-sans text-[10px] uppercase tracking-widest ${
                          styleChoice === id ? 'border-primary bg-parchment-bright text-primary' : 'border-oak-variant text-ink-muted hover:text-ink'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <textarea
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="make this more emotional; rewrite as noir detective prose; make this sound like internal monologue"
                  className="mt-3 min-h-20 w-full resize-y rounded-sm border border-oak-variant bg-parchment-bright p-3 font-serif text-sm text-ink outline-none focus:border-primary"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={aiBusy}
                    className="rounded-sm bg-primary px-4 py-2 font-sans text-[10px] uppercase tracking-widest text-parchment disabled:opacity-40"
                    onClick={() => void runAi(pendingAction)}
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    className="rounded-sm border border-oak-variant px-4 py-2 font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink"
                    onClick={() => setPendingAction(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <ManuscriptEditor
              ref={editorRef}
              projectId={activeProject.id}
              sceneId={activeSceneId}
              typewriterScrollParentRef={mainScrollRef}
              memoryTerms={memoryTerms}
              onEntityClick={(label) => setEntityCard(label)}
              onSaved={() => {
                setLastSavedAt(new Date());
                setSavedPulse(true);
                setTimeout(() => setSavedPulse(false), 900);
              }}
              onStats={setWordCount}
              onAutocompleteContext={(context) => void requestAutocomplete(context)}
            />

            {proposal && !proposal.proposed ? <p className="mt-4 text-sm text-amber-200/90 font-sans">{proposal.explanation}</p> : null}

            <div className="py-10 flex justify-center">
              <div className="h-px w-full bg-oak-variant/30 flex items-center justify-center">
                <div className="bg-parchment-bright px-4 text-oak-variant">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {zenFocus ? null : (
            <button
              type="button"
              className="snapshot-button fixed bg-amber-wax text-parchment rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all z-40 border-4 border-white"
              title="Snapshot"
              onClick={() => void api.createSnapshot(activeProject.id, 'manual')}
            >
              <Save className="w-6 h-6" />
            </button>
          )}
        </main>

        <aside
          className={`${
            zenFocus
              ? 'hidden'
              : 'hidden border-l border-oak-variant bg-sepia-low py-4 z-50 transition-[width] duration-200 lg:flex lg:flex-col'
          } ${toolsOpen ? 'w-64 px-3' : 'w-12 items-center px-1'}`}
        >
          <button
            type="button"
            className={`mb-4 flex h-9 items-center rounded-sm border border-oak-variant bg-sepia-high font-sans text-[10px] uppercase tracking-widest text-primary hover:border-primary/50 ${
              toolsOpen ? 'w-full justify-between px-3' : 'w-9 justify-center'
            }`}
            onClick={() => setToolsOpen((value) => !value)}
            aria-label={toolsOpen ? 'Collapse writing tools' : 'Open writing tools'}
            aria-expanded={toolsOpen}
            title={toolsOpen ? 'Collapse writing tools' : 'Open writing tools'}
          >
            {toolsOpen ? (
              <>
                <span>Writing tools</span>
                <ChevronRight className="h-4 w-4" />
              </>
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          {toolsOpen ? (
            <>
              <div className="mb-5 border-b border-oak-variant pb-4">
                <p className="text-xs leading-5 text-ink-muted">Keep writing here. Open these only when the scene needs planning, checking, or recovery.</p>
              </div>
              <div className="space-y-5 overflow-y-auto">
                {toolGroups.map((group) => (
                  <section key={group.label}>
                    <h3 className="mb-2 font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">{group.label}</h3>
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="flex w-full items-start gap-3 rounded-sm border border-transparent px-2 py-2 text-left hover:border-oak-variant hover:bg-sepia-mid"
                          onClick={item.onClick}
                        >
                          <span className="mt-0.5 text-primary">{item.icon}</span>
                          <span className="min-w-0">
                            <span className="block font-sans text-xs font-bold uppercase tracking-widest text-primary">{item.label}</span>
                            <span className="mt-1 block text-xs leading-4 text-ink-muted">{item.detail}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center gap-3 pt-2">
              <Brain className="h-5 w-5 text-primary" />
              <span className="vertical-rl font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted [writing-mode:vertical-rl]">Tools</span>
            </div>
          )}
        </aside>
      </div>

      {entityCard ? (
        <div
          className="fixed bottom-24 left-1/2 z-[70] w-full max-w-sm -translate-x-1/2 rounded-sm border border-oak-variant bg-surface-container-highest px-4 py-3 font-sans text-ink shadow-lg"
          role="dialog"
          aria-label="Story memory"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Story memory</p>
          <p className="mt-2 font-serif text-lg text-primary">{entityCard}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-sm bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-parchment"
              onClick={() => {
                setEntityCard(null);
                goScreen('StoryBible', 'push');
              }}
            >
              Open Story Bible
            </button>
            <button
              type="button"
              className="rounded-sm border border-oak-variant px-3 py-1.5 text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink"
              onClick={() => setEntityCard(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {suggestionAlternative ? (
        <SuggestionPanel
          actionLabel={proposal?.task ?? 'AI suggestion'}
          contextBreadcrumb={`${activeChapter?.title ?? 'Chapter'} · ${activeScene?.title ?? 'Scene'} · Selection: ${lastSelection.text.trim().split(/\s+/).filter(Boolean).length} words`}
          originalText={proposal?.original ?? ''}
          alternatives={[suggestionAlternative]}
          busy={aiBusy}
          unsupportedActions={['branch', 'note']}
          onAccept={() => void acceptProposal()}
          onReject={() => void rejectProposal()}
          onClose={() => {
            setProposal(null);
            setContextOpen(false);
          }}
          onShowContextInspector={() => setContextOpen(true)}
        />
      ) : null}

      {contextOpen && proposal ? (
        <div className="fixed right-[380px] top-10 bottom-8 z-40 w-[560px] max-w-[calc(100vw-390px)]">
          <ContextInspector
            className="h-full"
            subtitle={`for: ${proposal.task ?? 'AI suggestion'}`}
            tokenBudget={{used: proposal.contextTokens ?? 0, max: 4096}}
            sections={{
              task: {text: proposal.instruction ?? proposal.task ?? ''},
              selection: {text: proposal.original},
              style: {text: 'Included in full packet when story/style.md exists.'},
              motifs: {text: 'Included in full packet when story/motifs.md exists.'},
              threads: {text: 'Included in full packet when story/unresolved_threads.md exists.'},
              fullPacket: {text: proposal.contextPacket ?? 'The backend did not return a context packet for this response.'},
            }}
            onClose={() => setContextOpen(false)}
          />
        </div>
      ) : null}
    </AppScaffold>
  );
}
