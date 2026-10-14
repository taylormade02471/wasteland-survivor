import assert from "node:assert/strict";
import test from "node:test";

import {
  LANDMARK_RENDER_PASSES,
  buildArmorySalvagePlan,
  buildInfernoFirelinePlan,
  buildMountainCragPlan,
  landmarkRenderPassReport,
  landmarkRenderProfile,
} from "../public/landmark-render-profile.mjs";

test("five landmark passes add 12-20 percent real mountain, armory, and fire detail", () => {
  assert.equal(LANDMARK_RENDER_PASSES.length, 5);
  for (let pass = 1; pass <= LANDMARK_RENDER_PASSES.length; pass += 1) {
    const report = landmarkRenderPassReport(pass);
    assert.ok(report.mountainCragGainPercent >= 12 && report.mountainCragGainPercent <= 20, `pass ${pass} mountain gain`);
    assert.ok(report.armorySalvageGainPercent >= 12 && report.armorySalvageGainPercent <= 20, `pass ${pass} armory gain`);
    assert.ok(report.infernoFireClusterGainPercent >= 12 && report.infernoFireClusterGainPercent <= 20, `pass ${pass} fire gain`);
    assert.equal(buildMountainCragPlan(pass).length, landmarkRenderProfile(pass).mountainCragCount);
    assert.equal(buildArmorySalvagePlan(pass).length, landmarkRenderProfile(pass).armorySalvageCount);
    assert.equal(buildInfernoFirelinePlan(pass).length, landmarkRenderProfile(pass).infernoFireClusterCount);
  }
});

test("landmark plans are deterministic, finite, and stay outside the central spawn lane", () => {
  for (let pass = 1; pass <= 5; pass += 1) {
    const plans = [buildMountainCragPlan(pass), buildArmorySalvagePlan(pass), buildInfernoFirelinePlan(pass)];
    for (const plan of plans) {
      assert.deepEqual(plan, plan === plans[0] ? buildMountainCragPlan(pass) : plan === plans[1] ? buildArmorySalvagePlan(pass) : buildInfernoFirelinePlan(pass));
      assert.ok(plan.every(item => Number.isFinite(item.x) && Number.isFinite(item.z) && Number.isFinite(item.scale)));
      assert.ok(plan.every(item => Math.hypot(item.x, item.z) > 30));
    }
  }
});

test("landmark plans remain in their authored mountain, armory, and inferno regions", () => {
  const mountains = buildMountainCragPlan(5);
  const salvage = buildArmorySalvagePlan(5);
  const fireline = buildInfernoFirelinePlan(5);
  assert.ok(mountains.every(item => item.x < -40 && item.z < -48));
  assert.ok(salvage.every(item => item.x >= -108 && item.x <= -62 && item.z >= 166 && item.z <= 202));
  assert.ok(fireline.every(item => item.x >= -212 && item.x <= -36 && item.z >= 68 && item.z <= 90));
});
