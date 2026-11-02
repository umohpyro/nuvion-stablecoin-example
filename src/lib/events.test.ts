import assert from "node:assert/strict";
import { test } from "node:test";
import { clearEvents, lastEvent, record } from "./events.ts";

test("keeps the latest event per transfer and ignores a repeated event ID", async () => {
  clearEvents();
  const e = (eventId: string, event: string) => ({ eventId, event, status: "x", receivedAt: 1 });
  assert.equal(await record("T1", e("a", "outflows.created")), true);
  assert.equal(await record("T1", e("a", "outflows.created")), false);
  assert.equal(await record("T1", e("b", "outflows.completed")), true);
  assert.equal((await lastEvent("T1"))?.event, "outflows.completed");
  assert.equal(await lastEvent("nope"), null);
});

test("with Redis configured, dedupes on the event ID and reads back from Redis", async () => {
  const realFetch = globalThis.fetch;
  const db = new Map<string, string>();
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const [cmd, key, value, ...opts] = JSON.parse(init.body as string) as string[];
    let result: string | null = null;
    if (cmd === "GET") result = db.get(key) ?? null;
    else if (opts.includes("NX") && db.has(key)) result = null;
    else {
      db.set(key, value);
      result = "OK";
    }
    return new Response(JSON.stringify({ result }));
  }) as typeof fetch;
  process.env.KV_REST_API_URL = "https://redis.test";
  process.env.KV_REST_API_TOKEN = "t";
  try {
    const e = { eventId: "evt_9", event: "outflows.failed", status: "failed", receivedAt: 2 };
    assert.equal(await record("T9", e), true);
    assert.equal(await record("T9", e), false);
    assert.equal((await lastEvent("T9"))?.status, "failed");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  }
});
