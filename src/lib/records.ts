import type { SiteData } from "./site-data";
import { fmtDate, fmtPct, fmtShortDate, fmtTop } from "./format";

export interface RecordRow {
  /** Shared rank for ties (1, 1, 3, …). */
  rank: number;
  name: string;
  slug: string;
  value: string;
  detail?: string;
}

export interface RecordBoard {
  id: string;
  title: string;
  note?: string;
  rows: RecordRow[];
  /** Set when a tie at the cut-off was too big to list: "6 more on 2". */
  more?: string;
}

/** Minimum locals played to appear on rate-based boards. */
export const MIN_EVENTS = 10;
const TOP = 5;

/**
 * Rank items by score (higher is better) and keep the top `TOP` places. Ties share a rank. A tie group that
 * would run past `TOP` rows is not cut arbitrarily: it is dropped and summarised in `more` instead
 * (unless it is a tie for first, which is always listed).
 */
function board<T>(
  items: T[],
  score: (x: T) => number,
  row: (x: T) => Omit<RecordRow, "rank">,
  tieBreak: (a: T, b: T) => number = () => 0,
): Pick<RecordBoard, "rows" | "more"> {
  const sorted = items.filter((x) => score(x) > 0).sort((a, b) => score(b) - score(a) || tieBreak(a, b));
  const rows: RecordRow[] = [];
  let i = 0;
  while (i < sorted.length && rows.length < TOP) {
    let j = i;
    while (j < sorted.length && score(sorted[j]!) === score(sorted[i]!)) j++;
    const group = sorted.slice(i, j);
    if (rows.length + group.length > TOP && i > 0) {
      return { rows, more: `${group.length} more on ${row(group[0]!).value}` };
    }
    for (const x of group) rows.push({ rank: i + 1, ...row(x) });
    i = j;
  }
  return { rows };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const range = (start?: string, end?: string) =>
  !start ? undefined : start === end ? fmtDate(start) : `${fmtShortDate(start)} to ${fmtDate(end!)}`;

export function computeRecords(data: SiteData): RecordBoard[] {
  const { standings: players, streaks, formats } = data;
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const st = (name: string) => streaks.get(name)!;
  const regulars = players.filter((p) => p.events >= MIN_EVENTS);

  const winners = players.flatMap((p) =>
    p.history.filter((h) => h.rank === 1).map((h) => ({ name: p.name, slug: p.slug, date: h.date, entrants: h.entrants, record: `${h.wins}-${h.losses}-${h.draws}` })),
  );
  const formatRuns = formats.flatMap((f) => f.standings.map((p) => ({ name: p.name, slug: p.slug, points: p.points, format: f.name, events: p.events })));

  return [
    {
      id: "locals-won",
      title: "Most locals won",
      ...board(players, (p) => p.firsts, (p) => ({ name: p.name, slug: p.slug, value: String(p.firsts), detail: `of ${p.events} played` }), byName),
    },
    {
      id: "undefeated",
      title: "Most undefeated nights",
      note: "Won every round of the night.",
      ...board(
        players,
        (p) => st(p.name).undefeatedCount,
        (p) => ({ name: p.name, slug: p.slug, value: String(st(p.name).undefeatedCount), detail: `of ${p.events} played` }),
        byName,
      ),
    },
    {
      id: "attendance",
      title: "Longest attendance streak",
      note: "Locals in a row without missing one.",
      ...board(
        players,
        (p) => st(p.name).attendance.best,
        (p) => {
          const s = st(p.name).attendance;
          return { name: p.name, slug: p.slug, value: plural(s.best, "local", "locals"), detail: s.current === s.best ? "Ongoing" : range(s.start, s.end) };
        },
        byName,
      ),
    },
    {
      id: "top8",
      title: "Longest top-8 run",
      note: "Top-8 finishes in a row, counting only locals they played.",
      ...board(
        players,
        (p) => st(p.name).top8.best,
        (p) => {
          const s = st(p.name).top8;
          return { name: p.name, slug: p.slug, value: plural(s.best, "finish", "finishes"), detail: s.current === s.best ? "Ongoing" : range(s.start, s.end) };
        },
        byName,
      ),
    },
    {
      id: "biggest-win",
      title: "Biggest field won",
      ...board(
        winners,
        (w) => w.entrants,
        (w) => ({ name: w.name, slug: w.slug, value: `${w.entrants} players`, detail: `${fmtDate(w.date)} · ${w.record}` }),
        (a, b) => (a.date < b.date ? -1 : 1),
      ),
    },
    {
      id: "format-points",
      title: "Most points in one format",
      ...board(
        formatRuns,
        (r) => r.points,
        (r) => ({ name: r.name, slug: r.slug, value: `${r.points} pts`, detail: `${r.format} · ${plural(r.events, "local", "locals")}` }),
        byName,
      ),
    },
    {
      id: "win-rate",
      title: "Best win rate",
      note: `At least ${MIN_EVENTS} locals played.`,
      ...board(regulars, (p) => p.winRate, (p) => ({ name: p.name, slug: p.slug, value: fmtPct(p.winRate), detail: `${p.wins}-${p.losses}-${p.draws}` }), byName),
    },
    {
      id: "avg-finish",
      title: "Best average finish",
      note: `As a share of the field. At least ${MIN_EVENTS} locals played.`,
      ...board(
        regulars,
        (p) => 1 - p.averagePercentile,
        (p) => ({ name: p.name, slug: p.slug, value: fmtTop(p.averagePercentile), detail: `avg place ${p.averageFinish.toFixed(1)}` }),
        byName,
      ),
    },
    {
      id: "most-played",
      title: "Most locals played",
      ...board(players, (p) => p.events, (p) => ({ name: p.name, slug: p.slug, value: String(p.events), detail: `since ${fmtDate(p.firstEvent)}` }), byName),
    },
  ];
}
