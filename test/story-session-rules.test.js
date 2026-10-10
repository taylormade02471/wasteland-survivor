import test from "node:test";
import assert from "node:assert/strict";

import {
  CURRENT_STORY_SNAPSHOT_VERSION,
  buildStorySnapshot,
  canSaveAndExitStory,
  deriveContinueStorySummary,
  deriveStoryCampaignState,
  mergeStorySnapshot,
  migrateStorySnapshot,
  validateStorySnapshot,
} from "../public/story-session-rules.mjs";

function storyState(overrides = {}) {
  return {
    profileId: "player-local-7f2q",
    chapter: 2,
    mission: "c2-m1",
    map: "Toxic Pond",
    wave: 7,
    stage: 3,
    level: 8,
    xp: 25000,
    scrap: 725,
    kills: 41,
    classId: "ranger",
    avatarId: "ranger-v1",
    unlockedMaps: ["Wasteland", "Toxic Pond"],
    weaponLevels: { "scout-rifle": 12, "breacher-cannon": 3 },
    inventory: { "health-kit": 2, "frag-grenade": 1 },
    shieldUpgrades: { level: 4, capacity: 80 },
    tacticalUpgrades: { "motion-sensor": 2 },
    kingdom: { unlocked: false, name: "", level: 0 },
    difficulty: "expert",
    checkpoint: { id: "toxic-pump", chapter: 2, mission: "c2-m1", map: "Toxic Pond", wave: 6, stage: 3 },
    ...overrides,
  };
}

test("pause exit builds a versioned JSON-safe checkpoint and returns to the lobby", () => {
  const snapshot = buildStorySnapshot(storyState({
    bullets: [{ id: "transient" }],
    enemies: [{ id: "transient" }],
  }), { reason: "pause-exit", now: () => 1735689600000 });

  assert.equal(snapshot.version, CURRENT_STORY_SNAPSHOT_VERSION);
  assert.equal(snapshot.savedAt, "2025-01-01T00:00:00.000Z");
  assert.equal(snapshot.exit.reason, "pause-exit");
  assert.deepEqual(snapshot.returnIntent, { screen: "main-lobby", multiplayerSelectable: true });
  assert.deepEqual(snapshot.resume, {
    kind: "safe-checkpoint",
    activeCombat: false,
    chapter: 2,
    mission: "c2-m1",
    map: "Toxic Pond",
    wave: 6,
    stage: 3,
    checkpointId: "toxic-pump",
  });
  assert.equal("bullets" in snapshot, false);
  assert.equal("enemies" in snapshot, false);
  assert.doesNotThrow(() => JSON.stringify(snapshot));
  assert.equal(validateStorySnapshot(snapshot).ok, true);
});

test("death exit preserves permanent earnings but cannot resume active combat", () => {
  const snapshot = buildStorySnapshot(storyState({
    wave: 9,
    xp: 31000,
    scrap: 990,
    kills: 55,
    health: 0,
  }), { reason: "death-exit", now: () => "2026-10-07T12:00:00.000Z" });

  assert.equal(snapshot.exit.reason, "death-exit");
  assert.equal(snapshot.progress.xp, 31000);
  assert.equal(snapshot.progress.scrap, 990);
  assert.equal(snapshot.progress.kills, 55);
  assert.equal(snapshot.resume.activeCombat, false);
  assert.equal(snapshot.resume.kind, "safe-checkpoint");
  assert.equal(snapshot.resume.wave, 6);
  assert.equal("health" in snapshot.progress, false);
});

test("builder strips private identity fields at every depth", () => {
  const snapshot = buildStorySnapshot(storyState({
    phone: "+15555550123",
    email: "private@example.com",
    birthday: "2000-01-01",
    pin: "1234",
    token: "secret",
    ip: "203.0.113.4",
    location: "home",
    kingdom: { unlocked: true, name: "New Dawn", level: 2, accountToken: "secret" },
    inventory: { "health-kit": 2, phone: 999 },
  }), { reason: "pause-exit" });

  const serialized = JSON.stringify(snapshot).toLowerCase();
  for (const privateValue of ["private@example.com", "+15555550123", "2000-01-01", "1234", "secret", "203.0.113.4", "home"]) {
    assert.equal(serialized.includes(privateValue.toLowerCase()), false);
  }
  for (const privateKey of ["phone", "email", "birthday", "pin", "token", "ip", "location"]) {
    assert.equal(serialized.includes(`\"${privateKey}\"`), false);
  }
});

test("stale snapshots merge without rolling newer permanent progress backward", () => {
  const snapshot = buildStorySnapshot(storyState({
    chapter: 2,
    level: 8,
    xp: 25000,
    scrap: 725,
    kills: 41,
    unlockedMaps: ["Wasteland", "Toxic Pond"],
    weaponLevels: { "scout-rifle": 12 },
    inventory: { "health-kit": 2 },
    shieldUpgrades: { level: 4 },
    tacticalUpgrades: { "motion-sensor": 2 },
  }), { reason: "pause-exit" });
  const current = {
    chapter: 4,
    mission: "c4-m1",
    map: "Fiery Inferno",
    wave: 18,
    stage: 8,
    level: 20,
    xp: 180500,
    scrap: 4200,
    kills: 300,
    unlockedMaps: ["Wasteland", "Toxic Pond", "Icy Mountain", "Fiery Inferno"],
    weaponLevels: { "scout-rifle": 20, "inferno-launcher": 5 },
    inventory: { "health-kit": 8, "frag-grenade": 4 },
    shieldUpgrades: { level: 7 },
    tacticalUpgrades: { "motion-sensor": 4 },
    kingdom: { unlocked: true, name: "Citadel", level: 3 },
  };

  const merged = mergeStorySnapshot(current, snapshot);
  assert.equal(merged.ok, true);
  assert.equal(merged.progress.level, 20);
  assert.equal(merged.progress.xp, 180500);
  assert.equal(merged.progress.scrap, 4200);
  assert.equal(merged.progress.kills, 300);
  assert.equal(merged.progress.weaponLevels["scout-rifle"], 20);
  assert.equal(merged.progress.weaponLevels["inferno-launcher"], 5);
  assert.equal(merged.progress.inventory["health-kit"], 8);
  assert.equal(merged.progress.kingdom.unlocked, true);
  assert.equal(merged.progress.kingdom.name, "Citadel");
  assert.equal(merged.resume.activeCombat, false);
});

test("corrupted and unsupported snapshots fail closed", () => {
  for (const value of [null, "not-json", { version: 999 }, { version: CURRENT_STORY_SNAPSHOT_VERSION, progress: {} }]) {
    const validation = validateStorySnapshot(value);
    assert.equal(validation.ok, false);
    assert.equal(validation.snapshot, null);
    assert.equal(mergeStorySnapshot({ xp: 10 }, value).ok, false);
    assert.equal(deriveContinueStorySummary(value), null);
  }
});

test("version migration upgrades a legacy snapshot and strips unsafe fields", () => {
  const legacy = {
    version: 1,
    playerId: "legacy-player",
    storyStage: 4,
    missionIndex: 1,
    storyMission: "c3-m2",
    map: "Icy Mountain",
    wave: 11,
    level: 12,
    experience: 60500,
    coins: 1300,
    kills: 88,
    class: "heavy",
    avatar: "heavy-v1",
    maps: ["Wasteland", "Toxic Pond", "Icy Mountain"],
    guns: { gun1: 20, gun2: 6 },
    inventory: { "health-kit": 3 },
    shieldLevel: 5,
    tactical: { "motion-sensor": 1 },
    kingdomUnlocked: false,
    difficulty: "medium",
    savedAt: "2026-01-02T03:04:05.000Z",
    email: "must-not-survive@example.com",
  };

  const migrated = migrateStorySnapshot(legacy);
  assert.equal(migrated.version, CURRENT_STORY_SNAPSHOT_VERSION);
  assert.equal(migrated.player.profileId, "legacy-player");
  assert.equal(migrated.progress.stage, 4);
  assert.equal(migrated.progress.mission, "c3-m2");
  assert.equal(migrated.progress.xp, 60500);
  assert.equal(migrated.progress.scrap, 1300);
  assert.deepEqual(migrated.progress.weaponLevels, { gun1: 20, gun2: 6 });
  assert.equal(migrated.progress.shieldUpgrades.level, 5);
  assert.equal(JSON.stringify(migrated).includes("must-not-survive"), false);
  assert.equal(validateStorySnapshot(migrated).ok, true);
});

test("continue summary exposes checkpoint details without private identity", () => {
  const snapshot = buildStorySnapshot(storyState(), { reason: "pause-exit", now: () => 1735689600000 });
  assert.deepEqual(deriveContinueStorySummary(snapshot), {
    available: true,
    chapter: 2,
    mission: "c2-m1",
    map: "Toxic Pond",
    stage: 3,
    level: 8,
    difficulty: "expert",
    savedAt: "2025-01-01T00:00:00.000Z",
    wasDeathExit: false,
    resumeKind: "safe-checkpoint",
  });
});

test("Save & Exit is limited to active story pause or death states", () => {
  assert.deepEqual(canSaveAndExitStory({ mode: "story", state: "paused" }), { available: true, reason: null });
  assert.deepEqual(canSaveAndExitStory({ mode: "story", state: "dead" }), { available: true, reason: null });
  assert.deepEqual(canSaveAndExitStory({ mode: "story", state: "playing" }), { available: false, reason: "pause-or-death-required" });
  assert.deepEqual(canSaveAndExitStory({ mode: "multiplayer", state: "paused" }), { available: false, reason: "story-mode-only" });
});

test("story map and difficulty progression follow permanent player level", () => {
  assert.deepEqual(deriveStoryCampaignState({ level: 1, stage: 1 }), {
    availableMaps: ["wasteland"], recommendedMap: "wasteland", difficulty: "easy", difficultyRatio: 0.1,
  });
  assert.deepEqual(deriveStoryCampaignState({ level: 7, stage: 3 }), {
    availableMaps: ["wasteland", "toxic"], recommendedMap: "toxic", difficulty: "medium", difficultyRatio: 0.22,
  });
  assert.deepEqual(deriveStoryCampaignState({ level: 12, stage: 6 }), {
    availableMaps: ["wasteland", "toxic", "ice"], recommendedMap: "ice", difficulty: "expert", difficultyRatio: 0.35,
  });
  assert.deepEqual(deriveStoryCampaignState({ level: 25, stage: 12 }), {
    availableMaps: ["wasteland", "toxic", "ice", "inferno"], recommendedMap: "inferno", difficulty: "insane", difficultyRatio: 0.75,
  });
  assert.equal(deriveStoryCampaignState({ level: 15, stage: 1 }).recommendedMap, "inferno");
});
