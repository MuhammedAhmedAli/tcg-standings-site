import { parseCsv } from "./csv";
import type { DataIssue, ParseResult, ResultRow } from "./types";

export type Aliases = Record<string, string>;

const REQUIRED_COLUMNS = ["Week", "Player", "P", "W", "L", "D", "OWP", "OOWP"] as const;

/**
 * Parse the weekly input sheet (published as CSV) into result rows.
 *
 * Rank is taken from row order within each week, because the sheet is entered
 * in final standings order and that order is the source of truth (it already
 * reflects the event's own tiebreakers).
 *
 * The parser is lenient: it fixes obvious typos where the intent is clear and
 * reports everything it touched or could not use as an issue, so the sheet can
 * be corrected at source.
 */
export function parseResults(csvText: string, aliases: Aliases = {}): ParseResult {
  const issues: DataIssue[] = [];
  const table = parseCsv(csvText);
  const header = (table[0] ?? []).map((h) => h.trim());

  const col: Record<string, number> = {};
  for (const name of REQUIRED_COLUMNS) {
    const idx = header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    if (idx === -1) {
      issues.push({ severity: "error", line: 1, message: `Missing column "${name}"` });
    } else {
      col[name] = idx;
    }
  }
  if (issues.length) return { rows: [], issues };

  // Anything after the last known column is treated as a free-text note.
  const noteIdx = Math.max(...Object.values(col)) + 1;
  const get = (r: string[], name: (typeof REQUIRED_COLUMNS)[number]) => (r[col[name]!] ?? "").trim();

  // Slots in sheet order per week; `row: null` holds a standings position for a row we couldn't attribute.
  const weeks = new Map<string, { row: ResultRow | null }[]>();

  for (let i = 1; i < table.length; i++) {
    const r = table[i]!;
    const line = i + 1;
    const week = get(r, "Week");
    const rawPlayer = get(r, "Player").replace(/\s+/g, " ");

    // Blank lines and footer rows (e.g. a running total under the data).
    if (!week && !rawPlayer) continue;
    if (!week || !rawPlayer) {
      issues.push({ severity: "error", line, message: `Row is missing ${!week ? "Week" : "Player"}; skipped` });
      continue;
    }

    const date = parseUkDate(week);
    if (!date) {
      issues.push({ severity: "error", line, message: `Unrecognised date "${week}" (expected DD/MM/YY); skipped` });
      continue;
    }

    const ints = (["P", "W", "L", "D"] as const).map((k) => parseCount(get(r, k)));
    if (ints.some((n) => n === null)) {
      issues.push({ severity: "error", line, message: `${rawPlayer}: P/W/L/D must be whole numbers; skipped` });
      continue;
    }
    const [played, wins, losses, draws] = ints as number[] as [number, number, number, number];

    if (wins + losses + draws !== played) {
      issues.push({
        severity: "warning",
        line,
        message: `${rawPlayer} (${week}): P=${played} but W+L+D=${wins + losses + draws}`,
      });
    }

    const owp = parsePercent(get(r, "OWP"), "OWP", rawPlayer, week, line, issues);
    const oowp = parsePercent(get(r, "OOWP"), "OOWP", rawPlayer, week, line, issues);

    const player = aliases[rawPlayer] ?? rawPlayer;
    const note = r.slice(noteIdx).map((s) => s.trim()).filter(Boolean).join(" ") || undefined;
    const row: ResultRow = { date, player, rawPlayer, played, wins, losses, draws, owp, oowp, rank: 0, entrants: 0, note, line };

    const slots = weeks.get(date) ?? [];
    weeks.set(date, slots);
    const prev = slots.find((s) => s.row?.player === player);
    if (prev) {
      if (sameRecord(prev.row!, row)) {
        // Copy-paste duplicate: drop it entirely.
        issues.push({ severity: "warning", line, message: `${player} (${week}): exact duplicate of line ${prev.row!.line}; ignored` });
        continue;
      }
      // Two different records under one name: probably someone else entered under the wrong name.
      // Keep the standings slot so other players' ranks are right, but leave it out of stats.
      issues.push({
        severity: "error",
        line,
        message: `${player} appears twice on ${week} with different records (see line ${prev.row!.line}); this row is left out of stats`,
      });
      slots.push({ row: null });
      continue;
    }
    slots.push({ row });
  }

  // Rank = position in the sheet within the week; entrants = slots in that week.
  const rows: ResultRow[] = [];
  for (const slots of weeks.values()) {
    slots.forEach((slot, idx) => {
      if (!slot.row) return;
      slot.row.rank = idx + 1;
      slot.row.entrants = slots.length;
      rows.push(slot.row);
    });
  }

  return { rows, issues };
}

function sameRecord(a: ResultRow, b: ResultRow): boolean {
  return (
    a.played === b.played && a.wins === b.wins && a.losses === b.losses && a.draws === b.draws &&
    a.owp === b.owp && a.oowp === b.oowp
  );
}

/** `DD/MM/YY` or `DD/MM/YYYY` → `YYYY-MM-DD`, or null if invalid. */
export function parseUkDate(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseCount(s: string): number | null {
  return /^\d+$/.test(s) ? Number(s) : null;
}

function parsePercent(
  raw: string,
  label: string,
  player: string,
  week: string,
  line: number,
  issues: DataIssue[],
): number | null {
  if (raw === "") {
    issues.push({ severity: "warning", line, message: `${player} (${week}): ${label} is blank` });
    return null;
  }
  // Fix common typos: decimal comma ("72,22") and doubled point ("44..44").
  const cleaned = raw.replace(/%$/, "").replace(",", ".").replace(/\.{2,}/g, ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    issues.push({ severity: "warning", line, message: `${player} (${week}): ${label} "${raw}" is not a number; ignored` });
    return null;
  }
  const n = Number(cleaned);
  if (cleaned !== raw) {
    issues.push({ severity: "warning", line, message: `${player} (${week}): ${label} "${raw}" read as ${n}` });
  }
  if (n > 100) {
    issues.push({ severity: "warning", line, message: `${player} (${week}): ${label} ${raw} is over 100; ignored` });
    return null;
  }
  return n;
}
