import {useMemo, useState} from 'react';
import {ArrowLeft, ArrowRight, GitBranch, MessageSquare, RefreshCw, Send, X} from 'lucide-react';
import {diffWords} from 'diff';

export type SuggestionPanelView = 'original' | 'suggestion' | 'diff' | 'split';

export type SuggestionAlternative = {
  id: string;
  label?: string;
  proposedText: string;
  explanation?: string;
};

export type SuggestionPanelAction = 'accept' | 'reject' | 'branch' | 'note' | 'regenerate';

export type SuggestionPanelProps = {
  actionLabel: string;
  contextBreadcrumb?: string;
  originalText: string;
  alternatives: SuggestionAlternative[];
  activeAlternativeId?: string;
  defaultView?: SuggestionPanelView;
  busy?: boolean;
  unsupportedActions?: SuggestionPanelAction[];
  /** When true, show “Insert below” beside Accept / Reject (e.g. expand-with-choice). */
  showInsertBelow?: boolean;
  acceptLabel?: string;
  rejectLabel?: string;
  className?: string;
  onAccept?: (alternative: SuggestionAlternative) => void;
  onReject?: (alternative: SuggestionAlternative) => void;
  onInsertBelow?: (alternative: SuggestionAlternative) => void;
  onBranch?: (alternative: SuggestionAlternative) => void;
  onNote?: (alternative: SuggestionAlternative) => void;
  onRegenerate?: () => void;
  onRegenerateWithInstruction?: (instruction: string) => void;
  onShowContextInspector?: () => void;
  onClose?: () => void;
  onAlternativeChange?: (alternative: SuggestionAlternative) => void;
};

const VIEWS: {id: SuggestionPanelView; label: string}[] = [
  {id: 'suggestion', label: 'Suggestion'},
  {id: 'split', label: 'Split'},
  {id: 'diff', label: 'Diff'},
  {id: 'original', label: 'Original'},
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitParagraphs(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.length ? paragraphs : [''];
}

function actionDisabled(
  action: SuggestionPanelAction,
  busy: boolean | undefined,
  unsupportedActions: SuggestionPanelAction[] | undefined,
  handler?: () => void,
): boolean {
  return Boolean(busy || unsupportedActions?.includes(action) || !handler);
}

export function SuggestionPanel({
  actionLabel,
  contextBreadcrumb,
  originalText,
  alternatives,
  activeAlternativeId,
  defaultView = 'diff',
  busy,
  unsupportedActions,
  showInsertBelow,
  acceptLabel = 'Replace selected text',
  rejectLabel = 'Keep original',
  className = '',
  onAccept,
  onReject,
  onInsertBelow,
  onBranch,
  onNote,
  onRegenerate,
  onRegenerateWithInstruction,
  onShowContextInspector,
  onClose,
  onAlternativeChange,
}: SuggestionPanelProps) {
  const initialIndex = Math.max(
    0,
    alternatives.findIndex((alternative) => alternative.id === activeAlternativeId),
  );
  const [view, setView] = useState<SuggestionPanelView>(defaultView);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [affectedOpen, setAffectedOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const activeAlternative = alternatives[activeIndex] ?? alternatives[0];
  const proposedText = activeAlternative?.proposedText ?? '';
  const diffParts = useMemo(() => diffWords(originalText, proposedText), [originalText, proposedText]);
  const originalParagraphs = useMemo(() => splitParagraphs(originalText), [originalText]);
  const proposedParagraphs = useMemo(() => splitParagraphs(proposedText), [proposedText]);
  const paragraphCount = Math.max(originalParagraphs.length, proposedParagraphs.length);

  const setAlternative = (nextIndex: number) => {
    if (!alternatives.length) return;
    const normalized = (nextIndex + alternatives.length) % alternatives.length;
    setActiveIndex(normalized);
    onAlternativeChange?.(alternatives[normalized]);
  };

  const renderDiff = () => (
    <div className="font-serif text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
      {diffParts.map((part, index) => {
        if (part.added) {
          return (
            <span key={index} className="bg-emerald-700/15 text-ink border-b border-emerald-700/25">
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span key={index} className="bg-red-900/20 text-ink-muted line-through decoration-red-900/40">
              {part.value}
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );

  const renderContent = () => {
    if (!activeAlternative) {
      return (
        <div className="rounded-sm border border-dashed border-oak-variant bg-parchment-bright/60 p-4 text-sm italic text-ink-muted">
          No suggestion is available yet.
        </div>
      );
    }

    if (view === 'original') {
      return <div className="font-serif text-[13px] leading-relaxed whitespace-pre-wrap text-ink">{originalText}</div>;
    }
    if (view === 'suggestion') {
      return <div className="font-serif text-[13px] leading-relaxed whitespace-pre-wrap text-ink">{proposedText}</div>;
    }
    if (view === 'split') {
      return (
        <div className="grid grid-cols-2 gap-4 text-[13px]">
          <div>
            <div className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Original</div>
            {Array.from({length: paragraphCount}).map((_, index) => (
              <p
                key={index}
                className="mb-3 rounded-sm border border-oak-variant bg-parchment-bright/80 p-3 font-serif leading-relaxed text-ink"
              >
                {originalParagraphs[index] ?? ''}
              </p>
            ))}
          </div>
          <div>
            <div className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Suggestion</div>
            {Array.from({length: paragraphCount}).map((_, index) => (
              <p
                key={index}
                className="mb-3 rounded-sm border border-oak-variant bg-parchment-bright/80 p-3 font-serif leading-relaxed text-ink"
              >
                {proposedParagraphs[index] ?? ''}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return renderDiff();
  };

  const selectionSummary = contextBreadcrumb ?? `Selection: ${countWords(originalText).toLocaleString()} words`;
  const acceptDisabled = actionDisabled('accept', busy, unsupportedActions, activeAlternative && onAccept ? () => onAccept(activeAlternative) : undefined);
  const rejectDisabled = actionDisabled('reject', busy, unsupportedActions, activeAlternative && onReject ? () => onReject(activeAlternative) : undefined);
  const branchDisabled = actionDisabled('branch', busy, unsupportedActions, activeAlternative && onBranch ? () => onBranch(activeAlternative) : undefined);
  const noteDisabled = actionDisabled('note', busy, unsupportedActions, activeAlternative && onNote ? () => onNote(activeAlternative) : undefined);
  const regenerateDisabled = actionDisabled('regenerate', busy, unsupportedActions, onRegenerate);
  const insertBelowDisabled = Boolean(busy || !activeAlternative || !onInsertBelow);

  return (
    <aside
      className={`fixed right-0 top-24 bottom-8 z-40 flex w-[min(400px,calc(100vw-1rem))] flex-col border-l border-outline-variant bg-surface-container-lowest text-ink shadow-[inset_1px_0_0_0_var(--color-outline-variant)] sm:top-12 ${className}`}
    >
      <header className="shrink-0 border-b border-outline-variant bg-parchment-bright px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-sans text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Suggestion</div>
            <h2 className="mt-1.5 font-serif text-xl font-semibold leading-snug text-primary" title={actionLabel}>
              {actionLabel}
            </h2>
            <p className="mt-2 font-sans text-[11px] leading-snug text-ink-muted">{selectionSummary}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-sm p-1.5 text-ink-muted hover:bg-surface-container-high hover:text-ink"
              aria-label="Close suggestion panel"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {activeAlternative?.explanation ? (
          <div className="mt-4 border-t border-outline-variant/70 pt-4">
            <div className="font-sans text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Why this works</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{activeAlternative.explanation}</p>
          </div>
        ) : null}

        {originalText.trim() ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setAffectedOpen((open) => !open)}
              className="font-sans text-[10px] font-semibold uppercase tracking-widest text-ink-muted hover:text-primary"
            >
              Affected passage {affectedOpen ? '⌄' : '›'}
            </button>
            {affectedOpen ? (
              <div className="mt-1.5 max-h-28 overflow-y-auto rounded-sm border border-oak-variant bg-surface-container-low px-3 py-2 font-serif text-[12px] leading-relaxed text-ink whitespace-pre-wrap">
                {originalText}
              </div>
            ) : null}
          </div>
        ) : null}

        {onShowContextInspector ? (
          <button
            type="button"
            onClick={onShowContextInspector}
            className="mt-3 font-sans text-[10px] font-semibold uppercase tracking-widest text-primary hover:text-amber-wax"
          >
            See what the AI received →
          </button>
        ) : null}
      </header>

      <div className="shrink-0 border-b border-outline-variant bg-surface-container-low px-5 py-3">
        <div className={`grid gap-2 ${showInsertBelow && onInsertBelow ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
          <button
            type="button"
            disabled={acceptDisabled}
            onClick={() => activeAlternative && onAccept?.(activeAlternative)}
            className="btn-wax-seal rounded-sm px-3 py-2.5 font-sans text-[11px] font-semibold uppercase tracking-widest disabled:opacity-40"
          >
            {acceptLabel}
          </button>
          <button
            type="button"
            disabled={rejectDisabled}
            onClick={() => activeAlternative && onReject?.(activeAlternative)}
            className="rounded-sm border border-oak-variant bg-parchment-bright px-3 py-2.5 font-sans text-[11px] font-semibold uppercase tracking-widest text-ink-muted hover:border-primary hover:text-primary disabled:opacity-40"
          >
            {rejectLabel}
          </button>
          {showInsertBelow && onInsertBelow ? (
            <button
              type="button"
              disabled={insertBelowDisabled}
              onClick={() => activeAlternative && onInsertBelow(activeAlternative)}
              className="rounded-sm border border-oak-variant bg-surface-container-high px-3 py-2.5 font-sans text-[11px] font-semibold uppercase tracking-widest text-ink hover:border-primary disabled:opacity-40"
            >
              Insert below
            </button>
          ) : null}
        </div>
      </div>

      <nav className="shrink-0 flex gap-1 border-b border-outline-variant bg-surface-container-low px-4 py-2">
        {VIEWS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`min-w-0 flex-1 rounded-sm px-2 py-2 font-sans text-[10px] font-semibold uppercase tracking-widest transition-colors ${
              view === tab.id
                ? 'border border-primary bg-primary text-parchment-bright'
                : 'border border-transparent text-ink-muted hover:bg-surface-container-high hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{renderContent()}</div>

      <div className="shrink-0 border-t border-outline-variant bg-parchment-bright px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="font-sans text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Alternatives: {alternatives.length ? activeIndex + 1 : 0} of {alternatives.length}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setAlternative(activeIndex - 1)}
              disabled={busy || alternatives.length < 2}
              className="rounded-sm border border-oak-variant p-1.5 text-ink-muted hover:bg-surface-container-high hover:text-ink disabled:opacity-40"
              aria-label="Previous alternative"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setAlternative(activeIndex + 1)}
              disabled={busy || alternatives.length < 2}
              className="rounded-sm border border-oak-variant p-1.5 text-ink-muted hover:bg-surface-container-high hover:text-ink disabled:opacity-40"
              aria-label="Next alternative"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={branchDisabled}
            onClick={() => activeAlternative && onBranch?.(activeAlternative)}
            className="rounded-sm border border-oak-variant p-2 text-ink-muted hover:bg-surface-container-high hover:text-ink disabled:opacity-40"
            aria-label="Branch suggestion"
            title="Branch"
          >
            <GitBranch className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={noteDisabled}
            onClick={() => activeAlternative && onNote?.(activeAlternative)}
            className="rounded-sm border border-oak-variant p-2 text-ink-muted hover:bg-surface-container-high hover:text-ink disabled:opacity-40"
            aria-label="Add note"
            title="Note"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={regenerateDisabled}
            onClick={onRegenerate}
            className="rounded-sm border border-oak-variant p-2 text-ink-muted hover:bg-surface-container-high hover:text-ink disabled:opacity-40"
            aria-label="Regenerate suggestion"
            title="Regenerate"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Ask for adjustment..."
            className="min-w-0 flex-1 rounded-sm border border-oak-variant bg-surface-container-low px-3 py-2 font-sans text-xs text-ink outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={busy || !instruction.trim() || !onRegenerateWithInstruction}
            onClick={() => {
              const next = instruction.trim();
              if (!next) return;
              onRegenerateWithInstruction?.(next);
              setInstruction('');
            }}
            className="rounded-sm border border-oak-variant p-2 text-ink-muted hover:bg-surface-container-high hover:text-ink disabled:opacity-40"
            aria-label="Regenerate with instruction"
            title="Regenerate with instruction"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
