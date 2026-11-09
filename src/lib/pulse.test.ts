import assert from "node:assert/strict";
import { test } from "node:test";
import { balanceStamp, deliveryStamp } from "./pulse.ts";

const a = (id: string, available: number, current = available) => ({ id, balance: { available, current } });

test("the balance stamp changes when any balance changes, and not when order does", () => {
  const base = balanceStamp([a("A", 100), a("B", 200)]);
  assert.equal(balanceStamp([a("B", 200), a("A", 100)]), base);
  assert.notEqual(balanceStamp([a("A", 101), a("B", 200)]), base);
  assert.notEqual(balanceStamp([a("A", 100), a("B", 200, 250)]), base);
  assert.notEqual(balanceStamp([a("A", 100), a("B", 200), a("C", 0)]), base);
});

test("the delivery stamp follows the newest log and starts at none", () => {
  assert.equal(deliveryStamp([]), "none");
  assert.equal(deliveryStamp([{ id: "L2", event_id: "E2" }, { id: "L1", event_id: "E1" }]), "L2:E2");
  assert.notEqual(deliveryStamp([{ id: "L3", event_id: "E3" }]), deliveryStamp([{ id: "L2", event_id: "E2" }]));
});
