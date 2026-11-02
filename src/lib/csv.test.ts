import assert from "node:assert/strict";
import { test } from "node:test";
import { csvField, csvRow } from "./csv.ts";

test("quotes commas, quotes and newlines", () => {
  assert.equal(csvField('a,"b"'), '"a,""b"""');
  assert.equal(csvField("line1\nline2"), '"line1\nline2"');
  assert.equal(csvField("plain"), "plain");
});

test("defuses spreadsheet formulas", () => {
  for (const f of ["=SUM(A1)", "+1", "-1+2", "@cmd", "\tx"]) assert.ok(csvField(f).startsWith("'") || csvField(f).startsWith('"\''), f);
});

test("joins a row", () => assert.equal(csvRow(["a", 1, "b,c"]), 'a,1,"b,c"'));
