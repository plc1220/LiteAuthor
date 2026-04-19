import {useEffect, useMemo, useState} from 'react';
import {Clock3, FileStack, GitBranch, History, Plus, RotateCcw, SplitSquareHorizontal} from 'lucide-react';
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
            Story Wiki
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-parchment text-ink overflow-hidden">
      <aside className="w-[340px] bg-sepia-low border-r border-oak-variant flex flex-col">
        <div className="p-6 border-b border-oak-variant">
          <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted">{activeProject.name}</p>
          <h1 className="text-2xl font-serif italic text-primary flex items-center gap-2 mt-1">
            <History className="w-5 h-5" />
            Version History
          </h1>
        </div>

        <div className="p-4 border-b border-oak-variant space-y-3">
          <div className="flex gap-2">
            <input className="flex-1 bg-sepia-high border border-oak-variant p-2 rounded-sm text-xs" placeholder="Snapshot label" value={label} onChange={(e) => setLabel(e.target.value)} />
            <button type="button" className="px-3 bg-primary text-parchment rounded-sm disabled:opacity-50" onClick={() => void createSnapshot()} disabled={isCreating} title="New snapshot">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px] font-sans uppercase tracking-widest">
            {['Whole manuscript', 'Current chapter', 'Current scene'].map((value) => (
              <button
                key={value}
                type="button"
                className={`px-2 py-2 rounded-sm border ${scope === value ? 'bg-amber-wax-container text-parchment border-primary' : 'bg-sepia-high border-oak-variant text-ink-muted'}`}
                onClick={() => setScope(value)}
              >
                {value.replace('Current ', '')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Object.entries(grouped).map(([day, rows]) => (
            <section key={day}>
              <h2 className="text-[10px] font-sans uppercase tracking-widest text-ink-muted mb-2">{day}</h2>
              <div className="space-y-2">
                {rows.map((snapshot) => {
                  const id = String(snapshot.id ?? '');
                  const selected = id === selectedA || id === selectedB;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`w-full border rounded-sm p-3 text-left hover:border-primary ${selected ? 'border-primary bg-sepia-highest' : 'border-oak-variant bg-sepia-high'}`}
                      onClick={() => {
                        if (!selectedA || selectedA === id) setSelectedA(id);
                        else setSelectedB(id);
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-serif text-ink">{snapshot.label || 'Autosave'}</span>
                        <span className="text-[10px] text-ink-muted font-sans">{timeLabel(snapshot.created_at)}</span>
                      </div>
                      <p className="mt-1 text-[10px] font-mono text-ink-muted truncate">{snapshot.snapshot_dir ?? id}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {snapshots.length === 0 ? <p className="text-sm text-ink-muted italic">No snapshots yet. Create one to capture manuscript and story wiki folders.</p> : null}

          <section className="border-t border-oak-variant pt-5">
            <h2 className="text-[10px] font-sans uppercase tracking-widest text-ink-muted mb-2">Branches</h2>
            <div className="space-y-2 opacity-60">
              {['Aria arc variant', 'Ch.5 darker version'].map((branch) => (
                <button key={branch} type="button" disabled className="w-full flex items-center gap-2 border border-oak-variant bg-sepia-high p-3 rounded-sm text-left text-sm">
                  <GitBranch className="w-4 h-4" />
                  {branch}
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <SecondaryPageNav
          eyebrow={`View: Main Branch · ${scope}`}
          title="Artifacts & Version History"
          projectName={activeProject.name}
          onNavigate={onNavigate}
        />

        <section className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-xs text-ink-muted uppercase tracking-widest">project md chars</p>
            </div>
          </div>

          <div className="border border-oak-variant bg-sepia-low rounded-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-serif italic">Selected snapshots</h3>
                <p className="text-sm text-ink-muted">Select two entries from the list to prepare a compare.</p>
              </div>
              <button type="button" disabled className="px-4 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest opacity-50" title="Snapshot diff endpoint is not available yet.">
                Generate diff
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[selectedA, selectedB].map((selectedId, index) => {
                const snapshot = snapshots.find((s) => s.id === selectedId);
                return (
                  <div key={index} className="min-h-64 border border-oak-variant bg-parchment-bright/40 rounded-sm p-5">
                    <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted mb-2">{index === 0 ? 'Older' : 'Newer'}</p>
                    {snapshot ? (
                      <>
                        <h4 className="text-2xl font-serif text-primary">{snapshot.label || 'Autosave'}</h4>
                        <p className="text-sm text-ink-muted mt-2">{dayLabel(snapshot.created_at)} · {timeLabel(snapshot.created_at)}</p>
                        <p className="text-xs font-mono text-ink-muted mt-4 break-all">{snapshot.snapshot_dir}</p>
                      </>
                    ) : (
                      <p className="text-sm text-ink-muted italic">Select a snapshot.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border border-oak-variant bg-sepia-high rounded-sm p-6">
            <div className="flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-oak shrink-0" />
              <div>
                <h3 className="font-serif text-lg italic">Restore and branch controls</h3>
                <p className="text-sm text-ink-muted mt-1">
                  Snapshot creation, browsing, restore, and delete are live. Paragraph-level restore, branch switching, merge, export, and diff generation still need deeper backend support.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!selectedB || isRestoring}
                className="px-3 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest hover:border-primary disabled:opacity-50"
                onClick={() => void restoreSelected()}
              >
                {isRestoring ? 'Restoring...' : 'Restore snapshot'}
              </button>
              <button type="button" disabled className="px-3 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest opacity-50">
                Branch from here
              </button>
              <button type="button" disabled className="px-3 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest opacity-50">
                Export plain text
              </button>
              <button
                type="button"
                disabled={!selectedB}
                className="px-3 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest text-red-200 hover:border-red-300 disabled:opacity-50"
                onClick={() => void deleteSelected()}
              >
                Delete snapshot
              </button>
            </div>
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
