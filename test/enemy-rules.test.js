import assert from "node:assert/strict";
import test from "node:test";

import {
  ENEMY_ARCHETYPES,
  composeWave,
  mapAffinity,
  scaleEnemy,
  spawnSchedule,
  tacticalIntent
} from "../public/enemy-rules.mjs";

test("defines eight distinct enemy archetypes", () => {
  assert.deepEqual(Object.keys(ENEMY_ARCHETYPES), [
    "rusher", "shooter", "sniper", "shield", "heavy", "drone", "mutant", "boss"
  ]);
  assert.equal(ENEMY_ARCHETYPES.sniper.role, "range");
  assert.equal(ENEMY_ARCHETYPES.shield.role, "defense");
  assert.ok(ENEMY_ARCHETYPES.heavy.health > ENEMY_ARCHETYPES.shooter.health);
});

test("scales enemies by wave and difficulty without mutating base stats", () => {
  const baseHealth = ENEMY_ARCHETYPES.shooter.health;
  const easy = scaleEnemy("shooter", { wave: 5, difficulty: "easy", playerSkill: 2 });
  const insane = scaleEnemy("shooter", { wave: 5, difficulty: "insane", playerSkill: 2 });

  assert.equal(ENEMY_ARCHETYPES.shooter.health, baseHealth);
  assert.ok(easy.health > baseHealth);
  assert.ok(insane.health > easy.health);
  assert.ok(insane.damage > easy.damage);
  assert.equal(easy.type, "shooter");
});

test("builds deterministic wave compositions with progression and bosses", () => {
  const first = composeWave({ wave: 1, difficulty: "easy", map: "wasteland", random: () => 0 });
  const later = composeWave({ wave: 8, difficulty: "expert", map: "toxic", random: () => 0.99 });
  const boss = composeWave({ wave: 10, difficulty: "medium", map: "inferno", random: () => 0.5 });

  assert.deepEqual(first, ["rusher", "rusher"]);
  assert.ok(later.length > first.length);
  assert.ok(later.some(type => ["sniper", "shield", "heavy", "drone", "mutant"].includes(type)));
  assert.equal(boss.filter(type => type === "boss").length, 1);
});

test("chooses tactical intent from archetype and combat state", () => {
  assert.equal(tacticalIntent("rusher", { distance: 20, healthRatio: 1, hasLineOfSight: true }), "advance");
  assert.equal(tacticalIntent("sniper", { distance: 8, healthRatio: 1, hasLineOfSight: true }), "retreat");
  assert.equal(tacticalIntent("shield", { distance: 16, healthRatio: 0.8, hasLineOfSight: true }), "hold");
  assert.equal(tacticalIntent("shooter", { distance: 24, healthRatio: 0.7, hasLineOfSight: false }), "flank");
  assert.equal(tacticalIntent("heavy", { distance: 12, healthRatio: 0.15, hasLineOfSight: true }), "retreat");
});

test("schedules one enemy at a time with difficulty-based pacing", () => {
  const easy = spawnSchedule({ enemyCount: 4, wave: 1, difficulty: "easy", startAt: 2 });
  const insane = spawnSchedule({ enemyCount: 4, wave: 8, difficulty: "insane", startAt: 2 });

  assert.equal(easy.length, 4);
  assert.equal(easy[0], 2);
  assert.ok(easy.every((time, index) => index === 0 || time > easy[index - 1]));
  assert.ok(insane[1] - insane[0] < easy[1] - easy[0]);
});

test("applies map affinity to composition weights", () => {
  assert.ok(mapAffinity("mutant", "toxic") > mapAffinity("mutant", "ice"));
  assert.ok(mapAffinity("sniper", "ice") > mapAffinity("sniper", "toxic"));
  assert.ok(mapAffinity("drone", "inferno") > 0);
  assert.equal(mapAffinity("unknown", "wasteland"), 0);
});

test("rejects invalid rule inputs", () => {
  assert.throws(() => scaleEnemy("unknown"), /Unknown enemy archetype/);
  assert.throws(() => composeWave({ wave: 0 }), /wave/);
  assert.throws(() => spawnSchedule({ enemyCount: -1 }), /enemyCount/);
});
