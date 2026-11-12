import type { EventResult } from "./types";

/** Locals-played counts worth marking. */
export const ATTENDANCE_MARKS = [10, 25, 50, 100, 150, 200, 300, 400, 500];

export type MilestoneKind = "debut" | "attendance" | "top8" | "undefeated" | "win";

export interface Milestone {
  date: string;
  kind: MilestoneKind;
  /** Locals played so far, for attendance milestones. */
  count?: number;
  result: EventResult;
}

const byDate = (a: EventResult, b: EventResult) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** A night where the player won every round (same rule as the undefeated streaks). */
export const isPerfect = (h: EventResult, rounds: Map<string, number>) => h.wins > 0 && h.wins === rounds.get(h.date);

/**
 * A player's firsts, oldest first: first locals, first top 8, first undefeated night,
 * first locals win, and each attendance mark reached. Events on the same night keep this order.
 */
export function playerMilestones(history: EventResult[], rounds: Map<string, number>): Milestone[] {
  const h = [...history].sort(byDate);
  if (h.length === 0) return [];
  const out: Milestone[] = [{ date: h[0]!.date, kind: "debut", result: h[0]! }];
  const order: MilestoneKind[] = ["debut", "attendance", "top8", "undefeated", "win"];
  const first = (kind: MilestoneKind, hit: (e: EventResult) => boolean) => {
    const e = h.find(hit);
    if (e) out.push({ date: e.date, kind, result: e });
  };
  first("top8", (e) => e.rank <= 8);
  first("undefeated", (e) => isPerfect(e, rounds));
  first("win", (e) => e.rank === 1);
  for (const n of ATTENDANCE_MARKS) if (h[n - 1]) out.push({ date: h[n - 1]!.date, kind: "attendance", count: n, result: h[n - 1]! });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : order.indexOf(a.kind) - order.indexOf(b.kind)));
}

/** The next attendance mark and how far along the player is, or null past the last mark. */
export function nextAttendanceMark(events: number): { target: number; played: number } | null {
  const target = ATTENDANCE_MARKS.find((n) => n > events);
  return target ? { target, played: events } : null;
}

export type EventTag =
  | { kind: "first-win"; debut: boolean }
  | { kind: "debut" }
  | { kind: "best"; was: number };

/**
 * What a player's result at `date` meant for them, judged only against their earlier locals.
 * A first win beats a debut, which beats a new best finish. Null when nothing was new.
 */
export function eventTag(history: EventResult[], date: string): EventTag | null {
  const now = history.find((h) => h.date === date);
  if (!now) return null;
  const before = history.filter((h) => h.date < date);
  const debut = before.length === 0;
  if (now.rank === 1 && !before.some((h) => h.rank === 1)) return { kind: "first-win", debut };
  if (debut) return { kind: "debut" };
  const best = Math.min(...before.map((h) => h.rank));
  return now.rank < best ? { kind: "best", was: best } : null;
}

export interface FinishBucket {
  label: string;
  count: number;
}

/** How often a player finished 1st, 2nd–4th, 5th–8th, or 9th or lower. */
export function finishBuckets(history: EventResult[]): FinishBucket[] {
  const count = (lo: number, hi: number) => history.filter((h) => h.rank >= lo && h.rank <= hi).length;
  return [
    { label: "1st", count: count(1, 1) },
    { label: "2nd–4th", count: count(2, 4) },
    { label: "5th–8th", count: count(5, 8) },
    { label: "9th or lower", count: count(9, Infinity) },
  ];
}
