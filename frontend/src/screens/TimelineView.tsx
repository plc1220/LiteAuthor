import {useEffect, useState, useCallback} from 'react';
import {AlertTriangle, Clock, Flag, GitBranch, Settings} from 'lucide-react';
import {NavigationProps} from '../types';
import {AppScaffold} from '../components/AppScaffold';
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
          <p className="font-serif text-lg italic mb-4">Select a project from the Wiki first.</p>
          <button type="button" className="font-sans text-xs uppercase px-4 py-2 bg-primary text-parchment rounded-sm" onClick={() => onNavigate('WikiHub', 'push_back')}>
            Wiki
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppScaffold
      active="desk"
      onNavigate={onNavigate}
      mainClassName="overflow-hidden"
      actions={
        <button type="button" className="rounded-sm p-2 hover:bg-sepia-high" onClick={() => onNavigate('SettingsScreen', 'push')} title="Settings">
          <Settings className="h-4 w-4 text-ink-muted hover:text-ink" />
        </button>
      }
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-oak-variant bg-sepia-low/60 lg:w-56 lg:border-b-0 lg:border-r">
          <div className="p-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Timeline</p>
            <h1 className="mt-1 font-serif text-xl italic text-primary">Thread</h1>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted/90">
              Chronology above, manuscript reveal order below. Anchor events to chapters to keep the story readable.
            </p>
          </div>
          <div className="border-t border-oak-variant/60 p-3">
            <label className="block font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Active project</label>
            <select
              className="mt-2 w-full rounded-sm border border-oak-variant bg-sepia-high px-2 py-2 font-sans text-xs text-ink outline-none focus:border-primary"
              value={activeProject.id}
              onChange={(e) => void selectProject(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-px border-t border-oak-variant/60 bg-oak-variant/50 text-center lg:block lg:bg-transparent">
            <div className="bg-sepia-low px-3 py-3 lg:border-b lg:border-oak-variant/50">
              <p className="font-serif text-xl italic text-primary">{events.length}</p>
              <p className="font-sans text-[9px] uppercase tracking-widest text-ink-muted">Beats</p>
            </div>
            <div className="bg-sepia-low px-3 py-3 lg:border-b lg:border-oak-variant/50">
              <p className="font-serif text-xl italic text-primary">{chList.length}</p>
              <p className="font-sans text-[9px] uppercase tracking-widest text-ink-muted">Chapters</p>
            </div>
            <div className="bg-sepia-low px-3 py-3">
              <p className="font-serif text-xl italic text-primary">{flags.length}</p>
              <p className="font-sans text-[9px] uppercase tracking-widest text-ink-muted">Flags</p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <section className="min-h-0 min-w-0 overflow-y-auto p-4 md:p-6">
            <header className="mb-4 border-b border-oak-variant pb-3">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Story order map</p>
              <h2 className="mt-1 font-serif text-2xl italic text-primary">Timeline</h2>
            </header>

            {chList.length === 0 ? (
              <div className="rounded-sm border border-oak-variant bg-parchment-bright/90 p-4 text-sm text-ink-muted">
                No chapters in outline. Add a chapter in the manuscript, then return.
              </div>
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
          </section>

          <aside className="min-h-0 overflow-y-auto border-t border-oak-variant bg-sepia-low/60 lg:border-l lg:border-t-0">
            <div className="border-b border-oak-variant p-4">
              <div className="flex items-center gap-2 text-primary">
                <Clock className="h-4 w-4" />
                <h2 className="font-sans text-[10px] font-bold uppercase tracking-widest">Event details</h2>
              </div>
              {selected ? (
                <>
                  <h3 className="mt-3 font-serif text-xl italic leading-tight text-primary">{selected.title}</h3>
                  {selected.has_conflict || continuityTension(selected, events).level === 'tension' ? (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-amber-wax/40 bg-amber-wax-container/40 px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-widest text-secondary">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {selected.has_conflict ? 'Flagged' : 'Review timing'}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">Select a beat in the chronology row to inspect its reveal, notes, and continuity state.</p>
              )}
            </div>

            <div className="space-y-5 p-4 text-sm">
              {selected ? (
                <>
                  <dl className="space-y-4">
                    <div>
                      <dt className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Story time</dt>
                      <dd className="mt-1 font-serif text-base italic text-ink">{selected.story_time ?? 'Unmarked'}</dd>
                    </div>
                    <div>
                      <dt className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">POV</dt>
                      <dd className="mt-1 text-ink">{selected.pov ?? 'Unassigned'}</dd>
                    </div>
                    <div>
                      <dt className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Notes</dt>
                      <dd className="mt-1 leading-relaxed text-ink-muted">{selected.notes ?? 'No notes yet.'}</dd>
                    </div>
                  </dl>

                  {continuityTension(selected, events).hint ? (
                    <div className="rounded-sm border border-amber-wax/30 bg-parchment-bright/70 p-3 text-xs leading-relaxed text-ink">
                      {continuityTension(selected, events).hint}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-primary px-3 py-2 font-sans text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-parchment-bright"
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
                    <Flag className="h-3.5 w-3.5" />
                    Save continuity flag
                  </button>
                </>
              ) : null}

              <div>
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <GitBranch className="h-4 w-4" />
                  <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest">Continuity flags</h3>
                </div>
                <div className="space-y-2 text-xs">
                  {flags.length === 0 ? <span className="text-ink-muted">None yet.</span> : null}
                  {flags.map((f) => (
                    <div key={String(f.id)} className="rounded-sm border border-oak-variant bg-parchment-bright/70 p-3">
                      <div className="font-bold text-primary">{String(f.title)}</div>
                      <div className="mt-1 leading-relaxed text-ink-muted">{String(f.detail ?? '')}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 border-t border-oak-variant pt-4">
                <button
                  type="button"
                  className="w-full rounded-sm bg-primary px-3 py-2 font-sans text-[10px] font-bold uppercase tracking-widest text-parchment"
                  onClick={() => onNavigate('AgentMode', 'push')}
                >
                  Open Agent Mode
                </button>
                <button
                  type="button"
                  className="w-full rounded-sm border border-oak-variant px-3 py-2 font-sans text-[10px] font-bold uppercase tracking-widest text-primary hover:border-primary"
                  onClick={() => onNavigate('ContinuityCheckPanel', 'push')}
                >
                  Review continuity
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppScaffold>
  );
}
