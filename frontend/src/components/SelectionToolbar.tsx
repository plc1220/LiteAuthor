import {ChevronDown, Edit3, Feather, Minimize2, Plus, Sparkles} from 'lucide-react';

export type Action = 'rephrase' | 'expand' | 'shorten' | 'tone' | 'continue' | 'custom';

const ACTIONS: {id: Action; label: string; title: string; icon: typeof Edit3}[] = [
  {id: 'rephrase', label: 'Rephrase', title: 'Rewrite with a chosen style', icon: Edit3},
  {id: 'expand', label: 'Expand', title: 'Add texture and detail', icon: Plus},
  {id: 'shorten', label: 'Shorten', title: 'Condense the selection', icon: Minimize2},
  {id: 'tone', label: 'Tone', title: 'Shift the tone', icon: Feather},
  {id: 'continue', label: 'Continue', title: 'Continue from the cursor', icon: ChevronDown},
  {id: 'custom', label: 'Custom', title: 'Write a custom transform', icon: Sparkles},
];

type Props = {
  disabled?: boolean;
  onAction: (action: Action) => void;
};

export function SelectionToolbar({disabled, onAction}: Props) {
  return (
    <div className="flex flex-wrap gap-2 py-3 border-b border-oak-variant/60">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            onClick={() => onAction(a.id)}
            title={a.title}
            className="inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-sm border border-oak-variant bg-sepia-high text-ink hover:border-primary hover:text-primary disabled:opacity-40"
          >
            <Icon className="h-3.5 w-3.5" />
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
