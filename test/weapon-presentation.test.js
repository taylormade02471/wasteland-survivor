import assert from "node:assert/strict";
import test from "node:test";

import {
  WEAPON_PRESENTATION_PROFILES,
  advanceWeaponPresentation,
  beginWeaponReload,
  createWeaponPresentationState,
  sampleWeaponPresentationFrame,
  triggerWeaponShot,
  weaponPresentationView,
} from "../public/weapon-presentation.mjs";

test("defines distinct first-person presentation profiles for each weapon", () => {
  const profiles = Object.values(WEAPON_PRESENTATION_PROFILES);
  assert.equal(profiles.length, 3);
  assert.equal(new Set(profiles.map((profile) => profile.modelId)).size, 3);
  assert.equal(new Set(profiles.map((profile) => profile.reloadMs)).size, 3);
  assert.equal(new Set(profiles.map((profile) => profile.recoilKick)).size, 3);
  for (const profile of profiles) {
    assert.ok(profile.reloadMs > 0);
    assert.ok(profile.shellVelocity > 0);
    assert.ok(profile.muzzleFlashMs > 0);
    assert.ok(profile.impactSparkCount > 0);
  }
});

test("shot cue drives muzzle flash, smoke, shell ejection, impact sparks, and recoil", () => {
  const initial = createWeaponPresentationState("scout");
  const result = triggerWeaponShot(initial);

  assert.equal(result.state.shots, 1);
  assert.equal(result.state.shellsEjected, 1);
  assert.equal(result.state.muzzleFlashMs, WEAPON_PRESENTATION_PROFILES.scout.muzzleFlashMs);
  assert.equal(result.state.smokeMs, WEAPON_PRESENTATION_PROFILES.scout.smokeMs);
  assert.equal(result.state.recoil, WEAPON_PRESENTATION_PROFILES.scout.recoilKick);
  assert.deepEqual(result.cue, {
    type: "shot",
    shell: true,
    impactSparks: WEAPON_PRESENTATION_PROFILES.scout.impactSparkCount,
  });
});

test("reload progresses monotonically and returns to ready when complete", () => {
  const started = beginWeaponReload(createWeaponPresentationState("cannon"));
  assert.equal(started.state.reloading, true);
  assert.equal(started.state.reloadProgress, 0);
  assert.equal(started.cue.type, "reload-start");

  const middle = advanceWeaponPresentation(started.state, WEAPON_PRESENTATION_PROFILES.cannon.reloadMs / 2000);
  assert.equal(middle.reloading, true);
  assert.equal(middle.reloadProgress, 0.5);

  const complete = advanceWeaponPresentation(middle, WEAPON_PRESENTATION_PROFILES.cannon.reloadMs / 2000);
  assert.equal(complete.reloading, false);
  assert.equal(complete.reloadProgress, 1);
  assert.equal(weaponPresentationView(complete).status, "READY");
});

test("presentation effects decay deterministically and remain finite with bad dt", () => {
  const fired = triggerWeaponShot(createWeaponPresentationState("inferno")).state;
  const cooled = advanceWeaponPresentation(fired, 0.1);
  assert.ok(cooled.recoil < fired.recoil);
  assert.ok(cooled.muzzleFlashMs < fired.muzzleFlashMs);
  assert.ok(cooled.smokeMs < fired.smokeMs);
  assert.equal(advanceWeaponPresentation(cooled, Number.NaN).recoil, cooled.recoil);
  assert.equal(advanceWeaponPresentation(cooled, -10).recoil, cooled.recoil);
  for (const value of Object.values(advanceWeaponPresentation(cooled, Infinity))) {
    if (typeof value === "number") assert.equal(Number.isFinite(value), true);
  }
});

test("shot and reload requests are ignored while reloading", () => {
  const state = beginWeaponReload(createWeaponPresentationState("inferno")).state;
  assert.equal(triggerWeaponShot(state).cue.type, "blocked");
  assert.deepEqual(beginWeaponReload(state), { state, cue: { type: "blocked" } });
});

test("frame sampler exposes deterministic readable muzzle flash and recoil pose cues", () => {
  const scoutShot = triggerWeaponShot(createWeaponPresentationState("scout")).state;
  const cannonShot = triggerWeaponShot(createWeaponPresentationState("cannon")).state;
  const infernoShot = triggerWeaponShot(createWeaponPresentationState("inferno")).state;

  const scoutFrame = sampleWeaponPresentationFrame(scoutShot, { aim: 0.25 });
  const cannonFrame = sampleWeaponPresentationFrame(cannonShot, { aim: 0.25 });
  const infernoFrame = sampleWeaponPresentationFrame(infernoShot, { aim: 0.25 });

  assert.deepEqual(scoutFrame, sampleWeaponPresentationFrame(scoutShot, { aim: 0.25 }));
  assert.equal(scoutFrame.weapon, "scout");
  assert.equal(scoutFrame.muzzleFlash.visible, true);
  assert.equal(scoutFrame.muzzleFlash.color, WEAPON_PRESENTATION_PROFILES.scout.flashColor);
  assert.ok(scoutFrame.muzzleFlash.scale >= 0.35);
  assert.ok(scoutFrame.pose.kickZ < 0);
  assert.ok(cannonFrame.pose.kickZ < scoutFrame.pose.kickZ);
  assert.notEqual(infernoFrame.muzzleFlash.color, scoutFrame.muzzleFlash.color);
  assert.ok(infernoFrame.heatGlow > scoutFrame.heatGlow);
  assert.ok(scoutFrame.accessibility.label.includes("Scout"));
});

test("frame sampler clamps bad input and fades effects without layout-sized overlays", () => {
  const fired = triggerWeaponShot(createWeaponPresentationState("cannon")).state;
  const cooled = advanceWeaponPresentation(fired, 0.08);
  const bright = sampleWeaponPresentationFrame(fired, { aim: Infinity, viewportWidth: 320 });
  const fading = sampleWeaponPresentationFrame(cooled, { aim: Number.NaN, viewportWidth: 320 });

  assert.equal(bright.aim, 1);
  assert.equal(fading.aim, 0);
  assert.ok(fading.muzzleFlash.opacity < bright.muzzleFlash.opacity);
  assert.ok(bright.muzzleFlash.maxScreenFraction <= 0.18);
  assert.ok(bright.shellEjection.velocityX > 0);
  for (const value of Object.values(bright.pose)) assert.equal(Number.isFinite(value), true);
});
