import {useRef, useState} from 'react';
import {
  BookOpen,
  UserSearch,
  Map as MapIcon,
  Package,
  Brain,
  History,
  Settings,
  Edit3,
  Save,
  Layers,
  Trash2,
} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import {ManuscriptEditor, type ManuscriptEditorHandle} from '../components/ManuscriptEditor';
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

  if (!activeProject || !activeSceneId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-parchment text-ink px-8 text-center gap-4">
        <p className="font-serif text-xl italic text-ink-muted">Open or create a project to edit the manuscript.</p>
        <button
          type="button"
          className="font-sans text-xs uppercase tracking-widest px-6 py-3 bg-primary text-parchment rounded-sm"
          onClick={() => onNavigate('StoryWikiHub', 'push_back')}
        >
          Go to Story Wiki
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

  const instructionFor = (action: Action, selection: string): {task: string; instruction: string; role: string} => {
    const base = `Selection:\n${selection || '(cursor position)'}`;
    switch (action) {
      case 'refine':
        return {task: 'Refine prose', instruction: `${base}\nTighten and clarify without changing meaning.`, role: 'literary_editor'};
      case 'lyrical':
        return {task: 'More lyrical', instruction: `${base}\nIncrease musicality and image density; keep voice consistent.`, role: 'literary_editor'};
      case 'tension':
        return {task: 'Increase tension', instruction: `${base}\nHeighten stakes through rhythm, detail, and subtext.`, role: 'literary_editor'};
      case 'clarity':
        return {task: 'Improve clarity', instruction: `${base}\nMake the passage easier to follow while preserving tone.`, role: 'literary_editor'};
      case 'continue':
        return {task: 'Continue scene', instruction: `${base}\nContinue for 2–4 sentences in the same voice.`, role: 'literary_editor'};
      case 'continuity':
        return {
          task: 'Continuity question',
          instruction: `${base}\nAnswer whether this passage contradicts likely canon; cite missing facts only.`,
          role: 'continuity_analyst',
        };
      default:
        return {task: 'Assist', instruction: base, role: 'literary_editor'};
    }
  };

  const runAi = async (action: Action) => {
    const handle = editorRef.current;
    if (!handle || !activeProject) return;
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
    const {task, instruction, role} = instructionFor(action, text);
    setAiBusy(true);
    setProposal(null);
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

  return (
    <div className="flex flex-col min-h-screen bg-parchment paper-texture paper-grain">
      <header className="fixed top-0 left-0 right-0 h-10 flex justify-between items-center px-6 z-50 bg-sepia-low border-b border-oak-variant text-ink font-serif text-sm tracking-tight">
        <div className="flex items-center gap-6">
          <span className="italic text-xl font-bold cursor-pointer" onClick={() => onNavigate('StoryWikiHub', 'push_back')}>
            LiteAuthor
          </span>
          <nav className="hidden md:flex items-center gap-4">
            <button
              type="button"
              className="text-ink-muted hover:text-ink transition-colors cursor-pointer bg-transparent border-none font-inherit"
              onClick={() => onNavigate('StoryWikiHub', 'push_back')}
            >
              Project
            </button>
            <span className="text-ink border-b border-ink pb-0.5">Manuscript</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-sepia-mid px-2 py-0.5 rounded-sm">
            <span className="text-[10px] font-sans uppercase tracking-widest text-ink-muted">Zen Mode</span>
            <div className="w-2 h-2 rounded-full bg-amber-wax" />
          </div>
          <span className="text-ink-muted text-xs">{wordCount.toLocaleString()} words</span>
          <History className="w-4 h-4 text-ink-muted hover:text-ink cursor-pointer" onClick={() => onNavigate('VersionHistory', 'push')} />
          <Settings className="w-4 h-4 text-ink-muted hover:text-ink cursor-pointer" onClick={() => onNavigate('SettingsScreen', 'push')} />
        </div>
      </header>

      <div className="flex flex-1 pt-10 overflow-hidden">
        <aside className="bg-sepia-low text-ink font-serif text-sm w-64 border-r border-oak-variant flex flex-col py-4 px-2 hidden lg:flex">
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
                  <div className="px-3 py-2 text-ink font-bold bg-sepia-high rounded-sm flex items-center gap-3">
                    <Edit3 className="w-4 h-4 shrink-0" />
                    <span className="truncate flex-1">{ch.title}</span>
                    <button
                      type="button"
                      className="p-1 rounded-sm text-ink-muted hover:text-red-200 hover:bg-sepia-mid disabled:opacity-30"
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
                          className={`flex items-center gap-1 rounded-sm ${
                            sc.id === activeSceneId ? 'text-primary font-bold border-l-2 border-primary -ml-3 pl-6' : 'text-ink-muted hover:text-primary'
                          }`}
                        >
                          <button type="button" onClick={() => setActiveScene(sc.id)} className="min-w-0 flex-1 text-left px-3 py-1.5 text-xs bg-transparent border-none">
                            <span className="block truncate">{sc.title}</span>
                          </button>
                          <button
                            type="button"
                            className="p-1 mr-1 rounded-sm text-ink-muted hover:text-red-200 hover:bg-sepia-mid disabled:opacity-30"
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

        <main className="flex-1 overflow-y-auto relative py-12 flex justify-center">
          <div className="max-w-[760px] w-full px-8 bg-parchment-bright shadow-xl min-h-[1100px] py-16 relative paper-stack">
            <header className="mb-8 text-center">
              <p className="font-sans text-xs text-ink-muted uppercase tracking-widest mb-2 font-bold">
                {activeChapter?.title ?? 'Chapter'}
              </p>
              <h1 className="text-3xl font-semibold italic text-primary mb-3">
                {outline?.scenes.find((s) => s.id === activeSceneId)?.title ?? 'Scene'}
              </h1>
              <div className="w-16 h-px bg-oak-variant mx-auto mb-6" />
            </header>

            <SelectionToolbar disabled={aiBusy} onAction={(a) => void runAi(a)} />

            <ManuscriptEditor
              ref={editorRef}
              projectId={activeProject.id}
              sceneId={activeSceneId}
              onSaved={() => {
                setSavedPulse(true);
                setTimeout(() => setSavedPulse(false), 900);
              }}
              onStats={setWordCount}
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

          <button
            type="button"
            className="fixed bottom-12 right-72 bg-amber-wax text-parchment rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all z-40 border-4 border-white"
            title="Snapshot"
            onClick={() => void api.createSnapshot(activeProject.id, 'manual')}
          >
            <Save className="w-6 h-6" />
          </button>
        </main>

        <aside className="w-12 border-l border-oak-variant bg-sepia-low flex flex-col items-center py-6 gap-6 z-50">
          <div className="p-2 hover:bg-sepia-mid cursor-pointer rounded-sm group relative">
            <UserSearch className="w-5 h-5 text-primary" />
            <div className="absolute right-full mr-2 px-2 py-1 bg-primary text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none font-sans uppercase">
              Characters
            </div>
          </div>
          <button
            type="button"
            className="p-2 hover:bg-sepia-mid cursor-pointer rounded-sm group relative bg-transparent border-none"
            onClick={() => onNavigate('ContinuityCheckPanel', 'push')}
          >
            <BookOpen className="w-5 h-5 text-primary" />
            <div className="absolute right-full mr-2 px-2 py-1 bg-primary text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none font-sans uppercase">
              Continuity
            </div>
          </button>
          <button
            type="button"
            className="p-2 hover:bg-sepia-mid cursor-pointer rounded-sm group relative bg-transparent border-none"
            onClick={() => onNavigate('StoryWikiHub', 'push_back')}
          >
            <MapIcon className="w-5 h-5 text-primary" />
            <div className="absolute right-full mr-2 px-2 py-1 bg-primary text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none font-sans uppercase">
              Story Wiki
            </div>
          </button>
          <button
            type="button"
            className="p-2 hover:bg-sepia-mid cursor-pointer rounded-sm group relative bg-transparent border-none"
            onClick={() => onNavigate('VersionHistory', 'push')}
          >
            <Package className="w-5 h-5 text-primary" />
            <div className="absolute right-full mr-2 px-2 py-1 bg-primary text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none font-sans uppercase">
              Artifacts
            </div>
          </button>
          <button
            type="button"
            className="p-2 hover:bg-sepia-mid cursor-pointer rounded-sm group relative bg-transparent border-none"
            onClick={() => onNavigate('MotifThemePanel', 'push')}
          >
            <Layers className="w-5 h-5 text-primary" />
            <div className="absolute right-full mr-2 px-2 py-1 bg-primary text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none font-sans uppercase">
              Motifs
            </div>
          </button>
          <button
            type="button"
            className="mt-auto p-2 hover:bg-sepia-mid cursor-pointer rounded-sm group relative bg-transparent border-none"
            onClick={() => onNavigate('AgentMode', 'push')}
          >
            <Brain className="w-5 h-5 text-primary" />
            <div className="absolute right-full mr-2 px-2 py-1 bg-primary text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none font-sans uppercase">
              AI Agent
            </div>
          </button>
        </aside>
      </div>

      <footer className="h-8 bg-sepia-high border-t border-oak-variant flex items-center justify-between px-6 text-[10px] font-sans text-ink-muted uppercase tracking-widest z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${savedPulse ? 'bg-amber-wax' : 'bg-green-600'}`} />
            <span>{savedPulse ? 'Saving…' : 'Saved'}</span>
          </div>
          <span className="text-oak">|</span>
          <span>Scene packet mode</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="font-bold text-primary">Words: {wordCount.toLocaleString()}</span>
          <div className="bg-primary text-parchment px-3 py-1 rounded-sm text-[9px] font-bold">ZEN ACTIVE</div>
        </div>
      </footer>

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
    </div>
  );
}
