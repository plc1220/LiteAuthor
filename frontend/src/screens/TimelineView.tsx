import {useEffect, useMemo, useState} from 'react';
import {Edit3, Users, Clock, BookOpen, Plus, History, Settings, Info, TriangleAlert} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import {api} from '../lib/api';

type EventRow = {
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
};

export default function TimelineView({onNavigate}: NavigationProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const selectProject = useProjectStore((s) => s.selectProject);
  const projects = useProjectStore((s) => s.projects);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [flags, setFlags] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!activeProject) return;
    (async () => {
      const [ev, fl] = await Promise.all([api.listEvents(activeProject.id), api.listFlags(activeProject.id)]);
      setEvents(ev as EventRow[]);
      setFlags(fl);
    })();
  }, [activeProject]);

  const revealCards = useMemo(() => {
    return [...events]
      .filter((e) => e.narrative_order != null)
      .sort((a, b) => (a.narrative_order ?? 0) - (b.narrative_order ?? 0))
      .map((e) => ({
        title: e.title,
        pov: (e.pov ?? '—').toUpperCase(),
        issue: e.has_conflict,
        italic: Boolean(e.notes?.toLowerCase().includes('flash')),
      }));
  }, [events]);

  if (!activeProject) {
    return (
      <div className="flex h-screen items-center justify-center bg-parchment text-ink px-6 text-center gap-4">
        <div>
          <p className="font-serif text-lg italic mb-4">Select a project from Story Wiki first.</p>
          <button type="button" className="font-sans text-xs uppercase px-4 py-2 bg-primary text-parchment rounded-sm" onClick={() => onNavigate('StoryWikiHub', 'push_back')}>
            Story Wiki
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
          <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-ink-muted hover:bg-sepia-highest/50 text-sm bg-transparent border-none cursor-pointer" onClick={() => onNavigate('ZenEditor', 'push_back')}>
            <Edit3 className="w-4 h-4" />
            <span>Manuscript</span>
          </button>
          <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-ink-muted hover:bg-sepia-highest/50 text-sm bg-transparent border-none cursor-pointer" onClick={() => onNavigate('StoryWikiHub', 'push_back')}>
            <Users className="w-4 h-4" />
            <span>Characters</span>
          </button>
          <div className="w-full flex items-center gap-3 px-4 py-3 bg-sepia-highest text-primary font-bold rounded-r-full text-sm">
            <Clock className="w-4 h-4" />
            <span>Timeline</span>
          </div>
          <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-ink-muted hover:bg-sepia-highest/50 text-sm bg-transparent border-none cursor-pointer" onClick={() => onNavigate('StoryWikiHub', 'push_back')}>
            <BookOpen className="w-4 h-4" />
            <span>World Bible</span>
          </button>
        </nav>
        <div className="px-6 py-4 space-y-2">
          <label className="text-[10px] font-sans uppercase text-ink-muted">Active project</label>
          <select
            className="w-full bg-sepia-high border border-oak-variant text-xs p-2 rounded-sm"
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
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="flex justify-between items-center px-8 py-4 bg-sepia-low border-b border-oak-variant z-10">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold italic">Manuscript</div>
            <div className="h-4 w-px bg-oak-variant" />
            <div className="text-ink-muted font-sans text-[10px] uppercase tracking-widest">Project &gt; Timeline</div>
          </div>
          <div className="flex items-center gap-4">
            <History className="w-5 h-5 text-ink-muted" />
            <Settings className="w-5 h-5 text-ink-muted cursor-pointer hover:text-ink" onClick={() => onNavigate('SettingsScreen', 'push')} />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-x-auto overflow-y-hidden bg-parchment-dim relative">
            <div className="px-8 py-4 border-b border-oak-variant flex items-center justify-between bg-parchment/50">
              <span className="text-xs font-sans uppercase tracking-widest text-ink-muted">Events loaded: {events.length}</span>
            </div>

            <div className="flex-1 relative min-w-[1200px]">
              <section className="h-1/2 relative border-b border-oak-variant/30">
                <div className="absolute top-4 left-8 text-[10px] font-sans uppercase tracking-[0.3em] text-ink-muted/50">Story Time (Chronology)</div>
                <div className="flex h-full pt-16 px-8 gap-6 overflow-x-auto">
                  {events
                    .filter((e) => e.story_time)
                    .map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setSelected(e)}
                        className="min-w-[200px] text-left border border-oak-variant bg-parchment-bright p-4 rounded-sm hover:border-primary bg-transparent cursor-pointer"
                      >
                        <div className="text-xs font-serif italic font-bold text-primary">{e.title}</div>
                        <div className="text-[9px] font-sans text-ink-muted mt-2">{e.story_time}</div>
                        {e.has_conflict ? (
                          <div className="mt-2 flex items-center gap-1 text-amber-500 text-[10px] font-sans uppercase">
                            <TriangleAlert className="w-3 h-3" /> conflict
                          </div>
                        ) : null}
                      </button>
                    ))}
                </div>
              </section>

              <section className="h-1/2 relative bg-sepia-low/20">
                <div className="absolute top-4 left-8 text-[10px] font-sans uppercase tracking-[0.3em] text-ink-muted/50">Narrative Reveal Order</div>
                <div className="flex h-full items-center px-12 gap-8 overflow-x-auto">
                  {revealCards.map((card, i) => (
                    <div key={i} className="flex flex-col gap-2 shrink-0">
                      <span className="text-[10px] font-sans text-ink-muted opacity-40 uppercase tracking-widest text-center">#{i + 1}</span>
                      <div className={`w-48 p-4 border border-oak-variant rounded-sm bg-parchment-bright ${card.italic ? 'italic' : ''} ${card.issue ? 'border-amber-500/50' : ''}`}>
                        <p className="text-sm font-bold">{card.title}</p>
                        <div className="mt-2 flex justify-between items-center">
                          <span className="text-[9px] font-sans px-2 py-0.5 rounded font-bold bg-primary/10 text-primary">{card.pov}</span>
                          {card.issue ? <Info className="w-3 h-3 text-amber-500" /> : <Plus className="w-3 h-3 text-oak-variant rotate-45" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <aside className="w-[320px] bg-sepia-low border-l border-oak-variant overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-oak-variant">
              <h2 className="text-xl italic font-serif mb-2">Event Details</h2>
              {selected ? (
                <>
                  {selected.has_conflict ? (
                    <div className="inline-flex items-center gap-2 mb-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-sans uppercase font-bold rounded">Conflict</div>
                  ) : null}
                  <h3 className="text-2xl font-semibold leading-tight">{selected.title}</h3>
                </>
              ) : (
                <p className="text-sm text-ink-muted">Select an event card.</p>
              )}
            </div>
            <div className="flex-1 p-6 space-y-6">
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
                  <button
                    type="button"
                    className="w-full py-2 border border-primary text-primary font-sans text-xs uppercase tracking-widest hover:bg-primary hover:text-parchment-bright font-bold bg-transparent cursor-pointer rounded-sm"
                    onClick={async () => {
                      if (!selected) return;
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
            <div className="p-6 border-t border-oak-variant">
              <button type="button" className="w-full py-2 bg-primary text-parchment text-xs font-sans uppercase tracking-widest font-bold rounded-sm border-none cursor-pointer" onClick={() => onNavigate('AgentMode', 'push')}>
                Open Agent Mode
              </button>
              <button type="button" className="mt-2 w-full py-2 border border-oak-variant text-primary text-xs font-sans uppercase tracking-widest font-bold rounded-sm cursor-pointer" onClick={() => onNavigate('ContinuityCheckPanel', 'push')}>
                Review continuity
              </button>
            </div>
          </aside>
        </div>
      </main>

      <button type="button" className="fixed bottom-8 right-8 w-14 h-14 bg-amber-wax text-parchment-bright rounded-full flex items-center justify-center shadow-lg border-none cursor-pointer" title="Placeholder">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
