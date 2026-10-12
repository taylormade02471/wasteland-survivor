import test from "node:test";
import assert from "node:assert/strict";

import {
  CURRENT_PROFILE_VERSION,
  KINGDOM_UNLOCK_LEVEL,
  MAP_UNLOCKS,
  STORY_CHAPTERS,
  STORE_CATALOG,
  applyPurchase,
  evaluateCtfMatch,
  evaluateEliminationSeries,
  kingdomUnlocked,
  levelFromXp,
  normalizeProfile,
  scoreSurvival,
  unlockedMaps,
  validatePurchase,
  xpForLevel,
} from "../public/progression-rules.mjs";

test("campaign defines ordered chapters, missions, and all four map unlocks", () => {
  assert.deepEqual(MAP_UNLOCKS.map(entry => entry.map), [
    "Wasteland",
    "Toxic Pond",
    "Icy Mountain",
    "Fiery Inferno",
  ]);
  assert.ok(STORY_CHAPTERS.length >= 4);
  assert.ok(STORY_CHAPTERS.every((chapter, index) => chapter.id === index + 1));
  assert.ok(STORY_CHAPTERS.every(chapter => chapter.missions.length >= 2));
  assert.deepEqual(unlockedMaps(1), ["Wasteland"]);
  assert.deepEqual(unlockedMaps(20), ["Wasteland", "Toxic Pond", "Icy Mountain", "Fiery Inferno"]);
});

test("XP thresholds are monotonic and levels derive from total XP", () => {
  assert.equal(xpForLevel(1), 0);
  assert.ok(xpForLevel(3) > xpForLevel(2));
  assert.equal(levelFromXp(-10), 1);
  assert.equal(levelFromXp(xpForLevel(7)), 7);
  assert.equal(levelFromXp(xpForLevel(8) - 1), 7);
});

test("kingdom unlock follows the configured level gate", () => {
  assert.equal(kingdomUnlocked(KINGDOM_UNLOCK_LEVEL - 1), false);
  assert.equal(kingdomUnlocked(KINGDOM_UNLOCK_LEVEL), true);
});

test("profile normalization creates a complete local-only save", () => {
  const profile = normalizeProfile();
  assert.equal(profile.version, CURRENT_PROFILE_VERSION);
  assert.equal(profile.level, 1);
  assert.equal(profile.xp, 0);
  assert.equal(profile.scrap, 0);
  assert.equal(profile.gold, 0);
  assert.equal(profile.silver, 0);
  assert.deepEqual(profile.unlockedMaps, ["Wasteland"]);
  assert.equal(profile.kingdom.unlocked, false);
  assert.deepEqual(profile.inventory, {});
  assert.deepEqual(profile.completedMissions, []);
});

test("profile normalization migrates legacy fields, sanitizes values, and preserves progress", () => {
  const legacy = {
    name: "  Kyle  ",
    experience: xpForLevel(8),
    coins: 725,
    goldCoins: 14,
    silverCoins: 88,
    weapons: ["scout-rifle", "scout-rifle", "unknown-item"],
    storyMission: "c1-m1",
    maps: ["Fiery Inferno", "Unknown"],
    kingdomCreated: true,
    stats: { kills: 12, deaths: -4, survivalHighScore: 900 },
  };
  const profile = normalizeProfile(legacy);
  assert.equal(profile.version, CURRENT_PROFILE_VERSION);
  assert.equal(profile.name, "Kyle");
  assert.equal(profile.level, 8);
  assert.equal(profile.scrap, 725);
  assert.equal(profile.gold, 14);
  assert.equal(profile.silver, 88);
  assert.equal(profile.inventory["scout-rifle"], 2);
  assert.equal(profile.inventory["unknown-item"], undefined);
  assert.deepEqual(profile.completedMissions, ["c1-m1"]);
  assert.deepEqual(profile.unlockedMaps, ["Wasteland", "Toxic Pond", "Icy Mountain", "Fiery Inferno"]);
  assert.equal(profile.kingdom.unlocked, true);
  assert.equal(profile.stats.kills, 12);
  assert.equal(profile.stats.deaths, 0);
});

test("store catalog covers every required category with unique purchasable entries", () => {
  const categories = new Set(STORE_CATALOG.map(item => item.category));
  assert.deepEqual(categories, new Set([
    "weapons",
    "shields",
    "armor",
    "grenades",
    "health-kits",
    "tactical-upgrades",
  ]));
  assert.equal(new Set(STORE_CATALOG.map(item => item.id)).size, STORE_CATALOG.length);
  assert.ok(STORE_CATALOG.every(item => item.price > 0 && item.requiredLevel >= 1));
});

test("purchase validation rejects unknown, locked, unaffordable, and capped items", () => {
  const base = normalizeProfile({ level: 1, xp: 0, scrap: 50 });
  assert.equal(validatePurchase(base, "missing").reason, "unknown-item");
  assert.equal(validatePurchase(base, "heavy-armor").reason, "level-locked");
  assert.equal(validatePurchase(base, "scout-rifle").reason, "insufficient-scrap");

  const capped = normalizeProfile({
    level: 20,
    xp: xpForLevel(20),
    scrap: 5000,
    inventory: { "heavy-armor": 1 },
  });
  assert.equal(validatePurchase(capped, "heavy-armor").reason, "inventory-cap");
});

test("valid purchases deduct scrap and add inventory without mutating the input", () => {
  const profile = normalizeProfile({ scrap: 1000 });
  const result = applyPurchase(profile, "scout-rifle", 2);
  assert.equal(result.ok, true);
  assert.equal(result.profile.inventory["scout-rifle"], 2);
  assert.equal(result.profile.scrap, 1000 - (result.item.price * 2));
  assert.equal(profile.scrap, 1000);
  assert.deepEqual(profile.inventory, {});
});

test("survival scoring rewards kills, waves, time, and difficulty", () => {
  const easy = scoreSurvival({ kills: 10, waves: 3, secondsSurvived: 125, difficulty: "easy" });
  const expert = scoreSurvival({ kills: 10, waves: 3, secondsSurvived: 125, difficulty: "expert" });
  assert.ok(easy > 0);
  assert.ok(expert > easy);
  assert.equal(scoreSurvival({ kills: -1, waves: -2, secondsSurvived: -3 }), 0);
});

test("best-of-three elimination ends at two wins and uses points for ranking", () => {
  const result = evaluateEliminationSeries([
    { winner: "red", redPoints: 8, bluePoints: 4 },
    { winner: "blue", redPoints: 3, bluePoints: 9 },
    { winner: "red", redPoints: 6, bluePoints: 6 },
  ]);
  assert.equal(result.complete, true);
  assert.equal(result.winner, "red");
  assert.deepEqual(result.wins, { red: 2, blue: 1 });
  assert.deepEqual(result.ranking.map(team => team.team), ["red", "blue"]);
  assert.equal(evaluateEliminationSeries([{ winner: "red", redPoints: 2, bluePoints: 1 }]).complete, false);
});

test("five-minute CTF awards control seconds and captures and reports ties", () => {
  const active = evaluateCtfMatch({
    elapsedSeconds: 120,
    teams: { red: { controlSeconds: 30, captures: 1 }, blue: { controlSeconds: 40, captures: 0 } },
  });
  assert.equal(active.complete, false);
  assert.equal(active.scores.red, 90);
  assert.equal(active.scores.blue, 40);

  const tied = evaluateCtfMatch({
    elapsedSeconds: 999,
    teams: { red: { controlSeconds: 60 }, blue: { controlSeconds: 60 } },
  });
  assert.equal(tied.durationSeconds, 300);
  assert.equal(tied.complete, true);
  assert.equal(tied.winner, null);
  assert.equal(tied.tied, true);
});
