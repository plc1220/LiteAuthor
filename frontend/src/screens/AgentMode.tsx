import {useEffect, useRef, useState} from 'react';
import {Bot, X, Send as SendIcon, Hourglass, Settings as SettingsIcon, Sparkles as SparklesIcon} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import {api} from '../lib/api';

export default function AgentMode({onNavigate}: NavigationProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [chat, setChat] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startJob = async () => {
    if (!activeProject) return;
    const {id} = await api.startAgentJob(activeProject.id, 'continuity_pass');
    setJobId(id);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const j = await api.getAgentJob(activeProject.id, id);
        setJob(j);
        if (j.status === 'completed' || j.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 900);
  };

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-parchment text-ink gap-4 px-6 text-center">
        <p className="font-serif text-lg italic">Select a project from Story Wiki.</p>
        <button type="button" className="font-sans text-xs uppercase px-4 py-2 bg-primary text-parchment rounded-sm border-none cursor-pointer" onClick={() => onNavigate('StoryWikiHub', 'push_back')}>
          Story Wiki
        </button>
      </div>
    );
  }

  const steps = Array.isArray(job?.steps_json) ? (job?.steps_json as {name: string; output: string}[]) : [];
  const progress = typeof job?.progress === 'number' ? Math.round(job.progress * 100) : 0;

  return (
    <div className="flex flex-col h-screen bg-parchment paper-grain">
      <header className="fixed top-0 left-0 right-0 h-10 flex justify-between items-center px-6 z-50 bg-sepia-low border-b border-oak-variant font-serif text-sm text-primary">
        <div className="flex items-center gap-8">
          <span className="italic text-xl font-bold">LiteAuthor</span>
          <nav className="flex gap-4">
            <button type="button" className="text-ink-muted hover:text-primary transition-colors cursor-pointer bg-transparent border-none font-inherit" onClick={() => onNavigate('StoryWikiHub', 'push_back')}>
              Project
            </button>
            <span className="text-primary border-b border-primary pb-0.5">Agent</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-0.5 bg-amber-wax-container/20 rounded-full border border-amber-wax/10">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-wax animate-pulse" />
            <span className="font-sans text-[11px] uppercase tracking-widest text-amber-wax font-bold">Agent</span>
          </div>
          <Hourglass className="w-4 h-4 text-ink-muted" />
          <SettingsIcon className="w-4 h-4 text-ink-muted" />
          <button type="button" className="bg-primary text-parchment px-3 py-1 text-[10px] font-bold uppercase rounded-sm border-none cursor-pointer" onClick={() => onNavigate('ZenEditor', 'none')}>
            Zen Mode
          </button>
        </div>
      </header>

      <div className="flex flex-1 pt-10 overflow-hidden">
        <main className="flex-1 overflow-y-auto flex justify-center py-16 bg-parchment-dim shadow-inner">
          <div className="max-w-[720px] w-full px-12 text-ink">
            <div className="mb-10 text-center text-ink-muted">
              <span className="font-sans text-amber-wax uppercase tracking-[0.2em] text-[12px] block mb-2">LiteAuthor</span>
              <h1 className="text-3xl font-semibold text-primary italic">Agent Mode</h1>
              <p className="mt-4 text-sm font-serif">Runs a multi-step continuity → planning → editorial pass using your scene packet builder.</p>
            </div>
            <article className="prose prose-invert font-serif text-lg leading-relaxed space-y-6 text-justify opacity-80">
              <p>
                Agent jobs execute on the FastAPI backend (background worker). When your local OpenAI-compatible server is running, you will see
                intermediate outputs appear in the rail.
              </p>
              <div className="flex justify-center opacity-30 py-6">
                <SparklesIcon className="w-8 h-8" />
              </div>
            </article>
            <div className="mt-10 flex gap-3">
              <button type="button" className="px-4 py-2 bg-primary text-parchment text-xs font-sans uppercase tracking-widest font-bold rounded-sm border-none cursor-pointer" onClick={() => void startJob()}>
                Start sample job
              </button>
              {jobId ? <span className="text-xs font-mono text-ink-muted self-center">job: {jobId.slice(0, 8)}…</span> : null}
            </div>
            {job?.error ? <p className="mt-4 text-sm text-red-300">Error: {String(job.error)}</p> : null}
          </div>
        </main>

        <aside className="w-[320px] bg-sepia-mid border-l border-oak-variant flex flex-col h-full shadow-lg z-20">
          <div className="p-4 border-b border-oak-variant bg-sepia-high flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot className="text-amber-wax w-4 h-4" />
              <h3 className="font-sans text-xs uppercase tracking-wider text-primary font-bold">LiteAuthor Agent</h3>
            </div>
            <button type="button" className="bg-transparent border-none cursor-pointer" onClick={() => onNavigate('ZenEditor', 'none')}>
              <X className="w-4 h-4 text-ink-muted hover:text-primary" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[10px] uppercase text-ink-muted tracking-widest">Job status</span>
                <span className="font-sans text-[10px] text-amber-wax">{String(job?.status ?? 'idle')}</span>
              </div>
              <div className="p-3 bg-sepia-highest border-l-4 border-amber-wax rounded-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-sans text-[12px] font-bold">Progress</span>
                  <span className="text-[10px] font-sans text-amber-wax italic">{progress}%</span>
                </div>
                <div className="w-full h-1 bg-sepia-low rounded-full overflow-hidden">
                  <div className="h-full bg-amber-wax transition-all" style={{width: `${progress}%`}} />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-oak-variant/50 space-y-4">
              <span className="font-sans text-[10px] uppercase text-ink-muted tracking-widest">Steps</span>
              <div className="space-y-3 text-[11px] leading-snug text-ink-muted">
                {steps.length === 0 ? <p>No job output yet.</p> : null}
                {steps.map((s) => (
                  <div key={s.name} className="border border-oak-variant rounded-sm p-2 bg-parchment-bright/30">
                    <div className="font-sans text-[10px] uppercase text-primary font-bold mb-1">{s.name}</div>
                    <pre className="whitespace-pre-wrap font-serif text-ink/90">{s.output}</pre>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 bg-sepia-highest border-t border-oak-variant">
            <div className="relative">
              <input
                className="w-full bg-sepia-mid border-b border-oak-variant py-2 pr-10 pl-2 text-xs italic font-serif focus:outline-none focus:border-amber-wax tracking-wide transition-colors placeholder:text-oak/50"
                placeholder="Ask Agent…"
                type="text"
                value={chat}
                onChange={(e) => setChat(e.target.value)}
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer" title="Not wired in MVP">
                <SendIcon className="w-4 h-4 text-oak hover:text-amber-wax" />
              </button>
            </div>
            <p className="mt-2 text-[9px] text-ink-muted italic">MVP: use “Start sample job” for orchestration.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
