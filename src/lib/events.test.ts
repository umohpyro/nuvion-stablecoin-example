import assert from "node:assert/strict";
import { test } from "node:test";
import { clearEvents, lastEvent, record } from "./events.ts";

test("keeps the latest event per transfer and ignores a repeated event ID", () => {
  clearEvents();
  const e = (eventId: string, event: string) => ({ eventId, event, status: "x", receivedAt: 1 });
  assert.equal(record("T1", e("a", "outflows.created")), true);
  assert.equal(record("T1", e("a", "outflows.created")), false);
  assert.equal(record("T1", e("b", "outflows.completed")), true);
  assert.equal(lastEvent("T1")?.event, "outflows.completed");
  assert.equal(lastEvent("nope"), null);
});
