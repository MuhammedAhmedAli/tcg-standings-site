/**
 * Print data-quality issues in the results sheet, plus a quick summary.
 *
 *   npm run data:check                      # published sheet
 *   npm run data:check -- path/to/file.csv  # local export
 *
 * Exits non-zero if any row had to be skipped (severity "error").
 */
import { loadResults } from "../src/data/load";
import { computeEvents, computePlayerStats } from "../src/data/stats";

const { rows, issues } = await loadResults(process.argv[2]);
const events = computeEvents(rows);
const players = computePlayerStats(rows);

console.log(`${rows.length} results, ${events.length} events, ${players.length} players`);
if (events.length) console.log(`${events[0]!.date} → ${events[events.length - 1]!.date}`);

for (const i of issues) console.log(`${i.severity.toUpperCase().padEnd(7)} line ${String(i.line).padStart(4)}  ${i.message}`);
if (!issues.length) console.log("No issues found.");

process.exitCode = issues.some((i) => i.severity === "error") ? 1 : 0;
