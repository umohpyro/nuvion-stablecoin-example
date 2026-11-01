import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAINS, validateAddress } from "./chains.ts";

test("accepts a well-formed address for each chain family", () => {
  assert.equal(validateAddress("base", CHAINS.base.example), null);
  assert.equal(validateAddress("eth", CHAINS.eth.example), null);
  assert.equal(validateAddress("sol", CHAINS.sol.example), null);
});

test("rejects a Solana address on an EVM chain and the reverse", () => {
  assert.match(validateAddress("eth", CHAINS.sol.example) ?? "", /Solana/);
  assert.match(validateAddress("sol", CHAINS.eth.example) ?? "", /Ethereum-style/);
});

test("rejects short, long and non-hex EVM addresses", () => {
  for (const bad of ["", "0x123", "0xZZZ6656EC7ab88b098defB751B7401B5f6d8976F", CHAINS.eth.example + "00"]) assert.notEqual(validateAddress("matic", bad), null, bad);
});
