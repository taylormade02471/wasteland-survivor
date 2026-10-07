import assert from "node:assert/strict";
import test from "node:test";

import {
  CLASS_DEFINITIONS,
  CLASS_IDS,
  DEFAULT_CLASS_ID,
  activateAbility,
  applyClassUpgrade,
  canUseAbility,
  createClassProgress,
  getClassDefinition,
  getClassStats,
  normalizeClassProgress,
} from "../public/class-rules.mjs";

test("defines four balanced, distinct classes with passives and active abilities", () => {
  assert.deepEqual(CLASS_IDS, ["scout", "ranger", "heavy", "tech"]);
  assert.equal(DEFAULT_CLASS_ID, "scout");

  const summaries = CLASS_IDS.map((id) => {
    const definition = getClassDefinition(id);
    assert.equal(definition.id, id);
    assert.ok(definition.label);
    assert.ok(definition.passive.id);
    assert.ok(definition.passive.description);
    assert.ok(definition.ability.id);
    assert.ok(definition.ability.durationMs > 0);
    assert.ok(definition.ability.cooldownMs > definition.ability.durationMs);
    assert.ok(definition.upgrades.length >= 3);
    return JSON.stringify({ stats: definition.baseStats, passive: definition.passive, ability: definition.ability });
  });

  assert.equal(new Set(summaries).size, CLASS_IDS.length);
  assert.equal(CLASS_DEFINITIONS.heavy.baseStats.moveSpeedMultiplier < 1, true);
  assert.equal(CLASS_DEFINITIONS.scout.baseStats.moveSpeedMultiplier > 1, true);
  assert.equal(CLASS_DEFINITIONS.tech.baseStats.scrapMultiplier > 1, true);
  assert.equal(CLASS_DEFINITIONS.ranger.baseStats.spreadMultiplier < 1, true);
});

test("falls back to Scout without exposing mutable shared definitions", () => {
  const fallback = getClassDefinition("unknown-class");
  assert.equal(fallback.id, DEFAULT_CLASS_ID);
  fallback.baseStats.maxHealth = 1;
  assert.equal(getClassDefinition("scout").baseStats.maxHealth, 100);
});

test("creates and normalizes JSON-safe progress from malformed or older saves", () => {
  const fresh = createClassProgress("heavy");
  assert.deepEqual(fresh, {
    version: 1,
    classId: "heavy",
    upgradePoints: 0,
    upgrades: {},
    abilityReadyAt: 0,
  });

  const normalized = normalizeClassProgress({
    classId: "not-real",
    upgradePoints: "7",
    upgrades: { fleetFoot: 99, unknown: 4, reinforcedFrame: -2 },
    abilityReadyAt: "1250",
    ignored: Infinity,
  });
  assert.deepEqual(normalized, {
    version: 1,
    classId: "scout",
    upgradePoints: 7,
    upgrades: { fleetFoot: 3 },
    abilityReadyAt: 1250,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(normalized)), normalized);
});

test("applies upgrades immutably, spends points, and enforces class paths and rank caps", () => {
  const start = { ...createClassProgress("scout"), upgradePoints: 4 };
  const first = applyClassUpgrade(start, "fleetFoot");
  assert.equal(first.applied, true);
  assert.equal(first.reason, null);
  assert.deepEqual(first.progress.upgrades, { fleetFoot: 1 });
  assert.equal(first.progress.upgradePoints, 3);
  assert.deepEqual(start.upgrades, {});

  const wrongClass = applyClassUpgrade(first.progress, "reinforcedFrame");
  assert.equal(wrongClass.applied, false);
  assert.equal(wrongClass.reason, "invalid-upgrade");

  let capped = first.progress;
  capped = applyClassUpgrade(capped, "fleetFoot").progress;
  capped = applyClassUpgrade(capped, "fleetFoot").progress;
  const atCap = applyClassUpgrade(capped, "fleetFoot");
  assert.equal(atCap.applied, false);
  assert.equal(atCap.reason, "max-rank");
});

test("computes class stats from upgrades without mutating saved progress", () => {
  const progress = normalizeClassProgress({
    classId: "heavy",
    upgradePoints: 0,
    upgrades: { reinforcedFrame: 2, shieldCore: 1 },
  });
  const before = JSON.stringify(progress);
  const stats = getClassStats(progress);
  assert.equal(stats.maxHealth, 150);
  assert.equal(stats.maxShield, 65);
  assert.equal(stats.moveSpeedMultiplier, 0.88);
  assert.equal(JSON.stringify(progress), before);
});

test("ability transitions are deterministic, immutable, and save-safe", () => {
  const start = createClassProgress("ranger");
  assert.equal(canUseAbility(start, 5000), true);

  const activated = activateAbility(start, 5000);
  assert.equal(activated.activated, true);
  assert.equal(activated.reason, null);
  assert.equal(activated.effect.id, "focus");
  assert.equal(activated.effect.startedAt, 5000);
  assert.equal(activated.effect.endsAt, 11000);
  assert.equal(activated.progress.abilityReadyAt, 25000);
  assert.equal(start.abilityReadyAt, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(activated)), activated);

  assert.equal(canUseAbility(activated.progress, 24999), false);
  const coolingDown = activateAbility(activated.progress, 24999);
  assert.equal(coolingDown.activated, false);
  assert.equal(coolingDown.reason, "cooldown");
  assert.equal(coolingDown.remainingMs, 1);
  assert.deepEqual(coolingDown.progress, activated.progress);
});
