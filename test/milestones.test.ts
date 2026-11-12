import { test } from "node:test";
import assert from "node:assert/strict";
import { eventTag, finishBuckets, nextAttendanceMark, playerMilestones } from "../src/data/milestones";
import type { EventResult } from "../src/data/types";

const ev = (date: string, rank: number, w: number, l: number, d = 0): EventResult => ({
  date, rank, entrants: 20, wins: w, losses: l, draws: d, owp: null, oowp: null,
});
const day = (i: number) => `2026-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`;

test("milestones list firsts in date order, attendance marks included", () => {
  const history = Array.from({ length: 12 }, (_, i) => ev(day(i), 12, 1, 2));
  history[2] = ev(day(2), 6, 2, 1);
  history[5] = ev(day(5), 3, 3, 0);
  history[11] = ev(day(11), 1, 3, 0);
  const rounds = new Map(history.map((h) => [h.date, 3]));
  const ms = playerMilestones([...history].reverse(), rounds);
  assert.deepEqual(
    ms.map((m) => [m.date, m.kind, m.count]),
    [
      [day(0), "debut", undefined],
      [day(2), "top8", undefined],
      [day(5), "undefeated", undefined],
      [day(9), "attendance", 10],
      [day(11), "win", undefined],
    ],
  );
});

test("a debut win stacks every first on the same night in a fixed order", () => {
  const ms = playerMilestones([ev(day(0), 1, 3, 0)], new Map([[day(0), 3]]));
  assert.deepEqual(ms.map((m) => m.kind), ["debut", "top8", "undefeated", "win"]);
});

test("undefeated needs every round won", () => {
  const ms = playerMilestones([ev(day(0), 2, 2, 0, 1)], new Map([[day(0), 3]]));
  assert.ok(!ms.some((m) => m.kind === "undefeated"));
});

test("next attendance mark", () => {
  assert.deepEqual(nextAttendanceMark(9), { target: 10, played: 9 });
  assert.deepEqual(nextAttendanceMark(10), { target: 25, played: 10 });
  assert.equal(nextAttendanceMark(500), null);
});

test("event tags: first win beats debut beats best finish", () => {
  const h = [ev(day(0), 9, 1, 2), ev(day(1), 5, 2, 1), ev(day(2), 7, 2, 1), ev(day(3), 1, 3, 0), ev(day(4), 1, 3, 0)];
  assert.deepEqual(eventTag(h, day(0)), { kind: "debut" });
  assert.deepEqual(eventTag(h, day(1)), { kind: "best", was: 9 });
  assert.equal(eventTag(h, day(2)), null);
  assert.deepEqual(eventTag(h, day(3)), { kind: "first-win", debut: false });
  assert.equal(eventTag(h, day(4)), null);
  assert.deepEqual(eventTag([ev(day(0), 1, 3, 0)], day(0)), { kind: "first-win", debut: true });
  assert.equal(eventTag(h, "2030-01-01"), null);
});

test("finish buckets", () => {
  const b = finishBuckets([ev(day(0), 1, 3, 0), ev(day(1), 4, 2, 1), ev(day(2), 8, 2, 1), ev(day(3), 9, 1, 2), ev(day(4), 30, 0, 3)]);
  assert.deepEqual(b.map((x) => x.count), [1, 1, 1, 2]);
});
