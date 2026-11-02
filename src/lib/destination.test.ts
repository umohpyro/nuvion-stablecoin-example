import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAINS } from "./chains.ts";
import { destination } from "./destination.ts";

const saved = { id: "R1", name: "Acme", chain: "eth" as const, address: CHAINS.eth.example };
const typed = { chain: "base" as const, address: CHAINS.base.example, name: "Someone" };

test("a saved recipient overrides whatever the browser typed", () => {
  const d = destination(saved, { chain: "sol", address: "attacker", name: "x" }, true);
  assert.deepEqual(d, { chain: "eth", address: CHAINS.eth.example, holder: "Acme", recipientId: "R1" });
});

test("the allow list refuses a typed address", () => {
  assert.throws(() => destination(null, typed, true), /only sends to saved recipients/);
});

test("without the allow list, a typed address is validated for its network", () => {
  assert.equal(destination(null, typed, false).holder, "Someone");
  assert.throws(() => destination(null, { ...typed, chain: "sol" }, false), /Ethereum-style/);
  assert.throws(() => destination(null, { ...typed, name: " " }, false), /recipient's name/);
});
