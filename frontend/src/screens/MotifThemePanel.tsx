import {useEffect, useMemo, useState} from 'react';
import {BookOpen, Layers3, Pencil, Plus, Save, Search, Sparkles, TriangleAlert} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import {SecondaryPageNav} from '../components/SecondaryPageNav';
import {api, type Scene} from '../lib/api';

type Motif = {
  name: string;
  description: string;
};

type Occurrence = {
  sceneId: string;
  sceneTitle: string;
  chapterTitle: string;
  chapterIndex: number;
  count: number;
  snippet: string;
};

const MOTIFS_PATH = 'story/motifs.md';

function parseMotifs(markdown: string): Motif[] {
  const lines = markdown.split('\n');
  const motifs: Motif[] = [];
  let current: Motif | null = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) {
      if (current) motifs.push(current);
      current = {name: heading[1].trim(), description: ''};
    } else if (current) {
      current.description = `${current.description}${current.description ? '\n' : ''}${line}`.trim();
    }
  }

  if (current) motifs.push(current);
  return motifs.filter((m) => m.name.length > 0);
}

function countNeedle(haystack: string, needle: string) {
  if (!needle.trim()) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (haystack.match(new RegExp(`\\b${escaped}\\b`, 'gi')) ?? []).length;
}

function firstSnippet(markdown: string, motif: string) {
  const lower = markdown.toLowerCase();
  const at = lower.indexOf(motif.toLowerCase());
  if (at < 0) return markdown.replace(/\s+/g, ' ').slice(0, 120);
  return markdown
    .slice(Math.max(0, at - 54), Math.min(markdown.length, at + motif.length + 66))
    .replace(/\s+/g, ' ')
    .trim();
}

export default function MotifThemePanel({onNavigate}: NavigationProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const outline = useProjectStore((s) => s.outline);
  const refreshOutline = useProjectStore((s) => s.refreshOutline);
  const setActiveScene = useProjectStore((s) => s.setActiveScene);

  const [motifsMarkdown, setMotifsMarkdown] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loadState, setLoadState] = useState('Loading motifs...');

  useEffect(() => {
    if (!activeProject) return;
    (async () => {
      setLoadState('Loading motifs...');
      try {
        await refreshOutline();
        const file = await api.wikiGet(activeProject.id, MOTIFS_PATH);
        setMotifsMarkdown(file.content);
        const first = parseMotifs(file.content)[0]?.name ?? '';
        setSelectedName((current) => current || first);
        setLoadState('');
      } catch {
        const starter = '# Motifs and Themes\n\n## Light\nHow light changes meaning across the manuscript.\n\n## Letters\nMessages, secrets, and delayed knowledge.\n';
        setMotifsMarkdown(starter);
        setSelectedName('Light');
        setLoadState('motifs.md has not been created yet; saving will create it.');
      }
    })();
  }, [activeProject, refreshOutline]);

  const motifs = useMemo(() => parseMotifs(motifsMarkdown), [motifsMarkdown]);
  const selected = motifs.find((m) => m.name === selectedName) ?? motifs[0] ?? null;
  const chapters = outline?.chapters ?? [];
  const scenes = outline?.scenes ?? [];

  useEffect(() => {
    if (!activeProject || !selected || scenes.length === 0) {
      setOccurrences([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const chapterById = new Map(chapters.map((chapter, index) => [chapter.id, {chapter, index}]));
      const rows: Occurrence[] = [];
      await Promise.all(
        scenes.map(async (scene: Scene) => {
          try {
            const content = await api.getSceneContent(activeProject.id, scene.id);
            const count = countNeedle(content.markdown, selected.name);
            const chapterMeta = chapterById.get(scene.chapter_id);
            if (count > 0 && chapterMeta) {
              rows.push({
                sceneId: scene.id,
                sceneTitle: scene.title,
                chapterTitle: chapterMeta.chapter.title,
                chapterIndex: chapterMeta.index,
                count,
                snippet: firstSnippet(content.markdown, selected.name),
              });
            }
          } catch {
            // Scene scanning is best-effort; the wiki remains editable even if a scene file is missing.
          }
        }),
      );
      if (!cancelled) setOccurrences(rows.sort((a, b) => a.chapterIndex - b.chapterIndex || a.sceneTitle.localeCompare(b.sceneTitle)));
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject, chapters, scenes, selected]);

  const heat = useMemo(() => {
    return chapters.map((chapter, index) => ({
      id: chapter.id,
      title: chapter.title,
      count: occurrences.filter((o) => o.chapterIndex === index).reduce((sum, o) => sum + o.count, 0),
    }));
  }, [chapters, occurrences]);

  const overused = heat.filter((h) => h.count > 3);

  const saveMotifs = async () => {
    if (!activeProject) return;
    setIsSaving(true);
    try {
      await api.wikiPut(activeProject.id, MOTIFS_PATH, motifsMarkdown);
      setLoadState('Saved to story/motifs.md');
    } finally {
      setIsSaving(false);
    }
  };

  const addMotif = () => {
    const name = window.prompt('Motif name');
    if (!name?.trim()) return;
    const block = `\n\n## ${name.trim()}\nDescribe what this motif means, where it should evolve, and which character arcs it touches.\n`;
    setMotifsMarkdown((current) => `${current.trimEnd()}${block}`);
    setSelectedName(name.trim());
  };

  if (!activeProject) {
    return (
      <div className="flex h-screen items-center justify-center bg-parchment text-ink px-6 text-center">
        <div>
          <p className="font-serif text-lg italic mb-4">Select a project before opening motifs.</p>
          <button type="button" className="font-sans text-xs uppercase px-4 py-2 bg-primary text-parchment rounded-sm" onClick={() => onNavigate('StoryWikiHub', 'push_back')}>
            Story Wiki
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-parchment text-ink">
      <aside className="w-72 bg-sepia-low border-r border-oak-variant flex flex-col">
        <div className="p-6 border-b border-oak-variant">
          <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted">Story Wiki</p>
          <h1 className="text-2xl font-serif italic text-primary mt-1">Motifs</h1>
        </div>
        <nav className="p-4 space-y-2">
          <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-sm text-ink-muted hover:bg-sepia-high bg-transparent border-none text-left" onClick={() => onNavigate('StoryWikiHub', 'push_back')}>
            <BookOpen className="w-4 h-4" />
            Story Bible
          </button>
          <div className="w-full flex items-center gap-3 px-4 py-3 text-sm bg-sepia-highest text-primary font-bold rounded-r-full">
            <Layers3 className="w-4 h-4" />
            Motif Map
          </div>
        </nav>
        <div className="px-6 py-4 mt-auto border-t border-oak-variant text-xs text-ink-muted">
          {loadState || 'Scanning scene text for recurrence counts.'}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <SecondaryPageNav
          eyebrow="Explicit canon"
          title="Motif & Theme Panel"
          projectName={activeProject.name}
          active="wiki"
          onNavigate={onNavigate}
          actions={
            <>
            <button type="button" className="px-4 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest flex items-center gap-2" onClick={addMotif}>
              <Plus className="w-4 h-4" />
              Add motif
            </button>
            <button type="button" className="px-4 py-2 bg-primary text-parchment rounded-sm text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-50" onClick={() => void saveMotifs()} disabled={isSaving}>
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving' : 'Save'}
            </button>
            </>
          }
        />

        <section className="px-8 py-8 border-b border-oak-variant bg-parchment-dim">
          <div className="flex flex-wrap gap-3">
            {motifs.map((motif) => {
              const total = occurrences.filter((o) => o.count > 0 && motif.name === selected?.name).reduce((sum, o) => sum + o.count, 0);
              const selectedMotif = motif.name === selected?.name;
              return (
                <button
                  key={motif.name}
                  type="button"
                  className={`px-4 py-2 rounded-full border text-sm font-serif ${
                    selectedMotif ? 'border-primary bg-amber-wax-container text-parchment' : 'border-oak-variant bg-sepia-high text-ink hover:border-primary'
                  }`}
                  onClick={() => setSelectedName(motif.name)}
                >
                  {motif.name}
                  {selectedMotif && total > 0 ? <span className="ml-2 font-sans text-[10px]">{total}</span> : null}
                </button>
              );
            })}
            {motifs.length === 0 ? <span className="text-sm text-ink-muted italic">Add headings like “## Mirrors” to story/motifs.md.</span> : null}
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-8 p-8">
          <section className="space-y-6">
            <div className="border border-oak-variant bg-sepia-low p-6 rounded-sm">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted">Selected</p>
                  <h3 className="text-4xl font-serif italic text-primary mt-1">{selected?.name ?? 'No motif selected'}</h3>
                </div>
                <button type="button" disabled className="px-4 py-2 rounded-sm border border-oak-variant text-xs uppercase tracking-widest opacity-50 flex items-center gap-2" title="AI echo opens Suggestion Panel after integration.">
                  <Sparkles className="w-4 h-4" />
                  Echo in selection
                </button>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-ink-muted whitespace-pre-wrap">{selected?.description || 'Write a description in the markdown editor.'}</p>
            </div>

            {overused.length > 0 ? (
              <div className="border border-amber-500/40 bg-amber-500/10 p-4 rounded-sm flex gap-3 text-sm">
                <TriangleAlert className="w-5 h-5 text-amber-wax shrink-0" />
                <div>
                  <div className="font-bold text-primary">Over-use warning</div>
                  <p className="text-ink-muted">Used more than 3 times in {overused.map((h) => h.title).join(', ')}. The threshold is configurable in Settings once persistence is available.</p>
                </div>
              </div>
            ) : null}

            <div className="border border-oak-variant bg-sepia-low p-6 rounded-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-serif text-xl italic">Recurrence heatmap</h4>
                <span className="text-[10px] font-sans uppercase tracking-widest text-ink-muted">chapter cells</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {heat.map((cell) => (
                  <div key={cell.id} className="group relative">
                    <div className={`w-10 h-10 rounded-sm border border-oak-variant ${cell.count === 0 ? 'bg-sepia-high' : cell.count < 3 ? 'bg-amber-wax-container/50' : 'bg-amber-wax'}`} />
                    <div className="absolute hidden group-hover:block z-20 top-12 left-0 min-w-44 bg-parchment-bright border border-oak-variant p-2 text-xs shadow-xl">
                      {cell.title}: {cell.count} use{cell.count === 1 ? '' : 's'}
                    </div>
                  </div>
                ))}
                {heat.length === 0 ? <span className="text-sm text-ink-muted">No chapters loaded yet.</span> : null}
              </div>
            </div>

            <div className="border border-oak-variant bg-sepia-low p-6 rounded-sm">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-4 h-4 text-oak" />
                <h4 className="font-serif text-xl italic">All occurrences</h4>
              </div>
              <div className="space-y-3">
                {occurrences.length === 0 ? <p className="text-sm text-ink-muted italic">No scene text currently contains this motif label.</p> : null}
                {occurrences.map((occurrence) => (
                  <button
                    key={`${occurrence.sceneId}-${occurrence.count}`}
                    type="button"
                    className="w-full text-left border border-oak-variant bg-parchment-bright/40 p-4 rounded-sm hover:border-primary"
                    onClick={() => {
                      setActiveScene(occurrence.sceneId);
                      onNavigate('ZenEditor', 'push');
                    }}
                  >
                    <div className="flex justify-between gap-4 text-xs font-sans uppercase tracking-widest text-ink-muted">
                      <span>{occurrence.chapterTitle} · {occurrence.sceneTitle}</span>
                      <span>{occurrence.count}x</span>
                    </div>
                    <p className="mt-2 text-sm font-serif text-ink">{occurrence.snippet || 'Occurrence found in scene.'}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="border border-oak-variant bg-sepia-high p-4 rounded-sm h-fit sticky top-28">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-serif text-lg italic">Theme Notes</h4>
              <Pencil className="w-4 h-4 text-oak" />
            </div>
            <textarea
              className="w-full h-[620px] bg-parchment-bright border border-oak-variant rounded-sm p-4 text-xs font-mono text-ink leading-relaxed"
              value={motifsMarkdown}
              onChange={(e) => setMotifsMarkdown(e.target.value)}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
