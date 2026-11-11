import { computeEvents, computeStandings, loadResults } from "../data";
import type { EventSummary, PlayerStats } from "../data";

export interface SiteData {
  standings: PlayerStats[];
  events: EventSummary[];
  /** Overall standings position by player name (1-based). */
  position: Map<string, number>;
  updated: string;
}

let cached: Promise<SiteData> | undefined;

/** Load and compute everything once per build. */
export function getSiteData(): Promise<SiteData> {
  cached ??= (async () => {
    const { rows, issues } = await loadResults();
    for (const i of issues) console.warn(`[data] ${i.severity} line ${i.line}: ${i.message}`);
    const standings = computeStandings(rows);
    return {
      standings,
      events: computeEvents(rows),
      position: new Map(standings.map((p, i) => [p.name, i + 1])),
      updated: new Date().toISOString(),
    };
  })();
  return cached;
}
