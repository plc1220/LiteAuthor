import {useEffect, useMemo, useState} from 'react';
import {
  Archive,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import type {Project} from '../lib/api';

type FilterKey = 'all' | 'recent' | 'completed' | 'drafts';

const FILTERS: {key: FilterKey; label: string}[] = [
  {key: 'all', label: 'All'},
  {key: 'recent', label: 'Recently opened'},
  {key: 'completed', label: 'Completed'},
  {key: 'drafts', label: 'Drafts'},
];

const COVER_COLORS = [
  '#3B2F63',
  '#164E63',
  '#365314',
  '#7C2D12',
  '#581C87',
  '#7F1D1D',
  '#1E3A8A',
  '#064E3B',
];

function hashText(value: string) {
  return value.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 17);
}

function getSettingString(project: Project, key: string) {
  const value = project.settings?.[key];
  return typeof value === 'string' ? value : null;
}

function getSettingNumber(project: Project, key: string) {
  const value = project.settings?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function projectDate(project: Project) {
  return getSettingString(project, 'last_opened_at') ?? getSettingString(project, 'last_opened') ?? project.created_at;
}

function relativeTime(value: string | null) {
  if (!value) return 'Not opened yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';

  const diffMs = Date.now() - date.getTime();
  const future = diffMs < 0;
  const seconds = Math.max(1, Math.round(Math.abs(diffMs) / 1000));
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, {numeric: 'auto'});
  for (const [unit, size] of units) {
    if (seconds >= size) {
      const amount = Math.round(seconds / size) * (future ? 1 : -1);
      return formatter.format(amount, unit);
    }
  }
  return 'just now';
}

function titleInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'LA';
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

function projectStatus(project: Project) {
  const raw = getSettingString(project, 'status')?.toLowerCase();
  if (raw === 'completed' || raw === 'complete') return 'Completed';
  if (raw === 'archived') return 'Archived';
  return 'Draft';
}

function projectMatchesFilter(project: Project, filter: FilterKey) {
  const status = projectStatus(project);
  if (filter === 'completed') return status === 'Completed';
  if (filter === 'drafts') return status === 'Draft';
  if (filter === 'recent') {
    const date = new Date(projectDate(project));
    return !Number.isNaN(date.getTime()) && Date.now() - date.getTime() <= 1000 * 60 * 60 * 24 * 30;
  }
  return true;
}

function HighlightedTitle({title, query}: {title: string; query: string}) {
  const trimmed = query.trim();
  if (!trimmed) return <>{title}</>;
  const index = title.toLowerCase().indexOf(trimmed.toLowerCase());
  if (index === -1) return <>{title}</>;
  return (
    <>
      {title.slice(0, index)}
      <mark className="bg-amber-wax/25 text-primary rounded-sm px-0.5">{title.slice(index, index + trimmed.length)}</mark>
      {title.slice(index + trimmed.length)}
    </>
  );
}

function ProjectCard({
  project,
  query,
  menuOpen,
  onToggleMenu,
  onOpen,
}: {
  project: Project;
  query: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpen: () => void;
}) {
  const coverColor = COVER_COLORS[hashText(project.id || project.name) % COVER_COLORS.length];
  const targetWords = getSettingNumber(project, 'target_words') ?? getSettingNumber(project, 'targetWords');
  const currentWords = getSettingNumber(project, 'word_count') ?? getSettingNumber(project, 'current_words') ?? 0;
  const progress = targetWords ? Math.min(100, Math.round((currentWords / targetWords) * 100)) : null;
  const chapterCount = getSettingNumber(project, 'chapter_count') ?? getSettingNumber(project, 'chapters');
  const status = projectStatus(project);

  return (
    <article className="group relative overflow-hidden rounded-soft border border-oak-variant bg-sepia-low transition-all hover:-translate-y-1 hover:border-primary/45 hover:bg-sepia-mid">
      <button type="button" className="block w-full text-left bg-transparent border-none p-0 cursor-pointer" onClick={onOpen}>
        <div className="relative h-[150px] overflow-hidden" style={{backgroundColor: coverColor}}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.16),transparent_34%),linear-gradient(135deg,rgba(0,0,0,0.05),rgba(0,0,0,0.38))]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-6xl text-white/85 drop-shadow-sm">{titleInitials(project.name)}</span>
          </div>
          {chapterCount ? (
            <span className="absolute bottom-3 right-3 rounded-sm border border-white/15 bg-black/35 px-2 py-1 text-[10px] font-sans uppercase tracking-widest text-white/90">
              {chapterCount} ch.
            </span>
          ) : null}
        </div>

        <div className="p-4 pb-5">
          <h3 className="min-h-[42px] text-[15px] font-serif font-medium leading-snug text-ink line-clamp-2" title={project.name}>
            <HighlightedTitle title={project.name} query={query} />
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-sans uppercase tracking-widest text-ink-muted">
            <span>{currentWords.toLocaleString()} words</span>
            <span className="text-oak-variant">/</span>
            <span>{relativeTime(projectDate(project))}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="rounded-sm border border-oak-variant bg-sepia-high px-2 py-1 text-[10px] font-sans uppercase tracking-widest text-primary">
              {status}
            </span>
            <span className="truncate text-[10px] font-mono text-ink-muted" title={project.root_path}>
              {project.root_path}
            </span>
          </div>
        </div>
      </button>

      <button
        type="button"
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-sm border border-white/15 bg-black/35 text-white opacity-0 transition-opacity hover:bg-black/55 group-hover:opacity-100"
        aria-label={`Project actions for ${project.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMenu();
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menuOpen ? (
        <div className="absolute right-3 top-12 z-20 w-44 rounded-soft border border-oak-variant bg-sepia-high p-1 shadow-xl">
          <button type="button" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs hover:bg-sepia-highest" onClick={onOpen}>
            <FolderOpen className="h-4 w-4 text-primary" />
            Open
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs opacity-45" disabled title="Rename needs a backend endpoint.">
            <BookOpen className="h-4 w-4" />
            Rename
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs opacity-45" disabled title="Duplicate is not wired yet.">
            <Copy className="h-4 w-4" />
            Duplicate
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs opacity-45" disabled title="Export is not wired yet.">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs opacity-45" disabled title="Archive is not wired yet.">
            <Archive className="h-4 w-4" />
            Archive
          </button>
          <button type="button" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs text-red-300 opacity-45" disabled title="Delete is not wired yet.">
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      ) : null}

      {progress !== null ? (
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-sepia-highest">
          <div className="h-full bg-primary" style={{width: `${progress}%`}} />
        </div>
      ) : null}
    </article>
  );
}

function CreateProjectCard({onCreate}: {onCreate: () => void}) {
  return (
    <button
      type="button"
      className="flex min-h-[292px] flex-col items-center justify-center rounded-soft border border-dashed border-primary/45 bg-sepia-low/45 p-8 text-center transition-all hover:-translate-y-1 hover:border-primary hover:bg-sepia-mid"
      onClick={onCreate}
    >
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary">
        <Plus className="h-7 w-7" />
      </span>
      <span className="font-serif text-xl italic text-ink">Create new</span>
      <span className="mt-2 text-xs text-ink-muted">Open the project setup wizard</span>
    </button>
  );
}

export default function LibraryHome({onNavigate}: NavigationProps) {
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const selectProject = useProjectStore((s) => s.selectProject);
  const lastError = useProjectStore((s) => s.lastError);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [activityCollapsed, setActivityCollapsed] = useState(() => localStorage.getItem('liteauthor.library.activityCollapsed') === 'true');

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    localStorage.setItem('liteauthor.library.activityCollapsed', String(activityCollapsed));
  }, [activityCollapsed]);

  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) => {
        const aTime = new Date(projectDate(a)).getTime();
        const bTime = new Date(projectDate(b)).getTime();
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
      }),
    [projects],
  );

  const counts = useMemo(
    () =>
      FILTERS.reduce(
        (acc, item) => ({
          ...acc,
          [item.key]: sortedProjects.filter((project) => projectMatchesFilter(project, item.key)).length,
        }),
        {} as Record<FilterKey, number>,
      ),
    [sortedProjects],
  );

  const visibleProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortedProjects.filter((project) => {
      const matchesSearch =
        !q ||
        project.name.toLowerCase().includes(q) ||
        project.root_path.toLowerCase().includes(q) ||
        projectStatus(project).toLowerCase().includes(q);
      return projectMatchesFilter(project, filter) && matchesSearch;
    });
  }, [filter, query, sortedProjects]);

  const latestProject = sortedProjects[0] ?? null;
  const recentActivities = sortedProjects.slice(0, 8).map((project, index) => ({
    id: `${project.id}-${index}`,
    project,
    label: index % 3 === 0 ? 'Edited manuscript' : index % 3 === 1 ? 'Wiki ready' : 'Draft opened',
    time: relativeTime(projectDate(project)),
  }));

  const openProject = async (project: Project) => {
    setMenuFor(null);
    await selectProject(project.id);
    onNavigate('ZenEditor', 'push');
  };

  const createProject = () => onNavigate('ProjectSetupWizard', 'slide_up');

  return (
    <div className="flex min-h-screen flex-col bg-parchment text-ink">
      <header className="flex h-10 items-center justify-between border-b border-oak-variant bg-sepia-highest/70 px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-primary/35 bg-primary/10 font-serif text-sm font-bold text-primary">
            L
          </span>
          <span className="font-sans text-sm font-semibold tracking-wide text-ink">LiteAuthor</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-sm hover:bg-sepia-high" title="Command palette unavailable on Library Home">
            <Search className="h-4 w-4 text-oak" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-sm hover:bg-sepia-high"
            title="Settings"
            onClick={() => onNavigate('SettingsScreen', 'push')}
          >
            <Settings className="h-4 w-4 text-oak" />
          </button>
        </div>
      </header>

      {lastError ? (
        <div className="border-b border-red-400/20 bg-red-950/40 px-8 py-3 text-xs text-red-100">
          API: {lastError} <span className="text-red-100/60">Start the backend to load local projects.</span>
        </div>
      ) : null}

      <main className="flex-1 overflow-y-auto pb-24">
        <section className="border-b border-oak-variant bg-sepia-low">
          <div className="mx-auto flex min-h-[220px] max-w-[1680px] flex-col justify-center px-6 py-9 md:px-12 xl:px-16">
            <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-4 flex items-center gap-2 text-[10px] font-sans uppercase tracking-widest text-primary">
                  <Sparkles className="h-4 w-4" />
                  Local manuscripts
                </div>
                <h1 className="font-serif text-5xl font-medium italic leading-tight text-ink md:text-6xl">Your manuscripts</h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-muted">
                  {projects.length === 0
                    ? 'No projects yet. Start a first manuscript when you are ready.'
                    : `${projects.length} project${projects.length === 1 ? '' : 's'} in this library${
                        latestProject ? `, last opened ${relativeTime(projectDate(latestProject))}` : ''
                      }.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-sm bg-primary px-5 py-3 text-xs font-bold uppercase tracking-widest text-parchment-bright shadow-sm transition hover:brightness-110"
                  onClick={createProject}
                >
                  <FilePlus2 className="h-4 w-4" />
                  New Project
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-sm border border-oak-variant bg-sepia-high px-4 py-3 text-xs font-bold uppercase tracking-widest text-ink-muted"
                  disabled
                  title="Command palette will be wired by the shell."
                >
                  <Search className="h-4 w-4" />
                  Cmd K
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1680px] px-6 py-7 md:px-12 xl:px-16">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`rounded-sm border px-3 py-2 text-xs font-sans uppercase tracking-widest transition ${
                    filter === item.key
                      ? 'border-primary bg-primary text-parchment-bright'
                      : 'border-oak-variant bg-sepia-low text-ink-muted hover:border-primary/50 hover:text-ink'
                  }`}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label} <span className="ml-2 opacity-70">{counts[item.key]}</span>
                </button>
              ))}
            </div>

            <label className="relative block w-full lg:w-[420px] xl:w-[448px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-oak" />
              <input
                className="w-full rounded-sm border border-oak-variant bg-sepia-low py-3 pl-10 pr-3 text-sm outline-none placeholder:text-ink-muted/70 focus:border-primary/60"
                placeholder="Search projects..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          {projects.length === 0 ? (
            <div className="flex min-h-[380px] flex-col items-center justify-center rounded-soft border border-oak-variant bg-sepia-low px-6 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
                <BookOpen className="h-10 w-10 text-primary" />
              </div>
              <h2 className="font-serif text-3xl italic text-ink">Start your first manuscript</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted">Create a local project with a manuscript, story wiki, and metadata store.</p>
              <button
                type="button"
                className="mt-7 flex items-center gap-2 rounded-sm bg-primary px-5 py-3 text-xs font-bold uppercase tracking-widest text-parchment-bright hover:brightness-110"
                onClick={createProject}
              >
                <Plus className="h-4 w-4" />
                New Project
              </button>
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-soft border border-oak-variant bg-sepia-low px-6 text-center">
              <Search className="mb-5 h-10 w-10 text-oak" />
              <h2 className="font-serif text-2xl italic text-ink">No matching manuscripts</h2>
              <p className="mt-2 text-sm text-ink-muted">Try another search term or switch filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(320px,360px))]">
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  query={query}
                  menuOpen={menuFor === project.id}
                  onToggleMenu={() => setMenuFor(menuFor === project.id ? null : project.id)}
                  onOpen={() => void openProject(project)}
                />
              ))}
              <CreateProjectCard onCreate={createProject} />
            </div>
          )}
        </section>
      </main>

      <aside className="fixed inset-x-0 bottom-0 border-t border-oak-variant bg-sepia-highest/95">
        <div className={`mx-auto flex max-w-[1680px] items-center gap-4 px-6 transition-[height] md:px-12 xl:px-16 ${activityCollapsed ? 'h-11' : 'h-16'}`}>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-oak-variant bg-sepia-high hover:border-primary/50"
            onClick={() => setActivityCollapsed((value) => !value)}
            aria-label={activityCollapsed ? 'Expand recent activity' : 'Collapse recent activity'}
          >
            {activityCollapsed ? <ChevronRight className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />}
          </button>
          <div className="hidden shrink-0 items-center gap-2 text-[10px] font-sans uppercase tracking-widest text-ink-muted sm:flex">
            <Clock3 className="h-4 w-4 text-oak" />
            Recent
          </div>
          <div className={`min-w-0 flex-1 gap-2 overflow-x-auto pb-1 ${activityCollapsed ? 'hidden' : 'flex'}`}>
            {recentActivities.length === 0 ? (
              <span className="flex items-center gap-2 rounded-sm border border-oak-variant bg-sepia-high px-3 py-2 text-xs text-ink-muted">
                <Check className="h-4 w-4 text-oak" />
                Activity will appear after projects are opened.
              </span>
            ) : (
              recentActivities.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  className="shrink-0 rounded-sm border border-oak-variant bg-sepia-high px-3 py-2 text-left text-xs hover:border-primary/50"
                  onClick={() => void openProject(activity.project)}
                >
                  <span className="font-serif text-ink">{activity.project.name}</span>
                  <span className="ml-2 text-ink-muted">{activity.label} · {activity.time}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
