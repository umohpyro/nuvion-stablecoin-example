import assert from "node:assert/strict";
import { test } from "node:test";
import { isRelevant, sign, verify } from "./webhook.ts";

const secret = "nv_wsk_unit_test_secret";
const body = JSON.stringify({ event: "outflows.completed", data: { id: "01HXYZ5401ABCDEFGHJKMNPQRS", status: "successful" } });
const timestamp = "2026-10-29T09:31:12.129Z";
const headers = (o: Record<string, string> = {}) =>
  new Headers({ "x-nuvion-event-timestamp": timestamp, "x-nuvion-event-signature": sign(secret, timestamp, body), ...o });

test("accepts a correctly signed body", () => assert.equal(verify(secret, body, headers()), true));
test("rejects a body changed after signing", () => assert.equal(verify(secret, body.replace("successful", "failed"), headers()), false));
test("rejects a re-serialized body", () => assert.equal(verify(secret, JSON.stringify(JSON.parse(body), null, 2), headers()), false));
test("rejects the wrong secret", () => assert.equal(verify("nv_wsk_other", body, headers()), false));
test("rejects a changed timestamp", () => assert.equal(verify(secret, body, headers({ "x-nuvion-event-timestamp": "2026-10-29T09:31:12.130Z" })), false));
test("rejects missing or malformed signatures without throwing", () => {
  assert.equal(verify(secret, body, new Headers()), false);
  assert.equal(verify(secret, body, headers({ "x-nuvion-event-signature": "short" })), false);
  assert.equal(verify(secret, body, headers({ "x-nuvion-event-signature": "z".repeat(64) })), false);
});

test("treats account, wallet and transfer events as relevant, and the health check as not", () => {
  for (const e of ["outflows.completed", "inflows.failed", "accounts.created", "account_details.updated"]) assert.equal(isRelevant(e), true, e);
  for (const e of ["webhook.health", "entities.updated", "cards.created", "", undefined]) assert.equal(isRelevant(e), false, String(e));
});
