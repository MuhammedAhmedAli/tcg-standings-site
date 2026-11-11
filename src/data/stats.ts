import type { EventSummary, PlayerStats, ResultRow, ScopeSummary } from "./types";

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const byDateThenRank = (a: ResultRow, b: ResultRow) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.rank - b.rank;

/** Per-player aggregates, keyed by canonical name. */
export function computePlayerStats(rows: ResultRow[]): PlayerStats[] {
  const byPlayer = new Map<string, ResultRow[]>();
  for (const row of [...rows].sort(byDateThenRank)) {
    const list = byPlayer.get(row.player) ?? [];
    list.push(row);
    byPlayer.set(row.player, list);
  }

  const out: PlayerStats[] = [];
  for (const [name, list] of byPlayer) {
    const wins = sum(list, (r) => r.wins);
    const losses = sum(list, (r) => r.losses);
    const draws = sum(list, (r) => r.draws);
    const matches = wins + losses + draws;
    out.push({
      name,
      slug: slugify(name),
      events: list.length,
      matches,
      wins,
      losses,
      draws,
      points: wins * 3 + draws,
      winRate: matches ? wins / matches : 0,
      tieRate: matches ? draws / matches : 0,
      bestFinish: Math.min(...list.map((r) => r.rank)),
      averageFinish: sum(list, (r) => r.rank) / list.length,
      averagePercentile: sum(list, (r) => r.rank / r.entrants) / list.length,
      firsts: list.filter((r) => r.rank === 1).length,
      firstEvent: list[0]!.date,
      lastEvent: list[list.length - 1]!.date,
      history: list.map((r) => ({
        date: r.date,
        rank: r.rank,
        entrants: r.entrants,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        owp: r.owp,
        oowp: r.oowp,
      })),
    });
  }

  assertUniqueSlugs(out);
  return out;
}

/**
 * Overall standings: total points, then win rate, then events played, then name.
 * The site can re-sort by any column; this is just the default order.
 */
export function computeStandings(rows: ResultRow[]): PlayerStats[] {
  return computePlayerStats(rows).sort(
    (a, b) =>
      b.points - a.points ||
      b.winRate - a.winRate ||
      b.events - a.events ||
      a.name.localeCompare(b.name),
  );
}

/**
 * Places moved since the previous event: positive = climbed. `null` = not in the previous standings (new).
 * Undefined when there is only one event, so there is nothing to compare.
 */
export function computeMovement(rows: ResultRow[]): Map<string, number | null> | undefined {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  if (dates.length < 2) return undefined;
  const latest = dates[dates.length - 1]!;
  const before = new Map(computeStandings(rows.filter((r) => r.date !== latest)).map((p, i) => [p.name, i + 1]));
  return new Map(
    computeStandings(rows).map((p, i) => {
      const prev = before.get(p.name);
      return [p.name, prev === undefined ? null : prev - (i + 1)];
    }),
  );
}

export function computeEvents(rows: ResultRow[]): EventSummary[] {
  const byDate = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, list]) => ({
      date,
      entrants: list[0]!.entrants,
      winner: list.find((r) => r.rank === 1)!.player,
    }));
}

/** Headline numbers for a set of result rows: turnout, draw share, undefeated runs, top event winner. */
export function computeSummary(rows: ResultRow[]): ScopeSummary {
  const events = computeEvents(rows);
  const draws = sum(rows, (r) => r.draws);
  const results = sum(rows, (r) => r.wins + r.losses + r.draws);
  const firsts = new Map<string, number>();
  for (const r of rows) if (r.rank === 1) firsts.set(r.player, (firsts.get(r.player) ?? 0) + 1);
  const topWins = Math.max(0, ...firsts.values());
  // Rounds at an event = the most matches anyone played there, so early drops on a perfect record don't count.
  const rounds = new Map<string, number>();
  for (const r of rows) rounds.set(r.date, Math.max(rounds.get(r.date) ?? 0, r.wins + r.losses + r.draws));
  return {
    events: events.length,
    players: new Set(rows.map((r) => r.player)).size,
    averageEntrants: events.length ? sum(events, (e) => e.entrants) / events.length : 0,
    peakEntrants: Math.max(0, ...events.map((e) => e.entrants)),
    draws,
    results,
    drawShare: results ? draws / results : 0,
    undefeated: rows.filter((r) => r.wins > 0 && r.wins === rounds.get(r.date)).length,
    entries: rows.length,
    topWins,
    topWinners: [...firsts]
      .filter(([, n]) => n === topWins && n > 0)
      .map(([name]) => ({ name, slug: slugify(name) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function sum<T>(xs: T[], f: (x: T) => number): number {
  return xs.reduce((acc, x) => acc + f(x), 0);
}

function assertUniqueSlugs(players: PlayerStats[]): void {
  const seen = new Map<string, string>();
  for (const p of players) {
    const other = seen.get(p.slug);
    if (other) throw new Error(`Players "${other}" and "${p.name}" share the URL slug "${p.slug}"`);
    seen.set(p.slug, p.name);
  }
}
