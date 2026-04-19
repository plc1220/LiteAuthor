export type Action = 'refine' | 'lyrical' | 'tension' | 'clarity' | 'continue' | 'continuity';

const ACTIONS: {id: Action; label: string}[] = [
  {id: 'refine', label: 'Refine'},
  {id: 'lyrical', label: 'Lyrical'},
  {id: 'tension', label: 'Tension'},
  {id: 'clarity', label: 'Clarity'},
  {id: 'continue', label: 'Continue'},
  {id: 'continuity', label: 'Continuity'},
];

type Props = {
  disabled?: boolean;
  onAction: (action: Action) => void;
};

export function SelectionToolbar({disabled, onAction}: Props) {
  return (
    <div className="flex flex-wrap gap-2 py-3 border-b border-oak-variant/60">
      {ACTIONS.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={disabled}
          onClick={() => onAction(a.id)}
          className="font-sans text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-sm border border-oak-variant bg-sepia-high text-ink hover:border-primary hover:text-primary disabled:opacity-40"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
