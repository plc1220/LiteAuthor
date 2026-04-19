import {useMemo, useState} from 'react';
import {ArrowLeft, ArrowRight, GitBranch, MessageSquare, RefreshCw, X} from 'lucide-react';
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
  className?: string;
  onAccept?: (alternative: SuggestionAlternative) => void;
  onReject?: (alternative: SuggestionAlternative) => void;
  onBranch?: (alternative: SuggestionAlternative) => void;
  onNote?: (alternative: SuggestionAlternative) => void;
  onRegenerate?: () => void;
  onShowContextInspector?: () => void;
  onClose?: () => void;
  onAlternativeChange?: (alternative: SuggestionAlternative) => void;
};

const VIEWS: {id: SuggestionPanelView; label: string}[] = [
  {id: 'original', label: 'Original'},
  {id: 'suggestion', label: 'Suggestion'},
  {id: 'diff', label: 'Diff'},
  {id: 'split', label: 'Split'},
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
  className = '',
  onAccept,
  onReject,
  onBranch,
  onNote,
  onRegenerate,
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
    <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap">
      {diffParts.map((part, index) => {
        if (part.added) {
          return (
            <span key={index} className="bg-emerald-900/45 text-emerald-100">
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span key={index} className="bg-red-900/45 text-red-100 line-through">
              {part.value}
            </span>
          );
        }
        return (
          <span key={index} className="text-ink-muted">
            {part.value}
          </span>
        );
      })}
    </div>
  );

  const renderContent = () => {
    if (!activeAlternative) {
      return (
        <div className="rounded-sm border border-dashed border-oak-variant bg-parchment-bright/40 p-4 text-sm italic text-ink-muted">
          No suggestion is available yet.
        </div>
      );
    }

    if (view === 'original') {
      return <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap">{originalText}</div>;
    }
    if (view === 'suggestion') {
      return <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap">{proposedText}</div>;
    }
    if (view === 'split') {
      return (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="mb-2 font-sans text-[10px] uppercase tracking-widest text-ink-muted">Original</div>
            {Array.from({length: paragraphCount}).map((_, index) => (
              <p key={index} className="mb-3 rounded-sm border border-oak-variant bg-parchment-bright p-3 font-serif leading-relaxed">
                {originalParagraphs[index] ?? ''}
              </p>
            ))}
          </div>
          <div>
            <div className="mb-2 font-sans text-[10px] uppercase tracking-widest text-ink-muted">Suggestion</div>
            {Array.from({length: paragraphCount}).map((_, index) => (
              <p key={index} className="mb-3 rounded-sm border border-oak-variant bg-parchment-bright p-3 font-serif leading-relaxed">
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

  return (
    <aside className={`fixed right-0 top-10 bottom-8 z-40 w-[380px] max-w-[calc(100vw-1rem)] bg-sepia-mid border-l border-oak-variant text-ink shadow-2xl flex flex-col ${className}`}>
      <header className="p-4 border-b border-oak-variant bg-sepia-high">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-sans text-[10px] uppercase tracking-widest text-ink-muted">Suggestion Panel</div>
            <h2 className="mt-1 font-serif text-lg font-semibold text-primary truncate" title={actionLabel}>
              {actionLabel}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">{selectionSummary}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-sm text-ink-muted hover:text-ink hover:bg-sepia-highest"
              aria-label="Close suggestion panel"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {activeAlternative?.explanation ? <p className="mt-3 text-xs italic text-ink-muted">{activeAlternative.explanation}</p> : null}
        {onShowContextInspector ? (
          <button
            type="button"
            onClick={onShowContextInspector}
            className="mt-3 font-sans text-[10px] uppercase tracking-widest text-primary hover:text-amber-wax"
          >
            See what the AI received →
          </button>
        ) : null}
      </header>

      <nav className="grid grid-cols-4 gap-1 p-3 border-b border-oak-variant bg-sepia-mid">
        {VIEWS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`px-2 py-1.5 rounded-sm border font-sans text-[10px] uppercase tracking-widest ${
              view === tab.id ? 'border-primary text-primary bg-sepia-highest' : 'border-oak-variant text-ink-muted hover:text-ink hover:border-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">{renderContent()}</div>

      <div className="border-t border-oak-variant bg-sepia-high p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="font-sans text-[10px] uppercase tracking-widest text-ink-muted">
            Alternatives: {alternatives.length ? activeIndex + 1 : 0} of {alternatives.length}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setAlternative(activeIndex - 1)}
              disabled={busy || alternatives.length < 2}
              className="p-1.5 rounded-sm border border-oak-variant text-ink-muted hover:text-ink disabled:opacity-40"
              aria-label="Previous alternative"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setAlternative(activeIndex + 1)}
              disabled={busy || alternatives.length < 2}
              className="p-1.5 rounded-sm border border-oak-variant text-ink-muted hover:text-ink disabled:opacity-40"
              aria-label="Next alternative"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          <button
            type="button"
            disabled={acceptDisabled}
            onClick={() => activeAlternative && onAccept?.(activeAlternative)}
            className="rounded-sm bg-primary px-2 py-2 font-sans text-[10px] uppercase tracking-widest text-parchment disabled:opacity-40"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={rejectDisabled}
            onClick={() => activeAlternative && onReject?.(activeAlternative)}
            className="rounded-sm border border-oak-variant px-2 py-2 font-sans text-[10px] uppercase tracking-widest text-ink-muted hover:text-ink disabled:opacity-40"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={branchDisabled}
            onClick={() => activeAlternative && onBranch?.(activeAlternative)}
            className="flex items-center justify-center rounded-sm border border-oak-variant px-2 py-2 text-ink-muted hover:text-ink disabled:opacity-40"
            aria-label="Branch suggestion"
            title="Branch"
          >
            <GitBranch className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={noteDisabled}
            onClick={() => activeAlternative && onNote?.(activeAlternative)}
            className="flex items-center justify-center rounded-sm border border-oak-variant px-2 py-2 text-ink-muted hover:text-ink disabled:opacity-40"
            aria-label="Add note"
            title="Note"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={regenerateDisabled}
            onClick={onRegenerate}
            className="flex items-center justify-center rounded-sm border border-oak-variant px-2 py-2 text-ink-muted hover:text-ink disabled:opacity-40"
            aria-label="Regenerate suggestion"
            title="Regenerate"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
