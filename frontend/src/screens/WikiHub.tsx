import {useEffect, useState} from 'react';
import {Search, History, Settings, Layers3, TriangleAlert, ListTree, BookMarked} from 'lucide-react';
import {NavigationProps} from '../types';
import {AppScaffold} from '../components/AppScaffold';
import {useProjectStore} from '../stores/projectStore';
import {api} from '../lib/api';
import {MOTIFS_WIKI_PATH} from '../components/MotifTrackerPanel';
import {setWikiOpen} from '../lib/wikiOpen';

function noteLabel(path: string) {
  return path.replace(/^story\//, '').replace(/\.md$/i, '');
}

function formatMemoryDepth(wikiChars: number) {
  if (wikiChars < 1000) return `${wikiChars.toLocaleString()} chars`;
  if (wikiChars < 10_000) return `${(wikiChars / 1000).toFixed(1)}k reference chars`;
  return `${Math.round(wikiChars / 1000)}k reference chars`;
}

export default function WikiHub({onNavigate}: NavigationProps) {
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const selectProject = useProjectStore((s) => s.selectProject);
  const activeProject = useProjectStore((s) => s.activeProject);
  const lastError = useProjectStore((s) => s.lastError);

  const [stats, setStats] = useState<{
    chars: number;
    wiki_chars: number;
    character_files: number;
    word_count: number;
    open_continuity_flags: number;
  } | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, unknown>[]>([]);
  const [wikiTree, setWikiTree] = useState<{path: string; is_dir: boolean}[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<{path: string; line: number | null; snippet: string}[]>([]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!activeProject) {
      setStats(null);
      setWikiTree([]);
      return;
    }
    (async () => {
      try {
        const [s, tree] = await Promise.all([api.projectStats(activeProject.id), api.wikiTree(activeProject.id)]);
        setStats(s);
        setWikiTree(tree);
        try {
          setSnapshots(await api.listSnapshots(activeProject.id));
        } catch {
          setSnapshots([]);
        }
      } catch {
        setStats(null);
      }
    })();
  }, [activeProject]);

  const runSearch = async () => {
    if (!activeProject || !searchQ.trim()) {
      setSearchHits([]);
      return;
    }
    const res = await api.search(activeProject.id, searchQ.trim());
    setSearchHits(res.hits);
  };

  const wikiFiles = wikiTree.filter((n) => !n.is_dir && n.path.endsWith('.md'));
  const activeProjectId = activeProject?.id ?? '';
  const openGaps = stats?.open_continuity_flags ?? 0;

  return (
    <AppScaffold
      active="desk"
      onNavigate={onNavigate}
      actions={
        <>
          <label className="relative block min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-oak" />
            <input
              className="w-full rounded-sm border border-oak-variant bg-sepia-low py-2 pl-9 pr-3 text-xs font-sans outline-none placeholder:italic placeholder:text-ink-muted/70 focus:border-primary md:w-64"
              placeholder="Search manuscript and wiki…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
            />
          </label>
          <button
            type="button"
            className="rounded-sm border border-oak-variant px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-primary hover:border-primary"
            onClick={() => void runSearch()}
          >
            Go
          </button>
          <button type="button" className="p-2 hover:bg-sepia-high rounded-sm bg-transparent border-none" onClick={() => onNavigate('VersionHistory', 'push')} title="Version history">
            <History className="text-primary-container w-5 h-5" />
          </button>
          <button type="button" className="p-2 hover:bg-sepia-high rounded-sm bg-transparent border-none" onClick={() => onNavigate('SettingsScreen', 'push')} title="Settings">
            <Settings className="text-primary-container w-5 h-5" />
          </button>
        </>
      }
    >
      {lastError ? (
        <div className="px-8 py-3 bg-red-950/40 text-red-100 text-xs font-sans">API: {lastError} — start backend: <code className="text-amber-200">npm run api</code></div>
      ) : null}

      <main className="mx-auto max-w-[1200px] px-5 py-7 md:px-8">
        <section className="mb-4 flex flex-col gap-4 border-b border-oak-variant pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">{activeProject?.name ?? 'No project selected'}</p>
            <h1 className="mt-1 text-4xl font-semibold italic text-primary">Wiki</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
              Throw loose ideas into the Canvas. Distill them into Timeline and Wiki canon. Then return to the manuscript with cleaner context.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 min-w-52 rounded-sm border border-oak-variant bg-sepia-low px-3 font-serif text-sm italic text-primary outline-none"
              value={activeProjectId}
              onChange={(event) => {
                if (event.target.value) void selectProject(event.target.value);
              }}
            >
              <option value="">Choose project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button type="button" className="h-10 rounded-sm bg-primary px-4 font-sans text-xs font-bold uppercase tracking-widest text-parchment-bright" onClick={() => onNavigate('ZenEditor', 'push')}>
              Continue writing
            </button>
            <button
              type="button"
              className="h-10 rounded-sm border border-oak-variant px-4 font-sans text-xs font-bold uppercase tracking-widest text-primary hover:border-primary"
              onClick={() => onNavigate('ProjectSetupWizard', 'slide_up')}
            >
              New project
            </button>
          </div>
        </section>

        {activeProject && stats ? (
          <div className="mb-8 flex flex-wrap gap-x-8 gap-y-3 border-b border-oak-variant/80 pb-6 text-sm">
            <div>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Words</p>
              <p className="mt-0.5 font-serif text-2xl tabular-nums text-primary">{(stats.word_count ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Cast</p>
              <p className="mt-0.5 font-serif text-2xl tabular-nums text-primary">{stats.character_files ?? 0}</p>
            </div>
            <div>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Memory depth</p>
              <p className="mt-0.5 font-serif text-xl text-primary" title="Volume of wiki reference the AI can draw on">
                {formatMemoryDepth(stats.wiki_chars ?? 0)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-8">
          <section>
            <h2 className="mb-1 font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Build</h2>
            <p className="mb-4 text-xs text-ink-muted/90">Canvas for source packets, Timeline for order, Wiki for canon.</p>
            <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="flex w-full min-h-[8.5rem] items-start gap-4 rounded-sm border border-primary/20 bg-parchment-bright p-5 text-left shadow-sm hover:border-primary/50 hover:bg-sepia-low"
                onClick={() => onNavigate('Canvas', 'push')}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-oak-variant bg-sepia-high text-primary">
                  <Layers3 className="h-6 w-6" />
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block font-sans text-sm font-bold uppercase tracking-widest text-primary">Canvas</span>
                  <span className="mt-0.5 block text-[10px] font-sans font-semibold uppercase tracking-widest text-ink-muted/80">Source window</span>
                  <span className="mt-1 block text-sm leading-6 text-ink-muted">Drop notes, fragments, images, and scene ideas. LiteAuthor distills them into cards.</span>
                </span>
              </button>
              <button
                type="button"
                className="flex w-full min-h-[8.5rem] items-start gap-4 rounded-sm border border-oak-variant bg-parchment-bright p-5 text-left shadow-sm hover:border-primary/50 hover:bg-sepia-low"
                onClick={() => onNavigate('TimelineView', 'push')}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-oak-variant bg-sepia-high text-primary">
                  <ListTree className="h-6 w-6" />
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block font-sans text-sm font-bold uppercase tracking-widest text-primary">Timeline</span>
                  <span className="mt-0.5 block text-[10px] font-sans font-semibold uppercase tracking-widest text-ink-muted/80">The order</span>
                  <span className="mt-1 block text-sm leading-6 text-ink-muted">Pin what matters to a sequence: events, reveals, and the active thread of the plot.</span>
                </span>
              </button>
            </div>
          </section>

          <section className="max-w-3xl">
            <h2 className="mb-1 font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Bible</h2>
            <p className="mb-4 text-xs text-ink-muted/90">One place for character notes, world lore, and tracked motifs (with heatmaps) tied to the manuscript.</p>
            <button
              type="button"
              className="flex w-full min-h-[7.5rem] items-start gap-4 rounded-sm border border-primary/25 bg-sepia-low/80 p-5 text-left shadow-sm hover:border-primary/50 hover:bg-sepia-mid/40"
              onClick={() => onNavigate('Wiki', 'push')}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-oak-variant bg-parchment-bright text-primary">
                <BookMarked className="h-6 w-6" />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block font-sans text-sm font-bold uppercase tracking-widest text-primary">Wiki</span>
                <span className="mt-0.5 block text-[10px] font-sans font-semibold uppercase tracking-widest text-ink-muted/80">Canon</span>
                <span className="mt-1 block text-sm leading-6 text-ink-muted">
                  Characters, places, world rules, motifs, and unresolved questions the editor can remember while you write. {wikiFiles.length} reference file{wikiFiles.length === 1 ? '' : 's'} in this project.
                </span>
              </span>
            </button>
          </section>
        </div>

        {activeProject ? (
          <section className="mt-10 border-t border-oak-variant pt-6">
            <h2 className="mb-1 font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Refine</h2>
            <p className="mb-4 max-w-2xl text-xs text-ink-muted/90">Your safety net and history—checks and snapshots without blocking the workbenches above.</p>
            <div className="grid max-w-3xl gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
              <button
                type="button"
                className="flex min-h-20 items-center gap-4 rounded-sm border border-oak-variant bg-sepia-low p-4 text-left hover:border-primary/50"
                onClick={() => onNavigate('ContinuityCheckPanel', 'push')}
              >
                <span className="text-primary">
                  <TriangleAlert className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-sans text-xs font-bold uppercase tracking-widest text-primary">Continuity</span>
                  {openGaps > 0 ? (
                    <span className="mt-1 block text-sm text-primary">
                      {openGaps} unresolved story gap{openGaps === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs text-ink-muted">No open gaps in the queue</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className="flex min-h-20 flex-col items-stretch justify-center gap-1 rounded-sm border border-oak-variant border-dashed bg-parchment-bright/80 p-3 text-left text-ink-muted hover:border-primary/40"
                onClick={() => onNavigate('VersionHistory', 'push')}
              >
                <span className="flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-widest text-primary">
                  <History className="h-3.5 w-3.5" />
                  Versions
                </span>
                <span className="text-xs">
                  {snapshots.length} snapshot{snapshots.length === 1 ? '' : 's'}
                </span>
              </button>
            </div>
          </section>
        ) : null}

        {searchHits.length > 0 ? (
          <section className="mt-8 border-t border-oak-variant pt-6">
            <h2 className="mb-3 font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Search results</h2>
            <div className="space-y-2">
              {searchHits.map((hit) => (
                <button
                  key={`${hit.path}-${hit.line}`}
                  type="button"
                  className="block w-full rounded-sm border border-oak-variant bg-parchment-bright p-3 text-left hover:border-primary"
                  onClick={() => {
                    setWikiOpen(hit.path === MOTIFS_WIKI_PATH ? {view: 'motifs'} : {view: 'file', path: hit.path});
                    onNavigate('Wiki', 'push');
                  }}
                >
                  <span className="block font-mono text-xs text-primary">{noteLabel(hit.path)}</span>
                  <span className="mt-1 block text-xs text-ink-muted">{hit.snippet}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </AppScaffold>
  );
}
