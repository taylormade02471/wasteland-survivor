import assert from "node:assert/strict";
import test from "node:test";

import {
  TACTICAL_ITEMS,
  WEAPON_FAMILIES,
  applyUpgrade,
  calculateDamage,
  calculateShotPattern,
  completeReload,
  createCombatState,
  createHitFeedback,
  getUpgradeCost,
  getWeaponProfile,
  isWeaponUnlocked,
  startReload,
  switchWeapon,
  takeShot,
  useTacticalItem,
} from "../public/combat-rules.mjs";

test("defines three weapon families with established unlocks and magazines", () => {
  assert.deepEqual(Object.keys(WEAPON_FAMILIES), ["scout", "cannon", "inferno"]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(WEAPON_FAMILIES).map(([key, value]) => [key, [value.unlockKills, value.magazineSize]])),
    { scout: [3, 30], cannon: [6, 12], inferno: [9, 8] },
  );
});

test("creates independent magazine, reserve ammo, upgrade, and tactical state", () => {
  const state = createCombatState();
  assert.equal(state.activeWeapon, "scout");
  assert.deepEqual(state.weapons.scout, { level: 0, magazine: 30, reserve: 180, reloadEndsAt: null });
  assert.deepEqual(state.tacticals, { frag: 2, flash: 1, stim: 2 });
});

test("uses deterministic upgrade scaling and established barrel milestones", () => {
  assert.deepEqual(getWeaponProfile("scout", 25), {
    id: "scout", name: "Scout", level: 25, damage: 52, fireDelayMs: 135,
    projectiles: 1, penetration: 1, spreadDegrees: 0.65, recoil: 0.72,
    magazineSize: 30, reloadMs: 900, automaticReloadMs: 1100,
    falloffStart: 18, falloffEnd: 52, minimumDamageMultiplier: 0.58,
  });
  assert.equal(getWeaponProfile("cannon", 50).projectiles, 2);
  assert.equal(getWeaponProfile("cannon", 75).projectiles, 3);
  assert.equal(getWeaponProfile("cannon", 100).projectiles, 4);
  assert.equal(getWeaponProfile("cannon", 50).damage, 152);
  assert.equal(getWeaponProfile("inferno", 25).projectiles, 2);
  assert.equal(getWeaponProfile("inferno", 38).projectiles, 3);
  assert.equal(getWeaponProfile("inferno", 50).projectiles, 4);
  assert.throws(() => getWeaponProfile("inferno", 51), /level/i);
});

test("unlocks at 3, 6, and 9 kills and applies upgrades without mutation", () => {
  const state = createCombatState({ kills: 6, scrap: 100 });
  assert.equal(isWeaponUnlocked("scout", state.kills), true);
  assert.equal(isWeaponUnlocked("inferno", state.kills), false);
  assert.equal(getUpgradeCost("cannon", 0), 28);
  assert.equal(getUpgradeCost("cannon", 10), 33);
  const result = applyUpgrade(state, "cannon");
  assert.equal(result.ok, true);
  assert.equal(result.state.weapons.cannon.level, 1);
  assert.equal(result.state.scrap, 72);
  assert.equal(state.weapons.cannon.level, 0);
  assert.equal(state.scrap, 100);
});

test("consumes magazine ammo and requests automatic reload only when empty", () => {
  const state = createCombatState({ kills: 3 });
  state.weapons.scout.magazine = 1;
  const first = takeShot(state, 1_000);
  assert.equal(first.ok, true);
  assert.equal(first.state.weapons.scout.magazine, 0);
  assert.equal(first.autoReloadRequired, false);
  const empty = takeShot(first.state, 1_200);
  assert.deepEqual(empty, { ok: false, reason: "empty", autoReloadRequired: true, state: first.state });
});

test("supports manual and automatic reload timing using reserve ammunition", () => {
  const state = createCombatState({ kills: 3 });
  state.weapons.scout.magazine = 4;
  state.weapons.scout.reserve = 10;
  const loading = startReload(state, 2_000, { automatic: false });
  assert.equal(loading.ok, true);
  assert.equal(loading.state.weapons.scout.reloadEndsAt, 2_900);
  assert.equal(completeReload(loading.state, 2_899).completed, false);
  const done = completeReload(loading.state, 2_900);
  assert.equal(done.completed, true);
  assert.equal(done.state.weapons.scout.magazine, 14);
  assert.equal(done.state.weapons.scout.reserve, 0);

  const empty = createCombatState({ kills: 3 });
  empty.weapons.scout.magazine = 0;
  assert.equal(startReload(empty, 5_000, { automatic: true }).state.weapons.scout.reloadEndsAt, 6_100);
});

test("produces deterministic recoil and spread from shot index and seed", () => {
  const profile = getWeaponProfile("cannon", 75);
  const a = calculateShotPattern(profile, { shotIndex: 4, seed: 99, aiming: false });
  const b = calculateShotPattern(profile, { shotIndex: 4, seed: 99, aiming: false });
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  assert.ok(a.every((shot) => Number.isFinite(shot.yawDegrees) && Number.isFinite(shot.pitchDegrees)));
  const aimed = calculateShotPattern(profile, { shotIndex: 4, seed: 99, aiming: true });
  assert.ok(Math.abs(aimed[0].yawDegrees) < Math.abs(a[0].yawDegrees));
});

test("applies range falloff and penetration loss deterministically", () => {
  const profile = getWeaponProfile("cannon", 0);
  assert.equal(calculateDamage(profile, { distance: 10, penetrations: 0 }), 52);
  assert.equal(calculateDamage(profile, { distance: 60, penetrations: 0 }), 31.2);
  assert.equal(calculateDamage(profile, { distance: 10, penetrations: 2 }), 33.28);
  assert.equal(calculateDamage(profile, { distance: 10, penetrations: 3 }), 0);
});

test("creates serializable hit feedback event data", () => {
  assert.deepEqual(createHitFeedback({
    targetId: "raider-7", damage: 32.5, remainingHealth: 0, headshot: true,
    penetrations: 1, weaponId: "cannon", timestamp: 4_200,
  }), {
    type: "combat:hit", targetId: "raider-7", weaponId: "cannon", damage: 32.5,
    remainingHealth: 0, headshot: true, penetrations: 1, eliminated: true,
    marker: "elimination", timestamp: 4_200,
  });
});

test("switches only among unlocked weapons and cancels reload on switch", () => {
  const state = createCombatState({ kills: 6 });
  state.weapons.scout.reloadEndsAt = 5_000;
  const next = switchWeapon(state, 1);
  assert.equal(next.ok, true);
  assert.equal(next.state.activeWeapon, "cannon");
  assert.equal(next.state.weapons.scout.reloadEndsAt, null);
  assert.equal(switchWeapon(next.state, 1).state.activeWeapon, "scout");
});

test("defines and consumes tactical items with pure effects", () => {
  assert.deepEqual(Object.keys(TACTICAL_ITEMS), ["frag", "flash", "stim"]);
  const state = createCombatState();
  const frag = useTacticalItem(state, "frag", { timestamp: 7_000 });
  assert.equal(frag.ok, true);
  assert.equal(frag.state.tacticals.frag, 1);
  assert.deepEqual(frag.event, {
    type: "combat:tactical", tacticalId: "frag", effect: "explosive",
    radius: 5, power: 90, durationMs: 0, timestamp: 7_000,
  });
  assert.equal(useTacticalItem(state, "unknown").reason, "unknown-tactical");
});
