import {CharacterCount} from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import {EditorContent, useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import type {Editor} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {Decoration, DecorationSet} from '@tiptap/pm/view';
import {markdownToTipTapDoc, tipTapDocToMarkdown} from '../lib/markdownDoc';
import {api} from '../lib/api';

export type ManuscriptEditorHandle = {
  getEditor: () => Editor | null;
  replaceSelection: (markdown: string) => void;
  getSelection: () => {from: number; to: number; text: string};
  setGhostText: (text: string) => void;
  clearGhostText: () => void;
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
};

const SAVE_MS = 900;
const AUTOCOMPLETE_MS = 220;
const ghostPluginKey = new PluginKey('liteauthor-autocomplete');

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

export const ManuscriptEditor = forwardRef<ManuscriptEditorHandle, Props>(function ManuscriptEditor(
  {projectId, sceneId, onSaved, onStats, onSelectionChange, onAutocompleteContext},
  ref,
) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostText = useRef('');
  const lastAutocompleteBefore = useRef('');

  const refreshGhost = (editor: Editor | null) => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(ghostPluginKey, {refresh: true}));
  };

  const setGhostText = (editor: Editor | null, text: string) => {
    ghostText.current = text;
    refreshGhost(editor);
  };

  const insertGhostText = (editor: Editor, text: string) => {
    if (!text) return;
    const originalGhost = ghostText.current;
    editor.chain().focus().insertContent(text).run();
    const rest = originalGhost.slice(text.length);
    setGhostText(editor, rest);
  };

  const scheduleAutocomplete = (editor: Editor) => {
    setGhostText(editor, '');
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    autocompleteTimer.current = setTimeout(() => {
      const context = buildAutocompleteContext(editor);
      if (!context || context.before === lastAutocompleteBefore.current) return;
      const typedChars = context.before.length - lastAutocompleteBefore.current.length;
      const meaningfulBoundary = /[\s.,!?;:]$/.test(context.before);
      if (!meaningfulBoundary && typedChars < 3) return;
      if (typedChars < 0) return;
      lastAutocompleteBefore.current = context.before;
      onAutocompleteContext?.(context);
    }, AUTOCOMPLETE_MS);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({heading: {levels: [1, 2, 3]}}),
      Placeholder.configure({placeholder: 'Write the scene…'}),
      CharacterCount,
    ],
    content: markdownToTipTapDoc(''),
    editorProps: {
      attributes: {
        class:
          'prose prose-invert max-w-none min-h-[480px] focus:outline-none font-serif text-xl leading-relaxed text-ink px-1',
      },
      handleKeyDown: (_view, event) => {
        if (!editor || !ghostText.current) return false;
        if (event.key === 'Tab') {
          event.preventDefault();
          insertGhostText(editor, ghostText.current);
          return true;
        }
        if (event.key === 'ArrowRight' && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
          const {from, to} = editor.state.selection;
          if (from !== to) return false;
          event.preventDefault();
          insertGhostText(editor, nextWordChunk(ghostText.current));
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setGhostText(editor, '');
          return true;
        }
        return false;
      },
    },
    onCreate: ({editor}) => {
      editor.registerPlugin(
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
    },
    onUpdate: ({editor}) => {
      onStats?.(editor.storage.characterCount.words());
      scheduleAutocomplete(editor);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const md = tipTapDocToMarkdown(editor.getJSON());
        try {
          await api.putSceneContent(projectId, sceneId, md);
          onSaved?.();
        } catch {
          /* surface via parent later */
        }
      }, SAVE_MS);
    },
    onSelectionUpdate: ({editor}) => {
      const {from, to} = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, '\n');
      onSelectionChange?.({from, to, text});
      if (from !== to) {
        setGhostText(editor, '');
      } else {
        scheduleAutocomplete(editor);
      }
    },
  });

  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
    replaceSelection: (markdown: string) => {
      if (!editor) return;
      const {from, to} = editor.state.selection;
      const doc = markdownToTipTapDoc(markdown);
      const inner = doc.content?.length ? doc.content : [{type: 'paragraph'}];
      editor.chain().focus().insertContentAt({from, to}, inner).run();
    },
    getSelection: () => {
      if (!editor) return {from: 0, to: 0, text: ''};
      const {from, to} = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, '\n');
      return {from, to, text};
    },
    setGhostText: (text: string) => setGhostText(editor, text),
    clearGhostText: () => setGhostText(editor, ''),
  }));

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

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    },
    [],
  );

  if (!editor) {
    return <div className="text-ink-muted text-sm font-sans">Loading editor…</div>;
  }

  return <EditorContent editor={editor} />;
});
