export const CURRENT_STORY_SNAPSHOT_VERSION = 2;

const EXIT_REASONS = new Set(["pause-exit", "death-exit"]);
const DIFFICULTIES = new Set(["easy", "medium", "expert", "insane"]);
const STORY_MAP_GATES = Object.freeze([
  Object.freeze({ key: "wasteland", level: 1, stage: 1, difficulty: "easy", difficultyRatio: 0.1 }),
  Object.freeze({ key: "toxic", level: 5, stage: 3, difficulty: "medium", difficultyRatio: 0.22 }),
  Object.freeze({ key: "ice", level: 10, stage: 6, difficulty: "expert", difficultyRatio: 0.35 }),
  Object.freeze({ key: "inferno", level: 15, stage: 10, difficulty: "insane", difficultyRatio: 0.75 }),
]);
const PRIVATE_KEY = /(?:phone|email|birth|pin|pass|token|secret|account|ip|location)/i;

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, fallback = "", limit = 80) {
  return typeof value === "string" ? value.trim().slice(0, limit) : fallback;
}

function integer(value, fallback = 0, minimum = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(minimum, Math.floor(numeric)) : fallback;
}

function numericMap(value) {
  const result = {};
  for (const [key, amount] of Object.entries(record(value))) {
    const safeKey = text(key, "", 64);
    if (!safeKey || PRIVATE_KEY.test(safeKey)) continue;
    const safeAmount = integer(amount);
    if (safeAmount > 0) result[safeKey] = safeAmount;
  }
  return result;
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => text(item, "", 64)).filter(Boolean))];
}

function safeDate(now) {
  const value = typeof now === "function" ? now() : Date.now();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function chapterFromMission(mission, fallback = 1) {
  const match = /^c(\d+)-m\d+$/i.exec(text(mission));
  return match ? integer(match[1], fallback, 1) : integer(fallback, 1, 1);
}

function safeKingdom(value, legacyUnlocked = false) {
  const source = record(value);
  return {
    unlocked: source.unlocked === true || legacyUnlocked === true,
    name: text(source.name, "", 32),
    level: integer(source.level),
  };
}

function safeProgress(source) {
  const input = record(source);
  return {
    chapter: integer(input.chapter, 1, 1),
    mission: text(input.mission, "c1-m1", 32),
    map: text(input.map, "Wasteland", 64),
    wave: integer(input.wave, 1, 1),
    stage: integer(input.stage, 1, 1),
    level: integer(input.level, 1, 1),
    xp: integer(input.xp),
    scrap: integer(input.scrap),
    kills: integer(input.kills),
    unlockedMaps: stringList(input.unlockedMaps),
    weaponLevels: numericMap(input.weaponLevels),
    inventory: numericMap(input.inventory),
    shieldUpgrades: numericMap(input.shieldUpgrades),
    tacticalUpgrades: numericMap(input.tacticalUpgrades),
    kingdom: safeKingdom(input.kingdom),
    difficulty: DIFFICULTIES.has(input.difficulty) ? input.difficulty : "medium",
  };
}

function safeResume(source, progress) {
  const checkpoint = record(source);
  return {
    kind: "safe-checkpoint",
    activeCombat: false,
    chapter: integer(checkpoint.chapter, progress.chapter, 1),
    mission: text(checkpoint.mission, progress.mission, 32),
    map: text(checkpoint.map, progress.map, 64),
    wave: integer(checkpoint.wave, progress.wave, 1),
    stage: integer(checkpoint.stage, progress.stage, 1),
    checkpointId: text(checkpoint.id ?? checkpoint.checkpointId, "chapter-start", 64),
  };
}

function makeSnapshot(source, { reason, now, checkpoint } = {}) {
  const progress = safeProgress(source);
  const resume = safeResume(checkpoint ?? source.checkpoint, progress);
  return {
    version: CURRENT_STORY_SNAPSHOT_VERSION,
    savedAt: safeDate(now),
    player: {
      profileId: text(source.profileId ?? source.playerId, "local-player", 80),
      classId: text(source.classId ?? source.class, "scout", 32),
      avatarId: text(source.avatarId ?? source.avatar, "scout-v1", 64),
    },
    progress,
    resume,
    exit: {
      reason: EXIT_REASONS.has(reason) ? reason : "pause-exit",
      died: reason === "death-exit",
    },
    returnIntent: { screen: "main-lobby", multiplayerSelectable: true },
  };
}

export function buildStorySnapshot(state = {}, options = {}) {
  return makeSnapshot(record(state), options);
}

export function canSaveAndExitStory({ mode, state } = {}) {
  if (mode !== "story") return { available: false, reason: "story-mode-only" };
  if (state !== "paused" && state !== "dead") {
    return { available: false, reason: "pause-or-death-required" };
  }
  return { available: true, reason: null };
}

export function deriveStoryCampaignState({ level = 1 } = {}) {
  const safeLevel = integer(level, 1, 1);
  const furthestByLevel = STORY_MAP_GATES.reduce(
    (result, gate, index) => safeLevel >= gate.level ? index : result,
    0,
  );
  const gate = STORY_MAP_GATES[furthestByLevel];
  return {
    availableMaps: STORY_MAP_GATES.slice(0, furthestByLevel + 1).map(entry => entry.key),
    recommendedMap: gate.key,
    difficulty: gate.difficulty,
    difficultyRatio: gate.difficultyRatio,
  };
}

export function deriveContinueStorySummary(value) {
  const validation = validateStorySnapshot(value);
  if (!validation.ok) return null;
  const snapshot = validation.snapshot;
  return {
    available: true,
    chapter: snapshot.resume.chapter,
    mission: snapshot.resume.mission,
    map: snapshot.resume.map,
    stage: snapshot.resume.stage,
    level: snapshot.progress.level,
    difficulty: snapshot.progress.difficulty,
    savedAt: snapshot.savedAt,
    wasDeathExit: snapshot.exit.reason === "death-exit",
    resumeKind: snapshot.resume.kind,
  };
}

function maxMap(left, right) {
  const result = { ...numericMap(left) };
  for (const [key, value] of Object.entries(numericMap(right))) {
    result[key] = Math.max(result[key] || 0, value);
  }
  return result;
}

export function mergeStorySnapshot(currentProgress = {}, value) {
  const validation = validateStorySnapshot(value);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason, progress: null, resume: null };
  }
  const snapshot = validation.snapshot;
  const current = safeProgress(currentProgress);
  const saved = snapshot.progress;
  const currentIsFurther = current.chapter > saved.chapter
    || (current.chapter === saved.chapter && current.stage > saved.stage)
    || (current.chapter === saved.chapter && current.stage === saved.stage && current.wave > saved.wave);
  const position = currentIsFurther ? current : saved;
  const kingdomUnlocked = current.kingdom.unlocked || saved.kingdom.unlocked;
  const progress = {
    ...position,
    level: Math.max(current.level, saved.level),
    xp: Math.max(current.xp, saved.xp),
    scrap: Math.max(current.scrap, saved.scrap),
    kills: Math.max(current.kills, saved.kills),
    unlockedMaps: [...new Set([...current.unlockedMaps, ...saved.unlockedMaps])],
    weaponLevels: maxMap(current.weaponLevels, saved.weaponLevels),
    inventory: maxMap(current.inventory, saved.inventory),
    shieldUpgrades: maxMap(current.shieldUpgrades, saved.shieldUpgrades),
    tacticalUpgrades: maxMap(current.tacticalUpgrades, saved.tacticalUpgrades),
    kingdom: {
      unlocked: kingdomUnlocked,
      name: current.kingdom.name || saved.kingdom.name,
      level: Math.max(current.kingdom.level, saved.kingdom.level),
    },
  };
  const resume = {
    ...snapshot.resume,
    activeCombat: false,
    chapter: progress.chapter,
    mission: progress.mission,
    map: progress.map,
    wave: progress.wave,
    stage: progress.stage,
  };
  return { ok: true, reason: null, progress, resume, snapshot };
}

export function migrateStorySnapshot(value) {
  const source = record(value);
  if (source.version === CURRENT_STORY_SNAPSHOT_VERSION) return source;
  if (source.version !== 1) return null;

  const mission = text(source.storyMission, "c1-m1", 32);
  const chapter = integer(source.chapter, chapterFromMission(mission), 1);
  const stage = integer(source.storyStage ?? source.stage, 1, 1);
  const progress = {
    chapter,
    mission,
    map: source.map,
    wave: source.wave,
    stage,
    level: source.level,
    xp: source.experience ?? source.xp,
    scrap: source.coins ?? source.scrap,
    kills: source.kills,
    classId: source.class,
    avatarId: source.avatar,
    unlockedMaps: source.maps ?? source.unlockedMaps,
    weaponLevels: source.guns ?? source.weaponLevels,
    inventory: source.inventory,
    shieldUpgrades: { ...record(source.shieldUpgrades), level: source.shieldLevel ?? record(source.shieldUpgrades).level },
    tacticalUpgrades: source.tactical ?? source.tacticalUpgrades,
    kingdom: safeKingdom(source.kingdom, source.kingdomUnlocked),
    difficulty: source.difficulty,
    checkpoint: {
      id: source.checkpointId ?? "legacy-checkpoint",
      chapter,
      mission,
      map: source.map,
      wave: source.checkpointWave ?? source.wave,
      stage,
    },
  };
  return makeSnapshot({
    ...progress,
    profileId: source.playerId ?? source.profileId,
    classId: source.class,
    avatarId: source.avatar,
  }, {
    reason: source.exitReason === "death-exit" ? "death-exit" : "pause-exit",
    now: () => source.savedAt,
    checkpoint: progress.checkpoint,
  });
}

export function validateStorySnapshot(value) {
  const snapshot = migrateStorySnapshot(value);
  if (!snapshot) return { ok: false, reason: "unsupported-version", snapshot: null };
  if (snapshot.version !== CURRENT_STORY_SNAPSHOT_VERSION) {
    return { ok: false, reason: "unsupported-version", snapshot: null };
  }
  const savedAt = new Date(snapshot.savedAt);
  const valid = !Number.isNaN(savedAt.getTime())
    && text(snapshot.player?.profileId).length > 0
    && EXIT_REASONS.has(snapshot.exit?.reason)
    && snapshot.returnIntent?.screen === "main-lobby"
    && snapshot.returnIntent?.multiplayerSelectable === true
    && snapshot.resume?.kind === "safe-checkpoint"
    && snapshot.resume?.activeCombat === false
    && integer(snapshot.resume?.chapter, 0) >= 1
    && integer(snapshot.progress?.chapter, 0) >= 1
    && text(snapshot.progress?.mission).length > 0
    && text(snapshot.progress?.map).length > 0;
  if (!valid) return { ok: false, reason: "corrupt-snapshot", snapshot: null };

  const clean = makeSnapshot({
    ...record(snapshot.progress),
    profileId: snapshot.player.profileId,
    classId: snapshot.player.classId,
    avatarId: snapshot.player.avatarId,
  }, {
    reason: snapshot.exit.reason,
    now: () => snapshot.savedAt,
    checkpoint: snapshot.resume,
  });
  return { ok: true, reason: null, snapshot: clean };
}
