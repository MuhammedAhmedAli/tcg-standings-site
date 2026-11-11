import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreaks } from "../src/data/stats";
import type { EventResult } from "../src/data/types";

const ev = (date: string, rank: number, w: number, l: number, d = 0): EventResult => ({
  date, rank, entrants: 20, wins: w, losses: l, draws: d, owp: null, oowp: null,
});
const dates = ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29", "2026-02-05"];
const rounds = new Map(dates.map((d) => [d, 3]));

test("attendance breaks on a missed locals; top-8 and undefeated runs skip weeks not played", () => {
  const history = [
    ev("2026-01-01", 1, 3, 0),
    ev("2026-01-08", 2, 3, 0),
    // missed 15 Jan
    ev("2026-01-22", 5, 2, 1),
    ev("2026-01-29", 9, 1, 2),
    ev("2026-02-05", 3, 3, 0),
  ];
  const s = computeStreaks(history, dates, rounds);
  assert.deepEqual(s.attendance, { best: 3, current: 3, start: "2026-01-22", end: "2026-02-05" });
  assert.deepEqual(s.top8, { best: 3, current: 1, start: "2026-01-01", end: "2026-01-22" });
  assert.deepEqual(s.undefeated, { best: 2, current: 1, start: "2026-01-01", end: "2026-01-08" });
  assert.equal(s.undefeatedCount, 3);
});

test("a run is only current if the player was at the latest locals", () => {
  const s = computeStreaks([ev("2026-01-22", 1, 3, 0), ev("2026-01-29", 1, 3, 0)], dates, rounds);
  assert.equal(s.undefeated.best, 2);
  assert.equal(s.undefeated.current, 0);
  assert.equal(s.attendance.current, 0);
});

test("an early drop on a perfect record is not undefeated", () => {
  const s = computeStreaks([ev("2026-02-05", 10, 1, 0)], dates, rounds);
  assert.equal(s.undefeatedCount, 0);
});
