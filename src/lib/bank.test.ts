import assert from "node:assert/strict";
import { test } from "node:test";
import { sortCode, ukAccountNumber } from "./bank.ts";

test("normalizes sort codes", () => {
  assert.equal(sortCode("04-00-04"), "040004");
  assert.equal(sortCode(" 040004 "), "040004");
  for (const bad of ["", "04000", "0400045", "04-00-0a"]) assert.equal(sortCode(bad), null, bad);
});

test("accepts only 8 digit account numbers", () => {
  assert.equal(ukAccountNumber("1234 5678"), "12345678");
  for (const bad of ["1234567", "123456789", "1234567a", ""]) assert.equal(ukAccountNumber(bad), null, bad);
});
