import {type DragEvent, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Chapter, Scene} from '../lib/api';
import {chapterSlotIndex, continuityTension, countByChapterId, eventsSortedByWorldTime, firstSceneIdForChapter, nextNarrativeOrderForDrop, storyTimeSortKey} from '../lib/timelineLayout';

export type ThreadEvent = {
  id: string;
  title: string;
  story_time: string | null;
  narrative_order: number | null;
  pov: string | null;
  participants: string[];
  notes: string | null;
  has_conflict: boolean;
  scene_id: string | null;
};

type Props = {
  events: ThreadEvent[];
  chapters: Chapter[];
  scenes: Scene[];
  selectedId: string | null;
  onSelect: (e: ThreadEvent) => void;
  onDropToChapter: (args: {eventId: string; chapterId: string; sceneId: string; nextNarrativeOrder: number}) => Promise<void>;
};

type MeasuredPath = {d: string; color: string; dash: string; title: string; eventId: string};

function avatarLabel(e: ThreadEvent) {
  const a = (e.participants[0] ?? e.pov ?? e.title[0] ?? '?').trim();
  return a.slice(0, 1).toUpperCase();
}

function bezierD(x0: number, y0: number, x1: number, y1: number) {
  const m = (x0 + x1) / 2;
  return `M ${x0} ${y0} C ${m} ${(y0 + y1) / 2} ${m} ${(y0 + y1) / 2} ${x1} ${y1}`;
}

function pathsEqual(a: MeasuredPath[], b: MeasuredPath[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) {
      return false;
    }
    if (x.d !== y.d || x.color !== y.color || x.dash !== y.dash || x.eventId !== y.eventId) {
      return false;
    }
  }
  return true;
}

export function TimelineThreadCanvas({events, chapters, scenes, selectedId, onSelect, onDropToChapter}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const btmRef = useRef<HTMLDivElement | null>(null);
  const [paths, setPaths] = useState<MeasuredPath[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  const chSorted = useMemo(
    () => (chapters.length ? [...chapters].sort((a, b) => a.sort_order - b.sort_order) : []),
    [chapters],
  );
  const worldLine = eventsSortedByWorldTime(events);
  const counts = countByChapterId(events, scenes, chSorted.map((c) => c.id));
  const maxC = Math.max(1, ...Object.values(counts), 0);
  const pacingGaps: string[] = [];
  if (chSorted.length > 2) {
    for (let i = 1; i < chSorted.length - 1; i += 1) {
      if (counts[chSorted[i]!.id] === 0 && (counts[chSorted[i - 1]!.id]! > 0 || counts[chSorted[i + 1]!.id]! > 0)) {
        pacingGaps.push(chSorted[i]!.id);
      }
    }
  }

  const eventsKey = useMemo(
    () =>
      events
        .map(
          (e) =>
            `${e.id}\t${e.narrative_order ?? ''}\t${e.scene_id ?? ''}\t${e.has_conflict ? 1 : 0}\t${(e.story_time ?? '').slice(0, 48)}\t${(e.title ?? '').slice(0, 64)}`,
        )
        .join('\n'),
    [events],
  );
  const scenesKey = useMemo(
    () =>
      scenes
        .map((s) => `${s.id}\t${s.chapter_id}`)
        .join('\n'),
    [scenes],
  );
  const chKey = useMemo(
    () =>
      chSorted
        .map((c) => `${c.id}\t${c.sort_order}`)
        .join('\n'),
    [chSorted],
  );

  const evRef = useRef(events);
  const chRef = useRef(chSorted);
  const scRef = useRef(scenes);
  evRef.current = events;
  chRef.current = chSorted;
  scRef.current = scenes;

  useLayoutEffect(() => {
    let raf = 0;
    const runMeasure = () => {
      const eventsNow = evRef.current;
      const chSortedNow = chRef.current;
      const scenesNow = scRef.current;
      const w = wrapRef.current;
      const t = topRef.current;
      const b = btmRef.current;
      if (!w || !t || !b) {
        return;
      }
      const wr = w.getBoundingClientRect();
      if (wr.width < 8) {
        setPaths((p) => (p.length ? [] : p));
        return;
      }
      const wOrdered = eventsSortedByWorldTime(eventsNow);
      const centerX = (el: Element | null) => {
        if (!el) {
          return 0.5 * wr.width;
        }
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2 - wr.left;
      };
      const next: MeasuredPath[] = [];
      const wTop = 6;
      const wBot = 94;
      for (const e of wOrdered) {
        const tEl = t.querySelector(`[data-wid="${e.id}"]`);
        const {slot, inUnplaced} = chapterSlotIndex(e, chSortedNow, scenesNow);
        const bSel = inUnplaced
          ? b.querySelector(`[data-col="u"]`)
          : b.querySelector(`[data-col="ch-${chSortedNow[slot]?.id ?? 'none'}"]`);
        const x0 = (centerX(tEl) / wr.width) * 1000;
        const x1 = (centerX(bSel) / wr.width) * 1000;
        const tns = continuityTension(e, eventsNow);
        const tense = tns.level === 'tension' || e.has_conflict;
        const watch = tns.level === 'watch' && !e.has_conflict;
        const color = tense ? 'rgb(217 119 6)' : watch ? 'rgb(71 85 105)' : 'rgb(130 110 90)';
        const dash = watch ? '5 4' : '0';
        const lineTitle = e.has_conflict
          ? 'Flagged in data; verify reader knowledge and timing'
          : tns.hint
            ? tns.hint
            : 'World time → when this surfaces in the manuscript order';
        next.push({
          eventId: e.id,
          d: bezierD(x0, wTop, x1, wBot),
          color,
          dash,
          title: `${e.title} — ${lineTitle}`,
        });
      }
      setPaths((prev) => (pathsEqual(prev, next) ? prev : next));
    };

    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(runMeasure);
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    if (ro && wrapRef.current) {
      ro.observe(wrapRef.current);
    }
    window.addEventListener('resize', measure, {passive: true});
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [eventsKey, chKey, scenesKey]);

  const onDragStart = (id: string) => {
    setDragId(id);
  };
  const onDragEnd = () => setDragId(null);

  const onDrop = async (e: DragEvent, chapterId: string | 'unplaced', chIndex: number) => {
    e.preventDefault();
    const from = e.dataTransfer?.getData('text/plain') ?? dragId;
    if (!from) {
      onDragEnd();
      return;
    }
    if (chapterId === 'unplaced') {
      onDragEnd();
      return;
    }
    const scId = firstSceneIdForChapter(chapterId, scenes);
    if (!scId) {
      onDragEnd();
      return;
    }
    const order = nextNarrativeOrderForDrop(events, chapterId, scenes, from);
    try {
      await onDropToChapter({eventId: from, chapterId, sceneId: scId, nextNarrativeOrder: order});
    } finally {
      onDragEnd();
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[10px] font-sans font-bold uppercase tracking-widest text-ink-muted">Thread map</h3>
        <p className="max-w-xl text-[10px] leading-normal text-ink-muted/80">
          Drag a world event onto a chapter to anchor the reveal. Curves show cross-overs; amber = worth another look, dashed = out-of-chronology tell (often a frame or memory).
        </p>
      </div>

      <div ref={wrapRef} className="relative w-full min-w-0">
        <div className="text-[9px] font-sans font-bold uppercase tracking-widest text-ink-muted/60">World time (chronology)</div>
        <div
          ref={topRef}
          className="mt-2 flex min-h-[4.5rem] gap-1.5 overflow-x-auto overflow-y-hidden pb-1 [scrollbar-gutter:stable] sm:gap-2"
        >
          {worldLine.map((e) => {
            const tns = continuityTension(e, events);
            const tense = tns.level === 'tension' || e.has_conflict;
            return (
              <div key={e.id} className="w-[6.5rem] shrink-0 sm:w-28">
                <button
                  data-wid={e.id}
                  type="button"
                  draggable
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData('text/plain', e.id);
                    ev.dataTransfer.effectAllowed = 'move';
                    onDragStart(e.id);
                  }}
                  onDragEnd={onDragEnd}
                  onClick={() => onSelect(e)}
                  className={[
                    'w-full min-h-16 rounded-sm border p-1.5 text-left transition',
                    'bg-parchment-bright hover:border-primary/40',
                    selectedId === e.id ? 'ring-1 ring-primary border-primary' : 'border-oak-variant',
                    tense || e.has_conflict ? 'ring-1 ring-amber-600/40' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  title={
                    tns.hint
                      ? `${e.title} — ${tns.hint}`
                      : (e.story_time ?? 'No world-time label') + (e.notes ? ` — ${e.notes.slice(0, 120)}` : '')
                  }
                >
                  <p className="line-clamp-2 font-sans text-[9px] font-bold uppercase leading-tight tracking-wide text-primary">{e.title}</p>
                  {e.story_time ? <p className="mt-1 line-clamp-1 font-serif text-[9px] italic text-ink-muted">{(e.story_time as string) ?? ''}</p> : <p className="mt-1 text-[8px] text-ink-muted/60">TBD in world</p>}
                  <div className="mt-1.5 flex items-center justify-between">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full border border-oak-variant bg-sepia-high text-[9px] font-bold text-primary"
                      aria-hidden
                    >
                      {avatarLabel(e)}
                    </span>
                    {tns.level === 'watch' && !e.has_conflict ? <span className="text-[8px] text-slate-600">↪</span> : null}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        <div className="relative h-20 w-full shrink-0 sm:h-24" aria-hidden>
          <svg className="h-full w-full" viewBox="0 0 1000 100" preserveAspectRatio="none" role="presentation" style={{overflow: 'visible'}}>
            {paths.map((p) => (
              <path
                key={p.eventId}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth="1.25"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={p.dash === '0' ? undefined : p.dash}
                pointerEvents="none"
                opacity={0.92}
              >
                <title>{p.title}</title>
              </path>
            ))}
          </svg>
        </div>
        <p className="sr-only" aria-live="polite">
          {paths.length} string connectors between world time and chapter reveal columns.
        </p>

        <div className="text-[9px] font-sans font-bold uppercase tracking-widest text-ink-muted/60">Reader time (manuscript / chapters)</div>
        <div
          ref={btmRef}
          className="mt-2 flex min-h-24 gap-1.5 overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable] sm:gap-2"
        >
          {chSorted.map((ch, idx) => {
            const c = counts[ch.id] ?? 0;
            const wPct = (c / maxC) * 100;
            const hot = c >= 3;
            const gap = pacingGaps.includes(ch.id);
            return (
              <div
                key={ch.id}
                className="w-24 shrink-0 sm:w-32"
                onDragOver={(ev) => {
                  ev.preventDefault();
                  ev.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(ev) => void onDrop(ev, ch.id, idx)}
              >
                <div
                  data-col={`ch-${ch.id}`}
                  className={[
                    'h-full min-h-24 rounded-sm border border-dashed p-2 text-left',
                    'bg-sepia-low/40 transition',
                    dragId ? 'border-amber-700/40' : 'border-oak-variant/50',
                    gap ? 'ring-1 ring-amber-500/20' : '',
                  ].join(' ')}
                >
                  <p className="line-clamp-2 text-[9px] font-sans font-bold uppercase tracking-tight text-primary">Ch. {idx + 1}</p>
                  <p className="mt-0.5 line-clamp-2 font-serif text-xs italic text-ink">{ch.title}</p>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-parchment/80" title="Event density in this chapter">
                    <div className={`h-full ${hot ? 'bg-amber-600' : c > 0 ? 'bg-primary' : 'bg-oak/30'}`} style={{width: `${Math.min(100, wPct)}%`}} />
                  </div>
                  <p className="mt-0.5 text-[8px] text-ink-muted">
                    {c} beat{c === 1 ? '' : 's'}
                    {gap ? ' · Pacing lull' : c === 0 && chSorted.length > 1 && idx > 0 && idx < chSorted.length - 1 ? ' · Empty' : null}
                    {c >= 4 ? ' · Busy' : null}
                  </p>
                </div>
              </div>
            );
          })}
          <div
            className="w-24 shrink-0 sm:w-32"
            onDragOver={(ev) => {
              ev.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDragEnd();
            }}
          >
            <div
              className="h-full min-h-24 rounded-sm border border-dashed border-oak-variant/30 bg-parchment/30 p-2"
              data-col="u"
              title="Events with no scene anchor or narrative place yet."
            >
              <p className="text-[9px] font-sans font-bold uppercase tracking-tight text-ink-muted/70">Unplaced</p>
              <p className="mt-1 text-[8px] leading-tight text-ink-muted/70">Drag from world, drop on a chapter to reveal it there</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
