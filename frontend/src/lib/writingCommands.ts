import {
  Activity,
  AlertTriangle,
  BookOpen,
  ChevronsRight,
  ChevronDown,
  Edit3,
  Feather,
  Link2,
  MessageCircle,
  Minimize2,
  Moon,
  Paintbrush,
  Plus,
  ScrollText,
  Sparkles,
  UserCheck,
  UserCircle,
  Waypoints,
  WandSparkles,
  Zap,
} from 'lucide-react';

export type WritingCommandId =
  | 'continue'
  | 'finish_sentence'
  | 'rewrite'
  | 'expand'
  | 'shorten'
  | 'tone_darker'
  | 'describe_setting'
  | 'emotional_beat'
  | 'finish_dialogue'
  | 'next_beat'
  | 'custom';

export type StorycraftCommandId =
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

export type CommandId = WritingCommandId | StorycraftCommandId;

export type CommandScopeMode = 'selection' | 'cursor' | 'scene' | 'chapter';
export type CommandContextProfile = 'inline' | 'scene' | 'chapter';
export type CommandOperation =
  | 'insert_after_cursor'
  | 'replace_current_sentence'
  | 'replace_current_paragraph'
  | 'replace_selection'
  | 'insert_block_after'
  | 'expand_choice';

export type WritingCommand = {
  id: WritingCommandId;
  kind: 'write';
  label: string;
  slash: string[];
  group: 'Write' | 'Shape' | 'Mood' | 'Scene';
  title: string;
  icon: typeof Edit3;
  scopeMode: CommandScopeMode;
  contextProfile: CommandContextProfile;
  operation: CommandOperation;
  requiresSelection?: boolean;
};

export type StorycraftCommand = {
  id: StorycraftCommandId;
  kind: 'storycraft';
  label: string;
  slash: string[];
  group: 'Outcome' | 'Craft' | 'Deep craft';
  title: string;
  icon: typeof Edit3;
  intent: string;
  chapterPosition: string | null;
};

export type CommandPaletteItem = WritingCommand | StorycraftCommand;

export const WRITING_COMMANDS: WritingCommand[] = [
  {
    id: 'continue',
    kind: 'write',
    label: 'Continue',
    slash: ['continue', 'cont'],
    group: 'Write',
    title: 'Continue from the cursor',
    icon: ChevronsRight,
    scopeMode: 'cursor',
    contextProfile: 'inline',
    operation: 'insert_after_cursor',
  },
  {
    id: 'finish_sentence',
    kind: 'write',
    label: 'Finish sentence',
    slash: ['finish sentence', 'finish'],
    group: 'Write',
    title: 'Complete the current sentence',
    icon: WandSparkles,
    scopeMode: 'cursor',
    contextProfile: 'inline',
    operation: 'replace_current_sentence',
  },
  {
    id: 'rewrite',
    kind: 'write',
    label: 'Rewrite',
    slash: ['rewrite', 'rephrase'],
    group: 'Shape',
    title: 'Rewrite the selection or current paragraph',
    icon: Edit3,
    scopeMode: 'selection',
    contextProfile: 'inline',
    operation: 'replace_current_paragraph',
  },
  {
    id: 'expand',
    kind: 'write',
    label: 'Expand',
    slash: ['expand'],
    group: 'Shape',
    title: 'Expand the selection or current paragraph',
    icon: Plus,
    scopeMode: 'selection',
    contextProfile: 'inline',
    operation: 'expand_choice',
  },
  {
    id: 'shorten',
    kind: 'write',
    label: 'Shorten',
    slash: ['shorten', 'condense'],
    group: 'Shape',
    title: 'Condense the selection or current paragraph',
    icon: Minimize2,
    scopeMode: 'selection',
    contextProfile: 'inline',
    operation: 'replace_current_paragraph',
  },
  {
    id: 'tone_darker',
    kind: 'write',
    label: 'Darken',
    slash: ['darken', 'make darker', 'make this darker', 'tone darker'],
    group: 'Mood',
    title: 'Make the current prose darker in mood',
    icon: Moon,
    scopeMode: 'selection',
    contextProfile: 'inline',
    operation: 'replace_current_paragraph',
  },
  {
    id: 'describe_setting',
    kind: 'write',
    label: 'Describe setting',
    slash: ['describe setting', 'describe room', 'setting'],
    group: 'Scene',
    title: 'Insert a sensory setting beat',
    icon: Paintbrush,
    scopeMode: 'cursor',
    contextProfile: 'inline',
    operation: 'insert_block_after',
  },
  {
    id: 'emotional_beat',
    kind: 'write',
    label: 'Emotional beat',
    slash: ['emotional beat', 'emotion'],
    group: 'Scene',
    title: 'Insert an emotional reaction beat',
    icon: Feather,
    scopeMode: 'cursor',
    contextProfile: 'inline',
    operation: 'insert_block_after',
  },
  {
    id: 'finish_dialogue',
    kind: 'write',
    label: 'Finish dialogue',
    slash: ['finish dialogue', 'dialogue'],
    group: 'Write',
    title: 'Finish the current line of dialogue',
    icon: MessageCircle,
    scopeMode: 'cursor',
    contextProfile: 'inline',
    operation: 'replace_current_sentence',
  },
  {
    id: 'next_beat',
    kind: 'write',
    label: 'Next beat',
    slash: ['next beat', 'next action'],
    group: 'Scene',
    title: 'Insert the next story action as a new paragraph',
    icon: Sparkles,
    scopeMode: 'cursor',
    contextProfile: 'inline',
    operation: 'insert_block_after',
  },
  {
    id: 'custom',
    kind: 'write',
    label: 'Custom',
    slash: ['do'],
    group: 'Shape',
    title: 'Run a deliberate freeform instruction',
    icon: Sparkles,
    scopeMode: 'selection',
    contextProfile: 'inline',
    operation: 'replace_current_paragraph',
  },
];

export const STORYCRAFT_COMMANDS: StorycraftCommand[] = [
  {
    id: 'story_tension',
    kind: 'storycraft',
    label: 'Add tension',
    slash: ['add tension', 'tension'],
    group: 'Outcome',
    title: 'More friction, risk, and pressure',
    icon: AlertTriangle,
    intent: 'increase_tension',
    chapterPosition: null,
  },
  {
    id: 'story_dialogue',
    kind: 'storycraft',
    label: 'Sharper dialogue',
    slash: ['sharper dialogue', 'dialogue craft'],
    group: 'Outcome',
    title: 'Rhythm, subtext, and contrast in speech',
    icon: MessageCircle,
    intent: 'sharpen_dialogue',
    chapterPosition: null,
  },
  {
    id: 'story_ending',
    kind: 'storycraft',
    label: 'Stronger ending',
    slash: ['stronger ending', 'ending'],
    group: 'Outcome',
    title: 'End beat with momentum and curiosity',
    icon: ChevronDown,
    intent: 'strengthen_chapter_ending',
    chapterPosition: 'ending',
  },
  {
    id: 'story_intent',
    kind: 'storycraft',
    label: 'Rewrite w/ intent',
    slash: ['rewrite with intent', 'intent'],
    group: 'Outcome',
    title: 'Tighter scene purpose, preserve facts and voice',
    icon: Sparkles,
    intent: 'rewrite_with_intent',
    chapterPosition: null,
  },
  {
    id: 'story_opening',
    kind: 'storycraft',
    label: 'Opening doctor',
    slash: ['opening doctor', 'opening', 'hook'],
    group: 'Craft',
    title: 'Hook, orientation, and first-beat pull',
    icon: BookOpen,
    intent: 'opening_doctor',
    chapterPosition: 'opening',
  },
  {
    id: 'story_pacing',
    kind: 'storycraft',
    label: 'Pacing tune',
    slash: ['pacing tune', 'pacing'],
    group: 'Craft',
    title: 'Rhythm, compression, and scene turns',
    icon: Activity,
    intent: 'pacing_analyzer',
    chapterPosition: null,
  },
  {
    id: 'story_character',
    kind: 'storycraft',
    label: 'Character drive',
    slash: ['character drive', 'drive'],
    group: 'Craft',
    title: 'Want, reaction, and choice in voice',
    icon: UserCircle,
    intent: 'character_engine',
    chapterPosition: null,
  },
  {
    id: 'story_payoff',
    kind: 'storycraft',
    label: 'Setup & payoff',
    slash: ['setup payoff', 'payoff'],
    group: 'Craft',
    title: 'Strengthen thread promise and satisfaction',
    icon: Link2,
    intent: 'payoff_tracker',
    chapterPosition: null,
  },
  {
    id: 'story_lore',
    kind: 'storycraft',
    label: 'Lore compress',
    slash: ['lore compress', 'lore'],
    group: 'Deep craft',
    title: 'Scene-embedded world facts, less lecture',
    icon: ScrollText,
    intent: 'lore_compression',
    chapterPosition: null,
  },
  {
    id: 'story_addiction',
    kind: 'storycraft',
    label: 'Addiction beat',
    slash: ['addiction beat', 'serial pull'],
    group: 'Deep craft',
    title: 'Serial pull, curiosity, and stakes',
    icon: Zap,
    intent: 'chapter_addiction',
    chapterPosition: null,
  },
  {
    id: 'story_cont_check',
    kind: 'storycraft',
    label: 'Char match',
    slash: ['char match', 'character consistency'],
    group: 'Deep craft',
    title: 'Behavior and voice against persona',
    icon: UserCheck,
    intent: 'character_consistency',
    chapterPosition: null,
  },
  {
    id: 'story_planner',
    kind: 'storycraft',
    label: 'Story plan',
    slash: ['story plan', 'planning'],
    group: 'Deep craft',
    title: 'Act spines, turns, outline-level help',
    icon: Waypoints,
    intent: 'planning_architect',
    chapterPosition: null,
  },
];

export const COMMAND_PALETTE: CommandPaletteItem[] = [...WRITING_COMMANDS, ...STORYCRAFT_COMMANDS];

export function isStorycraftCommandId(id: CommandId): id is StorycraftCommandId {
  return STORYCRAFT_COMMANDS.some((command) => command.id === id);
}

export function getStorycraftCommand(id: StorycraftCommandId): StorycraftCommand | undefined {
  return STORYCRAFT_COMMANDS.find((command) => command.id === id);
}

export function findSlashCommand(raw: string): CommandPaletteItem | null {
  const query = raw.trim().toLowerCase();
  if (!query) return null;
  return (
    COMMAND_PALETTE.find((command) => command.slash.some((alias) => alias === query)) ??
    COMMAND_PALETTE.find((command) => command.slash.some((alias) => alias.startsWith(query))) ??
    null
  );
}

export function searchSlashCommands(raw: string): CommandPaletteItem[] {
  const query = raw.trim().toLowerCase();
  if (!query) return COMMAND_PALETTE.slice(0, 8);
  return COMMAND_PALETTE.filter((command) => {
    return command.label.toLowerCase().includes(query) || command.slash.some((alias) => alias.includes(query));
  }).slice(0, 8);
}
