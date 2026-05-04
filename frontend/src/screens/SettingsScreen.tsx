import {useEffect, useMemo, useState} from 'react';
import {Activity, Bot, Database, Eye, FileText, Keyboard, Palette, RefreshCcw, Save, Settings, ShieldCheck, SlidersHorizontal, TriangleAlert} from 'lucide-react';
import {NavigationProps} from '../types';
import {useProjectStore} from '../stores/projectStore';
import {api, type MetricStats, type MetricsSnapshot} from '../lib/api';

type Section = 'Editor' | 'AI & Models' | 'Observability' | 'Reference Notes' | 'Continuity Engine' | 'Appearance' | 'Keyboard Shortcuts' | 'Data & Storage';

const sections: {name: Section; icon: typeof SlidersHorizontal}[] = [
  {name: 'Editor', icon: SlidersHorizontal},
  {name: 'AI & Models', icon: Bot},
  {name: 'Observability', icon: Activity},
  {name: 'Reference Notes', icon: FileText},
  {name: 'Continuity Engine', icon: ShieldCheck},
  {name: 'Appearance', icon: Palette},
  {name: 'Keyboard Shortcuts', icon: Keyboard},
  {name: 'Data & Storage', icon: Database},
];

export default function SettingsScreen({onNavigate}: NavigationProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const wordCount = useProjectStore((s) => s.wordCount);
  const [section, setSection] = useState<Section>('Editor');
  const [fontFamily, setFontFamily] = useState('Georgia');
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [measure, setMeasure] = useState(65);
  const [autosave, setAutosave] = useState('1min');
  const [spellCheck, setSpellCheck] = useState(false);
  const [focusMode, setFocusMode] = useState(true);
  const [typewriter, setTypewriter] = useState(false);
  const [serverUrl, setServerUrl] = useState('http://localhost:8080');
  const [contextTokens, setContextTokens] = useState(4096);
  const [temperature, setTemperature] = useState(0.85);
  const [alternatives, setAlternatives] = useState('1');
  const [streaming, setStreaming] = useState(true);
  const [zenCap, setZenCap] = useState(1500);
  const [agentCap, setAgentCap] = useState(6000);
  const [autoWiki, setAutoWiki] = useState(true);
  const [autoSummary, setAutoSummary] = useState(false);
  const [motifThreshold, setMotifThreshold] = useState(3);
  const [inlineFlags, setInlineFlags] = useState(true);
  const [autoSelection, setAutoSelection] = useState(false);
  const [povLeakage, setPovLeakage] = useState(true);
  const [setupPayoff, setSetupPayoff] = useState(false);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [metricsError, setMetricsError] = useState('');
  const [metricsUpdatedAt, setMetricsUpdatedAt] = useState<Date | null>(null);
  const [autoRefreshMetrics, setAutoRefreshMetrics] = useState(true);

  const wikiPath = useMemo(() => {
    if (!activeProject) return '~/Documents/LiteAuthor/[project]/story/';
    return `${activeProject.root_path}/story/`;
  }, [activeProject]);

  const Toggle = ({checked, onChange}: {checked: boolean; onChange: (value: boolean) => void}) => (
    <button
      type="button"
      className={`w-11 h-6 rounded-full border border-oak-variant p-0.5 transition-colors ${checked ? 'bg-amber-wax-container' : 'bg-sepia-highest'}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className={`block w-4 h-4 rounded-full bg-ink transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  const Row = ({label, detail, children}: {label: string; detail: string; children: React.ReactNode}) => (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(180px,260px)_1fr] gap-4 py-5 border-b border-oak-variant/60">
      <div>
        <div className="font-serif text-base text-ink">{label}</div>
        <p className="text-xs text-ink-muted mt-1 leading-relaxed">{detail}</p>
      </div>
      <div className="flex items-center justify-start md:justify-end">{children}</div>
    </div>
  );

  const loadMetrics = async () => {
    try {
      const next = await api.metrics();
      setMetrics(next);
      setMetricsError('');
      setMetricsUpdatedAt(new Date());
    } catch (e) {
      setMetricsError((e as Error).message);
    }
  };

  useEffect(() => {
    if (section !== 'Observability') return;
    void loadMetrics();
    if (!autoRefreshMetrics) return;
    const id = window.setInterval(() => void loadMetrics(), 5000);
    return () => window.clearInterval(id);
  }, [section, autoRefreshMetrics]);

  const editorSection = (
    <>
      <Row label="Font family" detail="Preview updates locally for the writing surface.">
        <select className="w-64 bg-sepia-high border border-oak-variant p-2 rounded-sm text-sm" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
          {['Palatino', 'Georgia', 'EB Garamond', 'Spectral', 'Charter', 'DM Sans', 'Libre Franklin', 'Lato'].map((font) => <option key={font}>{font}</option>)}
        </select>
      </Row>
      <Row label="Font size" detail="Default 18px.">
        <input className="w-64 accent-amber-wax" type="range" min={14} max={24} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
        <span className="ml-3 text-xs text-ink-muted">{fontSize}px</span>
      </Row>
      <Row label="Line height" detail="Comfortable prose spacing.">
        <input className="w-64 accent-amber-wax" type="range" min={1.5} max={2.2} step={0.1} value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} />
        <span className="ml-3 text-xs text-ink-muted">{lineHeight.toFixed(1)}</span>
      </Row>
      <Row label="Measure" detail="Target line width in characters.">
        <input className="w-64 accent-amber-wax" type="range" min={50} max={80} value={measure} onChange={(e) => setMeasure(Number(e.target.value))} />
        <span className="ml-3 text-xs text-ink-muted">{measure} chars</span>
      </Row>
      <Row label="Autosave interval" detail="Local manuscript save cadence.">
        <select className="w-44 bg-sepia-high border border-oak-variant p-2 rounded-sm text-sm" value={autosave} onChange={(e) => setAutosave(e.target.value)}>
          {['Off', '30s', '1min', '2min', '5min'].map((value) => <option key={value}>{value}</option>)}
        </select>
      </Row>
      <Row label="Spell check" detail="Off by default for literary names and invented words."><Toggle checked={spellCheck} onChange={setSpellCheck} /></Row>
      <Row label="Focus mode default" detail="Start sessions with sidebars collapsed."><Toggle checked={focusMode} onChange={setFocusMode} /></Row>
      <Row label="Typewriter scroll" detail="Keep the cursor near the vertical center."><Toggle checked={typewriter} onChange={setTypewriter} /></Row>
    </>
  );

  const aiSection = (
    <>
      <Row label="Primary model" detail="Model discovery from the MLX server is not wired yet.">
        <select disabled className="w-64 bg-sepia-high border border-oak-variant p-2 rounded-sm text-sm opacity-60">
          <option>Wayfarer 12B (placeholder)</option>
        </select>
      </Row>
      <Row label="MLX server URL" detail="OpenAI-compatible local endpoint.">
        <input className="w-72 bg-sepia-high border border-oak-variant p-2 rounded-sm text-sm" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
      </Row>
      <Row label="Max context tokens" detail="Minimum 2048. Lower is faster.">
        <input className="w-32 bg-sepia-high border border-oak-variant p-2 rounded-sm text-sm" type="number" min={2048} value={contextTokens} onChange={(e) => setContextTokens(Number(e.target.value))} />
      </Row>
      <Row label="Temperature" detail="Higher values produce more variation.">
        <input className="w-64 accent-amber-wax" type="range" min={0} max={1.5} step={0.05} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
        <span className="ml-3 text-xs text-ink-muted">{temperature.toFixed(2)}</span>
      </Row>
      <Row label="Alternatives count" detail="More alternatives use more tokens.">
        <select className="w-24 bg-sepia-high border border-oak-variant p-2 rounded-sm text-sm" value={alternatives} onChange={(e) => setAlternatives(e.target.value)}>
          {['1', '2', '3', '4'].map((value) => <option key={value}>{value}</option>)}
        </select>
      </Row>
      <Row label="Streaming" detail="Turn off for servers that do not support streaming."><Toggle checked={streaming} onChange={setStreaming} /></Row>
      <Row label="Zen Mode token cap" detail="Short requests should stay responsive.">
        <input className="w-32 bg-sepia-high border border-oak-variant p-2 rounded-sm text-sm" type="number" value={zenCap} onChange={(e) => setZenCap(Number(e.target.value))} />
      </Row>
      <Row label="Agent Mode token cap" detail="Allows larger context for deep analysis.">
        <input className="w-32 bg-sepia-high border border-oak-variant p-2 rounded-sm text-sm" type="number" value={agentCap} onChange={(e) => setAgentCap(Number(e.target.value))} />
      </Row>
    </>
  );

  const wikiSection = (
    <>
      <Row label="Reference folder" detail="Local story reference folder for this project.">
        <input readOnly className="w-full max-w-xl bg-sepia-high border border-oak-variant p-2 rounded-sm text-xs font-mono text-ink-muted" value={wikiPath} />
      </Row>
      <Row label="Auto-suggest wiki updates" detail="Prompt after chapter completion."><Toggle checked={autoWiki} onChange={setAutoWiki} /></Row>
      <Row label="Chapter summary auto-generate" detail="Prompt when navigating away from a completed chapter."><Toggle checked={autoSummary} onChange={setAutoSummary} /></Row>
      <Row label="Motif over-use threshold" detail="Uses per chapter before warning.">
        <input className="w-24 bg-sepia-high border border-oak-variant p-2 rounded-sm text-sm" type="number" min={1} value={motifThreshold} onChange={(e) => setMotifThreshold(Number(e.target.value))} />
      </Row>
    </>
  );

  const continuitySection = (
    <>
      <Row label="Show inline flags" detail="Show issue icons in the chapter navigator."><Toggle checked={inlineFlags} onChange={setInlineFlags} /></Row>
      <Row label="Auto-check on selection" detail="Adds latency when opening AI suggestions."><Toggle checked={autoSelection} onChange={setAutoSelection} /></Row>
      <Row label="POV leakage detection" detail="Include POV checks in inline and full runs."><Toggle checked={povLeakage} onChange={setPovLeakage} /></Row>
      <Row label="Setup/payoff tracking" detail="Track narrative promises near manuscript end."><Toggle checked={setupPayoff} onChange={setSetupPayoff} /></Row>
    </>
  );

  const formatMs = (value: number) => {
    if (!Number.isFinite(value)) return '0 ms';
    if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
    return `${value.toFixed(value >= 100 ? 0 : 1)} ms`;
  };

  const formatRate = (value: number) => `${Math.round(value * 100)}%`;

  const metricEntries = useMemo(() => {
    const entries = Object.entries(metrics?.metrics ?? {});
    return entries.sort((a, b) => b[1].p99_ms - a[1].p99_ms);
  }, [metrics]);

  const httpMetrics = metricEntries.filter(([name]) => name.startsWith('http.'));
  const modelMetrics = metricEntries.filter(([name]) => name.startsWith('model.'));
  const topMetrics = metricEntries.slice(0, 4);

  const metricHealth = useMemo(() => {
    if (!metrics) return {label: 'Waiting', tone: 'text-ink-muted', detail: 'No samples loaded yet.'};
    const hasErrors = metricEntries.some(([, stat]) => stat.errors > 0);
    if (hasErrors) return {label: 'Errors', tone: 'text-red-700', detail: 'At least one route or model operation has recorded failures.'};
    return {label: 'Healthy', tone: 'text-emerald-700', detail: 'No errors in the current rolling window.'};
  }, [metrics, metricEntries]);

  const MetricCard = ({name, stat}: {name: string; stat: MetricStats}) => (
    <div className="border border-oak-variant bg-parchment-bright p-4 rounded-sm min-w-0">
      <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted truncate">{name.replace(/^http\./, '').replace(/^model\./, '')}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-serif text-primary">{formatMs(stat.p99_ms)}</p>
          <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted">p99 latency</p>
        </div>
        <div className={`text-right text-xs ${stat.errors ? 'text-red-700' : 'text-ink-muted'}`}>
          <p>{stat.count} calls</p>
          <p>{formatRate(stat.error_rate)} errors</p>
        </div>
      </div>
    </div>
  );

  const MetricTable = ({title, entries}: {title: string; entries: [string, MetricStats][]}) => (
    <div className="border border-oak-variant bg-sepia-low rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-oak-variant bg-sepia-high flex items-center justify-between">
        <h3 className="text-sm font-serif text-primary">{title}</h3>
        <span className="text-[10px] font-sans uppercase tracking-widest text-ink-muted">{entries.length} series</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-ink-muted font-sans">
            <tr className="border-b border-oak-variant/60">
              <th className="text-left font-normal px-4 py-3">Series</th>
              <th className="text-right font-normal px-3 py-3">Count</th>
              <th className="text-right font-normal px-3 py-3">Errors</th>
              <th className="text-right font-normal px-3 py-3">Avg</th>
              <th className="text-right font-normal px-3 py-3">P95</th>
              <th className="text-right font-normal px-4 py-3">P99</th>
            </tr>
          </thead>
          <tbody>
            {entries.length ? entries.map(([name, stat]) => (
              <tr key={name} className="border-b border-oak-variant/40 last:border-b-0">
                <td className="px-4 py-3 font-mono text-xs text-ink max-w-[380px] truncate" title={name}>{name}</td>
                <td className="px-3 py-3 text-right text-ink-muted">{stat.count}</td>
                <td className={`px-3 py-3 text-right ${stat.errors ? 'text-red-700' : 'text-ink-muted'}`}>{stat.errors}</td>
                <td className="px-3 py-3 text-right text-ink-muted">{formatMs(stat.avg_ms)}</td>
                <td className="px-3 py-3 text-right text-ink-muted">{formatMs(stat.p95_ms)}</td>
                <td className="px-4 py-3 text-right font-serif text-primary">{formatMs(stat.p99_ms)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-muted">No samples yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const observabilitySection = (
    <div className="space-y-6">
      <div className="border border-oak-variant bg-sepia-high p-5 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {metricHealth.label === 'Errors' ? <TriangleAlert className="w-5 h-5 text-red-700 mt-0.5" /> : <Activity className="w-5 h-5 text-primary mt-0.5" />}
          <div>
            <p className={`font-serif text-xl ${metricHealth.tone}`}>{metricHealth.label}</p>
            <p className="text-xs text-ink-muted mt-1">{metricHealth.detail}</p>
            <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted mt-2">
              {metricsUpdatedAt ? `Updated ${metricsUpdatedAt.toLocaleTimeString()}` : 'Not refreshed yet'} · rolling window {metrics?.window_samples ?? 0} samples
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <Toggle checked={autoRefreshMetrics} onChange={setAutoRefreshMetrics} />
            Auto
          </label>
          <button type="button" className="px-3 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest flex items-center gap-2" onClick={() => void loadMetrics()}>
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {metricsError ? (
        <div className="border border-red-800/30 bg-red-950/10 text-red-800 p-4 rounded-sm text-sm">{metricsError}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {topMetrics.length ? topMetrics.map(([name, stat]) => <MetricCard key={name} name={name} stat={stat} />) : (
          <div className="border border-oak-variant bg-parchment-bright p-6 rounded-sm text-sm text-ink-muted md:col-span-2 xl:col-span-4">Run the app or call an API endpoint to populate latency samples.</div>
        )}
      </div>

      <MetricTable title="HTTP Routes" entries={httpMetrics} />
      <MetricTable title="Model Operations" entries={modelMetrics} />
    </div>
  );

  const placeholderSection = (
    <div className="border border-oak-variant bg-sepia-high p-8 rounded-sm text-sm text-ink-muted">
      <Eye className="w-6 h-6 text-oak mb-3" />
      <p>This section is laid out for integration. Persistence and system-level controls need backend or Tauri support before the controls can be enabled.</p>
    </div>
  );

  const content = section === 'Editor' ? editorSection : section === 'AI & Models' ? aiSection : section === 'Observability' ? observabilitySection : section === 'Reference Notes' ? wikiSection : section === 'Continuity Engine' ? continuitySection : placeholderSection;

  return (
    <div className="flex h-screen bg-parchment text-ink overflow-hidden">
      <aside className="w-64 bg-sepia-low border-r border-oak-variant flex flex-col">
        <div className="p-6 border-b border-oak-variant">
          <div className="flex items-center gap-2 text-primary">
            <Settings className="w-5 h-5" />
            <h1 className="text-2xl font-serif italic">Settings</h1>
          </div>
          <p className="text-xs text-ink-muted mt-2 truncate">{activeProject?.name ?? 'No project selected'}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                type="button"
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-r-full text-sm text-left ${section === item.name ? 'bg-sepia-highest text-primary font-bold' : 'text-ink-muted hover:bg-sepia-high'}`}
                onClick={() => setSection(item.name)}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 px-8 py-5 bg-sepia-low border-b border-oak-variant flex justify-between items-center">
          <div>
            <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-ink-muted">Preferences</p>
            <h2 className="text-3xl font-serif italic text-primary">{section}</h2>
          </div>
          <div className="flex gap-3">
            <button type="button" className="px-4 py-2 border border-oak-variant rounded-sm text-xs uppercase tracking-widest" onClick={() => onNavigate('ZenEditor', 'push_back')}>
              Back
            </button>
            <button type="button" disabled className="px-4 py-2 bg-primary text-parchment rounded-sm text-xs uppercase tracking-widest flex items-center gap-2 opacity-50" title="Project settings update endpoint is not available yet.">
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </header>

        <section className="p-8 max-w-5xl">
          <div className="border border-oak-variant bg-sepia-low rounded-sm p-6 mb-6">
            <p className="text-sm text-ink-muted">
              Local controls are interactive for preview. Project settings are read from the active project, but saving changes is disabled until a settings update API exists.
            </p>
            <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted mt-3">Current word count: {wordCount.toLocaleString()}</p>
          </div>
          <div className="border border-oak-variant bg-sepia-low rounded-sm p-6">{content}</div>
          {section === 'Editor' ? (
            <div className="mt-6 border border-oak-variant bg-parchment-bright p-8 rounded-sm">
              <p className="text-[10px] font-sans uppercase tracking-widest text-ink-muted mb-3">Preview</p>
              <p style={{fontFamily, fontSize, lineHeight, maxWidth: `${measure}ch`}} className="font-serif text-ink">
                The sentence should have enough room to breathe without drifting away from the page. This preview reflects the editor typography controls above.
              </p>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
