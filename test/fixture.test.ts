import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadResults } from "../src/data/load";
import { computeEvents, computePlayerStats, computeStandings } from "../src/data/stats";

// Real export of the "Weekly_Input" tab, 8 Jan – 29 Oct 2026.
const FIXTURE = fileURLToPath(new URL("./fixtures/weekly-input.csv", import.meta.url));
const { rows, issues } = await loadResults(FIXTURE);
const players = new Map(computePlayerStats(rows).map((p) => [p.name, p]));

test("loads every row from the real export", () => {
  // 908 data rows, minus one exact duplicate and one conflicting duplicate.
  assert.equal(rows.length, 906);
  assert.equal(computeEvents(rows).length, 42);
});

test("reports the known data-entry problems in the export", () => {
  const msgs = issues.map((i) => i.message).join("\n");
  assert.match(msgs, /Zach S \(15\/01\/26\): OOWP 551\.85 is over 100/);
  assert.match(msgs, /Harlan D \(26\/02\/26\): OWP "72,22" read as 72\.22/);
  assert.match(msgs, /Connor F \(26\/02\/26\): OWP "44\.\.44" read as 44\.44/);
  assert.match(msgs, /James D \(23\/04\/26\): P=2 but W\+L\+D=3/);
  // Six rows entered as 0-0-0 despite P=3 (05/02 x4, 18/06 x2).
  assert.equal(issues.filter((i) => /P=3 but W\+L\+D=0/.test(i.message)).length, 6);
  assert.match(msgs, /Tom R \(01\/10\/26\): exact duplicate of line 823/);
  assert.deepEqual(
    issues.filter((i) => i.severity === "error").map((i) => i.line),
    [166], // second "Rick S" on 12/03/26 with a different record
  );
});

test("Rick S: totals, rates and finishes match a hand calculation", () => {
  // 37 rows in the sheet; the conflicting second row on 12/03/26 (0-2-1, 15th) is excluded.
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

test("a conflicting duplicate keeps its standings slot; an exact duplicate does not", () => {
  const ev = new Map(computeEvents(rows).map((e) => [e.date, e]));
  assert.equal(ev.get("2026-03-12")!.entrants, 16);
  assert.equal(ev.get("2026-10-01")!.entrants, 26);
  const after = rows.find((r) => r.date === "2026-03-12" && r.line === 167)!;
  assert.equal(after.rank, 16);
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
