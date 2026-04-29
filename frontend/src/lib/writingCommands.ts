import {
  ChevronsRight,
  Edit3,
  Feather,
  MessageCircle,
  Minimize2,
  Moon,
  Paintbrush,
  Plus,
  Sparkles,
  WandSparkles,
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

export const WRITING_COMMANDS: WritingCommand[] = [
  {
    id: 'continue',
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

export function findSlashCommand(raw: string): WritingCommand | null {
  const query = raw.trim().toLowerCase();
  if (!query) return null;
  return (
    WRITING_COMMANDS.find((command) => command.slash.some((alias) => alias === query)) ??
    WRITING_COMMANDS.find((command) => command.slash.some((alias) => alias.startsWith(query))) ??
    null
  );
}

export function searchSlashCommands(raw: string): WritingCommand[] {
  const query = raw.trim().toLowerCase();
  if (!query) return WRITING_COMMANDS.slice(0, 8);
  return WRITING_COMMANDS.filter((command) => {
    return command.label.toLowerCase().includes(query) || command.slash.some((alias) => alias.includes(query));
  }).slice(0, 8);
}

