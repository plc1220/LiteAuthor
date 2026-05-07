const KEY = 'liteauthor.wiki.open';
const LEGACY_KEY = 'liteauthor.storyBible.open';

export type WikiOpen = {view: 'file' | 'motifs'; path?: string};

export function setWikiOpen(v: WikiOpen) {
  sessionStorage.setItem(KEY, JSON.stringify(v));
}

export function takeWikiOpen(): WikiOpen | null {
  const key = sessionStorage.getItem(KEY) ? KEY : LEGACY_KEY;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as WikiOpen;
    sessionStorage.removeItem(key);
    if (p && (p.view === 'file' || p.view === 'motifs')) return p;
  } catch {
    /* ignore */
  }
  sessionStorage.removeItem(key);
  return null;
}
