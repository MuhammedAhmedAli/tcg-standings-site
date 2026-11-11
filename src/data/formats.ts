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
}

export interface FormatsResult {
  formats: Format[];
  issues: DataIssue[];
}

/**
 * Parse the formats tab: one row per format, a name and the date it became legal.
 * Header names are matched loosely ("Format"/"Name"/"Set", "Start"/"Date"/"From").
 */
export function parseFormats(csvText: string): FormatsResult {
  const issues: DataIssue[] = [];
  const table = parseCsv(csvText);
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const nameIdx = header.findIndex((h) => /format|name|set/.test(h));
  const dateIdx = header.findIndex((h) => /start|date|from|legal/.test(h));
  if (nameIdx === -1 || dateIdx === -1) {
    issues.push({ severity: "error", line: 1, message: `Formats tab needs a name column and a start date column (found: ${table[0]?.join(", ")})` });
    return { formats: [], issues };
  }

  const found: Omit<Format, "until">[] = [];
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
    found.push({ name, slug: slugify(name), start });
  }

  found.sort((a, b) => (a.start < b.start ? -1 : 1));
  const slugs = new Set<string>();
  const formats = found.map((f, i) => {
    let slug = f.slug || `format-${i + 1}`;
    while (slugs.has(slug)) slug += "-2";
    slugs.add(slug);
    return { ...f, slug, until: found[i + 1]?.start ?? null };
  });
  return { formats, issues };
}

/** The format an event date falls in, or undefined if it predates every format. */
export function formatFor(date: string, formats: Format[]): Format | undefined {
  return formats.find((f) => date >= f.start && (f.until === null || date < f.until));
}
