import { computeEvents, computeMovement, computeRounds, computeStandings, computeStreaks, computeSummary, formatFor, loadFormats, loadResults } from "../data";
import type { EventSummary, Format, PlayerStats, PlayerStreaks, ResultRow, ScopeSummary } from "../data";

export interface FormatData extends Format {
  standings: PlayerStats[];
  events: EventSummary[];
  summary: ScopeSummary;
  /** Players whose first ever locals fell in this format. */
  newPlayers: number;
  /** Places moved at the format's latest event; only set for the format that holds the latest locals. */
  movement?: Map<string, number | null>;
}

export interface SiteData {
  standings: PlayerStats[];
  events: EventSummary[];
  summary: ScopeSummary;
  /** Places moved at the latest locals (positive = climbed, null = new). */
  movement?: Map<string, number | null>;
  /** Attendance / top-8 / undefeated streaks by player name. */
  streaks: Map<string, PlayerStreaks>;
  /** Overall standings position by player name (1-based). */
  position: Map<string, number>;
  /** Formats with at least one event, oldest first. */
  formats: FormatData[];
  /** Format slug for each event date (absent if the event predates every format). */
  formatOf: Map<string, FormatData>;
  updated: string;
}

let cached: Promise<SiteData> | undefined;

/** Load and compute everything once per build. */
export function getSiteData(): Promise<SiteData> {
  cached ??= (async () => {
    const [{ rows, issues }, formatsResult] = await Promise.all([loadResults(), loadFormats()]);
    for (const i of [...issues, ...formatsResult.issues]) console.warn(`[data] ${i.severity} line ${i.line}: ${i.message}`);

    const standings = computeStandings(rows);
    const byFormat = new Map<string, ResultRow[]>();
    for (const row of rows) {
      const f = formatFor(row.date, formatsResult.formats);
      if (!f) continue;
      const list = byFormat.get(f.slug) ?? [];
      list.push(row);
      byFormat.set(f.slug, list);
    }
    const debut = new Map(standings.map((p) => [p.name, p.firstEvent]));
    const formats: FormatData[] = formatsResult.formats
      .filter((f) => byFormat.has(f.slug))
      .map((f) => {
        const fRows = byFormat.get(f.slug)!;
        const fStandings = computeStandings(fRows);
        return {
          ...f,
          standings: fStandings,
          events: computeEvents(fRows),
          summary: computeSummary(fRows),
          newPlayers: fStandings.filter((p) => formatFor(debut.get(p.name)!, formatsResult.formats)?.slug === f.slug).length,
        };
      });
    const lastDate = rows.reduce((m, r) => (r.date > m ? r.date : m), "");
    const current = formats.find((f) => f.events.some((e) => e.date === lastDate));
    if (current) current.movement = computeMovement(byFormat.get(current.slug)!);
    const formatOf = new Map<string, FormatData>();
    for (const f of formats) for (const e of f.events) formatOf.set(e.date, f);

    const events = computeEvents(rows);
    const allDates = events.map((e) => e.date);
    const rounds = computeRounds(rows);
    const streaks = new Map(standings.map((p) => [p.name, computeStreaks(p.history, allDates, rounds)]));

    return {
      standings,
      streaks,
      events,
      summary: computeSummary(rows),
      movement: computeMovement(rows),
      position: new Map(standings.map((p, i) => [p.name, i + 1])),
      formats,
      formatOf,
      updated: new Date().toISOString(),
    };
  })();
  return cached;
}
