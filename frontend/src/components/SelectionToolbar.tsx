import {useEffect, useRef, useState} from 'react';
import {ChevronDown, Edit3, Plus} from 'lucide-react';
import {
  STORYCRAFT_COMMANDS,
  WRITING_COMMANDS,
  type CommandId,
  type CommandPaletteItem,
} from '../lib/writingCommands';

export type Action = CommandId | 'rephrase' | 'tone';

const QUICK_ACTIONS: CommandPaletteItem[] = WRITING_COMMANDS.filter((command) =>
  ['continue', 'rewrite', 'expand', 'shorten'].includes(command.id),
);

const INSERT_ACTIONS: CommandPaletteItem[] = WRITING_COMMANDS.filter((command) =>
  ['finish_sentence', 'describe_setting', 'emotional_beat', 'finish_dialogue', 'next_beat', 'tone_darker', 'custom'].includes(command.id),
);

type Props = {
  disabled?: boolean;
  onAction: (action: Action) => void;
};

function CommandMenu({
  label,
  title,
  items,
  disabled,
  onAction,
}: {
  label: string;
  title: string;
  items: CommandPaletteItem[];
  disabled?: boolean;
  onAction: (action: Action) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const groups = [...new Set(items.map((item) => item.group))];

  return (
    <div
      ref={rootRef}
      className="relative inline-block"
      onMouseEnter={() => {
        if (!disabled) setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-sm border border-oak-variant bg-sepia-high px-3 py-1.5 font-sans text-[10px] uppercase tracking-widest text-ink hover:border-primary hover:text-primary disabled:opacity-40"
        title={title}
        aria-expanded={open}
      >
        {label === 'Insert' ? <Plus className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          className="absolute left-1/2 top-full z-30 -mt-1 min-w-[230px] -translate-x-1/2 rounded-sm border border-oak-variant bg-surface-container-high py-1 pt-2 shadow-md"
          role="menu"
        >
          {groups.map((group) => (
            <div key={group}>
              {groups.length > 1 ? (
                <div className="border-t border-oak-variant/60 px-3 py-1.5 text-[8px] uppercase tracking-widest text-ink-muted first:border-t-0">
                  {group}
                </div>
              ) : null}
              {items
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onAction(item.id);
                        setOpen(false);
                      }}
                      title={item.title}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-[10px] uppercase tracking-widest text-ink hover:bg-sepia-mid disabled:opacity-40"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SelectionToolbar({disabled, onAction}: Props) {
  return (
    <div className="relative z-20 flex flex-wrap items-center justify-center gap-2 border-b border-oak-variant/60 py-2">
      {QUICK_ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            onClick={() => onAction(a.id)}
            title={a.title}
            className="inline-flex items-center gap-1.5 rounded-sm border border-oak-variant bg-sepia-high px-2.5 py-1.5 font-sans text-[10px] uppercase tracking-widest text-ink hover:border-primary hover:text-primary disabled:opacity-40"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{a.label}</span>
          </button>
        );
      })}
      <CommandMenu label="Insert" title="Inline insert and finish actions" items={INSERT_ACTIONS} disabled={disabled} onAction={onAction} />
      <CommandMenu label="Craft" title="Storycraft outcomes and diagnostics" items={STORYCRAFT_COMMANDS} disabled={disabled} onAction={onAction} />
    </div>
  );
}
