import { readFile } from "node:fs/promises";
import aliases from "../../data/aliases.json" with { type: "json" };
import { parseFormats, type FormatsResult } from "./formats";
import { parseResults } from "./parse";
import type { ParseResult } from "./types";

/** Published "Weekly_Input" tab of the results sheet (CSV). Override with SHEET_CSV_URL. */
export const DEFAULT_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQaTZB8QkVFNABfmiDpI0SLs4-olnlVmDyk0X5eFwZUhcYFDcs5fANcyWEr5OQ_vMLgsDGWTU91sj0Y/pub?gid=988356688&single=true&output=csv";

/**
 * Load results from a URL or local file path.
 * Defaults to SHEET_CSV_FILE, then SHEET_CSV_URL, then the published sheet.
 */
export async function loadResults(source?: string): Promise<ParseResult> {
  const src = source ?? process.env.SHEET_CSV_FILE ?? process.env.SHEET_CSV_URL ?? DEFAULT_SHEET_CSV_URL;
  const text = /^https?:\/\//.test(src) ? await fetchText(src) : await readFile(src, "utf8");
  return parseResults(text, aliases as Record<string, string>);
}

/** Published "Formats" tab (format name + start date). Override with FORMATS_CSV_URL. */
export const DEFAULT_FORMATS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQaTZB8QkVFNABfmiDpI0SLs4-olnlVmDyk0X5eFwZUhcYFDcs5fANcyWEr5OQ_vMLgsDGWTU91sj0Y/pub?gid=1047257124&single=true&output=csv";

/** Load formats from a URL or local file path. Defaults to FORMATS_CSV_FILE, then FORMATS_CSV_URL, then the published tab. */
export async function loadFormats(source?: string): Promise<FormatsResult> {
  const src = source ?? process.env.FORMATS_CSV_FILE ?? process.env.FORMATS_CSV_URL ?? DEFAULT_FORMATS_CSV_URL;
  const text = /^https?:\/\//.test(src) ? await fetchText(src) : await readFile(src, "utf8");
  return parseFormats(text);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetching sheet failed: HTTP ${res.status} ${res.statusText}`);
  return res.text();
}
