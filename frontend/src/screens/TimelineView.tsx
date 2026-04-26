import {useEffect, useState, useCallback} from 'react';
import {Edit3, Users, Clock, BookOpen, History, Settings} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import {api, type Chapter, type Scene} from '../lib/api';
import {TimelineThreadCanvas, type ThreadEvent} from '../components/TimelineThreadCanvas';
import {continuityTension} from '../lib/timelineLayout';

/** Single shared reference so we don't pass a fresh `[]` every render and thrash `TimelineThreadCanvas` layout effects. */
const EMPTY_CHAPTERS: Chapter[] = [];
const EMPTY_SCENES: Scene[] = [];

type EventRow = ThreadEvent;

export default function TimelineView({onNavigate}: NavigationProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const selectProject = useProjectStore((s) => s.selectProject);
  const projects = useProjectStore((s) => s.projects);
  const outline = useProjectStore((s) => s.outline);
  const refreshOutline = useProjectStore((s) => s.refreshOutline);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [flags, setFlags] = useState<Record<string, unknown>[]>([]);
  const load = useCallback(async () => {
    if (!activeProject) {
      return;
    }
    const o = await refreshOutline();
    if (!o) {
      return;
    }
    const [ev, fl] = await Promise.all([api.listEvents(activeProject.id), api.listFlags(activeProject.id)]);
    setEvents(ev as EventRow[]);
    setFlags(fl);
  }, [activeProject, refreshOutline]);

  useEffect(() => {
    if (!activeProject) {
      return;
    }
    void load();
  }, [activeProject, load]);

  const onDropToChapter = async (args: {eventId: string; chapterId: string; sceneId: string; nextNarrativeOrder: number}) => {
    if (!activeProject) {
      return;
    }
    const {eventId, sceneId, nextNarrativeOrder} = args;
    const updated = await api.patchEvent(activeProject.id, eventId, {scene_id: sceneId, narrative_order: nextNarrativeOrder});
    setEvents((prev) => prev.map((e) => (e.id === eventId ? (updated as EventRow) : e)));
    if (selected?.id === eventId) {
      setSelected(updated as EventRow);
    }
  };

  const chList = outline?.chapters ?? EMPTY_CHAPTERS;
  const scList = outline?.scenes ?? EMPTY_SCENES;

  if (!activeProject) {
    return (
      <div className="flex h-screen items-center justify-center bg-parchment text-ink px-6 text-center gap-4">
        <div>
          <p className="font-serif text-lg italic mb-4">Select a project from the Codex first.</p>
          <button type="button" className="font-sans text-xs uppercase px-4 py-2 bg-primary text-parchment rounded-sm" onClick={() => onNavigate('StoryWikiHub', 'push_back')}>
            The Codex
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-parchment">
      <aside className="w-64 bg-sepia-low border-r border-oak-variant flex flex-col z-40">
        <div className="p-6">
          <h1 className="text-lg font-bold uppercase tracking-tighter mb-1 truncate">{activeProject.name}</h1>
          <p className="text-[10px] text-ink-muted font-sans uppercase tracking-widest">Timeline</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 text-ink-muted hover:bg-sepia-highest/50 text-sm bg-transparent border-none cursor-pointer"
            onClick={() => onNavigate('ZenEditor', 'push_back')}
          >
            <Edit3 className="w-4 h-4" />
            <span>Manuscript</span>
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 text-ink-muted hover:bg-sepia-highest/50 text-sm bg-transparent border-none cursor-pointer"
            onClick={() => onNavigate('StoryWikiHub', 'push_back')}
          >
            <Users className="w-4 h-4" />
            <span>The Codex</span>
          </button>
          <div className="w-full flex items-center gap-3 px-4 py-3 bg-sepia-highest text-primary font-bold rounded-r-full text-sm">
            <Clock className="w-4 h-4" />
            <span>Timeline</span>
          </div>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 text-ink-muted hover:bg-sepia-highest/50 text-sm bg-transparent border-none cursor-pointer"
            onClick={() => onNavigate('StoryWikiHub', 'push_back')}
          >
            <BookOpen className="w-4 h-4" />
            <span>Story Bible</span>
          </button>
        </nav>
        <div className="px-6 py-4 space-y-2">
          <label className="text-[10px] font-sans uppercase text-ink-muted">Active project</label>
          <select className="w-full bg-sepia-high border border-oak-variant text-xs p-2 rounded-sm" value={activeProject.id} onChange={(e) => void selectProject(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex justify-between items-center px-6 py-4 bg-sepia-low border-b border-oak-variant z-10 sm:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="text-2xl font-bold italic">Thread</div>
            <div className="h-4 w-px bg-oak-variant" />
            <div className="text-ink-muted font-sans text-[10px] uppercase tracking-widest truncate">The Codex / Timeline</div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <History className="w-5 h-5 text-ink-muted" />
            <Settings className="w-5 h-5 text-ink-muted cursor-pointer hover:text-ink" onClick={() => onNavigate('SettingsScreen', 'push')} />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-y-auto min-w-0 min-h-0 bg-parchment-dim">
            <div className="border-b border-oak-variant/40 bg-parchment/40 px-6 sm:px-8 py-3 text-xs text-ink-muted">
              {events.length} world beat{events.length === 1 ? '' : 's'} — dual-track: story-time above, where it surfaces in the manuscript below.
            </div>

            <div className="p-4 sm:px-8 sm:py-6">
              {chList.length === 0 ? (
                <p className="text-sm text-ink-muted">No chapters in outline — add a chapter in the manuscript, then return.</p>
              ) : (
                <TimelineThreadCanvas
                  events={events}
                  chapters={chList}
                  scenes={scList}
                  selectedId={selected?.id ?? null}
                  onSelect={(e) => setSelected(e)}
                  onDropToChapter={onDropToChapter}
                />
              )}
            </div>
          </div>

          <aside className="w-[min(100%,20rem)] sm:w-[20rem] lg:w-[19rem] shrink-0 bg-sepia-low border-l border-oak-variant overflow-y-auto flex flex-col">
            <div className="p-4 sm:p-6 border-b border-oak-variant">
              <h2 className="text-lg italic font-serif mb-1">Event details</h2>
              {selected ? (
                <>
                  {continuityTension(selected, events).level === 'watch' ? (
                    <p className="text-xs text-ink-muted mb-1">↪ Told out of world-time order — often a memory, frame, or reordered tell.</p>
                  ) : null}
                  {selected.has_conflict || continuityTension(selected, events).level === 'tension' ? (
                    <div className="mb-1 inline-flex items-center gap-2 px-2 py-0.5 bg-amber-100/90 text-amber-900 text-[10px] font-sans uppercase font-bold rounded">
                      {selected.has_conflict ? 'Flagged in data' : 'Pacing / logic'}
                    </div>
                  ) : null}
                  <h3 className="text-xl font-semibold leading-tight text-primary mt-1">{selected.title}</h3>
                </>
              ) : (
                <p className="text-sm text-ink-muted">Select a beat in the world row.</p>
              )}
            </div>
            <div className="flex-1 p-4 sm:p-6 space-y-4">
              {selected ? (
                <>
                  <div>
                    <label className="text-[10px] font-sans uppercase tracking-widest text-ink-muted block mb-1">Story time</label>
                    <p className="italic text-sm">{selected.story_time ?? '—'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-sans uppercase tracking-widest text-ink-muted block mb-1">POV</label>
                    <p className="text-sm">{selected.pov ?? '—'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-sans uppercase tracking-widest text-ink-muted block mb-1">Notes</label>
                    <p className="text-sm text-ink-muted leading-relaxed">{selected.notes ?? '—'}</p>
                  </div>
                  {continuityTension(selected, events).hint && (
                    <div className="rounded-sm border border-amber-500/30 bg-amber-50/30 p-3 text-xs text-ink">
                      {continuityTension(selected, events).hint}
                    </div>
                  )}
                  <button
                    type="button"
                    className="w-full py-2 border border-primary text-primary font-sans text-xs uppercase tracking-widest hover:bg-primary hover:text-parchment-bright font-bold bg-transparent cursor-pointer rounded-sm"
                    onClick={async () => {
                      if (!selected) {
                        return;
                      }
                      await api.createFlag(activeProject.id, {
                        title: `Timeline: ${selected.title}`,
                        detail: selected.notes || 'Flagged from timeline.',
                        scene_id: selected.scene_id,
                        event_id: selected.id,
                      });
                      setFlags(await api.listFlags(activeProject.id));
                    }}
                  >
                    Save as continuity flag
                  </button>
                </>
              ) : null}

              <div>
                <label className="text-[10px] font-sans uppercase tracking-widest text-ink-muted block mb-2">Continuity flags</label>
                <div className="space-y-2 text-xs">
                  {flags.length === 0 ? <span className="text-ink-muted">None yet.</span> : null}
                  {flags.map((f) => (
                    <div key={String(f.id)} className="p-2 border border-oak-variant rounded-sm bg-parchment-bright/40">
                      <div className="font-bold text-primary">{String(f.title)}</div>
                      <div className="text-ink-muted mt-1">{String(f.detail ?? '')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-oak-variant">
              <button
                type="button"
                className="w-full py-2 bg-primary text-parchment text-xs font-sans uppercase tracking-widest font-bold rounded-sm border-none cursor-pointer"
                onClick={() => onNavigate('AgentMode', 'push')}
              >
                Open Agent Mode
              </button>
              <button
                type="button"
                className="mt-2 w-full py-2 border border-oak-variant text-primary text-xs font-sans uppercase tracking-widest font-bold rounded-sm cursor-pointer"
                onClick={() => onNavigate('ContinuityCheckPanel', 'push')}
              >
                Review continuity
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
