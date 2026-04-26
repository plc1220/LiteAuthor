const KEY = 'liteauthor.storyBible.open';

export type StoryBibleOpen = {view: 'file' | 'motifs'; path?: string};

export function setStoryBibleOpen(v: StoryBibleOpen) {
  sessionStorage.setItem(KEY, JSON.stringify(v));
}

export function takeStoryBibleOpen(): StoryBibleOpen | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as StoryBibleOpen;
    sessionStorage.removeItem(KEY);
    if (p && (p.view === 'file' || p.view === 'motifs')) return p;
  } catch {
    /* ignore */
  }
  sessionStorage.removeItem(KEY);
  return null;
}
