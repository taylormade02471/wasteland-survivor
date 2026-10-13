import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { buildFireVfxProfile, fireVfxFrame } from "../public/fire-vfx.mjs";

const gameSource = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("fire VFX stays bounded across the five render passes", () => {
  for (let pass = 1; pass <= 5; pass += 1) {
    const profile = buildFireVfxProfile(pass);
    assert.equal(profile.pass, pass);
    assert.ok(profile.smokeCount >= 12 && profile.smokeCount <= 72);
    assert.ok(profile.emberCount >= 16 && profile.emberCount <= 96);
    assert.ok(profile.smokeCount >= (pass === 1 ? 12 : buildFireVfxProfile(pass - 1).smokeCount));
    assert.ok(profile.heatOpacity > 0 && profile.heatOpacity <= .3);
  }
});

test("fire plume frames are deterministic and animate upward without unbounded drift", () => {
  const profile = buildFireVfxProfile(5);
  const first = fireVfxFrame({ profile, elapsed: 3.25, index: 4 });
  const second = fireVfxFrame({ profile, elapsed: 3.25, index: 4 });
  assert.deepEqual(first, second);
  assert.ok(first.y >= 0 && first.y <= profile.maxHeight);
  assert.ok(Math.abs(first.x) <= profile.horizontalSpread);
  assert.ok(first.opacity >= 0 && first.opacity <= profile.smokeOpacity);
  assert.ok(first.scale >= .6 && first.scale <= 1.8);
});

test("the renderer wires fire smoke, embers, and heat shimmer into inferno visuals", () => {
  assert.match(gameSource, /fire-vfx\.mjs/);
  assert.match(gameSource, /buildFireVfxProfile\(renderQuality\.pass\)/);
  assert.match(gameSource, /fire-smoke-plume/);
  assert.match(gameSource, /fire-ember-field/);
  assert.match(gameSource, /heat-shimmer/);
});
