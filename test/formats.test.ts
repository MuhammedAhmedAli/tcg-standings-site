import { test } from "node:test";
import assert from "node:assert/strict";
import { formatFor, groupByBlock, parseFormats } from "../src/data/formats";

test("formats run from their start until the next format starts", () => {
  const { formats, issues } = parseFormats("Format,Start\r\nCRI,28/05/26\r\nPOR,16/04/26\r\nPBL,16/07/26\r\n");
  assert.deepEqual(issues, []);
  assert.deepEqual(
    formats.map((f) => [f.name, f.slug, f.start, f.until]),
    [
      ["POR", "por", "2026-04-16", "2026-05-28"],
      ["CRI", "cri", "2026-05-28", "2026-07-16"],
      ["PBL", "pbl", "2026-07-16", null],
    ],
  );
  assert.equal(formatFor("2026-04-09", formats), undefined);
  assert.equal(formatFor("2026-04-16", formats)?.name, "POR");
  assert.equal(formatFor("2026-05-21", formats)?.name, "POR");
  assert.equal(formatFor("2026-05-28", formats)?.name, "CRI");
  assert.equal(formatFor("2026-10-29", formats)?.name, "PBL");
});

test("header names are matched loosely and bad rows are reported", () => {
  const { formats, issues } = parseFormats("Set name,Date legal\nA,01/01/26\nB,not a date\n,\nC,01/01/26\n");
  assert.deepEqual(formats.map((f) => f.name), ["A"]);
  assert.equal(issues.length, 2);
});

test("a tab without the expected columns is an error", () => {
  const { formats, issues } = parseFormats("Foo,Bar\nx,y\n");
  assert.equal(formats.length, 0);
  assert.equal(issues[0]!.severity, "error");
});

test("formats default to the Mega Evolution block without a Block column", () => {
  const { formats } = parseFormats("Format,Start\nPOR,16/04/26\nCRI,28/05/26\n");
  assert.deepEqual(formats.map((f) => f.block), ["Mega Evolution", "Mega Evolution"]);
});

test("formats are grouped by block, newest first", () => {
  const { formats, issues } = parseFormats("Block,Format,Start\nMega Evolution,POR,16/04/26\nMega Evolution,CRI,28/05/26\nNext,NXT,01/03/27\n,NX2,01/05/27\n");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.severity, "warning");
  assert.deepEqual(
    groupByBlock(formats).map((b) => [b.name, b.formats.map((f) => f.name)]),
    [
      ["Next", ["NX2", "NXT"]],
      ["Mega Evolution", ["CRI", "POR"]],
    ],
  );
});
