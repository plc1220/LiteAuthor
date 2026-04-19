import type {JSONContent} from '@tiptap/core';

function paragraphFromText(text: string): JSONContent {
  const t = text.trim();
  if (!t) return {type: 'paragraph'};
  return {type: 'paragraph', content: [{type: 'text', text: t}]};
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
      content.push({
        type: 'heading',
        attrs: {level},
        content: [{type: 'text', text: m[2].trim()}],
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

export function tipTapDocToMarkdown(doc: JSONContent): string {
  if (!doc.content) return '';
  const parts: string[] = [];
  for (const node of doc.content) {
    if (node.type === 'heading') {
      const level = (node.attrs?.level as number) || 1;
      const text = extractText(node);
      parts.push(`${'#'.repeat(level)} ${text}`.trim());
    } else if (node.type === 'paragraph') {
      parts.push(extractText(node).trim());
    }
  }
  return parts.filter(Boolean).join('\n\n');
}

function extractText(node: JSONContent): string {
  if (!node.content) return '';
  return node.content
    .map((c) => {
      if (c.type === 'text') return c.text || '';
      return extractText(c);
    })
    .join('');
}
