import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BookOpen,
  BookMarked,
  Brain,
  Download,
  History,
  Pencil,
  Settings,
  Edit3,
  Layers,
  Trash2,
} from 'lucide-react';
import {NavigationProps} from '../types';
import {AppScaffold} from '../components/AppScaffold';
import {useProjectStore} from '../stores/projectStore';
import {ManuscriptEditor, type AutocompleteContext, type CommandScope, type InlineOperation, type InlinePreview, type ManuscriptEditorHandle} from '../components/ManuscriptEditor';
import {ContextInspector} from '../components/ContextInspector';
import {SuggestionPanel, type SuggestionAlternative} from '../components/SuggestionPanel';
import LumoPet from '../components/LumoPet';
import {api, type CaptureProposal} from '../lib/api';
import {COMMAND_PALETTE, getStorycraftCommand, isStorycraftCommandId, type CommandId, type StorycraftCommandId} from '../lib/writingCommands';

type Action = CommandId | 'rephrase' | 'tone';

function proposalKindLabel(kind: string) {
  if (kind === 'timeline_event') return 'Timeline';
  if (kind === 'wiki') return 'Wiki';
  return kind.replace(/_/g, ' ');
}

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
    operation?: InlineOperation;
    preview?: InlinePreview;
    explanation?: string;
    task?: string;
    instruction?: string;
    contextPacket?: string;
    contextTokens?: number;
    action?: Action;
    style?: string;
    scope?: CommandScope;
  } | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [lastSelection, setLastSelection] = useState({from: 0, to: 0, text: ''});
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [styleChoice, setStyleChoice] = useState('clearer');
  const [customInstruction, setCustomInstruction] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [zenFocus, setZenFocus] = useState(() => localStorage.getItem('liteauthor.editor.zenFocus') === 'true');
  const [memoryTerms, setMemoryTerms] = useState<string[]>([]);
  const [entityCard, setEntityCard] = useState<string | null>(null);
  const [wikiProposals, setWikiProposals] = useState<CaptureProposal[]>([]);
  const [selectedWikiProposalIds, setSelectedWikiProposalIds] = useState<Set<string>>(() => new Set());
  const [wikiPopulateOpen, setWikiPopulateOpen] = useState(false);
  const [wikiPopulateBusy, setWikiPopulateBusy] = useState(false);
  const [wikiPopulateStatus, setWikiPopulateStatus] = useState('');
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
    localStorage.setItem('liteauthor.editor.zenFocus', String(zenFocus));
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

  const selectedWikiProposals = useMemo(
    () => wikiProposals.filter((proposal) => selectedWikiProposalIds.has(proposal.id)),
    [wikiProposals, selectedWikiProposalIds],
  );

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

  const instructionFor = (action: Action, selection: string, style = styleInstruction(), scope?: CommandScope): {task: string; instruction: string; role: string} => {
    const current = scope?.currentParagraph.text || selection || '(cursor position)';
    const base = [
      `Target:\n${selection || current}`,
      scope ? `Previous context:\n${scope.previousParagraphs.join('\n\n') || '(none)'}` : null,
      scope ? `Next context:\n${scope.nextParagraphs.join('\n\n') || '(none)'}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');
    switch (action) {
      case 'rewrite':
      case 'rephrase':
        return {task: 'Rephrase selected text', instruction: `${base}\nRewrite the selected text. Keep the original meaning. ${style}`, role: 'literary_editor'};
      case 'expand':
        return {task: 'Expand selected text', instruction: `${base}\nExpand the selected text with concrete detail while preserving meaning and voice.`, role: 'literary_editor'};
      case 'shorten':
        return {task: 'Shorten selected text', instruction: `${base}\nShorten the selected text. Preserve the core meaning, cadence, and story facts.`, role: 'literary_editor'};
      case 'tone':
        return {task: 'Change tone', instruction: `${base}\nRewrite the selected text with this direction: ${style}`, role: 'literary_editor'};
      case 'continue':
        return {task: 'Continue scene', instruction: `${base}\nContinue from the cursor for 1–3 sentences in the same voice. Return only the continuation text.`, role: 'literary_editor'};
      case 'finish_sentence':
        return {task: 'Finish sentence', instruction: `${base}\nComplete the current unfinished sentence naturally. Return the full finished sentence only.`, role: 'literary_editor'};
      case 'tone_darker':
        return {task: 'Darken prose', instruction: `${base}\nRewrite the target paragraph with a darker mood and sharper atmosphere. Preserve story facts, POV, and tense.`, role: 'literary_editor'};
      case 'describe_setting':
        return {task: 'Describe setting', instruction: `${base}\nWrite one concise sensory setting beat that fits at the cursor. Return only prose to insert.`, role: 'literary_editor'};
      case 'emotional_beat':
        return {task: 'Add emotional beat', instruction: `${base}\nWrite one emotional reaction beat that fits at the cursor. Return only prose to insert.`, role: 'literary_editor'};
      case 'finish_dialogue':
        return {task: 'Finish dialogue', instruction: `${base}\nComplete the current dialogue line in character. Return the full finished sentence or line only.`, role: 'literary_editor'};
      case 'next_beat':
        return {task: 'Next beat', instruction: `${base}\nWrite the next action beat as a new paragraph. Return only the paragraph.`, role: 'literary_editor'};
      case 'custom':
        return {task: 'Custom transform', instruction: `${base}\n${style || customInstruction.trim() || 'Transform the target text while preserving story continuity.'}`, role: 'literary_editor'};
      default:
        return {task: 'Assist', instruction: base, role: 'literary_editor'};
    }
  };

  const operationForAction = (action: Action, scope: CommandScope): InlineOperation => {
    const hasSelection = scope.selection.from !== scope.selection.to;
    if (hasSelection) return {operation: 'replace_selection', text: ''};
    switch (action) {
      case 'continue':
        return {operation: 'insert_after_cursor', text: ''};
      case 'finish_sentence':
      case 'finish_dialogue':
        return {operation: 'replace_current_sentence', text: ''};
      case 'describe_setting':
      case 'emotional_beat':
      case 'next_beat':
        return {operation: 'insert_block_after', text: ''};
      case 'expand':
        return {operation: 'expand_choice', text: ''};
      default:
        return {operation: 'replace_current_paragraph', text: ''};
    }
  };

  const previewForOperation = (operation: InlineOperation, scope: CommandScope, proposed: string): InlinePreview => {
    const hasSelection = scope.selection.from !== scope.selection.to;
    if (hasSelection) {
      return {
        operation: {...operation, operation: 'replace_selection', text: proposed},
        range: {from: scope.selection.from, to: scope.selection.to},
        insertPos: scope.selection.to,
        original: scope.selection.text,
        proposed,
      };
    }
    if (operation.operation === 'insert_after_cursor') {
      return {operation: {...operation, text: proposed}, range: {from: scope.cursor, to: scope.cursor}, insertPos: scope.cursor, original: '', proposed};
    }
    if (operation.operation === 'replace_current_sentence') {
      return {
        operation: {...operation, text: proposed},
        range: {from: scope.currentSentence.from, to: scope.currentSentence.to},
        insertPos: scope.currentSentence.to,
        original: scope.currentSentence.text,
        proposed,
      };
    }
    if (operation.operation === 'insert_block_after') {
      return {
        operation: {...operation, text: proposed},
        range: {from: scope.currentParagraph.to, to: scope.currentParagraph.to},
        insertPos: scope.currentParagraph.to,
        original: '',
        proposed: `\n\n${proposed}`,
      };
    }
    return {
      operation: {...operation, text: proposed},
      range: {from: scope.currentParagraph.from, to: scope.currentParagraph.to},
      insertPos: scope.currentParagraph.to,
      original: scope.currentParagraph.text,
      proposed,
      showInsertBelow: operation.operation === 'expand_choice',
    };
  };

  const wordDeltaSummary = (original: string, proposed: string) => {
    const originalWords = original.trim().split(/\s+/).filter(Boolean).length;
    const proposedWords = proposed.trim().split(/\s+/).filter(Boolean).length;
    const delta = proposedWords - originalWords;
    if (!proposed.trim()) return '';
    return `${originalWords} words → ${proposedWords} words · ${delta >= 0 ? '+' : ''}${delta} words`;
  };

  const showGeneratingPreview = (scope: CommandScope, operation: InlineOperation, task: string) => {
    const preview = previewForOperation(operation, scope, '');
    editorRef.current?.showInlinePreview({
      ...preview,
      status: 'generating',
      task,
    });
    return preview;
  };

  const runStorycraft = async (action: StorycraftCommandId, providedScope?: CommandScope) => {
    const handle = editorRef.current;
    if (!handle || !activeProject) return;
    handle.clearGhostText();
    handle.clearInlinePreview();
    const scope = providedScope ?? handle.getCommandScope();
    const operation = operationForAction(action, scope);
    const previewBase = previewForOperation(operation, scope, '');
    const text = scope.selection.text.trim() || scope.currentParagraph.text.trim();
    setLastSelection({from: previewBase.range.from, to: previewBase.range.to, text: previewBase.original || text});
    if (text.length < 2) {
      setProposal({
        original: '',
        proposed: '',
        explanation: 'Select text or place the cursor in a paragraph before running a storycraft outcome.',
      });
      return;
    }
    const cfg = getStorycraftCommand(action);
    if (!cfg) return;
    setAiBusy(true);
    setProposal(null);
    setReviewOpen(false);
    setPendingAction(null);
    showGeneratingPreview(scope, operation, cfg.label);
    try {
      const res = await api.storycraftRewrite(activeProject.id, {
        scene_id: activeSceneId,
        surface: 'inline_suggestion',
        intent: cfg.intent,
        selection: text,
        chapter_position: cfg.chapterPosition,
        run_model: true,
      });
      const proposed = (res.rewrite || '').trim();
      const preview = previewForOperation(operation, scope, proposed);
      handle.showInlinePreview({
        ...preview,
        status: 'ready',
        task: cfg.label,
        summary: wordDeltaSummary(preview.original || text, proposed),
      });
      const hint = [res.rewrite && `~${res.packet_meta.approx_tokens ?? 0} tok`].filter(Boolean).join(' ');
      setProposal({
        original: preview.original || text,
        proposed,
        operation: {...operation, text: proposed} as InlineOperation,
        preview,
        explanation: [
          res.diagnosis.length ? res.diagnosis.join(' ') : null,
          res.warnings.length ? res.warnings.join(' ') : null,
          res.rules.length ? res.rules.map((r) => r.name).join(', ') : null,
          hint,
        ]
          .filter(Boolean)
          .join(' — '),
        task: cfg.label,
        contextPacket: undefined,
        contextTokens: res.packet_meta.approx_tokens,
        action,
        scope,
      });
    } catch (e) {
      handle.clearInlinePreview();
      setProposal({
        original: text,
        proposed: '',
        explanation: `Model error: ${(e as Error).message}`,
      });
    } finally {
      setAiBusy(false);
    }
  };

  const runAi = async (action: Action, style?: string, providedScope?: CommandScope, freeform?: string) => {
    const handle = editorRef.current;
    if (!handle || !activeProject) return;
    handle.clearGhostText();
    handle.clearInlinePreview();
    const scope = providedScope ?? handle.getCommandScope();
    const sel = scope.selection;
    setLastSelection(sel);
    const operation = operationForAction(action, scope);
    const targetText = sel.text.trim() || scope.currentParagraph.text.trim() || scope.currentSentence.text.trim();
    if (operation.operation !== 'insert_after_cursor' && operation.operation !== 'insert_block_after' && targetText.length < 2) {
      setProposal({
        original: '',
        proposed: '',
        explanation: 'Place the cursor in a sentence or paragraph before running this action.',
      });
      return;
    }
    if (freeform) setCustomInstruction(freeform);
    const {task, instruction, role} = instructionFor(action, targetText, style, scope);
    setAiBusy(true);
    setProposal(null);
    setReviewOpen(false);
    setPendingAction(null);
    showGeneratingPreview(scope, operation, task);
    try {
      const res = await api.zenAi(activeProject.id, {
        scene_id: activeSceneId,
        task,
        selection: targetText,
        instruction,
        role,
      });
      const opWithText = {...operation, text: res.text.trim()} as InlineOperation;
      const preview = previewForOperation(operation, scope, res.text.trim());
      handle.showInlinePreview({
        ...preview,
        status: 'ready',
        task: action === 'expand' ? 'Suggested expansion' : `${task} ready`,
        summary: wordDeltaSummary(preview.original || targetText, res.text.trim()),
      });
      setProposal({
        original: preview.original || targetText,
        proposed: res.text.trim(),
        operation: opWithText,
        preview,
        explanation: 'Uses current scene context',
        task,
        instruction,
        contextPacket: res.context_packet?.markdown,
        contextTokens: res.context_packet?.approx_tokens ?? res.packet_meta.approx_tokens,
        action,
        style,
        scope,
      });
    } catch (e) {
      handle.clearInlinePreview();
      setProposal({
        original: targetText,
        proposed: '',
        explanation: `Model error: ${(e as Error).message}`,
      });
    } finally {
      setAiBusy(false);
    }
  };

  const handleInlineCommand = (commandId: CommandId, scope: CommandScope, freeform?: string) => {
    if (isStorycraftCommandId(commandId)) {
      void runStorycraft(commandId, scope);
      return;
    }
    if (commandId === 'custom' && freeform) {
      void runAi(commandId, freeform, scope, freeform);
      return;
    }
    void runAi(commandId, undefined, scope);
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
    const preview = proposal.preview;
    const {from, to, text} = preview
      ? {from: preview.range.from, to: preview.range.to, text: preview.original}
      : lastSelection;
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
      handle.applyOperation(proposal.operation ?? {operation: 'replace_selection', text: proposal.proposed});
      await api.patchSuggestion(activeProject.id, created.id, 'accepted');
    } catch {
      handle.applyOperation(proposal.operation ?? {operation: 'replace_selection', text: proposal.proposed});
    }
    setProposal(null);
    setContextOpen(false);
    setReviewOpen(false);
  };

  const acceptProposalInsertBelow = async () => {
    if (!proposal?.proposed) return;
    editorRef.current?.applyOperation({operation: 'expand_choice', text: proposal.proposed, choice: 'insert_below'});
    setProposal(null);
    setContextOpen(false);
    setReviewOpen(false);
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
    editorRef.current?.clearInlinePreview();
    setProposal(null);
    setContextOpen(false);
    setReviewOpen(false);
  };

  const handleInlinePreviewAction = (action: 'apply' | 'dismiss' | 'review' | 'regenerate') => {
    if (action === 'apply') {
      void acceptProposal();
      return;
    }
    if (action === 'dismiss') {
      void rejectProposal();
      return;
    }
    if (action === 'review') {
      setReviewOpen(true);
      return;
    }
    if (action === 'regenerate' && proposal?.action) {
      if (proposal.action !== 'tone' && proposal.action !== 'rephrase' && isStorycraftCommandId(proposal.action)) {
        void runStorycraft(proposal.action, proposal.scope);
      } else {
        void runAi(proposal.action, proposal.style, proposal.scope);
      }
    }
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
  const suggestionRailOpen = Boolean(suggestionAlternative) && reviewOpen && !zenFocus;
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

  const reviewWikiUpdates = async () => {
    if (!activeProject || !activeSceneId) return;
    setWikiPopulateBusy(true);
    setWikiPopulateOpen(true);
    setWikiPopulateStatus('Reading current scene...');
    try {
      await flushBeforeNav();
      const result = await api.wikiPopulate(activeProject.id, {source: 'manuscript', scene_id: activeSceneId});
      setWikiProposals(result.proposals);
      setSelectedWikiProposalIds(new Set(result.proposals.map((item) => item.id)));
      setWikiPopulateStatus(result.summary ?? `${result.proposals.length} update proposal(s).`);
    } catch (error) {
      setWikiPopulateStatus((error as Error).message);
    } finally {
      setWikiPopulateBusy(false);
    }
  };

  const applyWikiUpdates = async () => {
    if (!activeProject || selectedWikiProposals.length === 0) return;
    setWikiPopulateBusy(true);
    setWikiPopulateStatus('Applying...');
    try {
      const result = await api.wikiApply(activeProject.id, {proposals: selectedWikiProposals, apply: true});
      setWikiPopulateStatus(result.summary ?? `Applied ${selectedWikiProposals.length} update(s).`);
      setWikiProposals((current) => current.filter((proposal) => !selectedWikiProposalIds.has(proposal.id)));
      setSelectedWikiProposalIds(new Set());
      const tree = await api.wikiTree(activeProject.id);
      const terms = tree
        .filter((e) => /\/(characters|locations)\/[^/]+\.md$/i.test(e.path))
        .map((e) => e.path.replace(/.*\//, '').replace(/\.md$/, '').replace(/[-_]+/g, ' ').trim());
      setMemoryTerms([...new Set(terms)].filter((s) => s.length >= 2).slice(0, 50));
    } catch (error) {
      setWikiPopulateStatus((error as Error).message);
    } finally {
      setWikiPopulateBusy(false);
    }
  };

  return (
    <AppScaffold
      active="manuscript"
      onNavigate={onNavigate}
      beforeNavigate={flushBeforeNav}
      minimalChrome={zenFocus}
      mainClassName="overflow-hidden"
        actions={
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-sm border border-oak-variant bg-sepia-mid px-2.5 py-1 font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink disabled:opacity-50"
            onClick={() => void reviewWikiUpdates()}
            disabled={wikiPopulateBusy}
            title="Find Wiki updates from the current scene"
          >
            <BookMarked className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Wiki</span>
          </button>
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
            <span className="flex items-center gap-1.5 min-w-0" title="Scene and wiki context are sent with each AI call">
              <Brain className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Scene packet mode</span>
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span
              className="hidden font-sans text-[10px] uppercase tracking-widest text-ink-muted sm:inline"
              title="Disk last modified (from server); updates after each save"
            >
              Last saved{' '}
              <span className="font-bold text-primary">{formatLastSaved(lastSavedAt)}</span>
            </span>
            <span className="hidden text-oak sm:inline" aria-hidden>
              |
            </span>
            <span className="font-bold text-primary">Words: {wordCount.toLocaleString()}</span>
            {zenFocus ? <div className="rounded-sm bg-primary px-3 py-1 text-[9px] font-bold text-parchment">STUDIO ZEN</div> : null}
          </div>
        </footer>
      }
    >
      {zenFocus ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-end gap-2 p-3">
          <div className="pointer-events-auto flex max-w-sm flex-wrap items-center justify-end gap-2 rounded-sm border border-oak-variant/80 bg-sepia-high/95 px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-ink shadow-md backdrop-blur-sm">
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
          className={`zen-editor-main flex min-w-0 flex-1 items-start justify-center overflow-y-auto relative transition-[padding] duration-200 ${
            suggestionRailOpen ? 'xl:pr-[424px]' : ''
          }`}
        >
          <div className="manuscript-page w-full shrink-0 bg-parchment-bright shadow-xl relative paper-stack">
            <header className="mb-8 text-center">
              <p className="font-sans text-xs text-ink-muted uppercase tracking-widest mb-2 font-bold">
                {activeChapter?.title ?? 'Chapter'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                <h1 className="text-2xl sm:text-[1.65rem] font-semibold italic text-primary m-0 leading-tight">
                  {outline?.scenes.find((s) => s.id === activeSceneId)?.title ?? 'Scene'}
                </h1>
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-oak-variant/50 bg-sepia-high/50 text-ink-muted"
                  title="AI uses your scene and wiki context packet for each request (scene packet mode)"
                >
                  <Brain className="h-3.5 w-3.5" aria-hidden />
                </span>
              </div>
              <div className="w-16 h-px bg-oak-variant mx-auto mb-6" />
            </header>

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
              commands={COMMAND_PALETTE}
              onCommand={handleInlineCommand}
              onEntityClick={(label) => setEntityCard(label)}
              onSaved={() => {
                setLastSavedAt(new Date());
                setSavedPulse(true);
                setTimeout(() => setSavedPulse(false), 900);
              }}
              onHydrated={({updatedAt}) => setLastSavedAt(new Date(updatedAt))}
              onStats={setWordCount}
              onAutocompleteContext={(context) => void requestAutocomplete(context)}
              onInlinePreviewAction={handleInlinePreviewAction}
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

        </main>

      </div>

      <LumoPet
        hidden={zenFocus}
        manuscriptTitle={activeProject.name}
        currentScene={activeScene?.title}
        selectedText={lastSelection.text}
        aiBusy={aiBusy}
        hasSuggestion={Boolean(proposal?.proposed)}
        onSnapshot={() => void api.createSnapshot(activeProject.id, 'manual')}
      />

      {wikiPopulateOpen ? (
        <div className="fixed bottom-24 right-6 z-[72] w-[min(28rem,calc(100vw-2rem))] rounded-sm border border-oak-variant bg-parchment-bright p-4 text-ink shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-sans text-[10px] uppercase tracking-widest text-ink-muted">Wiki updates</p>
              <h2 className="mt-1 font-serif text-lg italic text-primary">{wikiProposals.length} found</h2>
            </div>
            <button
              type="button"
              className="rounded-sm border border-oak-variant px-2 py-1 font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink"
              onClick={() => setWikiPopulateOpen(false)}
            >
              Close
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">{wikiPopulateStatus}</p>
          {wikiProposals.length > 0 ? (
            <>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {wikiProposals.map((item) => {
                  const selected = selectedWikiProposalIds.has(item.id);
                  return (
                    <label key={item.id} className={`block cursor-pointer rounded-sm border p-2.5 ${selected ? 'border-primary/45 bg-sepia-highest' : 'border-oak-variant bg-sepia-low'}`}>
                      <span className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
                          checked={selected}
                          onChange={(event) => {
                            setSelectedWikiProposalIds((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(item.id);
                              else next.delete(item.id);
                              return next;
                            });
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block font-sans text-[9px] font-bold uppercase tracking-widest text-primary">
                            {proposalKindLabel(item.kind)} · {item.target}
                          </span>
                          <span className="mt-0.5 block text-sm font-semibold leading-snug text-ink">{item.title}</span>
                          <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-ink-muted">{item.content.replace(/[#*_`<>-]/g, ' ').trim()}</span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-sm bg-primary px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-parchment disabled:opacity-50"
                  onClick={() => void applyWikiUpdates()}
                  disabled={wikiPopulateBusy || selectedWikiProposals.length === 0}
                >
                  {wikiPopulateBusy ? 'Working...' : `Apply ${selectedWikiProposals.length}`}
                </button>
                <button
                  type="button"
                  className="rounded-sm border border-oak-variant px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink"
                  onClick={() => setSelectedWikiProposalIds(new Set(wikiProposals.map((item) => item.id)))}
                >
                  All
                </button>
                <button
                  type="button"
                  className="rounded-sm border border-oak-variant px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink"
                  onClick={() => setSelectedWikiProposalIds(new Set())}
                >
                  None
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {entityCard ? (
        <div
          className="fixed bottom-24 left-1/2 z-[70] w-full max-w-sm -translate-x-1/2 rounded-sm border border-oak-variant bg-surface-container-highest px-4 py-3 font-sans text-ink shadow-lg"
          role="dialog"
          aria-label="Wiki memory"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Wiki memory</p>
          <p className="mt-2 font-serif text-lg text-primary">{entityCard}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-sm bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-parchment"
              onClick={() => {
                setEntityCard(null);
                goScreen('Wiki', 'push');
              }}
            >
              Open Wiki
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

      {suggestionAlternative && reviewOpen ? (
        <SuggestionPanel
          actionLabel={proposal?.task?.toLowerCase().includes('expand') ? 'Suggested expansion' : 'Suggestion ready'}
          contextBreadcrumb={`${activeChapter?.title ?? 'Chapter'} · ${activeScene?.title ?? 'Scene'} · ${wordDeltaSummary(proposal?.original ?? '', proposal?.proposed ?? '')} · Uses current scene context`}
          originalText={proposal?.original ?? ''}
          alternatives={[suggestionAlternative]}
          defaultView="suggestion"
          busy={aiBusy}
          unsupportedActions={['branch', 'note']}
          showInsertBelow={Boolean(proposal?.preview?.showInsertBelow)}
          acceptLabel={proposal?.preview?.showInsertBelow ? 'Replace selected text' : 'Replace selected text'}
          rejectLabel="Keep original"
          onAccept={() => void acceptProposal()}
          onReject={() => void rejectProposal()}
          onInsertBelow={() => void acceptProposalInsertBelow()}
          onRegenerate={() => {
            if (!proposal?.action) return;
            if (proposal.action !== 'tone' && proposal.action !== 'rephrase' && isStorycraftCommandId(proposal.action)) {
              void runStorycraft(proposal.action, proposal.scope);
            } else {
              void runAi(proposal.action, proposal.style, proposal.scope);
            }
          }}
          onRegenerateWithInstruction={(instruction) => void runAi('custom', instruction, proposal?.scope, instruction)}
          onClose={() => {
            setReviewOpen(false);
            setContextOpen(false);
          }}
          onShowContextInspector={() => setContextOpen(true)}
        />
      ) : null}

      {contextOpen && proposal ? (
        <div className="fixed right-[412px] top-24 bottom-8 z-40 w-[560px] max-w-[calc(100vw-432px)] sm:top-12">
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
