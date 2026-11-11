import { parseCsv } from "./csv";
import { parseUkDate } from "./parse";
import { slugify } from "./stats";
import type { DataIssue } from "./types";

/** A format runs from its start date until the day before the next format starts. */
export interface Format {
  name: string;
  slug: string;
  /** ISO `YYYY-MM-DD`, inclusive. */
  start: string;
  /** ISO `YYYY-MM-DD` of the next format's start (exclusive), or null for the current format. */
  until: string | null;
  /** The block (rotation series) the format belongs to, from the tab's Block column. */
  block: string;
}

/** Used for every format while the Formats tab has no Block column. */
export const DEFAULT_BLOCK = "Mega Evolution";

/** Formats grouped by block, newest block first and newest format first within each. */
export interface FormatBlock<F extends Format = Format> {
  name: string;
  formats: F[];
}

export function groupByBlock<F extends Format>(formats: F[]): FormatBlock<F>[] {
  const blocks: FormatBlock<F>[] = [];
  for (const f of [...formats].sort((a, b) => (a.start < b.start ? 1 : -1))) {
    const block = blocks.find((b) => b.name === f.block);
    if (block) block.formats.push(f);
    else blocks.push({ name: f.block, formats: [f] });
  }
  return blocks;
}

export interface FormatsResult {
  formats: Format[];
  issues: DataIssue[];
}

/**
 * Parse the formats tab: one row per format, a name, the date it became legal and an optional block.
 * Header names are matched loosely ("Format"/"Name"/"Set", "Start"/"Date"/"From", "Block").
 * Without a Block column every format is in DEFAULT_BLOCK. A blank Block cell is reported and the
 * format stays in the block of the format before it.
 */
export function parseFormats(csvText: string): FormatsResult {
  const issues: DataIssue[] = [];
  const table = parseCsv(csvText);
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const blockIdx = header.findIndex((h) => /block/.test(h));
  const nameIdx = header.findIndex((h, i) => i !== blockIdx && /format|name|set/.test(h));
  const dateIdx = header.findIndex((h, i) => i !== blockIdx && /start|date|from|legal/.test(h));
  if (nameIdx === -1 || dateIdx === -1) {
    issues.push({ severity: "error", line: 1, message: `Formats tab needs a name column and a start date column (found: ${table[0]?.join(", ")})` });
    return { formats: [], issues };
  }

  const found: (Omit<Format, "until" | "block"> & { block: string; line: number })[] = [];
  for (let i = 1; i < table.length; i++) {
    const r = table[i]!;
    const name = (r[nameIdx] ?? "").trim();
    const rawDate = (r[dateIdx] ?? "").trim();
    if (!name && !rawDate) continue;
    const start = parseUkDate(rawDate);
    if (!name || !start) {
      issues.push({ severity: "error", line: i + 1, message: `Format row "${r.join(",")}" needs a name and a DD/MM/YY start date; skipped` });
      continue;
    }
    if (found.some((f) => f.start === start)) {
      issues.push({ severity: "error", line: i + 1, message: `Two formats start on ${rawDate}; "${name}" skipped` });
      continue;
    }
    const block = blockIdx === -1 ? DEFAULT_BLOCK : (r[blockIdx] ?? "").trim();
    found.push({ name, slug: slugify(name), start, block, line: i + 1 });
  }

  found.sort((a, b) => (a.start < b.start ? -1 : 1));
  for (const [i, f] of found.entries()) {
    if (f.block) continue;
    const prev = found[i - 1]?.block || DEFAULT_BLOCK;
    issues.push({ severity: "warning", line: f.line, message: `Format "${f.name}" has no block; shown under "${prev}"` });
    f.block = prev;
  }
  const slugs = new Set<string>();
  const formats = found.map((f, i) => {
    let slug = f.slug || `format-${i + 1}`;
    while (slugs.has(slug)) slug += "-2";
    slugs.add(slug);
    return { name: f.name, slug, start: f.start, until: found[i + 1]?.start ?? null, block: f.block };
  });
  return { formats, issues };
}

/** The format an event date falls in, or undefined if it predates every format. */
export function formatFor(date: string, formats: Format[]): Format | undefined {
  return formats.find((f) => date >= f.start && (f.until === null || date < f.until));
}
