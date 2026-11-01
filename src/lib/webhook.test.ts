import assert from "node:assert/strict";
import { test } from "node:test";
import { sign, verify } from "./webhook.ts";

const secret = "nv_wsk_unit_test_secret";
const body = JSON.stringify({ event: "payment_intent.completed", data: { id: "01HXYZ5501ABCDEFGHJKMNPQRS", status: "completed" } });
const timestamp = "2026-10-29T09:31:12.129Z";
const headers = (o: Record<string, string> = {}) =>
  new Headers({ "x-nuvion-event-timestamp": timestamp, "x-nuvion-event-signature": sign(secret, timestamp, body), ...o });

test("accepts a correctly signed body", () => assert.equal(verify(secret, body, headers()), true));
test("rejects a body changed after signing", () => assert.equal(verify(secret, body.replace("completed", "failed"), headers()), false));
test("rejects a re-serialized body", () => assert.equal(verify(secret, JSON.stringify(JSON.parse(body), null, 2), headers()), false));
test("rejects the wrong secret", () => assert.equal(verify("nv_wsk_other", body, headers()), false));
test("rejects missing or malformed signatures without throwing", () => {
  assert.equal(verify(secret, body, new Headers()), false);
  assert.equal(verify(secret, body, headers({ "x-nuvion-event-signature": "short" })), false);
});
