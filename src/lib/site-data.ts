import { computeEvents, computeStandings, computeSummary, formatFor, loadFormats, loadResults } from "../data";
import type { EventSummary, Format, PlayerStats, ResultRow, ScopeSummary } from "../data";

export interface FormatData extends Format {
  standings: PlayerStats[];
  events: EventSummary[];
  summary: ScopeSummary;
  /** Players whose first ever locals fell in this format. */
  newPlayers: number;
}

export interface SiteData {
  standings: PlayerStats[];
  events: EventSummary[];
  summary: ScopeSummary;
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
    const formatOf = new Map<string, FormatData>();
    for (const f of formats) for (const e of f.events) formatOf.set(e.date, f);

    return {
      standings,
      events: computeEvents(rows),
      summary: computeSummary(rows),
      position: new Map(standings.map((p, i) => [p.name, i + 1])),
      formats,
      formatOf,
      updated: new Date().toISOString(),
    };
  })();
  return cached;
}
