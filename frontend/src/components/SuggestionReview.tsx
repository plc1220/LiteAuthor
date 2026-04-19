import {diffWords} from 'diff';

type Props = {
  original: string;
  proposed: string;
  explanation?: string;
  busy?: boolean;
  onAccept: () => void;
  onReject: () => void;
};

export function SuggestionReview({original, proposed, explanation, busy, onAccept, onReject}: Props) {
  const parts = diffWords(original, proposed);
  return (
    <div className="mt-4 rounded-sm border border-oak-variant bg-sepia-high p-4 space-y-3">
      <div className="font-sans text-[10px] uppercase tracking-widest text-ink-muted">AI suggestion</div>
      {explanation ? <p className="text-xs text-ink-muted italic">{explanation}</p> : null}
      <div className="text-sm leading-relaxed font-serif whitespace-pre-wrap">
        {parts.map((p, i) => {
          if (p.added) {
            return (
              <span key={i} className="bg-emerald-900/40 text-emerald-100">
                {p.value}
              </span>
            );
          }
          if (p.removed) {
            return (
              <span key={i} className="bg-red-900/40 text-red-100 line-through">
                {p.value}
              </span>
            );
          }
          return <span key={i}>{p.value}</span>;
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="font-sans text-[10px] uppercase tracking-widest px-3 py-2 bg-primary text-parchment rounded-sm disabled:opacity-40"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          className="font-sans text-[10px] uppercase tracking-widest px-3 py-2 border border-oak-variant rounded-sm disabled:opacity-40"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
