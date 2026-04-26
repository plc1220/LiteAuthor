import {useEffect, useRef, useState} from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Edit3,
  Feather,
  Link2,
  MessageCircle,
  Minimize2,
  Plus,
  ScrollText,
  Sparkles,
  UserCheck,
  UserCircle,
  Waypoints,
  Zap,
} from 'lucide-react';

export type Action =
  | 'rephrase'
  | 'expand'
  | 'shorten'
  | 'tone'
  | 'continue'
  | 'custom'
  | 'story_tension'
  | 'story_dialogue'
  | 'story_ending'
  | 'story_intent'
  | 'story_opening'
  | 'story_pacing'
  | 'story_character'
  | 'story_payoff'
  | 'story_lore'
  | 'story_addiction'
  | 'story_cont_check'
  | 'story_planner';

const ACTIONS: {id: Action; label: string; title: string; icon: typeof Edit3}[] = [
  {id: 'rephrase', label: 'Rephrase', title: 'Rewrite with a chosen style', icon: Edit3},
  {id: 'expand', label: 'Expand', title: 'Add texture and detail', icon: Plus},
  {id: 'shorten', label: 'Shorten', title: 'Condense the selection', icon: Minimize2},
  {id: 'tone', label: 'Tone', title: 'Shift the tone', icon: Feather},
  {id: 'continue', label: 'Continue', title: 'Continue from the cursor', icon: ChevronDown},
  {id: 'custom', label: 'Custom', title: 'Write a custom transform', icon: Sparkles},
];

const STORY_OUTCOMES: {id: Action; label: string; title: string; icon: typeof Edit3}[] = [
  {id: 'story_tension', label: 'Add tension', title: 'More friction, risk, and pressure (scene craft rules)', icon: AlertTriangle},
  {id: 'story_dialogue', label: 'Sharper dialogue', title: 'Rhythm, subtext, and contrast in speech', icon: MessageCircle},
  {id: 'story_ending', label: 'Stronger ending', title: 'End beat with momentum and curiosity', icon: ChevronDown},
  {id: 'story_intent', label: 'Rewrite w/ intent', title: 'Tighter scene purpose, preserve facts and voice', icon: Sparkles},
];

const STORY_OUTCOMES_PHASE2: {id: Action; label: string; title: string; icon: typeof Edit3}[] = [
  {id: 'story_opening', label: 'Opening doctor', title: 'Hook, orientation, and first-beat pull', icon: BookOpen},
  {id: 'story_pacing', label: 'Pacing tune', title: 'Rhythm, compress or stretch, land turns', icon: Activity},
  {id: 'story_character', label: 'Character drive', title: 'Want, reaction, and choice in voice', icon: UserCircle},
  {id: 'story_payoff', label: 'Setup & payoff', title: 'Strengthen thread promise and satisfaction', icon: Link2},
];

const STORY_OUTCOMES_PHASE3: {id: Action; label: string; title: string; icon: typeof Edit3}[] = [
  {id: 'story_lore', label: 'Lore compress', title: 'Scene-embedded world facts, less lecture', icon: ScrollText},
  {id: 'story_addiction', label: 'Addiction beat', title: 'Serial pull, curiosity, and stakes', icon: Zap},
  {id: 'story_cont_check', label: 'Char match', title: 'Behavior and voice against persona', icon: UserCheck},
  {id: 'story_planner', label: 'Story plan', title: 'Act spines, turns, outline-level help', icon: Waypoints},
];

type Props = {
  disabled?: boolean;
  onAction: (action: Action) => void;
};

export function SelectionToolbar({disabled, onAction}: Props) {
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

  return (
    <div className="relative z-20 flex justify-center border-b border-oak-variant/60 py-2">
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
          className="inline-flex items-center gap-2 font-sans text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-sm border border-oak-variant bg-sepia-high text-ink hover:border-primary hover:text-primary disabled:opacity-40"
          title="AI writing actions"
          aria-expanded={open}
        >
          <span aria-hidden>✨</span>
          AI studio
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open ? (
          <div
            className="absolute left-1/2 top-full z-30 -mt-1 min-w-[220px] -translate-x-1/2 rounded-sm border border-oak-variant bg-surface-container-high py-1 pt-2 shadow-md"
            role="menu"
          >
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onAction(a.id);
                    setOpen(false);
                  }}
                  title={a.title}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-[10px] uppercase tracking-widest text-ink hover:bg-sepia-mid disabled:opacity-40"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {a.label}
                </button>
              );
            })}
            <div className="px-3 py-1.5 text-[8px] uppercase tracking-widest text-ink-muted border-t border-oak-variant/60">
              Outcomes
            </div>
            {STORY_OUTCOMES.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onAction(a.id);
                    setOpen(false);
                  }}
                  title={a.title}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-[10px] uppercase tracking-widest text-ink hover:bg-sepia-mid disabled:opacity-40"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {a.label}
                </button>
              );
            })}
            <div className="px-3 py-1.5 text-[8px] uppercase tracking-widest text-ink-muted border-t border-oak-variant/60">
              More craft
            </div>
            {STORY_OUTCOMES_PHASE2.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onAction(a.id);
                    setOpen(false);
                  }}
                  title={a.title}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-[10px] uppercase tracking-widest text-ink hover:bg-sepia-mid disabled:opacity-40"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {a.label}
                </button>
              );
            })}
            <div className="px-3 py-1.5 text-[8px] uppercase tracking-widest text-ink-muted border-t border-oak-variant/60">
              Deeper craft
            </div>
            {STORY_OUTCOMES_PHASE3.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onAction(a.id);
                    setOpen(false);
                  }}
                  title={a.title}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-[10px] uppercase tracking-widest text-ink hover:bg-sepia-mid disabled:opacity-40"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {a.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
