import {CharacterCount} from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import BubbleMenuExt from '@tiptap/extension-bubble-menu';
import type {Editor} from '@tiptap/core';
import {BubbleMenu, EditorContent, useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {forwardRef, useCallback, useEffect, useImperativeHandle, useRef} from 'react';
import {useState} from 'react';
import type {RefObject} from 'react';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {Decoration, DecorationSet} from '@tiptap/pm/view';
import type {Node as PMNode} from '@tiptap/pm/model';
import {markdownToTipTapDoc, tipTapDocToMarkdown} from '../lib/markdownDoc';
import {api} from '../lib/api';
import {searchSlashCommands, type WritingCommand, type WritingCommandId} from '../lib/writingCommands';

export type ManuscriptEditorHandle = {
  getEditor: () => Editor | null;
  replaceSelection: (markdown: string) => void;
  getSelection: () => {from: number; to: number; text: string};
  getCommandScope: () => CommandScope;
  showInlinePreview: (preview: InlinePreview) => void;
  clearInlinePreview: () => void;
  applyOperation: (operation: InlineOperation) => void;
  setGhostText: (text: string) => void;
  clearGhostText: () => void;
  flushSave: () => Promise<void>;
  getMarkdown: () => string;
};

export type AutocompleteContext = {
  before: string;
  after: string;
  previousParagraph: string;
  documentMemory: string;
};

type Props = {
  projectId: string;
  sceneId: string;
  onSaved?: () => void;
  onStats?: (words: number) => void;
  onSelectionChange?: (sel: {from: number; to: number; text: string}) => void;
  onAutocompleteContext?: (context: AutocompleteContext) => void;
  typewriterScrollParentRef?: RefObject<HTMLElement | null>;
  memoryTerms?: string[];
  onEntityClick?: (label: string) => void;
  commands?: WritingCommand[];
  onCommand?: (commandId: WritingCommandId, scope: CommandScope, freeform?: string) => void;
  onPreviewAction?: (action: 'accept' | 'reject' | 'insert_below') => void;
};

const SAVE_MS = 900;
const AUTOCOMPLETE_MS = 220;
const ghostPluginKey = new PluginKey('liteauthor-autocomplete');
const entityPluginKey = new PluginKey('liteauthor-entity-marks');
const inlinePreviewPluginKey = new PluginKey<InlinePreview | null>('liteauthor-inline-preview');

export type TextRange = {from: number; to: number; text: string};

export type CommandScope = {
  selection: TextRange;
  cursor: number;
  currentSentence: TextRange;
  currentParagraph: TextRange;
  previousParagraphs: string[];
  nextParagraphs: string[];
  fullSceneMarkdown: string;
};

export type InlineOperation =
  | {operation: 'insert_after_cursor'; text: string}
  | {operation: 'replace_current_sentence'; text: string}
  | {operation: 'replace_current_paragraph'; text: string}
  | {operation: 'replace_selection'; text: string}
  | {operation: 'insert_block_after'; text: string; blockType?: 'paragraph' | 'scene_break' | 'note'}
  | {operation: 'expand_choice'; text: string; choice?: 'replace' | 'insert_below'};

export type InlinePreview = {
  operation: InlineOperation;
  range: {from: number; to: number};
  insertPos: number;
  original: string;
  proposed: string;
  showInsertBelow?: boolean;
};

function nextWordChunk(text: string): string {
  const match = /^\s*\S+[\s,.!?;:]*/.exec(text);
  return match?.[0] || text;
}

function buildAutocompleteContext(editor: Editor): AutocompleteContext | null {
  const {from, to} = editor.state.selection;
  if (from !== to) return null;
  const beforeText = editor.state.doc.textBetween(0, from, '\n');
  const afterText = editor.state.doc.textBetween(from, editor.state.doc.content.size, '\n');
  const beforeParagraphs = beforeText.split(/\n+/);
  const currentBefore = beforeParagraphs.at(-1) ?? '';
  const previousParagraph = beforeParagraphs.slice(0, -1).filter((p) => p.trim()).at(-1) ?? '';
  const currentAfter = afterText.split(/\n+/, 1)[0] ?? '';
  const meaningfulTail = currentBefore.trim();
  if (meaningfulTail.length < 5 || /\s{2}$/.test(currentBefore)) return null;
  return {
    before: currentBefore.slice(-1200),
    after: currentAfter.slice(0, 300),
    previousParagraph: previousParagraph.slice(-1200),
    documentMemory: 'Continue naturally in the current scene voice.',
  };
}

function paragraphRanges(editor: Editor): TextRange[] {
  const ranges: TextRange[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isBlock || !node.textContent.trim()) return;
    ranges.push({from: pos + 1, to: pos + node.nodeSize - 1, text: node.textContent});
  });
  return ranges;
}

function paragraphAt(editor: Editor, cursor: number): TextRange {
  const ranges = paragraphRanges(editor);
  return ranges.find((r) => cursor >= r.from && cursor <= r.to) ?? {from: cursor, to: cursor, text: ''};
}

function sentenceAt(paragraph: TextRange, cursor: number): TextRange {
  const offset = Math.max(0, Math.min(paragraph.text.length, cursor - paragraph.from));
  const before = paragraph.text.slice(0, offset);
  const after = paragraph.text.slice(offset);
  const sentenceStartMatch = /[.!?。！？]\s+[^.!?。！？]*$/.exec(before);
  const startTokenLength = sentenceStartMatch?.[0].match(/^[.!?。！？]\s+/)?.[0].length ?? 0;
  const fromOffset = sentenceStartMatch ? before.lastIndexOf(sentenceStartMatch[0]) + startTokenLength : 0;
  const sentenceEndMatch = /[.!?。！？]/.exec(after);
  const toOffset = sentenceEndMatch ? offset + sentenceEndMatch.index + 1 : paragraph.text.length;
  return {
    from: paragraph.from + fromOffset,
    to: paragraph.from + toOffset,
    text: paragraph.text.slice(fromOffset, toOffset),
  };
}

function buildCommandScope(editor: Editor): CommandScope {
  const {from, to} = editor.state.selection;
  const paragraphs = paragraphRanges(editor);
  const currentParagraph = paragraphAt(editor, from);
  const currentIndex = paragraphs.findIndex((p) => p.from === currentParagraph.from && p.to === currentParagraph.to);
  return {
    selection: {from, to, text: editor.state.doc.textBetween(from, to, '\n')},
    cursor: from,
    currentSentence: sentenceAt(currentParagraph, from),
    currentParagraph,
    previousParagraphs: paragraphs.slice(Math.max(0, currentIndex - 5), Math.max(0, currentIndex)).map((p) => p.text).slice(-5),
    nextParagraphs: paragraphs.slice(currentIndex + 1, currentIndex + 3).map((p) => p.text),
    fullSceneMarkdown: tipTapDocToMarkdown(editor.getJSON()),
  };
}

function operationTarget(operation: InlineOperation, scope: CommandScope): {range: {from: number; to: number}; insertPos: number; original: string} {
  if (scope.selection.from !== scope.selection.to) {
    return {range: {from: scope.selection.from, to: scope.selection.to}, insertPos: scope.selection.to, original: scope.selection.text};
  }
  if (operation.operation === 'replace_current_sentence') {
    return {range: {from: scope.currentSentence.from, to: scope.currentSentence.to}, insertPos: scope.currentSentence.to, original: scope.currentSentence.text};
  }
  if (operation.operation === 'insert_after_cursor') {
    return {range: {from: scope.cursor, to: scope.cursor}, insertPos: scope.cursor, original: ''};
  }
  return {range: {from: scope.currentParagraph.from, to: scope.currentParagraph.to}, insertPos: scope.currentParagraph.to, original: scope.currentParagraph.text};
}

function insertMarkdownAt(editor: Editor, from: number, to: number, markdown: string) {
  const doc = markdownToTipTapDoc(markdown);
  const inner = doc.content?.length ? doc.content : [{type: 'paragraph'}];
  editor.chain().focus().insertContentAt({from, to}, inner).run();
}

function isWordBoundary(ch: string | undefined): boolean {
  if (ch == null) return true;
  return /[\s\W]/.test(ch) || ch === '' || ch === '\n';
}

function buildEntityDecorations(doc: PMNode, terms: string[]): DecorationSet {
  const decos: Decoration[] = [];
  const sorted = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length > 1))].sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return DecorationSet.empty;
  const used: [number, number][] = [];
  const hasOverlap = (from: number, to: number) => used.some(([a, b]) => from < b && to > a);
  const mark = (from: number, to: number) => {
    if (hasOverlap(from, to)) return;
    used.push([from, to]);
    decos.push(
      Decoration.inline(from, to, {
        class: 'story-memory-entity',
        'data-story-memory': '1',
      }),
    );
  };

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    for (const term of sorted) {
      if (term.length < 2) continue;
      let start = 0;
      const lowerT = term.toLowerCase();
      while (start < text.length) {
        const lower = text.toLowerCase();
        const idx = lower.indexOf(lowerT, start);
        if (idx === -1) break;
        const beforeC = idx > 0 ? text[idx - 1] : ' ';
        const afterC = idx + term.length < text.length ? text[idx + term.length] : ' ';
        if (!isWordBoundary(beforeC) || !isWordBoundary(afterC)) {
          start = idx + 1;
          continue;
        }
        const from = pos + idx;
        const to = from + term.length;
        if (!hasOverlap(from, to)) mark(from, to);
        start = idx + term.length;
      }
    }
  });

  return decos.length ? DecorationSet.create(doc, decos) : DecorationSet.empty;
}


export const ManuscriptEditor = forwardRef<ManuscriptEditorHandle, Props>(function ManuscriptEditor(
  {
    projectId,
    sceneId,
    onSaved,
    onStats,
    onSelectionChange,
    onAutocompleteContext,
    typewriterScrollParentRef,
    memoryTerms = [],
    onEntityClick,
    commands = [],
    onCommand,
    onPreviewAction,
  },
  ref,
) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostText = useRef('');
  const lastAutocompleteBefore = useRef('');
  const memoryTermsRef = useRef(memoryTerms);
  memoryTermsRef.current = memoryTerms;
  const onEntityClickRef = useRef(onEntityClick);
  onEntityClickRef.current = onEntityClick;
  const edRef = useRef<Editor | null>(null);
  const inlinePreview = useRef<InlinePreview | null>(null);
  const onPreviewActionRef = useRef(onPreviewAction);
  onPreviewActionRef.current = onPreviewAction;
  const [slashMenu, setSlashMenu] = useState<{
    open: boolean;
    query: string;
    from: number;
    to: number;
    x: number;
    y: number;
    activeIndex: number;
  } | null>(null);

  const typewriterRaf = useRef<number | null>(null);
  const runTypewriterScroll = useCallback(
    (ed: Editor | null) => {
      if (!ed || !typewriterScrollParentRef?.current) return;
      const parent = typewriterScrollParentRef.current;
      if (typewriterRaf.current) cancelAnimationFrame(typewriterRaf.current);
      typewriterRaf.current = requestAnimationFrame(() => {
        typewriterRaf.current = null;
        const {from} = ed.state.selection;
        try {
          const coords = ed.view.coordsAtPos(from);
          const pr = parent.getBoundingClientRect();
          const y = coords.top - pr.top + parent.scrollTop;
          const want = pr.height * 0.38;
          parent.scrollTop = Math.max(0, y - want);
        } catch {
          /* empty */
        }
      });
    },
    [typewriterScrollParentRef],
  );

  const refreshGhost = (ed: Editor | null) => {
    if (!ed) return;
    ed.view.dispatch(ed.state.tr.setMeta(ghostPluginKey, {refresh: true}));
  };

  const refreshInlinePreview = (ed: Editor | null, preview: InlinePreview | null) => {
    inlinePreview.current = preview;
    if (!ed) return;
    ed.view.dispatch(ed.state.tr.setMeta(inlinePreviewPluginKey, preview));
  };

  const updateSlashMenu = (ed: Editor) => {
    const {from, to} = ed.state.selection;
    if (from !== to) {
      setSlashMenu(null);
      return;
    }
    const beforeText = ed.state.doc.textBetween(Math.max(0, from - 80), from, '\n');
    const slash = beforeText.match(/(?:^|\s)\/([^\n/]*)$/);
    if (!slash) {
      setSlashMenu(null);
      return;
    }
    const query = slash[1] ?? '';
    const slashFrom = from - query.length - 1;
    try {
      const coords = ed.view.coordsAtPos(from);
      setSlashMenu((menu) => ({
        open: true,
        query,
        from: slashFrom,
        to: from,
        x: coords.left,
        y: coords.bottom + 8,
        activeIndex: menu?.query === query ? menu.activeIndex : 0,
      }));
    } catch {
      setSlashMenu(null);
    }
  };

  const runSlashCommand = (ed: Editor, menu = slashMenu, command?: WritingCommand) => {
    if (!menu) return false;
    const matches = searchSlashCommands(menu.query);
    const selected = command ?? matches[menu.activeIndex] ?? matches[0];
    if (!selected) return false;
    ed.chain().focus().deleteRange({from: menu.from, to: menu.to}).run();
    setSlashMenu(null);
    const scope = buildCommandScope(ed);
    onCommand?.(selected.id, scope, selected.id === 'custom' ? menu.query.replace(/^do\s*/i, '').trim() : undefined);
    return true;
  };

  const setGhostText = (ed: Editor | null, text: string) => {
    ghostText.current = text;
    refreshGhost(ed);
  };

  const insertGhostText = (ed: Editor, text: string) => {
    if (!text) return;
    const originalGhost = ghostText.current;
    ed.chain().focus().insertContent(text).run();
    const rest = originalGhost.slice(text.length);
    setGhostText(ed, rest);
  };

  const scheduleAutocomplete = (ed: Editor) => {
    setGhostText(ed, '');
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    autocompleteTimer.current = setTimeout(() => {
      const context = buildAutocompleteContext(ed);
      if (!context || context.before === lastAutocompleteBefore.current) return;
      const typedChars = context.before.length - lastAutocompleteBefore.current.length;
      const meaningfulBoundary = /[\s.,!?;:]$/.test(context.before);
      if (!meaningfulBoundary && typedChars < 3) return;
      if (typedChars < 0) return;
      lastAutocompleteBefore.current = context.before;
      onAutocompleteContext?.(context);
    }, AUTOCOMPLETE_MS);
  };

  const doSave = useCallback(
    async (ed: Editor) => {
      const md = tipTapDocToMarkdown(ed.getJSON());
      await api.putSceneContent(projectId, sceneId, md);
      onSaved?.();
    },
    [onSaved, projectId, sceneId],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({heading: {levels: [1, 2, 3]}}),
      Placeholder.configure({placeholder: 'Write the scene…'}),
      CharacterCount,
      BubbleMenuExt.configure({}),
    ],
    content: markdownToTipTapDoc(''),
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none min-h-[480px] focus:outline-none font-serif text-xl leading-relaxed text-ink px-1 zen-cursor',
      },
      handleKeyDown: (_view, event) => {
        const ed = edRef.current;
        if (!ed) return false;
        if (slashMenu?.open) {
          const matches = searchSlashCommands(slashMenu.query);
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSlashMenu((menu) => (menu ? {...menu, activeIndex: Math.min(matches.length - 1, menu.activeIndex + 1)} : menu));
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSlashMenu((menu) => (menu ? {...menu, activeIndex: Math.max(0, menu.activeIndex - 1)} : menu));
            return true;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            return runSlashCommand(ed);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setSlashMenu(null);
            return true;
          }
        }
        if (ghostText.current) {
          if (event.key === 'Tab') {
            event.preventDefault();
            insertGhostText(ed, ghostText.current);
            return true;
          }
          if (event.key === 'ArrowRight' && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
            const {from, to} = ed.state.selection;
            if (from !== to) return false;
            event.preventDefault();
            insertGhostText(ed, nextWordChunk(ghostText.current));
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setGhostText(ed, '');
            return true;
          }
        }
        return false;
      },
    },
    onCreate: ({editor: ed}) => {
      ed.registerPlugin(
        new Plugin({
          key: ghostPluginKey,
          props: {
            decorations(state) {
              if (!ghostText.current || !state.selection.empty) return DecorationSet.empty;
              const widget = Decoration.widget(
                state.selection.from,
                () => {
                  const span = document.createElement('span');
                  span.className = 'autocomplete-ghost';
                  span.textContent = ghostText.current;
                  return span;
                },
                {side: 1},
              );
              return DecorationSet.create(state.doc, [widget]);
            },
          },
        }),
      );
      ed.registerPlugin(
        new Plugin({
          key: entityPluginKey,
          props: {
            decorations(state) {
              return buildEntityDecorations(state.doc, memoryTermsRef.current);
            },
            handleDOMEvents: {
              click: (_view, e) => {
                const t = (e.target as HTMLElement | null)?.closest?.('.story-memory-entity');
                if (t) {
                  onEntityClickRef.current?.((t as HTMLElement).textContent?.trim() ?? '');
                  e.preventDefault();
                  return true;
                }
                return false;
              },
            },
          },
        }),
      );
      ed.registerPlugin(
        new Plugin<InlinePreview | null>({
          key: inlinePreviewPluginKey,
          state: {
            init: () => null,
            apply(tr, value) {
              const next = tr.getMeta(inlinePreviewPluginKey) as InlinePreview | null | undefined;
              return next === undefined ? value : next;
            },
          },
          props: {
            decorations(state) {
              const preview = inlinePreviewPluginKey.getState(state);
              if (!preview?.proposed) return DecorationSet.empty;
              const decos: Decoration[] = [];
              if (preview.range.from !== preview.range.to) {
                decos.push(Decoration.inline(preview.range.from, preview.range.to, {class: 'inline-edit-removed'}));
              }
              decos.push(
                Decoration.widget(
                  preview.insertPos,
                  () => {
                    const wrap = document.createElement('span');
                    wrap.className = 'inline-edit-widget';
                    const text = document.createElement('span');
                    text.className = 'inline-edit-added';
                    text.textContent = preview.proposed;
                    wrap.append(text);
                    const actions = document.createElement('span');
                    actions.className = 'inline-edit-actions';
                    const accept = document.createElement('button');
                    accept.type = 'button';
                    accept.textContent = 'Accept';
                    accept.dataset.inlinePreviewAction = 'accept';
                    actions.append(accept);
                    if (preview.showInsertBelow) {
                      const insert = document.createElement('button');
                      insert.type = 'button';
                      insert.textContent = 'Insert below';
                      insert.dataset.inlinePreviewAction = 'insert_below';
                      actions.append(insert);
                    }
                    const reject = document.createElement('button');
                    reject.type = 'button';
                    reject.textContent = 'Reject';
                    reject.dataset.inlinePreviewAction = 'reject';
                    actions.append(reject);
                    wrap.append(actions);
                    return wrap;
                  },
                  {side: 1},
                ),
              );
              return DecorationSet.create(state.doc, decos);
            },
            handleDOMEvents: {
              click: (_view, event) => {
                const action = (event.target as HTMLElement | null)?.closest?.('[data-inline-preview-action]') as HTMLElement | null;
                const value = action?.dataset.inlinePreviewAction as 'accept' | 'reject' | 'insert_below' | undefined;
                if (!value) return false;
                event.preventDefault();
                onPreviewActionRef.current?.(value);
                return true;
              },
            },
          },
        }),
      );
    },
    onUpdate: ({editor: ed}) => {
      refreshInlinePreview(ed, null);
      onStats?.(ed.storage.characterCount.words());
      scheduleAutocomplete(ed);
      updateSlashMenu(ed);
      runTypewriterScroll(ed);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void doSave(ed).catch(() => {
          /* surfaced later */
        });
      }, SAVE_MS);
    },
    onSelectionUpdate: ({editor: ed}) => {
      const {from, to} = ed.state.selection;
      const text = ed.state.doc.textBetween(from, to, '\n');
      onSelectionChange?.({from, to, text});
      if (from !== to) {
        setGhostText(ed, '');
        setSlashMenu(null);
      } else {
        scheduleAutocomplete(ed);
        updateSlashMenu(ed);
      }
      runTypewriterScroll(ed);
    },
  });

  edRef.current = editor ?? null;

  const flushSave = useCallback(async () => {
    if (!editor) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await doSave(editor);
  }, [doSave, editor]);

  useImperativeHandle(
    ref,
    () => ({
      getEditor: () => editor,
      replaceSelection: (markdown: string) => {
        if (!editor) return;
        const {from, to} = editor.state.selection;
        insertMarkdownAt(editor, from, to, markdown);
      },
      getSelection: () => {
        if (!editor) return {from: 0, to: 0, text: ''};
        const {from, to} = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, '\n');
        return {from, to, text};
      },
      getCommandScope: () =>
        editor
          ? buildCommandScope(editor)
          : {
              selection: {from: 0, to: 0, text: ''},
              cursor: 0,
              currentSentence: {from: 0, to: 0, text: ''},
              currentParagraph: {from: 0, to: 0, text: ''},
              previousParagraphs: [],
              nextParagraphs: [],
              fullSceneMarkdown: '',
            },
      showInlinePreview: (preview: InlinePreview) => refreshInlinePreview(editor, preview),
      clearInlinePreview: () => refreshInlinePreview(editor, null),
      applyOperation: (operation: InlineOperation) => {
        if (!editor) return;
        const preview = inlinePreview.current;
        const scope = buildCommandScope(editor);
        const target = preview ?? {...operationTarget(operation, scope), operation, proposed: operation.text};
        if (operation.operation === 'insert_after_cursor') {
          editor.chain().focus().insertContentAt(target.insertPos, operation.text).run();
          refreshInlinePreview(editor, null);
          return;
        }
        if (operation.operation === 'insert_block_after' || (operation.operation === 'expand_choice' && operation.choice === 'insert_below')) {
          insertMarkdownAt(editor, target.insertPos, target.insertPos, `\n\n${operation.text}`);
          refreshInlinePreview(editor, null);
          return;
        }
        insertMarkdownAt(editor, target.range.from, target.range.to, operation.text);
        refreshInlinePreview(editor, null);
      },
      setGhostText: (text: string) => setGhostText(editor, text),
      clearGhostText: () => setGhostText(editor, ''),
      flushSave,
      getMarkdown: () => (editor ? tipTapDocToMarkdown(editor.getJSON()) : ''),
    }),
    [editor, flushSave],
  );

  useEffect(() => {
    if (!editor || !sceneId) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (autocompleteTimer.current) {
      clearTimeout(autocompleteTimer.current);
      autocompleteTimer.current = null;
    }
    ghostText.current = '';
    lastAutocompleteBefore.current = '';
    let cancelled = false;
    (async () => {
      try {
        const {markdown} = await api.getSceneContent(projectId, sceneId);
        if (cancelled) return;
        editor.commands.setContent(markdownToTipTapDoc(markdown));
        onStats?.(editor.storage.characterCount.words());
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, projectId, sceneId, onStats]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta('entityTermsRefresh', 1));
  }, [editor, memoryTerms]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
      if (typewriterRaf.current) cancelAnimationFrame(typewriterRaf.current);
    },
    [],
  );

  if (!editor) {
    return <div className="text-ink-muted text-sm font-sans">Loading editor…</div>;
  }

  const slashMatches = slashMenu?.open ? searchSlashCommands(slashMenu.query) : [];

  return (
    <div className="relative w-full min-w-0">
      <BubbleMenu
        editor={editor}
        tippyOptions={{duration: 150, maxWidth: 'min(100vw, 360px)'}}
        shouldShow={({editor: ed}) => {
          const {from, to} = ed.state.selection;
          return from !== to && to - from < 200_000;
        }}
      >
        <div
          className="flex items-center gap-0.5 rounded-sm border border-outline-variant bg-surface-container-high px-1 py-0.5 font-sans text-ui-label shadow-sm"
          role="toolbar"
          aria-label="Formatting"
        >
          <button
            type="button"
            className={`min-w-8 rounded-sm px-2 py-1 text-xs font-semibold ${
              editor.isActive('bold') ? 'bg-surface-tint/15 text-on-surface' : 'text-ink-muted hover:text-on-surface'
            }`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (⌘B)"
          >
            B
          </button>
          <button
            type="button"
            className={`min-w-8 rounded-sm px-2 py-1 text-xs italic ${
              editor.isActive('italic') ? 'bg-surface-tint/15 text-on-surface' : 'text-ink-muted hover:text-on-surface'
            }`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (⌘I)"
          >
            I
          </button>
          <span className="mx-1 w-px self-stretch bg-outline-variant" aria-hidden />
          <span className="px-1.5 text-[10px] uppercase tracking-widest text-ink-muted">Prose: Newsreader</span>
        </div>
      </BubbleMenu>
      <EditorContent editor={editor} />
      {slashMenu?.open && slashMatches.length ? (
        <div
          className="fixed z-[80] max-h-80 w-64 overflow-y-auto rounded-sm border border-oak-variant bg-surface-container-high py-1 font-sans text-xs text-ink"
          style={{left: Math.min(slashMenu.x, window.innerWidth - 280), top: slashMenu.y}}
          role="menu"
        >
          {slashMatches.map((command, index) => {
            const Icon = command.icon;
            return (
              <button
                key={command.id}
                type="button"
                className={`flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-sepia-mid ${
                  index === slashMenu.activeIndex ? 'bg-sepia-high text-primary' : 'text-ink'
                }`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  runSlashCommand(editor, slashMenu, command);
                }}
                role="menuitem"
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-widest">{command.label}</span>
                  <span className="block truncate text-[11px] text-ink-muted">{command.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});
