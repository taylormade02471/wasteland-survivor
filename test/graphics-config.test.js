const assert = require("node:assert/strict");
const test = require("node:test");

const modulePath = new URL("../public/graphics-config.mjs", `file://${__filename.replace(/\\/g, "/")}`);

test("selects low graphics for reduced motion or low-memory devices", async () => {
  const { selectGraphicsTier } = await import(modulePath);

  assert.equal(selectGraphicsTier({ reducedMotion: true, deviceMemory: 16, hardwareConcurrency: 16 }), "low");
  assert.equal(selectGraphicsTier({ reducedMotion: false, deviceMemory: 2, hardwareConcurrency: 8 }), "low");
});

test("selects medium for typical phones and high for capable desktops", async () => {
  const { selectGraphicsTier } = await import(modulePath);

  assert.equal(selectGraphicsTier({ deviceMemory: 4, hardwareConcurrency: 8 }), "medium");
  assert.equal(selectGraphicsTier({ deviceMemory: 8, hardwareConcurrency: 8 }), "high");
});

test("valid saved graphics tier overrides automatic selection", async () => {
  const { selectGraphicsTier } = await import(modulePath);

  assert.equal(selectGraphicsTier({ reducedMotion: true, deviceMemory: 1, hardwareConcurrency: 1, savedTier: "high" }), "high");
  assert.equal(selectGraphicsTier({ deviceMemory: 16, hardwareConcurrency: 16, savedTier: "low" }), "low");
  assert.equal(selectGraphicsTier({ deviceMemory: 8, hardwareConcurrency: 8, savedTier: "ultra" }), "high");
});

test("resolves known manifest assets and returns null for unknown keys", async () => {
  const { resolveAsset } = await import(modulePath);
  const manifest = { assets: { loading: "/assets/nightfall/backgrounds/nightfall-loading-v1.webp" } };

  assert.equal(resolveAsset(manifest, "loading"), "/assets/nightfall/backgrounds/nightfall-loading-v1.webp");
  assert.equal(resolveAsset(manifest, "missing"), null);
  assert.equal(resolveAsset(null, "loading"), null);
});
