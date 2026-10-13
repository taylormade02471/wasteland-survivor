import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { summarizeWorldAssetStates } from "../public/world-asset-audit.mjs";

const gameSource = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("world asset audit separates authored, loading, and fallback props", () => {
  assert.deepEqual(summarizeWorldAssetStates(["authored", "authored", "fallback-loading", "fallback-load-error"]), {
    total: 4,
    authored: 2,
    loading: 1,
    fallback: 1,
    complete: true,
  });
  assert.equal(summarizeWorldAssetStates([]).complete, false);
});

test("runtime publishes world asset coverage on the live canvas", () => {
  assert.match(gameSource, /world-asset-audit\.mjs/);
  assert.match(gameSource, /worldFieldAuthored/);
  assert.match(gameSource, /worldFieldFallback/);
  assert.match(gameSource, /worldFieldTotal/);
});
