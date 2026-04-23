import {useEffect, useMemo, useState} from 'react';
import {Clock3, FileStack, Plus, RotateCcw, SplitSquareHorizontal} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import {SecondaryPageNav} from '../components/SecondaryPageNav';
import {api} from '../lib/api';

type SnapshotRow = {
  id?: string;
  label?: string | null;
  snapshot_dir?: string;
  created_at?: string;
};

function dayLabel(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
}

function timeLabel(value?: string) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
}

export default function VersionHistory({onNavigate}: NavigationProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const outline = useProjectStore((s) => s.outline);
  const refreshOutline = useProjectStore((s) => s.refreshOutline);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);
  const [scope, setScope] = useState('Whole manuscript');
  const [label, setLabel] = useState('');
  const [stats, setStats] = useState<{chars: number; wiki_chars: number; character_files: number} | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const reload = async () => {
    if (!activeProject) return;
    await refreshOutline();
    const [nextSnapshots, nextStats] = await Promise.all([api.listSnapshots(activeProject.id), api.projectStats(activeProject.id)]);
    setSnapshots(nextSnapshots as SnapshotRow[]);
    setStats(nextStats);
    setSelectedA((current) => current ?? String((nextSnapshots[1] as SnapshotRow | undefined)?.id ?? ''));
    setSelectedB((current) => current ?? String((nextSnapshots[0] as SnapshotRow | undefined)?.id ?? ''));
  };

  useEffect(() => {
    if (!activeProject) return;
    void reload();
  }, [activeProject]);

  const grouped = useMemo(() => {
    return snapshots.reduce<Record<string, SnapshotRow[]>>((acc, snapshot) => {
      const key = dayLabel(snapshot.created_at);
      acc[key] = [...(acc[key] ?? []), snapshot];
      return acc;
    }, {});
  }, [snapshots]);

  const selectedSnapshots = snapshots.filter((snapshot) => snapshot.id === selectedA || snapshot.id === selectedB);

  const createSnapshot = async () => {
    if (!activeProject) return;
    setIsCreating(true);
    try {
      await api.createSnapshot(activeProject.id, label.trim() || undefined);
      setLabel('');
      await reload();
    } finally {
      setIsCreating(false);
    }
  };

  const restoreSelected = async () => {
    if (!activeProject || !selectedB) return;
    if (!window.confirm('Restore the selected newer snapshot? A pre-restore backup will be created first.')) return;
    setIsRestoring(true);
    try {
      await api.restoreSnapshot(activeProject.id, selectedB);
      await reload();
    } finally {
      setIsRestoring(false);
    }
  };

  const deleteSelected = async () => {
    if (!activeProject || !selectedB) return;
    if (!window.confirm('Delete this snapshot permanently?')) return;
    await api.deleteSnapshot(activeProject.id, selectedB);
    setSelectedB(null);
    await reload();
  };

  if (!activeProject) {
    return (
      <div className="flex h-screen items-center justify-center bg-parchment text-ink px-6 text-center">
        <div>
          <p className="font-serif text-lg italic mb-4">Select a project before opening version history.</p>
          <button type="button" className="font-sans text-xs uppercase px-4 py-2 bg-primary text-parchment rounded-sm" onClick={() => onNavigate('StoryWikiHub', 'push_back')}>
            Project Desk
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment text-ink">
      <main>
        <SecondaryPageNav
          eyebrow={scope}
          title="Versions"
          projectName={activeProject.name}
          active="wiki"
          onNavigate={onNavigate}
        />

        <section className="mx-auto max-w-[1180px] space-y-5 px-5 py-6 md:px-8">
          <div className="rounded-sm border border-oak-variant bg-sepia-low p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-serif text-xl italic text-primary">Create a snapshot</h2>
                <p className="mt-1 text-sm text-ink-muted">Capture the manuscript and reference notes before a risky edit.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  className="h-10 min-w-56 rounded-sm border border-oak-variant bg-parchment-bright px-3 text-xs outline-none focus:border-primary"
                  placeholder="Snapshot label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-sm bg-primary px-4 font-sans text-xs uppercase tracking-widest text-parchment disabled:opacity-50"
                  onClick={() => void createSnapshot()}
                  disabled={isCreating}
                >
                  <Plus className="w-4 h-4" />
                  {isCreating ? 'Saving' : 'New snapshot'}
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-sans uppercase tracking-widest">
              {['Whole manuscript', 'Current chapter', 'Current scene'].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-sm border px-3 py-2 ${scope === value ? 'border-primary bg-sepia-highest text-primary' : 'border-oak-variant bg-parchment-bright text-ink-muted hover:text-ink'}`}
                  onClick={() => setScope(value)}
                >
                  {value.replace('Current ', '')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="border border-oak-variant bg-sepia-low p-5 rounded-sm">
              <Clock3 className="w-5 h-5 text-oak mb-3" />
              <div className="text-2xl font-serif text-primary">{snapshots.length}</div>
              <p className="text-xs text-ink-muted uppercase tracking-widest">snapshots</p>
            </div>
            <div className="border border-oak-variant bg-sepia-low p-5 rounded-sm">
              <FileStack className="w-5 h-5 text-oak mb-3" />
              <div className="text-2xl font-serif text-primary">{outline?.scenes.length ?? 0}</div>
              <p className="text-xs text-ink-muted uppercase tracking-widest">scenes tracked</p>
            </div>
            <div className="border border-oak-variant bg-sepia-low p-5 rounded-sm">
              <SplitSquareHorizontal className="w-5 h-5 text-oak mb-3" />
              <div className="text-2xl font-serif text-primary">{stats?.chars.toLocaleString() ?? '—'}</div>
              <p className="text-xs text-ink-muted uppercase tracking-widest">reference chars</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <section className="rounded-sm border border-oak-variant bg-sepia-low p-4">
              <h2 className="font-sans text-[10px] uppercase tracking-widest text-ink-muted">Snapshots</h2>
              <div className="mt-3 max-h-[420px] space-y-5 overflow-y-auto pr-1">
                {Object.entries(grouped).map(([day, rows]) => (
                  <section key={day}>
                    <h3 className="mb-2 font-sans text-[10px] uppercase tracking-widest text-ink-muted">{day}</h3>
                    <div className="space-y-2">
                      {rows.map((snapshot) => {
                        const id = String(snapshot.id ?? '');
                        const selected = id === selectedA || id === selectedB;
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`w-full rounded-sm border p-3 text-left hover:border-primary ${selected ? 'border-primary bg-sepia-highest' : 'border-oak-variant bg-parchment-bright'}`}
                            onClick={() => {
                              if (!selectedA || selectedA === id) setSelectedA(id);
                              else setSelectedB(id);
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-serif text-ink">{snapshot.label || 'Autosave'}</span>
                              <span className="font-sans text-[10px] text-ink-muted">{timeLabel(snapshot.created_at)}</span>
                            </div>
                            <p className="mt-1 truncate font-mono text-[10px] text-ink-muted">{snapshot.snapshot_dir ?? id}</p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
                {snapshots.length === 0 ? <p className="text-sm text-ink-muted italic">No snapshots yet. Create one before a risky edit.</p> : null}
              </div>
            </section>

            <section className="space-y-5">
              <div className="rounded-sm border border-oak-variant bg-sepia-low p-5">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-xl italic">Selected snapshots</h3>
                    <p className="text-sm text-ink-muted">Choose two entries to prepare a compare.</p>
                  </div>
                  <button type="button" disabled className="rounded-sm border border-oak-variant px-4 py-2 text-xs uppercase tracking-widest opacity-50" title="Snapshot diff endpoint is not available yet.">
                    Generate diff
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {[selectedA, selectedB].map((selectedId, index) => {
                    const snapshot = snapshots.find((s) => s.id === selectedId);
                    return (
                      <div key={index} className="min-h-52 rounded-sm border border-oak-variant bg-parchment-bright/40 p-5">
                        <p className="mb-2 font-sans text-[10px] uppercase tracking-widest text-ink-muted">{index === 0 ? 'Older' : 'Newer'}</p>
                        {snapshot ? (
                          <>
                            <h4 className="text-2xl font-serif text-primary">{snapshot.label || 'Autosave'}</h4>
                            <p className="mt-2 text-sm text-ink-muted">{dayLabel(snapshot.created_at)} · {timeLabel(snapshot.created_at)}</p>
                            <p className="mt-4 break-all font-mono text-xs text-ink-muted">{snapshot.snapshot_dir}</p>
                          </>
                        ) : (
                          <p className="text-sm italic text-ink-muted">Select a snapshot.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-sm border border-oak-variant bg-sepia-high p-5">
                <div className="flex items-start gap-3">
                  <RotateCcw className="w-5 h-5 text-oak shrink-0" />
                  <div>
                    <h3 className="font-serif text-lg italic">Recovery controls</h3>
                    <p className="mt-1 text-sm text-ink-muted">Restore and delete are available after selecting a newer snapshot. Compare and export stay disabled until backend support exists.</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!selectedB || isRestoring}
                    className="rounded-sm border border-oak-variant px-3 py-2 text-xs uppercase tracking-widest hover:border-primary disabled:opacity-50"
                    onClick={() => void restoreSelected()}
                  >
                    {isRestoring ? 'Restoring...' : 'Restore snapshot'}
                  </button>
                  <button type="button" disabled className="rounded-sm border border-oak-variant px-3 py-2 text-xs uppercase tracking-widest opacity-50">
                    Export plain text
                  </button>
                  <button
                    type="button"
                    disabled={!selectedB}
                    className="rounded-sm border border-oak-variant px-3 py-2 text-xs uppercase tracking-widest text-red-900 hover:border-red-600 disabled:opacity-50"
                    onClick={() => void deleteSelected()}
                  >
                    Delete snapshot
                  </button>
                </div>
              </div>
            </section>
          </div>

          {selectedSnapshots.length > 0 ? (
            <div className="text-xs text-ink-muted">
              Comparing locally is pending. Selected IDs: {selectedSnapshots.map((snapshot) => snapshot.id).join(' / ')}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
