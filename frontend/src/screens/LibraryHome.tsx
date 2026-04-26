import {useEffect, useMemo, useRef, useState} from 'react';
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
  Activity,
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

function getEmotionalArcValues(project: Project): number[] | null {
  const raw = project.settings?.emotional_arc;
  if (Array.isArray(raw) && raw.length > 0 && raw.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return raw as number[];
  }
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p) && p.length > 0 && p.every((n) => typeof n === 'number' && Number.isFinite(n))) {
        return p;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function getFocalCharacter(project: Project) {
  return (
    getSettingString(project, 'focal_character')?.trim() ||
    getSettingString(project, 'main_character')?.trim() ||
    getSettingString(project, 'protagonist')?.trim() ||
    getSettingString(project, 'focal_pov')?.trim() ||
    null
  );
}

function getStoryHealthLabel(project: Project, progressPercent: number | null) {
  const explicit = getSettingString(project, 'story_health')?.trim();
  if (explicit) return explicit;
  if (progressPercent !== null && progressPercent >= 0) {
    if (progressPercent >= 100) return 'At target length';
    if (progressPercent >= 66) return 'Strong progress';
    if (progressPercent >= 33) return 'Finding rhythm';
  }
  return 'Early draft';
}

function EmotionalArcSparkline({values}: {values: number[] | null}) {
  const w = 76;
  const h = 22;
  const pad = 2;
  const hasData = values != null && values.length > 0;
  const raw = hasData && values ? values : Array.from({length: 8}, () => 0.5);
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const range = max - min || 1;
  const norm = raw.map((v) => (v - min) / range);
  const pathD = norm
    .map((v, i) => {
      const x = pad + (i / (norm.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - v) * (h - 2 * pad);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      className={hasData ? 'shrink-0 text-primary/90' : 'shrink-0 text-ink-muted/45'}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      <path d={pathD} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
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
  const emotionalValues = getEmotionalArcValues(project);
  const focal = getFocalCharacter(project);
  const health = getStoryHealthLabel(project, progress);
  const arcTitle = emotionalValues?.length
    ? 'Emotional arc snapshot'
    : 'Map emotional arc in the Codex or story metadata';

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
          <div className="mt-3 rounded-sm border border-oak-variant/80 bg-sepia-high/60 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-[9px] font-sans font-semibold uppercase tracking-widest text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary/80" />
                Story pulse
              </span>
              {chapterCount != null && chapterCount > 0 ? (
                <span className="text-ink-muted/80 normal-case">
                  {chapterCount} {chapterCount === 1 ? 'chapter' : 'chapters'}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm font-sans text-ink" title={health}>
              {health}
            </p>
            <div className="mt-2.5 flex items-end justify-between gap-3">
              {focal ? (
                <span
                  className="inline-block max-w-[60%] truncate rounded-full border border-primary/25 bg-primary/8 px-2.5 py-0.5 text-[11px] font-sans text-primary"
                  title={focal}
                >
                  Focal: {focal}
                </span>
              ) : (
                <span className="text-[11px] font-sans leading-snug text-ink-muted">Focal character not set</span>
              )}
              <span className="shrink-0" title={arcTitle}>
                <EmotionalArcSparkline values={emotionalValues} />
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="rounded-sm border border-oak-variant bg-sepia-high px-2 py-1 text-[10px] font-sans uppercase tracking-widest text-primary">
              {status}
            </span>
            <span
              className="hidden max-w-[min(12rem,42vw)] truncate text-right text-[10px] font-mono text-ink-muted/90 group-hover:block"
              title={project.root_path}
            >
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

export default function LibraryHome({onNavigate}: NavigationProps) {
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const selectProject = useProjectStore((s) => s.selectProject);
  const lastError = useProjectStore((s) => s.lastError);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [activityCollapsed, setActivityCollapsed] = useState(() => localStorage.getItem('liteauthor.library.activityCollapsed') === 'true');

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

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
      <header className="flex h-10 min-h-10 items-center justify-between gap-2 border-b border-oak-variant bg-sepia-highest/70 px-4 sm:px-5">
        <div className="flex min-w-0 shrink-0 items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-primary/35 bg-primary/10 font-serif text-sm font-bold text-primary">
            L
          </span>
          <span className="hidden min-w-0 font-sans text-sm font-semibold tracking-wide text-ink sm:inline">LiteAuthor</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
          {searchOpen ? (
            <label className="relative w-full min-w-0 max-w-sm flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-oak" />
              <input
                ref={searchInputRef}
                className="w-full rounded-sm border border-oak-variant bg-sepia-low py-1.5 pl-8 pr-2 text-sm outline-none placeholder:text-ink-muted/70 focus:border-primary/60"
                placeholder="Search projects…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search projects"
              />
            </label>
          ) : null}
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-oak transition hover:bg-sepia-high hover:text-ink"
            title="Search (⌘K)"
            aria-expanded={searchOpen}
            aria-label={searchOpen ? 'Close search' : 'Open search'}
            onClick={() => {
              setSearchOpen((o) => !o);
            }}
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-oak transition hover:bg-sepia-high hover:text-ink"
            title="Settings"
            onClick={() => onNavigate('SettingsScreen', 'push')}
          >
            <Settings className="h-4 w-4" />
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
          <div className="mx-auto flex min-h-[160px] max-w-[1680px] flex-col justify-center px-6 py-7 md:min-h-[180px] md:px-12 md:py-8 xl:px-16">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[10px] font-sans font-medium uppercase tracking-widest text-primary/90">
                  <Sparkles className="h-3.5 w-3.5" />
                  Local manuscripts
                </div>
                <h1 className="font-serif text-2xl font-normal not-italic leading-tight text-ink/90 md:text-3xl">Your manuscripts</h1>
                {projects.length === 0 ? (
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">No projects yet. Start a first manuscript when you are ready.</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 md:shrink-0">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-parchment-bright shadow-sm transition hover:brightness-110"
                  onClick={createProject}
                >
                  <FilePlus2 className="h-4 w-4" />
                  New Project
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1680px] px-6 py-6 md:px-12 md:py-7 xl:px-16">
          {projects.length > 0 ? (
            <div className="mb-6 flex flex-wrap gap-2">
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
                  {item.label} <span className="tabular-nums opacity-90">({counts[item.key]})</span>
                </button>
              ))}
            </div>
          ) : null}

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
