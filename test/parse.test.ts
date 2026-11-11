import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../src/data/csv";
import { parseResults, parseUkDate } from "../src/data/parse";

const HEADER = "Week,Player,P,W,L,D,OWP,OOWP,\r\n";

test("parseCsv handles quotes, escaped quotes and CRLF", () => {
  assert.deepEqual(parseCsv('a,"b,c","d""e"\r\n1,2,3\n'), [
    ["a", "b,c", 'd"e'],
    ["1", "2", "3"],
  ]);
});

test("parseUkDate reads DD/MM/YY as UK dates and rejects impossible ones", () => {
  assert.equal(parseUkDate("08/01/26"), "2026-01-08");
  assert.equal(parseUkDate("29/10/2026"), "2026-10-29");
  assert.equal(parseUkDate("31/02/26"), null);
  assert.equal(parseUkDate("2026-01-08"), null);
});

test("rank follows row order within each week, not recomputed tiebreakers", () => {
  const csv =
    HEADER +
    "08/01/26,A,3,3,0,0,40,60,\r\n" +
    "08/01/26,B,3,3,0,0,70,50,\r\n" + // higher OWP but listed second: sheet order wins
    "08/01/26,C,3,0,3,0,50,50,\r\n" +
    "15/01/26,C,3,2,1,0,50,50,\r\n" +
    "15/01/26,A,3,1,2,0,50,50,\r\n";
  const { rows, issues } = parseResults(csv);
  assert.deepEqual(issues, []);
  assert.deepEqual(
    rows.map((r) => [r.date, r.player, r.rank, r.entrants]),
    [
      ["2026-01-08", "A", 1, 3],
      ["2026-01-08", "B", 2, 3],
      ["2026-01-08", "C", 3, 3],
      ["2026-01-15", "C", 1, 2],
      ["2026-01-15", "A", 2, 2],
    ],
  );
});

test("fixes decimal-comma and doubled-point typos, with a warning", () => {
  const csv = HEADER + '08/01/26,A,3,2,1,0,"72,22",50.93,\r\n' + "08/01/26,B,3,0,3,0,44..44,49.07,\r\n";
  const { rows, issues } = parseResults(csv);
  assert.equal(rows[0]!.owp, 72.22);
  assert.equal(rows[1]!.owp, 44.44);
  assert.equal(issues.length, 2);
  assert.ok(issues.every((i) => i.severity === "warning"));
});

test("percentages over 100 are dropped and reported", () => {
  const { rows, issues } = parseResults(HEADER + "08/01/26,A,3,2,1,0,36.11,551.85,\r\n");
  assert.equal(rows[0]!.oowp, null);
  assert.match(issues[0]!.message, /over 100/);
});

test("P != W+L+D is kept but reported", () => {
  const { rows, issues } = parseResults(HEADER + "05/02/26,A,3,0,0,0,61.11,46.3,\r\n");
  assert.equal(rows.length, 1);
  assert.match(issues[0]!.message, /P=3 but W\+L\+D=0/);
});

test("footer/blank rows are skipped silently; half-filled rows are errors", () => {
  const csv = HEADER + "08/01/26,A,3,3,0,0,50,50,\r\n,,2657,,,,,,\r\n\r\n,B,3,3,0,0,50,50,\r\n";
  const { rows, issues } = parseResults(csv);
  assert.equal(rows.length, 1);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.severity, "error");
});

test("aliases merge names across weeks", () => {
  const csv = HEADER + "08/01/26,Lee King,3,1,2,0,50,50,\r\n" + "15/01/26,Lee K,3,1,2,0,50,50,\r\n";
  const { rows, issues } = parseResults(csv, { "Lee King": "Lee K" });
  assert.deepEqual(issues, []);
  assert.deepEqual(rows.map((r) => [r.player, r.rawPlayer]), [["Lee K", "Lee King"], ["Lee K", "Lee K"]]);
});

test("exact duplicate row is dropped; conflicting duplicate keeps its rank slot", () => {
  const csv =
    HEADER +
    "08/01/26,A,3,3,0,0,50,50,\r\n" +
    "08/01/26,A,3,3,0,0,50,50,\r\n" + // copy-paste
    "08/01/26,B,3,2,1,0,50,50,\r\n" +
    "08/01/26,B,3,0,3,0,40,40,\r\n" + // someone else under B's name
    "08/01/26,C,3,0,3,0,30,30,\r\n";
  const { rows, issues } = parseResults(csv);
  assert.deepEqual(rows.map((r) => [r.player, r.rank, r.entrants]), [["A", 1, 4], ["B", 2, 4], ["C", 4, 4]]);
  assert.deepEqual(issues.map((i) => i.severity), ["warning", "error"]);
});

test("trailing unnamed column is captured as a note", () => {
  const { rows } = parseResults(HEADER + "16/04/26,Percy B,3,3,0,0,44.44,63.89,POR legal\r\n");
  assert.equal(rows[0]!.note, "POR legal");
});

test("missing required column is reported", () => {
  const { rows, issues } = parseResults("Week,Player,P,W,L,D,OWP\n");
  assert.equal(rows.length, 0);
  assert.match(issues[0]!.message, /OOWP/);
});
