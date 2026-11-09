import assert from "node:assert/strict";
import { test } from "node:test";
import { publicHttpsOrigin } from "./origin.ts";

test("accepts a public https origin and drops the path", () => {
  assert.equal(publicHttpsOrigin("https://nuvion-stablecoin-example.vercel.app"), "https://nuvion-stablecoin-example.vercel.app");
  assert.equal(publicHttpsOrigin("https://example.com/some/path?x=1"), "https://example.com");
});

test("rejects http, localhost, private addresses and junk", () => {
  for (const bad of ["http://example.com", "https://localhost:3000", "https://127.0.0.1", "https://192.168.1.5", "https://10.0.0.2", "https://172.20.1.1", "https://mac.local", "https://intranet", "https://[::1]", "not a url", ""]) {
    assert.equal(publicHttpsOrigin(bad), null, bad);
  }
});
