/** Word count suited to multilingual prose (incl. CJK) using Intl.Segmenter where available. */
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

function countWithoutSegmenter(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const cjk = trimmed.match(CJK)?.length ?? 0;
  const rest = trimmed.replace(CJK, ' ').trim();
  const latin = rest ? rest.split(/\s+/).filter(Boolean).length : 0;
  return cjk + latin;
}

export function countManuscriptWords(text: string): number {
  const normalized = text.replace(/\u00a0/g, ' ');
  const trimmed = normalized.trim();
  if (!trimmed) return 0;

  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const Segmenter = (Intl as unknown as {Segmenter: new (locales?: Intl.LocalesArgument, options?: {granularity: string}) => Intl.Segmenter}).Segmenter;
      const segmenter = new Segmenter(undefined, {granularity: 'word'});
      let n = 0;
      for (const segment of segmenter.segment(trimmed) as Iterable<{segment: string; isWordLike?: boolean}>) {
        if (segment.isWordLike && segment.segment.trim()) n += 1;
      }
      if (n > 0) return n;
    } catch {
      /* fall through */
    }
  }

  return countWithoutSegmenter(trimmed);
}
