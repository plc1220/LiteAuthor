import {useEffect, useState} from 'react';
import {
  Search,
  History,
  Settings,
  User,
  Calendar,
  Layers3,
  TriangleAlert,
  Book,
} from 'lucide-react';
import {NavigationProps} from '../types';
import {AppScaffold} from '../components/AppScaffold';
import {useProjectStore} from '../stores/projectStore';
import {api} from '../lib/api';

function readableNote(content: string) {
  return content
    .split('\n')
    .map((line) =>
      line
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*]\s*/, '')
        .replace(/`([^`]+)`/g, '$1')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 12);
}

function noteLabel(path: string) {
  return path.replace(/^story\//, '').replace(/\.md$/i, '');
}

export default function StoryWikiHub({onNavigate}: NavigationProps) {
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const selectProject = useProjectStore((s) => s.selectProject);
  const activeProject = useProjectStore((s) => s.activeProject);
  const lastError = useProjectStore((s) => s.lastError);

  const [stats, setStats] = useState<{chars: number; wiki_chars: number; character_files: number} | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, unknown>[]>([]);
  const [wikiTree, setWikiTree] = useState<{path: string; is_dir: boolean}[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<{path: string; line: number | null; snippet: string}[]>([]);
  const [wikiPath, setWikiPath] = useState<string | null>(null);
  const [wikiPreview, setWikiPreview] = useState('');

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

  const openWikiFile = async (path: string) => {
    if (!activeProject) return;
    const f = await api.wikiGet(activeProject.id, path);
    setWikiPath(f.path);
    setWikiPreview(f.content);
  };

  const runSearch = async () => {
    if (!activeProject || !searchQ.trim()) {
      setSearchHits([]);
      return;
    }
    const res = await api.search(activeProject.id, searchQ.trim());
    setSearchHits(res.hits);
  };

  const wikiFiles = wikiTree.filter((n) => !n.is_dir && n.path.endsWith('.md'));
  const noteLines = readableNote(wikiPreview);
  const activeProjectId = activeProject?.id ?? '';
  const planItems = [
    {
      label: 'Reference notes',
      detail: `${stats?.character_files ?? 0} character file${(stats?.character_files ?? 0) === 1 ? '' : 's'}`,
      icon: <User className="h-4 w-4" />,
      onClick: () => {
        const first = wikiFiles[0];
        if (first) void openWikiFile(first.path);
      },
    },
    {
      label: 'Canvas',
      detail: 'Loose notes and structure',
      icon: <Layers3 className="h-4 w-4" />,
      onClick: () => onNavigate('StoryCanvas', 'push'),
    },
    {
      label: 'Timeline',
      detail: 'Events and reveal order',
      icon: <Calendar className="h-4 w-4" />,
      onClick: () => onNavigate('TimelineView', 'push'),
    },
    {
      label: 'Motifs',
      detail: 'Recurring imagery and themes',
      icon: <Book className="h-4 w-4" />,
      onClick: () => onNavigate('MotifThemePanel', 'push'),
    },
  ];
  const supportItems = [
    {
      label: 'Continuity',
      detail: 'Review unresolved story flags',
      icon: <TriangleAlert className="h-4 w-4" />,
      onClick: () => onNavigate('ContinuityCheckPanel', 'push'),
    },
    {
      label: 'Versions',
      detail: `${snapshots.length} snapshot${snapshots.length === 1 ? '' : 's'}`,
      icon: <History className="h-4 w-4" />,
      onClick: () => onNavigate('VersionHistory', 'push'),
    },
  ];

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
              placeholder="Search project…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
            />
          </label>
          <button type="button" className="rounded-sm border border-oak-variant px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-primary hover:border-primary" onClick={() => void runSearch()}>
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
        <section className="mb-6 flex flex-col gap-4 border-b border-oak-variant pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">{activeProject?.name ?? 'No project selected'}</p>
            <h1 className="mt-1 text-4xl font-semibold italic text-primary">Project desk</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">A compact place to jump into planning, checking, and preservation. The manuscript stays primary.</p>
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

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Plan</h2>
                <span className="text-xs text-ink-muted">{wikiFiles.length} note{wikiFiles.length === 1 ? '' : 's'}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {planItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="flex min-h-20 items-center gap-4 rounded-sm border border-oak-variant bg-parchment-bright p-4 text-left hover:border-primary/50 hover:bg-sepia-low"
                    onClick={item.onClick}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-oak-variant bg-sepia-high text-primary">{item.icon}</span>
                    <span className="min-w-0">
                      <span className="block font-sans text-xs font-bold uppercase tracking-widest text-primary">{item.label}</span>
                      <span className="mt-1 block text-sm leading-5 text-ink-muted">{item.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Check & preserve</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {supportItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="flex min-h-16 items-center gap-4 rounded-sm border border-oak-variant bg-sepia-low p-4 text-left hover:border-primary/50"
                    onClick={item.onClick}
                  >
                    <span className="text-primary">{item.icon}</span>
                    <span>
                      <span className="block font-sans text-xs font-bold uppercase tracking-widest text-primary">{item.label}</span>
                      <span className="mt-1 block text-xs text-ink-muted">{item.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {wikiFiles.length > 0 ? (
              <section>
                <h2 className="mb-3 font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Reference notes</h2>
                <div className="flex flex-wrap gap-2">
                  {wikiFiles.slice(0, 8).map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      className="rounded-sm border border-oak-variant bg-parchment-bright px-3 py-2 font-mono text-xs text-primary hover:border-primary"
                      onClick={() => void openWikiFile(file.path)}
                    >
                      {noteLabel(file.path)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {searchHits.length > 0 ? (
              <section>
                <h2 className="mb-3 font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Search results</h2>
                <div className="space-y-2">
                  {searchHits.map((hit) => (
                    <button
                      key={`${hit.path}-${hit.line}`}
                      type="button"
                      className="block w-full rounded-sm border border-oak-variant bg-parchment-bright p-3 text-left hover:border-primary"
                      onClick={() => void openWikiFile(hit.path)}
                    >
                      <span className="block font-mono text-xs text-primary">{noteLabel(hit.path)}</span>
                      <span className="mt-1 block text-xs text-ink-muted">{hit.snippet}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-3">
            <div className="rounded-sm border border-oak-variant bg-sepia-low p-4">
              <h2 className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Project state</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-muted">Characters</dt>
                  <dd className="font-serif text-2xl text-primary">{stats?.character_files ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Snapshots</dt>
                  <dd className="font-serif text-2xl text-primary">{snapshots.length}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-ink-muted">Reference chars</dt>
                  <dd className="font-serif text-lg text-primary">{stats?.chars?.toLocaleString() ?? '—'}</dd>
                </div>
              </dl>
            </div>

            {wikiPath ? (
              <div className="rounded-sm border border-oak-variant bg-parchment-bright p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-ink-muted">Reference note</p>
                    <h2 className="truncate font-mono text-xs text-primary">{noteLabel(wikiPath)}</h2>
                  </div>
                  <button type="button" className="font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:text-primary" onClick={() => setWikiPath(null)}>
                    Close
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-sm border border-oak-variant bg-sepia-low p-3">
                  {noteLines.length > 0 ? (
                    <div className="space-y-2">
                      {noteLines.map((line, index) => (
                        <p key={`${line}-${index}`} className="font-serif text-sm leading-6 text-ink-muted">
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="font-serif text-sm leading-6 text-ink-muted">No reference content yet.</p>
                  )}
                </div>
              </div>
            ) : null}
          </aside>
        </section>
      </main>
    </AppScaffold>
  );
}
