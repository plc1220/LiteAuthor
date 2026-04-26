import {useEffect, useMemo, useRef, useState} from 'react';
import {Bot, CheckCircle2, Clock, FileWarning, Filter, LocateFixed, Plus, ShieldAlert, TriangleAlert} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import {SecondaryPageNav} from '../components/SecondaryPageNav';
import {api} from '../lib/api';

type FlagRow = {
  id?: string;
  title?: string;
  detail?: string | null;
  scene_id?: string | null;
  event_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type EventRow = {
  id: string;
  title: string;
  story_time: string | null;
  scene_id: string | null;
  has_conflict: boolean;
};

const severityFor = (flag: FlagRow) => {
  const text = `${flag.title ?? ''} ${flag.detail ?? ''}`.toLowerCase();
  if (text.includes('contradiction') || text.includes('mismatch') || text.includes('conflict')) return 'High';
  if (text.includes('maybe') || text.includes('possible') || text.includes('style')) return 'Low';
  return 'Medium';
};

const typeFor = (flag: FlagRow) => {
  const text = `${flag.title ?? ''} ${flag.detail ?? ''}`.toLowerCase();
  if (text.includes('pov')) return 'POV leakage';
  if (text.includes('timeline') || text.includes('event')) return 'Timeline conflict';
  if (text.includes('motif')) return 'Motif over-use';
  if (text.includes('relationship')) return 'Relationship inconsistency';
  if (text.includes('setup') || text.includes('payoff')) return 'Broken setup';
  return 'Knowledge mismatch';
};

export default function ContinuityCheckPanel({onNavigate}: NavigationProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const outline = useProjectStore((s) => s.outline);
  const refreshOutline = useProjectStore((s) => s.refreshOutline);
  const setActiveScene = useProjectStore((s) => s.setActiveScene);

  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [severity, setSeverity] = useState('All');
  const [status, setStatus] = useState('Unresolved');
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = async () => {
    if (!activeProject) return;
    await refreshOutline();
    const [nextFlags, nextEvents] = await Promise.all([api.listFlags(activeProject.id), api.listEvents(activeProject.id)]);
    setFlags(nextFlags as FlagRow[]);
    setEvents(nextEvents as EventRow[]);
  };

  useEffect(() => {
    if (!activeProject) return;
    void reload();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeProject]);

  const scenesById = useMemo(() => new Map((outline?.scenes ?? []).map((scene) => [scene.id, scene])), [outline]);
  const chaptersById = useMemo(() => new Map((outline?.chapters ?? []).map((chapter) => [chapter.id, chapter])), [outline]);
  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  const enriched = useMemo(() => {
    return flags.map((flag) => {
      const scene = flag.scene_id ? scenesById.get(flag.scene_id) : null;
      const chapter = scene ? chaptersById.get(scene.chapter_id) : null;
      const event = flag.event_id ? eventsById.get(flag.event_id) : null;
      return {
        ...flag,
        severity: severityFor(flag),
        type: typeFor(flag),
        sceneTitle: scene?.title ?? 'Unlinked scene',
        chapterTitle: chapter?.title ?? 'Project-wide',
        eventTitle: event?.title ?? null,
      };
    });
  }, [chaptersById, eventsById, flags, scenesById]);

  const filtered = enriched.filter((flag) => {
    const severityOk = severity === 'All' || flag.severity === severity;
    const normalizedStatus = (flag.status ?? 'open').toLowerCase();
    const statusOk =
      status === 'All' ||
      (status === 'Unresolved' && normalizedStatus === 'open') ||
      (status === 'Resolved' && normalizedStatus === 'resolved') ||
      (status === 'Dismissed' && normalizedStatus === 'dismissed') ||
      (status === 'Intentional' && normalizedStatus === 'intentional');
    return severityOk && statusOk;
  });

  const counts = {
    All: enriched.length,
    High: enriched.filter((f) => f.severity === 'High').length,
    Medium: enriched.filter((f) => f.severity === 'Medium').length,
    Low: enriched.filter((f) => f.severity === 'Low').length,
  };

  const runCheck = async () => {
    if (!activeProject) return;
    setIsRunning(true);
    const {id} = await api.startAgentJob(activeProject.id, 'continuity_pass');
    setJob({id, status: 'queued', progress: 0});
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const next = await api.getAgentJob(activeProject.id, id);
        setJob(next);
        if (next.status === 'completed' || next.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setIsRunning(false);
          void reload();
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        setIsRunning(false);
      }
    }, 1000);
  };

  const addManualFlag = async () => {
    if (!activeProject) return;
    const title = window.prompt('Flag title');
    if (!title?.trim()) return;
    const detail = window.prompt('What should be checked?') ?? 'Manual continuity note.';
    await api.createFlag(activeProject.id, {title: title.trim(), detail});
    await reload();
  };

  const updateFlagStatus = async (flagId: string | undefined, nextStatus: 'dismissed' | 'resolved' | 'intentional') => {
    if (!activeProject || !flagId) return;
    await api.patchFlag(activeProject.id, flagId, nextStatus);
    await reload();
  };

  if (!activeProject) {
    return (
      <div className="flex h-screen items-center justify-center bg-parchment text-ink px-6 text-center">
        <div>
          <p className="font-serif text-lg italic mb-4">Select a project before checking continuity.</p>
          <button type="button" className="font-sans text-xs uppercase px-4 py-2 bg-primary text-parchment rounded-sm" onClick={() => onNavigate('StoryWikiHub', 'push_back')}>
            The Codex
          </button>
        </div>
      </div>
    );
  }

  const progress = typeof job?.progress === 'number' ? Math.round(job.progress * 100) : 0;

  return (
    <div className="min-h-screen bg-parchment text-ink">
      <SecondaryPageNav
        eyebrow="Continuity"
        title="Continuity Check"
        projectName={activeProject.name}
        active="manuscript"
        onNavigate={onNavigate}
        actions={
          <>
          <button type="button" className="px-4 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest flex items-center gap-2" onClick={addManualFlag}>
            <Plus className="w-4 h-4" />
            Manual flag
          </button>
          <button type="button" className="px-4 py-2 bg-primary text-parchment rounded-sm text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-60" onClick={() => void runCheck()} disabled={isRunning}>
            <Bot className="w-4 h-4" />
            {isRunning ? 'Running' : 'Run now'}
          </button>
          </>
        }
      />

      <main className="p-8 max-w-6xl mx-auto">
        <section className="border border-oak-variant bg-sepia-low rounded-sm p-5 mb-6">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3 text-sm text-ink-muted">
              <Clock className="w-4 h-4 text-oak" />
              <span>Last loaded from local flags table. Agent results appear after the background pass writes new flags.</span>
            </div>
            {job ? (
              <div className="flex items-center gap-3 min-w-56">
                <span className="text-[10px] uppercase tracking-widest text-ink-muted">{String(job.status ?? 'queued')}</span>
                <div className="h-1 flex-1 bg-sepia-highest rounded-full overflow-hidden">
                  <div className="h-full bg-amber-wax" style={{width: `${progress}%`}} />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="border border-oak-variant bg-sepia-low rounded-sm p-5 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-oak" />
            <h2 className="font-serif text-xl italic">Filter</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['All', 'High', 'Medium', 'Low'] as const).map((label) => (
              <button
                key={label}
                type="button"
                className={`px-3 py-1.5 rounded-full border text-xs uppercase tracking-widest ${severity === label ? 'bg-amber-wax-container text-parchment border-primary' : 'bg-sepia-high border-oak-variant text-ink'}`}
                onClick={() => setSeverity(label)}
              >
                {label} ({counts[label]})
              </button>
            ))}
            <span className="w-px bg-oak-variant mx-2" />
            {['All', 'Unresolved', 'Dismissed', 'Resolved', 'Intentional'].map((label) => (
              <button
                key={label}
                type="button"
                className={`px-3 py-1.5 rounded-full border text-xs uppercase tracking-widest ${status === label ? 'bg-sepia-highest text-primary border-primary' : 'bg-sepia-high border-oak-variant text-ink'}`}
                onClick={() => setStatus(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {filtered.length === 0 ? (
            <div className="border border-oak-variant bg-sepia-low p-10 rounded-sm text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-primary mb-3" />
              <h2 className="font-serif text-2xl italic">No matching continuity flags</h2>
              <p className="text-sm text-ink-muted mt-2">Run an Agent continuity pass or add a manual flag to start the review queue.</p>
            </div>
          ) : null}

          {filtered.map((flag) => {
            const severe = flag.severity === 'High';
            return (
              <article key={flag.id ?? flag.title} className="border border-oak-variant bg-sepia-low rounded-sm p-5">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-sans uppercase tracking-widest ${severe ? 'bg-red-500/20 text-red-200' : flag.severity === 'Medium' ? 'bg-amber-500/20 text-amber-100' : 'bg-sepia-highest text-ink-muted'}`}>
                        <span className={`w-2 h-2 rounded-full ${severe ? 'bg-red-400' : flag.severity === 'Medium' ? 'bg-amber-wax' : 'bg-oak'}`} />
                        {flag.severity}
                      </span>
                      <span className="text-xs font-sans uppercase tracking-widest text-primary">{flag.type}</span>
                      <span className="text-xs text-ink-muted">{flag.chapterTitle} · {flag.sceneTitle}</span>
                    </div>
                    <h3 className="text-xl font-serif font-bold text-ink">{flag.title ?? 'Untitled continuity flag'}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{flag.detail ?? 'No detail was saved with this flag.'}</p>
                    {flag.eventTitle ? <p className="mt-3 text-xs text-ink-muted">Affected event: <span className="text-primary">{flag.eventTitle}</span></p> : null}
                  </div>
                  <ShieldAlert className={`w-6 h-6 shrink-0 ${severe ? 'text-red-300' : 'text-amber-wax'}`} />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest flex items-center gap-2 hover:border-primary"
                    onClick={() => {
                      if (flag.scene_id) setActiveScene(flag.scene_id);
                      onNavigate('ZenEditor', 'push');
                    }}
                  >
                    <LocateFixed className="w-4 h-4" />
                    Go to scene
                  </button>
                  <button type="button" className="px-3 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest" onClick={() => onNavigate('StoryWikiHub', 'push')}>
                    The Codex
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest hover:border-primary"
                    onClick={() => void updateFlagStatus(flag.id, 'dismissed')}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest hover:border-primary"
                    onClick={() => void updateFlagStatus(flag.id, 'resolved')}
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest hover:border-primary"
                    onClick={() => void updateFlagStatus(flag.id, 'intentional')}
                  >
                    Mark intentional
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="mt-8 border border-oak-variant bg-sepia-high p-4 rounded-sm flex items-start gap-3 text-sm text-ink-muted">
          <FileWarning className="w-5 h-5 text-oak shrink-0" />
          <p>Status actions persist to the local continuity flags table. Full automatic re-verification still belongs to the Agent pass.</p>
        </aside>
      </main>
    </div>
  );
}
