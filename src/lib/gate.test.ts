import assert from "node:assert/strict";
import { test } from "node:test";
import { createSession, hasSession, same } from "./gate.ts";

const NOW = 1_800_000_000_000;

test("allows everything when no password is set", async () => assert.equal(await hasSession(undefined, undefined), true));

test("accepts a session signed with the password until it expires", async () => {
  const cookie = await createSession("s3cret", NOW);
  assert.equal(await hasSession("s3cret", cookie, NOW + 1000), true);
  assert.equal(await hasSession("s3cret", cookie, NOW + 13 * 60 * 60 * 1000), false);
});

test("rejects a session after the password changes, and forged, tampered or missing cookies", async () => {
  const cookie = await createSession("s3cret", NOW);
  assert.equal(await hasSession("other", cookie, NOW), false);
  const [exp, sig] = cookie.split(".");
  assert.equal(await hasSession("s3cret", `${Number(exp) + 1000}.${sig}`, NOW), false);
  for (const bad of [undefined, "", "abc", "123.", ".abc", "x.y"]) assert.equal(await hasSession("s3cret", bad, NOW), false, String(bad));
});

test("compares strings of different length without matching", () => {
  assert.equal(same("abc", "abc"), true);
  assert.equal(same("abc", "abcd"), false);
  assert.equal(same("", "a"), false);
});
