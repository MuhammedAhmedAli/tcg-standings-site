import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadResults } from "../src/data/load";
import { computeEvents, computeMovement, computePlayerStats, computeStandings, computeSummary } from "../src/data/stats";

// Real export of the "Weekly_Input" tab, 8 Jan – 29 Oct 2026 (after Ali's 11 Nov clean-up).
const FIXTURE = fileURLToPath(new URL("./fixtures/weekly-input.csv", import.meta.url));
const { rows, issues } = await loadResults(FIXTURE);
const players = new Map(computePlayerStats(rows).map((p) => [p.name, p]));

test("loads every row from the real export", () => {
  assert.equal(rows.length, 907);
  assert.equal(computeEvents(rows).length, 42);
  assert.equal(issues.filter((i) => i.severity === "error").length, 0);
});

test("the cleaned-up export has no data issues", () => {
  assert.deepEqual(issues, []);
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

test("Lee K: all eight events under one name", () => {
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

test("level points are split by average OWP, then average OOWP", () => {
  const s = computeStandings(rows);
  const key = (v: number | null) => v ?? -1;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]!;
    const b = s[i]!;
    if (a.points !== b.points) continue;
    assert.ok(key(a.owp) >= key(b.owp), `${a.name} before ${b.name}: OWP`);
    if (key(a.owp) === key(b.owp)) assert.ok(key(a.oowp) >= key(b.oowp), `${a.name} before ${b.name}: OOWP`);
  }
  // Average of the sheet's per-event values, blanks ignored.
  const p = players.get("Rick S")!;
  const owps = p.history.map((h) => h.owp).filter((v): v is number => v != null);
  assert.ok(Math.abs(p.owp! - owps.reduce((a, v) => a + v, 0) / owps.length) < 1e-9);
});

test("standings are sorted by points and every player has a unique slug", () => {
  const s = computeStandings(rows);
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1]!.points >= s[i]!.points);
  assert.equal(new Set(s.map((p) => p.slug)).size, s.length);
});

test("summary: turnout, draw share and undefeated runs over the real export", () => {
  const s = computeSummary(rows);
  assert.equal(s.events, 42);
  assert.equal(s.entries, 907);
  assert.equal(s.players, computePlayerStats(rows).length);
  assert.deepEqual([s.draws, s.results], [373, 2654]);
  assert.ok(Math.abs(s.drawShare - 373 / 2654) < 1e-9);
  assert.ok(Math.abs(s.averageEntrants - 907 / 42) < 1e-9);
  assert.equal(s.peakEntrants, 35);
  assert.equal(s.undefeated, 83);
  assert.ok(s.topWinners.length > 0 && s.topWins >= 1);
});

test("average percentile is the mean of rank / entrants", () => {
  const p = players.get("Rick S")!;
  const expected = p.history.reduce((a, h) => a + h.rank / h.entrants, 0) / p.history.length;
  assert.ok(Math.abs(p.averagePercentile - expected) < 1e-12);
  assert.ok(p.averagePercentile > 0 && p.averagePercentile <= 1);
});

test("movement compares standings before and after the latest event", () => {
  const move = computeMovement(rows)!;
  const latest = computeEvents(rows).at(-1)!.date;
  const before = computeStandings(rows.filter((r) => r.date !== latest)).map((p) => p.name);
  computeStandings(rows).forEach((p, i) => {
    const prev = before.indexOf(p.name);
    assert.equal(move.get(p.name), prev === -1 ? null : prev - i);
  });
  assert.equal(computeMovement(rows.filter((r) => r.date === latest)), undefined);
});
