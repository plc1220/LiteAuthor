import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Search, BookMarked, Library, Sparkles} from 'lucide-react';
import {NavigationProps} from '../types';
import {AppScaffold} from '../components/AppScaffold';
import {useProjectStore} from '../stores/projectStore';
import {api} from '../lib/api';
import {MotifTrackerPanel, MOTIFS_WIKI_PATH} from '../components/MotifTrackerPanel';
import {takeWikiOpen} from '../lib/wikiOpen';

function noteLabel(path: string) {
  return path.replace(/^story\//, '').replace(/\.md$/i, '');
}

type Center = {kind: 'motifs'} | {kind: 'file'; path: string; content: string} | {kind: 'empty'};

export default function Wiki({onNavigate}: NavigationProps) {
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const selectProject = useProjectStore((s) => s.selectProject);
  const activeProject = useProjectStore((s) => s.activeProject);
  const lastError = useProjectStore((s) => s.lastError);

  const [wikiTree, setWikiTree] = useState<{path: string; is_dir: boolean}[]>([]);
  const [center, setCenter] = useState<Center>({kind: 'empty'});
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<{path: string; line: number | null; snippet: string}[]>([]);
  const hasInitialized = useRef(false);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    hasInitialized.current = false;
  }, [activeProject?.id]);

  const allWikiFiles = useMemo(
    () => wikiTree.filter((n) => !n.is_dir && n.path.toLowerCase().endsWith('.md')),
    [wikiTree],
  );
  const wikiFiles = useMemo(() => allWikiFiles.filter((n) => n.path !== MOTIFS_WIKI_PATH), [allWikiFiles]);

  const openWikiFile = useCallback(
    async (path: string) => {
      if (!activeProject) return;
      const f = await api.wikiGet(activeProject.id, path);
      setCenter({kind: 'file', path: f.path, content: f.content});
    },
    [activeProject],
  );

  useEffect(() => {
    if (!activeProject) {
      setWikiTree([]);
      setCenter({kind: 'empty'});
      return;
    }
    (async () => {
      try {
        const tree = await api.wikiTree(activeProject.id);
        setWikiTree(tree);
      } catch {
        setWikiTree([]);
      }
    })();
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) return;
    if (allWikiFiles.length === 0) {
      if (activeProject) setCenter({kind: 'empty'});
      return;
    }
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    void (async () => {
      const hint = takeWikiOpen();
      if (hint?.view === 'motifs') {
        setCenter({kind: 'motifs'});
        return;
      }
      if (hint?.view === 'file' && hint.path) {
        if (hint.path === MOTIFS_WIKI_PATH) {
          setCenter({kind: 'motifs'});
          return;
        }
        if (allWikiFiles.some((f) => f.path === hint.path)) {
          try {
            await openWikiFile(hint.path);
            return;
          } catch {
            /* fall through to default */
          }
        }
      }
      const first = allWikiFiles.find((f) => f.path !== MOTIFS_WIKI_PATH);
      if (first) {
        try {
          await openWikiFile(first.path);
        } catch {
          setCenter({kind: 'empty'});
        }
        return;
      }
      if (allWikiFiles.some((f) => f.path === MOTIFS_WIKI_PATH)) {
        setCenter({kind: 'motifs'});
        return;
      }
      setCenter({kind: 'empty'});
    })();
  }, [activeProject, allWikiFiles, openWikiFile]);

  const runSearch = async () => {
    if (!activeProject || !searchQ.trim()) {
      setSearchHits([]);
      return;
    }
    const res = await api.search(activeProject.id, searchQ.trim());
    setSearchHits(res.hits);
  };

  const onPickHit = async (path: string) => {
    if (path === MOTIFS_WIKI_PATH) {
      setCenter({kind: 'motifs'});
      setSearchHits([]);
      return;
    }
    await openWikiFile(path);
    setSearchHits([]);
  };

  const centerPath = center.kind === 'file' ? center.path : null;
  const showMotifs = center.kind === 'motifs';
  const hasMotifsFile = allWikiFiles.some((f) => f.path === MOTIFS_WIKI_PATH);
  const activeProjectId = activeProject?.id ?? '';

  return (
    <AppScaffold
      active="desk"
      onNavigate={onNavigate}
      actions={
        <>
          <label className="relative hidden min-w-0 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-oak" />
            <input
              className="w-full min-w-0 rounded-sm border border-oak-variant bg-sepia-low py-2 pl-9 pr-3 font-sans text-xs outline-none placeholder:italic placeholder:text-ink-muted/70 focus:border-primary md:w-56"
              placeholder="Search manuscript and wiki…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
            />
          </label>
          <button
            type="button"
            className="hidden rounded-sm border border-oak-variant px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-primary hover:border-primary md:inline"
            onClick={() => void runSearch()}
          >
            Go
          </button>
          <select
            className="h-10 min-w-0 max-w-[10rem] rounded-sm border border-oak-variant bg-sepia-low px-2 font-serif text-xs italic text-primary outline-none sm:min-w-52 sm:max-w-none sm:px-3 sm:text-sm"
            value={activeProjectId}
            onChange={(event) => {
              if (event.target.value) void selectProject(event.target.value);
            }}
          >
            <option value="">Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="h-10 shrink-0 rounded-sm bg-primary px-3 font-sans text-[10px] font-bold uppercase tracking-widest text-parchment-bright sm:px-4"
            onClick={() => onNavigate('ZenEditor', 'push')}
          >
            Continue
          </button>
        </>
      }
    >
      {lastError ? (
        <div className="bg-red-950/40 px-8 py-3 font-sans text-xs text-red-100">
          API: {lastError} — start backend: <code className="text-amber-200">npm run api</code>
        </div>
      ) : null}

      {!activeProject ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-serif text-lg italic text-ink">Choose a project to open the Wiki.</p>
          <button type="button" className="rounded-sm bg-primary px-4 py-2 font-sans text-xs uppercase text-parchment" onClick={() => onNavigate('WikiHub', 'push_back')}>
            Back to the Wiki
          </button>
        </div>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-0 lg:flex-row">
          <aside className="w-full shrink-0 border-b border-oak-variant bg-sepia-low/60 lg:w-56 lg:border-b-0 lg:border-r">
            <div className="p-4">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Wiki</p>
              <h1 className="mt-1 font-serif text-xl italic text-primary">Canon</h1>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted/90">Characters, places, world rules, motifs, and unresolved questions the editor can remember.</p>
            </div>
            <nav className="max-h-48 space-y-1 overflow-y-auto border-t border-oak-variant/60 px-2 py-2 lg:max-h-none">
              {hasMotifsFile ? (
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-sm border px-3 py-2.5 text-left text-sm transition-colors ${
                    showMotifs ? 'border-primary/40 bg-sepia-highest text-primary' : 'border-transparent text-ink hover:border-oak-variant hover:bg-sepia-mid/80'
                  }`}
                  onClick={() => setCenter({kind: 'motifs'})}
                >
                  <BookMarked className="h-4 w-4 shrink-0 opacity-80" />
                  <span>
                    <span className="block font-sans text-[10px] font-bold uppercase tracking-widest">Tracked motifs</span>
                    <span className="text-[11px] text-ink-muted">Heatmap and recurrence</span>
                  </span>
                </button>
              ) : (
                <div className="px-3 py-2 text-xs italic text-ink-muted">Add {MOTIFS_WIKI_PATH} to enable motif tracking.</div>
              )}

              <p className="px-3 pb-1 pt-3 font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Reference notes</p>
              {wikiFiles.length === 0 ? <p className="px-3 text-xs text-ink-muted/90">No wiki notes yet.</p> : null}
              {wikiFiles.map((f) => {
                const active = centerPath === f.path;
                return (
                  <button
                    key={f.path}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-sm border px-3 py-2 text-left font-mono text-[11px] leading-snug transition-colors ${
                      active ? 'border-primary/40 bg-sepia-highest text-primary' : 'border-transparent text-ink hover:border-oak-variant hover:bg-sepia-mid/80'
                    }`}
                    onClick={() => void openWikiFile(f.path)}
                    title={f.path}
                  >
                    <Library className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="min-w-0 break-all">{noteLabel(f.path)}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-oak-variant/60 p-3">
              <button
                type="button"
                className="w-full rounded-sm border border-dashed border-oak-variant py-2 font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary"
                onClick={() => onNavigate('WikiHub', 'push_back')}
              >
                Wiki
              </button>
            </div>
          </aside>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(200px,240px)] lg:gap-6">
            <div>
              {center.kind === 'empty' ? (
                <p className="text-sm text-ink-muted">Loading reference, or add markdown files under the wiki.</p>
              ) : null}
              {showMotifs ? (
                <div>
                  <p className="mb-4 font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Tracked in manuscript</p>
                  <MotifTrackerPanel onNavigate={onNavigate} />
                </div>
              ) : null}
              {center.kind === 'file' ? (
                <article>
                  <header className="mb-4 border-b border-oak-variant pb-3">
                    <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Reference note</p>
                    <h2 className="mt-1 break-all font-mono text-sm text-primary md:text-base">{center.path}</h2>
                  </header>
                  <div className="prose-article max-w-none">
                    <pre className="whitespace-pre-wrap font-serif text-sm leading-7 text-ink">{center.content || 'Empty file.'}</pre>
                  </div>
                </article>
              ) : null}
            </div>

            <aside className="mt-8 h-fit rounded-sm border border-oak-variant/80 bg-parchment-bright/90 p-4 text-sm lg:mt-0">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <h3 className="font-sans text-[10px] font-bold uppercase tracking-widest">AI insights</h3>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                Echoes, contradictions, and cross-links with the manuscript will show here as the story and engine mature.
              </p>
            </aside>
          </div>
        </div>
      )}

      {searchHits.length > 0 && activeProject ? (
        <div className="border-t border-oak-variant bg-sepia-low/50 px-4 py-3 md:px-8">
          <h2 className="mb-2 font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Search results</h2>
          <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
            {searchHits.map((hit) => (
              <button
                key={`${hit.path}-${hit.line}`}
                type="button"
                className="w-full rounded-sm border border-oak-variant bg-parchment-bright p-2 text-left hover:border-primary"
                onClick={() => void onPickHit(hit.path)}
              >
                <span className="block font-mono text-xs text-primary">{noteLabel(hit.path)}</span>
                <span className="mt-0.5 block line-clamp-2 text-xs text-ink-muted">{hit.snippet}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </AppScaffold>
  );
}
