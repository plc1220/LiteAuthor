import {useMemo, useState} from 'react';
import {X} from 'lucide-react';

export type ContextInspectorTab = 'task' | 'selection' | 'style' | 'motifs' | 'threads' | 'fullPacket';

export type ContextInspectorSection = {
  label?: string;
  text: string;
  tokens?: number;
};

export type ContextInspectorTokenBudget = {
  used: number;
  max: number;
};

export type ContextInspectorSections = {
  task?: ContextInspectorSection;
  selection?: ContextInspectorSection;
  style?: ContextInspectorSection;
  motifs?: ContextInspectorSection;
  threads?: ContextInspectorSection;
  fullPacket?: ContextInspectorSection;
};

export type ContextInspectorProps = {
  title?: string;
  subtitle?: string;
  tokenBudget: ContextInspectorTokenBudget;
  sections: ContextInspectorSections;
  defaultTab?: ContextInspectorTab;
  className?: string;
  onClose?: () => void;
};

const TABS: {id: ContextInspectorTab; label: string}[] = [
  {id: 'task', label: 'Task'},
  {id: 'selection', label: 'Selection'},
  {id: 'style', label: 'Style'},
  {id: 'motifs', label: 'Motifs'},
  {id: 'threads', label: 'Threads'},
  {id: 'fullPacket', label: 'Full Packet'},
];

function approxTokens(text: string): number {
  return Math.max(0, Math.ceil(text.trim().length / 4));
}

function tokenColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-wax';
  return 'bg-teal-500';
}

export function ContextInspector({
  title = 'Context Inspector',
  subtitle,
  tokenBudget,
  sections,
  defaultTab = 'task',
  className = '',
  onClose,
}: ContextInspectorProps) {
  const [activeTab, setActiveTab] = useState<ContextInspectorTab>(defaultTab);
  const sectionEntries = useMemo(
    () =>
      TABS.map((tab) => {
        const section = sections[tab.id];
        const text = section?.text ?? '';
        return {
          ...tab,
          label: section?.label ?? tab.label,
          text,
          tokens: section?.tokens ?? approxTokens(text),
        };
      }),
    [sections],
  );
  const activeSection = sectionEntries.find((section) => section.id === activeTab) ?? sectionEntries[0];
  const maxTokens = Math.max(1, tokenBudget.max);
  const usedTokens = Math.max(0, tokenBudget.used);
  const percent = Math.min(100, Math.round((usedTokens / maxTokens) * 100));

  return (
    <aside className={`w-full max-w-[560px] bg-sepia-mid border-l border-oak-variant text-ink shadow-2xl flex flex-col ${className}`}>
      <header className="p-4 border-b border-oak-variant bg-sepia-high">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-sans text-[10px] uppercase tracking-widest text-ink-muted">{title}</div>
            {subtitle ? <h2 className="mt-1 font-serif text-lg font-semibold text-primary">{subtitle}</h2> : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-sm text-ink-muted hover:text-ink hover:bg-sepia-highest"
              aria-label="Close context inspector"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-[10px] font-sans uppercase tracking-widest text-ink-muted">
            <span>Token budget</span>
            <span>
              {usedTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-sepia-low border border-oak-variant">
            <div className={`h-full ${tokenColor(percent)}`} style={{width: `${percent}%`}} />
          </div>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 p-3 border-b border-oak-variant bg-sepia-mid">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-sm border font-sans text-[10px] uppercase tracking-widest ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-sepia-highest'
                : 'border-oak-variant text-ink-muted hover:text-ink hover:border-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-serif text-base font-semibold text-ink">{activeSection.label}</h3>
          <span className="font-sans text-[10px] uppercase tracking-widest text-ink-muted">
            {activeSection.tokens.toLocaleString()} tok
          </span>
        </div>
        {activeSection.text ? (
          <pre
            className={`whitespace-pre-wrap rounded-sm border border-oak-variant bg-parchment-bright p-4 text-sm leading-relaxed text-ink ${
              activeTab === 'fullPacket' ? 'font-mono text-xs' : 'font-serif'
            }`}
          >
            {activeSection.text}
          </pre>
        ) : (
          <div className="rounded-sm border border-dashed border-oak-variant bg-parchment-bright/40 p-4 text-sm italic text-ink-muted">
            No context was provided for this section.
          </div>
        )}
      </div>

      <footer className="border-t border-oak-variant bg-sepia-high p-4">
        <div className="font-sans text-[10px] uppercase tracking-widest text-ink-muted mb-2">Section budget</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-muted">
          {sectionEntries.map((section) => (
            <div key={section.id} className="flex justify-between gap-2">
              <span className="truncate">{section.label}</span>
              <span className="font-mono">{section.tokens.toLocaleString()} tok</span>
            </div>
          ))}
        </div>
      </footer>
    </aside>
  );
}
