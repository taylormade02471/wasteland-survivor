import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  ARMORY_SURFACE_TEXTURES,
  ARMORY_VISUAL_PASSES,
  buildArmoryRubblePlan,
  armoryVisualPassReport,
  armoryVisualProfile,
} from "../public/armory-visual-profile.mjs";

const gameSource = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("five burned-armory passes grow real rubble triangles and texture density by 12-20 percent", () => {
  assert.equal(ARMORY_VISUAL_PASSES.length, 5);
  for (let pass = 1; pass <= ARMORY_VISUAL_PASSES.length; pass += 1) {
    const report = armoryVisualPassReport(pass);
    assert.ok(report.rubbleTriangleGainPercent >= 12 && report.rubbleTriangleGainPercent <= 20, `pass ${pass} triangles`);
    assert.ok(report.textureGainPercent >= 12 && report.textureGainPercent <= 20, `pass ${pass} texture`);
    assert.equal(report.rubbleTriangles, report.surfaceDetailPoints * 36);
  }
});

test("armory rubble plans are deterministic, bounded, and match the selected pass", () => {
  for (let pass = 1; pass <= ARMORY_VISUAL_PASSES.length; pass += 1) {
    const profile = armoryVisualProfile(pass);
    const plan = buildArmoryRubblePlan(pass);
    assert.equal(plan.length, profile.surfaceDetailPoints);
    assert.deepEqual(plan, buildArmoryRubblePlan(pass));
    assert.ok(plan.every(point => Number.isFinite(point.x) && Number.isFinite(point.z)));
    assert.ok(plan.every(point => Math.abs(point.x) <= 15 && point.z >= 9 && point.z <= 17));
  }
});

test("the runtime wires generated armory surface maps and instanced triangle detail", () => {
  assert.match(ARMORY_SURFACE_TEXTURES.baseColor, /burned-armory-steel-v1\.webp$/);
  assert.match(ARMORY_SURFACE_TEXTURES.bump, /burned-armory-steel-bump-v1\.webp$/);
  assert.match(gameSource, /armory-visual-profile\.mjs/);
  assert.match(gameSource, /buildArmoryRubblePlan\(renderQuality\.pass\)/);
  assert.match(gameSource, /buildArmorySalvagePlan\(renderQuality\.pass\)/);
  assert.match(gameSource, /armory-salvage-pass-/);
  assert.match(gameSource, /new THREE\.InstancedMesh\(rubbleGeometry, rubbleMaterial, rubblePlan\.length\)/);
  assert.match(gameSource, /ARMORY_SURFACE_TEXTURES\.baseColor/);
  assert.match(gameSource, /ARMORY_SURFACE_TEXTURES\.bump/);
  assert.match(gameSource, /name: "front-left"/);
  assert.match(gameSource, /name: "front-right"/);
  assert.match(gameSource, /name: "door-header"/);
  assert.match(gameSource, /const renderFocus = new URLSearchParams\(window\.location\.search\)\.get\("renderFocus"\)/);
  assert.match(gameSource, /function applyRequestedRenderFocus\(\)/);
  assert.match(gameSource, /renderFocus === "armory"/);
});
