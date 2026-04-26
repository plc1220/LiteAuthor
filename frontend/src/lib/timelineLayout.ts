import type {Chapter, Scene} from './api';

export type TimelineEventLike = {
  id: string;
  title: string;
  story_time: string | null;
  narrative_order: number | null;
  has_conflict: boolean;
  scene_id: string | null;
};

const SEASON_ORDER: Record<string, number> = {
  winter: 0,
  spring: 1,
  summer: 2,
  fall: 3,
  autumn: 3,
};

/**
 * Coarse key for story-time labels (e.g. "Spring, 1422") so the world line reads left-to-right in time.
 */
export function storyTimeSortKey(value: string | null | undefined): number {
  if (value == null) return 1_000_000_000;
  const t = value.toLowerCase();
  const yearM = t.match(/(\d{1,4})\b/);
  const year = yearM ? Math.min(9999, Math.max(0, parseInt(yearM[1], 10))) : 0;
  let band = 0.5;
  for (const [k, v] of Object.entries(SEASON_ORDER)) {
    if (t.includes(k)) {
      band = v;
      break;
    }
  }
  const numM = t.match(/\b(\d{1,2})\b/);
  if (!yearM && numM) band = Math.min(15, parseInt(numM[1], 10) / 2);
  return year * 32 + band;
}

export function eventsSortedByWorldTime<T extends TimelineEventLike>(events: T[]): T[] {
  const w = events.filter((e) => (e.story_time ?? '').trim() !== '');
  if (w.length === 0) return [...events];
  const tbd = events.filter((e) => !(e.story_time ?? '').trim());
  return [
    ...[...w].sort((a, b) => storyTimeSortKey(a.story_time) - storyTimeSortKey(b.story_time)),
    ...tbd,
  ];
}

function scenesByChapterId(scenes: Scene[]): Map<string, Scene[]> {
  const m = new Map<string, Scene[]>();
  for (const s of scenes) {
    const a = m.get(s.chapter_id) ?? [];
    a.push(s);
    m.set(s.chapter_id, a);
  }
  for (const a of m.values()) {
    a.sort((x, y) => x.sort_order - y.sort_order);
  }
  return m;
}

export function firstSceneIdForChapter(chapterId: string, scenes: Scene[]) {
  const m = scenesByChapterId(scenes);
  return m.get(chapterId)?.[0]?.id ?? null;
}

export function chapterIdForEvent(event: TimelineEventLike, scenes: Scene[] | null): string | null {
  if (!event.scene_id) return null;
  return scenes?.find((s) => s.id === event.scene_id)?.chapter_id ?? null;
}

/** Column index 0..chCount for reveal (last column = unanchored) */
export function chapterSlotIndex(
  event: TimelineEventLike,
  chapters: Chapter[],
  scenes: Scene[],
): {slot: number; inUnplaced: boolean} {
  const chSorted = [...chapters].sort((a, b) => a.sort_order - b.sort_order);
  if (chSorted.length === 0) return {slot: 0, inUnplaced: true};
  const chId = chapterIdForEvent(event, scenes);
  if (chId) {
    const i = chSorted.findIndex((c) => c.id === chId);
    if (i >= 0) return {slot: i, inUnplaced: false};
  }
  if (event.narrative_order != null) {
    const n = chSorted.length;
    const s = Math.min(n - 1, Math.max(0, (event.narrative_order as number) - 1)) % n;
    return {slot: s, inUnplaced: false};
  }
  return {slot: chSorted.length, inUnplaced: true};
}

export function worldIndexForEvent<T extends TimelineEventLike>(event: T, worldOrdered: T[]) {
  return worldOrdered.findIndex((e) => e.id === event.id);
}

export function continuityTension(
  e: TimelineEventLike,
  events: TimelineEventLike[],
): {level: 'none' | 'watch' | 'tension'; hint?: string} {
  const withW = events.filter((x) => (x.story_time ?? '').trim() !== '');
  if (withW.length < 2) return {level: 'none'};
  const sortedW = [...withW].sort((a, b) => storyTimeSortKey(a.story_time) - storyTimeSortKey(b.story_time));
  const wIdx = sortedW.findIndex((x) => x.id === e.id);
  if (wIdx < 0) return {level: 'none'};
  const wR = wIdx / Math.max(1, sortedW.length - 1);

  const withR = events.filter((x) => x.narrative_order != null);
  if (withR.length < 2) return {level: 'none'};
  const sortedR = [...withR].sort((a, b) => (a.narrative_order ?? 0) - (b.narrative_order ?? 0));
  const rIdx = sortedR.findIndex((x) => x.id === e.id);
  if (rIdx < 0) return {level: 'none'};
  const rR = rIdx / Math.max(1, withR.length - 1);

  const diff = wR - rR;
  if (diff < -0.4) {
    return {
      level: 'watch',
      hint: 'Told out of world-time order—often a flashback, frame, or reordered memory.',
    };
  }
  if (diff > 0.45) {
    return {
      level: 'tension',
      hint: 'Reveals early in the reading order, but this beat sits late on the world line—readers may assume information too soon.',
    };
  }
  return {level: 'none'};
}

export function countByChapterId(events: TimelineEventLike[], scenes: Scene[] | null, chapterIds: string[]) {
  const c: Record<string, number> = {};
  for (const id of chapterIds) c[id] = 0;
  for (const e of events) {
    const ch = chapterIdForEvent(e, scenes);
    if (ch && c[ch] !== undefined) c[ch] += 1;
  }
  return c;
}

/**
 * Next `narrative_order` when an event is anchored to a chapter (excludes the moved event if it
 * was already counted in another column).
 */
export function nextNarrativeOrderForDrop(
  events: TimelineEventLike[],
  targetChapterId: string,
  scenes: Scene[],
  exceptEventId?: string,
) {
  const inCh = events.filter(
    (e) => e.id !== exceptEventId && chapterIdForEvent(e, scenes) === targetChapterId,
  );
  const ords = inCh
    .map((e) => e.narrative_order)
    .filter((n): n is number => n != null);
  if (ords.length === 0) {
    const g = events
      .filter((e) => e.id !== exceptEventId)
      .map((e) => e.narrative_order)
      .filter((n): n is number => n != null);
    if (g.length) {
      return Math.max(...g) + 1;
    }
    return 1;
  }
  return Math.max(...ords) + 1;
}
