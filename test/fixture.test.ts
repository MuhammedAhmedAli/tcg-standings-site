import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadResults } from "../src/data/load";
import { computeEvents, computePlayerStats, computeStandings } from "../src/data/stats";

// Real export of the "Weekly_Input" tab, 8 Jan – 29 Oct 2026 (after Ali's 11 Nov clean-up).
const FIXTURE = fileURLToPath(new URL("./fixtures/weekly-input.csv", import.meta.url));
const { rows, issues } = await loadResults(FIXTURE);
const players = new Map(computePlayerStats(rows).map((p) => [p.name, p]));

test("loads every row from the real export", () => {
  assert.equal(rows.length, 907);
  assert.equal(computeEvents(rows).length, 42);
  assert.equal(issues.filter((i) => i.severity === "error").length, 0);
});

test("reports the remaining data-entry problems in the export", () => {
  // Two rows on 18/06/26 are entered as 0-0-0 despite P=3.
  assert.deepEqual(
    issues.map((i) => i.message),
    ["Matt K (18/06/26): P=3 but W+L+D=0", "Zach S (18/06/26): P=3 but W+L+D=0"],
  );
});

test("Rick S: totals, rates and finishes match a hand calculation", () => {
  const p = players.get("Rick S")!;
  assert.equal(p.events, 36);
  assert.deepEqual([p.wins, p.losses, p.draws, p.points], [42, 42, 24, 150]);
  assert.ok(Math.abs(p.winRate - 42 / 108) < 1e-9);
  assert.ok(Math.abs(p.tieRate - 24 / 108) < 1e-9);
  assert.equal(p.bestFinish, 2);
  assert.ok(Math.abs(p.averageFinish - 422 / 36) < 1e-9);
  assert.equal(p.firstEvent, "2026-01-08");
  assert.equal(p.lastEvent, "2026-10-29");
  assert.equal(p.history.length, 36);
});

test("event sizes and ranks come from the sheet", () => {
  const ev = new Map(computeEvents(rows).map((e) => [e.date, e]));
  assert.equal(ev.get("2026-03-12")!.entrants, 16);
  assert.equal(ev.get("2026-10-01")!.entrants, 26);
  const rickG = players.get("Rick G")!;
  assert.deepEqual(rickG.history.map((h) => [h.date, h.rank]), [["2026-03-12", 15]]);
});

test("aliases fold 'Lee King' into 'Lee K'", () => {
  assert.equal(players.has("Lee King"), false);
  const p = players.get("Lee K")!;
  assert.equal(p.events, 8);
  assert.deepEqual([p.wins, p.losses, p.draws], [5, 15, 4]);
  assert.equal(p.bestFinish, 8);
});

test("event winners come from the first row of each week", () => {
  const first = computeEvents(rows)[0]!;
  assert.deepEqual(first, { date: "2026-01-08", entrants: 20, winner: "Oli D" });
  assert.equal(players.get("Ted B")!.firsts, 1);
});

test("standings are sorted by points and every player has a unique slug", () => {
  const s = computeStandings(rows);
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1]!.points >= s[i]!.points);
  assert.equal(new Set(s.map((p) => p.slug)).size, s.length);
});
