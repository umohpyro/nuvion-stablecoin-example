import assert from "node:assert/strict";
import { test } from "node:test";
import { passes } from "./gate.ts";

const basic = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;

test("allows everything when no password is set", () => assert.equal(passes(undefined, null), true));
test("accepts the right password with any username", () => {
  assert.equal(passes("s3cret", basic("me", "s3cret")), true);
  assert.equal(passes("s3cret", basic("", "s3cret")), true);
});
test("rejects wrong, missing, malformed and prefix passwords", () => {
  for (const h of [basic("me", "nope"), basic("me", "s3cre"), basic("me", "s3cretX"), null, "Bearer s3cret", "Basic !!!"]) assert.equal(passes("s3cret", h), false, String(h));
});
