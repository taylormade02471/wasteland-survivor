import assert from "node:assert/strict";
import test from "node:test";
import { RENDER_QUALITY_PASSES, renderQualityPassReport, renderQualityProfile } from "../public/render-quality.mjs";

test("five render passes increase mesh, texture, and point budgets by 12-20 percent", () => {
  assert.equal(RENDER_QUALITY_PASSES.length, 5);
  for (let pass = 1; pass <= 5; pass += 1) {
    const report = renderQualityPassReport(pass);
    assert.ok(report.triangleGainPercent >= 12 && report.triangleGainPercent <= 20, `pass ${pass} triangles`);
    assert.ok(report.textureGainPercent >= 0 && report.textureGainPercent <= 20, `pass ${pass} texture`);
    assert.ok(report.pointGainPercent >= 12 && report.pointGainPercent <= 20, `pass ${pass} points`);
    assert.ok(report.terrainSegments >= 40);
  }
  assert.ok(renderQualityProfile(5).triangleBudget > renderQualityProfile(1).triangleBudget);
});

test("quality profiles are deterministic and bounded to the five-pass ladder", () => {
  assert.equal(renderQualityProfile(0).pass, 1);
  assert.equal(renderQualityProfile(99).pass, 5);
  assert.deepEqual(renderQualityProfile(3), renderQualityProfile(3));
});
