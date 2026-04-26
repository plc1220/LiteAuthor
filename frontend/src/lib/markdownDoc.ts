import type {JSONContent} from '@tiptap/core';

function paragraphFromText(text: string): JSONContent {
  const t = text.trim();
  if (!t) return {type: 'paragraph'};
  return {type: 'paragraph', content: parseInlineToContent(t)};
}

/** Parse a single line for **bold**, *italic*, and ***both***. Unclosed markers are left as plain text. */
export function parseInlineToContent(text: string): JSONContent[] {
  const out: JSONContent[] = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('***', i)) {
      const end = text.indexOf('***', i + 3);
      if (end !== -1) {
        out.push({type: 'text', text: text.slice(i + 3, end), marks: [{type: 'bold'}, {type: 'italic'}]});
        i = end + 3;
        continue;
      }
    }
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        out.push({type: 'text', text: text.slice(i + 2, end), marks: [{type: 'bold'}]});
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1) {
        out.push({type: 'text', text: text.slice(i + 1, end), marks: [{type: 'italic'}]});
        i = end + 1;
        continue;
      }
    }
    const nextStar = text.indexOf('*', i);
    const end = nextStar === -1 ? text.length : nextStar;
    if (end > i) {
      out.push({type: 'text', text: text.slice(i, end)});
    } else {
      out.push({type: 'text', text: text[i]});
      i += 1;
      continue;
    }
    i = end;
  }
  if (out.length === 0) {
    out.push({type: 'text', text: ''});
  }
  return out;
}

export function markdownToTipTapDoc(md: string): JSONContent {
  const chunks = md.split(/\n{2,}/);
  const content: JSONContent[] = [];
  for (const raw of chunks) {
    const block = raw.trim();
    if (!block) continue;
    const m = /^(#{1,3})\s+(.*)$/.exec(block);
    if (m) {
      const level = Math.min(3, m[1].length) as 1 | 2 | 3;
      const rest = m[2].trim();
      content.push({
        type: 'heading',
        attrs: {level},
        content: parseInlineToContent(rest),
      });
    } else {
      content.push(paragraphFromText(block));
    }
  }
  if (content.length === 0) {
    content.push({type: 'paragraph'});
  }
  return {type: 'doc', content};
}

function emitTextNode(node: JSONContent): string {
  if (node.type !== 'text' || !node.text) return '';
  const t = node.text;
  const marks = node.marks ?? [];
  const bold = marks.some((x) => x.type === 'bold');
  const italic = marks.some((x) => x.type === 'italic');
  if (bold && italic) return `***${t}***`;
  if (bold) return `**${t}**`;
  if (italic) return `*${t}*`;
  return t;
}

function extractTextWithMarks(node: JSONContent): string {
  if (!node.content) return '';
  return node.content.map(emitTextNode).join('');
}

export function tipTapDocToMarkdown(doc: JSONContent): string {
  if (!doc.content) return '';
  const parts: string[] = [];
  for (const node of doc.content) {
    if (node.type === 'heading') {
      const level = (node.attrs?.level as number) || 1;
      const text = extractTextWithMarks(node);
      parts.push(`${'#'.repeat(level)} ${text}`.trim());
    } else if (node.type === 'paragraph') {
      const text = extractTextWithMarks(node).trim();
      if (text) parts.push(text);
    }
  }
  return parts.join('\n\n');
}
