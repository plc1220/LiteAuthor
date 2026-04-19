import {CharacterCount} from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import {EditorContent, useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import type {Editor} from '@tiptap/core';
import {markdownToTipTapDoc, tipTapDocToMarkdown} from '../lib/markdownDoc';
import {api} from '../lib/api';

export type ManuscriptEditorHandle = {
  getEditor: () => Editor | null;
  replaceSelection: (markdown: string) => void;
  getSelection: () => {from: number; to: number; text: string};
};

type Props = {
  projectId: string;
  sceneId: string;
  onSaved?: () => void;
  onStats?: (words: number) => void;
  onSelectionChange?: (sel: {from: number; to: number; text: string}) => void;
};

const SAVE_MS = 900;

export const ManuscriptEditor = forwardRef<ManuscriptEditorHandle, Props>(function ManuscriptEditor(
  {projectId, sceneId, onSaved, onStats, onSelectionChange},
  ref,
) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    },
    onUpdate: ({editor}) => {
      onStats?.(editor.storage.characterCount.words());
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
  }));

  useEffect(() => {
    if (!editor || !sceneId) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
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
    },
    [],
  );

  if (!editor) {
    return <div className="text-ink-muted text-sm font-sans">Loading editor…</div>;
  }

  return <EditorContent editor={editor} />;
});
