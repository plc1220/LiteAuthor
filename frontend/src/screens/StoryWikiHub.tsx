import {useEffect, useState} from 'react';
import {
  Search,
  History,
  Settings,
  User,
  Calendar,
  BookOpen,
  FileText,
  Plus,
  TriangleAlert,
  Edit3,
  Book,
} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import {api, type Project} from '../lib/api';

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
  const [wikiContent, setWikiContent] = useState('');

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
    setWikiContent(f.content);
  };

  const saveWikiFile = async () => {
    if (!activeProject || !wikiPath) return;
    await api.wikiPut(activeProject.id, wikiPath, wikiContent);
    const tree = await api.wikiTree(activeProject.id);
    setWikiTree(tree);
    const s = await api.projectStats(activeProject.id);
    setStats(s);
  };

  const runSearch = async () => {
    if (!activeProject || !searchQ.trim()) {
      setSearchHits([]);
      return;
    }
    const res = await api.search(activeProject.id, searchQ.trim());
    setSearchHits(res.hits);
  };

  const pickProject = async (p: Project) => {
    await selectProject(p.id);
    onNavigate('ZenEditor', 'push');
  };

  return (
    <div className="flex flex-col min-h-screen bg-parchment">
      <header className="bg-sepia-highest/50 border-b border-oak-variant flex justify-between items-center w-full px-8 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <span className="text-2xl font-black text-primary tracking-widest">LiteAuthor</span>
          <nav className="hidden md:flex gap-4 text-xs font-sans uppercase tracking-widest text-ink/60">
            <button type="button" className="hover:text-ink bg-transparent border-none font-inherit cursor-pointer" onClick={() => onNavigate('ZenEditor', 'push')}>
              Manuscript
            </button>
            <span className="text-oak-variant">/</span>
            <span className="text-ink font-bold underline decoration-ink/30">Story Wiki</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group flex items-center gap-2">
            <Search className="text-oak w-4 h-4" />
            <input
              className="bg-sepia-low border-none focus:ring-1 focus:ring-primary-container pl-2 pr-4 py-2 text-xs font-sans rounded-lg w-48 placeholder:italic"
              placeholder="Search project…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
            />
            <button type="button" className="font-sans text-[10px] uppercase text-primary" onClick={() => void runSearch()}>
              Go
            </button>
          </div>
          <button type="button" className="p-2 hover:bg-sepia-high rounded-full bg-transparent border-none" onClick={() => onNavigate('VersionHistory', 'push')}>
            <History className="text-primary-container w-5 h-5" />
          </button>
          <button type="button" className="p-2 hover:bg-sepia-high rounded-full bg-transparent border-none" onClick={() => onNavigate('SettingsScreen', 'push')}>
            <Settings className="text-primary-container w-5 h-5" />
          </button>
        </div>
      </header>

      {lastError ? (
        <div className="px-8 py-3 bg-red-950/40 text-red-100 text-xs font-sans">API: {lastError} — start backend: <code className="text-amber-200">npm run api</code></div>
      ) : null}

      <div className="flex flex-1">
        <aside className="w-72 bg-sepia-low/30 border-r border-oak-variant flex flex-col py-8 sticky top-[65px] h-[calc(100vh-65px)]">
          <div className="px-6 mb-6">
            <h2 className="text-xl font-bold italic text-primary">Projects</h2>
            <p className="text-[10px] font-sans opacity-60 uppercase tracking-tighter">Local-first</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 space-y-2">
            {projects.map((p) => (
              <div key={p.id} className="rounded-sm border border-oak-variant bg-sepia-high/40 p-3">
                <div className="font-serif text-sm font-bold text-ink truncate">{p.name}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="font-sans text-[9px] uppercase tracking-widest px-2 py-1 bg-primary text-parchment rounded-sm"
                    onClick={() => void pickProject(p)}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="font-sans text-[9px] uppercase tracking-widest px-2 py-1 border border-oak-variant rounded-sm"
                    onClick={async () => {
                      await selectProject(p.id);
                    }}
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
            {projects.length === 0 ? <p className="text-xs text-ink-muted px-2">No projects yet. Create one from the wizard.</p> : null}
          </div>
          <div className="px-6 mt-auto pt-6 space-y-2">
            <button
              type="button"
              className="w-full bg-primary-container text-parchment-bright py-3 rounded shadow-sm font-sans text-xs font-bold uppercase tracking-widest hover:brightness-110"
              onClick={() => onNavigate('ProjectSetupWizard', 'slide_up')}
            >
              New project
            </button>
          </div>
        </aside>

        <main className="flex-1 p-12 flex flex-col lg:flex-row gap-8 overflow-y-auto">
          <div className="flex-1 max-w-[720px]">
            <div className="mb-10">
              <h1 className="text-4xl font-semibold text-primary italic mb-2">The Story Bible</h1>
              <p className="text-lg font-serif text-ink-muted italic">Canon lives in markdown on disk. SQLite tracks structure, AI, and continuity.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-sepia-low p-8 border border-oak-variant flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="bg-sepia-high px-3 py-1 text-[10px] font-sans uppercase tracking-widest border border-oak-variant">Characters</div>
                  <User className="text-oak w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-3xl font-medium text-primary leading-none mb-2">{stats?.character_files ?? 0} files</h3>
                  <p className="text-xs text-ink-muted">Under <code className="text-amber-200/90">story/characters</code></p>
                </div>
                <button
                  type="button"
                  className="mt-auto text-xs font-sans text-amber-wax uppercase tracking-widest hover:underline text-left bg-transparent border-none cursor-pointer"
                  onClick={async () => {
                    if (!activeProject) {
                      alert('Select a project in the sidebar first.');
                      return;
                    }
                    const slug = window.prompt('Character slug (filename)') || 'new-character';
                    const path = await api.wikiNewCharacter(activeProject.id, slug);
                    await openWikiFile(path.path);
                  }}
                >
                  New character
                </button>
              </div>

              <button
                type="button"
                className="bg-sepia-low p-8 border border-oak-variant flex flex-col gap-4 text-left hover:-translate-y-1 transition-transform bg-transparent"
                onClick={() => onNavigate('TimelineView', 'push')}
              >
                <div className="flex justify-between items-start">
                  <div className="bg-sepia-high px-3 py-1 text-[10px] font-sans uppercase tracking-widest border border-oak-variant">Timeline</div>
                  <Calendar className="text-oak w-5 h-5" />
                </div>
                <p className="text-sm italic opacity-80">Events + reveal order backed by SQLite.</p>
              </button>

              <button
                type="button"
                className="bg-sepia-low p-8 border border-oak-variant flex flex-col gap-4 text-left hover:-translate-y-1 transition-transform bg-transparent"
                onClick={() => onNavigate('MotifThemePanel', 'push')}
              >
                <div className="flex justify-between items-start">
                  <div className="bg-sepia-high px-3 py-1 text-[10px] font-sans uppercase tracking-widest border border-oak-variant">Motifs</div>
                  <Book className="text-oak w-5 h-5" />
                </div>
                <p className="text-sm italic opacity-80">Track recurring imagery and theme notes from motifs.md.</p>
              </button>

              <button
                type="button"
                className="bg-sepia-low p-8 border border-oak-variant flex flex-col gap-4 text-left hover:-translate-y-1 transition-transform bg-transparent"
                onClick={() => onNavigate('ContinuityCheckPanel', 'push')}
              >
                <div className="flex justify-between items-start">
                  <div className="bg-sepia-high px-3 py-1 text-[10px] font-sans uppercase tracking-widest border border-oak-variant">Continuity</div>
                  <TriangleAlert className="text-oak w-5 h-5" />
                </div>
                <p className="text-sm italic opacity-80">Review unresolved flags, run the agent pass, and mark outcomes.</p>
              </button>

              <div className="bg-sepia-low p-8 border border-oak-variant md:col-span-2">
                <div className="flex justify-between items-start mb-2">
                  <div className="bg-sepia-high px-3 py-1 text-[10px] font-sans uppercase tracking-widest border border-oak-variant">Wiki files</div>
                  <BookOpen className="text-oak w-5 h-5" />
                </div>
                <div className="max-h-48 overflow-y-auto text-xs font-mono space-y-1">
                  {wikiTree
                    .filter((n) => !n.is_dir && n.path.endsWith('.md'))
                    .map((n) => (
                      <button
                        key={n.path}
                        type="button"
                        className="block w-full text-left text-primary hover:underline bg-transparent border-none cursor-pointer truncate"
                        onClick={() => void openWikiFile(n.path)}
                      >
                        {n.path}
                      </button>
                    ))}
                </div>
              </div>

              <div className="bg-sepia-low p-8 border border-oak-variant flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="bg-red-50 text-red-800 px-3 py-1 text-[10px] font-sans uppercase tracking-widest border border-red-200">Search hits</div>
                  <TriangleAlert className="text-red-600 w-5 h-5" />
                </div>
                <div className="text-xs space-y-2 max-h-40 overflow-y-auto">
                  {searchHits.length === 0 ? <span className="text-ink-muted">Run a search from the header.</span> : null}
                  {searchHits.map((h) => (
                    <button
                      key={`${h.path}-${h.line}`}
                      type="button"
                      className="block w-full text-left border-b border-oak-variant/40 pb-2 bg-transparent border-t-0 border-x-0 cursor-pointer"
                      onClick={() => void openWikiFile(h.path)}
                    >
                      <div className="text-primary font-bold truncate">{h.path}</div>
                      <div className="text-ink-muted">{h.snippet}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-primary-container p-8 border border-sepia-highest/20 flex flex-col gap-4 text-parchment-bright">
                <div className="flex justify-between items-start">
                  <div className="bg-sepia-high px-3 py-1 text-[10px] font-sans uppercase tracking-widest border border-oak-variant text-primary-container">Corpus</div>
                  <Edit3 className="text-oak-variant w-5 h-5" />
                </div>
                <p className="text-xs opacity-80 leading-relaxed font-serif">
                  Characters: {stats?.character_files ?? 0} · Wiki chars: {stats?.wiki_chars?.toLocaleString() ?? '—'} · Total MD chars:{' '}
                  {stats?.chars?.toLocaleString() ?? '—'}
                </p>
                <p className="text-[10px] font-sans uppercase tracking-widest opacity-60 mt-2">Snapshots: {snapshots.length}</p>
                <button
                  type="button"
                  className="mt-auto text-xs font-sans text-amber-wax-container uppercase tracking-widest hover:brightness-125 bg-transparent border-none cursor-pointer text-left"
                  onClick={() => onNavigate('VersionHistory', 'push')}
                >
                  Open version history
                </button>
              </div>
            </div>

            <div className="my-12 flex flex-col items-center gap-8">
              <div className="deckle-edge h-px w-full bg-oak-variant opacity-30" />
              <div className="text-center opacity-40 max-w-sm">
                <Book className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm italic">Human writes. The system remembers. AI assists precisely.</p>
              </div>
            </div>
          </div>

          <aside className="w-full lg:w-[380px] shrink-0">
            <div className="bg-sepia-high border border-oak-variant rounded-sm p-4 sticky top-24">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-serif text-lg italic">Markdown</h3>
                <FileText className="w-4 h-4 text-oak" />
              </div>
              {wikiPath ? (
                <>
                  <div className="text-[10px] font-mono text-ink-muted mb-2 truncate">{wikiPath}</div>
                  <textarea
                    className="w-full h-[420px] bg-parchment-bright text-ink text-xs font-mono p-3 rounded-sm border border-oak-variant"
                    value={wikiContent}
                    onChange={(e) => setWikiContent(e.target.value)}
                  />
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="flex-1 py-2 bg-primary text-parchment text-[10px] font-sans uppercase tracking-widest rounded-sm" onClick={() => void saveWikiFile()}>
                      Save
                    </button>
                    <button type="button" className="py-2 px-3 border border-oak-variant text-[10px] font-sans uppercase rounded-sm" onClick={() => setWikiPath(null)}>
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-ink-muted">Pick a wiki file from the list to edit.</p>
              )}
            </div>
          </aside>
        </main>
      </div>

      <button
        type="button"
        className="fixed bottom-10 right-10 w-16 h-16 bg-amber-wax text-parchment-bright rounded-full flex items-center justify-center shadow-xl hover:scale-105 z-50 group border-none cursor-pointer"
        onClick={() => onNavigate('ProjectSetupWizard', 'slide_up')}
      >
        <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform" />
      </button>
    </div>
  );
}
