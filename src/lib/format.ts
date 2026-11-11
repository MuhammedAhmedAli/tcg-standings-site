const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortDateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// Newer ICU data abbreviates September as "Sept" in en-GB; keep every month to three letters.
const tidy = (s: string) => s.replace("Sept", "Sep");
export const fmtDate = (iso: string) => tidy(dateFmt.format(new Date(`${iso}T00:00:00Z`)));
export const fmtShortDate = (iso: string) => tidy(shortDateFmt.format(new Date(`${iso}T00:00:00Z`)));
export const fmtPct = (x: number) => `${(x * 100).toFixed(1)}%`;
/** A finish as a share of the field: rank / entrants → "Top 12%". */
export const fmtTop = (x: number) => `Top ${Math.max(1, Math.round(x * 100))}%`;
export const fmtRecord = (w: number, l: number, d: number) => `${w}-${l}-${d}`;

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

/** Prefix an internal path with the site's base path. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}
