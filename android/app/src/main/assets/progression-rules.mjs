export const CURRENT_PROFILE_VERSION = 2;
export const KINGDOM_UNLOCK_LEVEL = 25;
export const CTF_DURATION_SECONDS = 300;

export const MAP_UNLOCKS = Object.freeze([
  Object.freeze({ map: "Wasteland", level: 1 }),
  Object.freeze({ map: "Toxic Pond", level: 5 }),
  Object.freeze({ map: "Icy Mountain", level: 10 }),
  Object.freeze({ map: "Fiery Inferno", level: 15 }),
]);

export const STORY_CHAPTERS = Object.freeze([
  Object.freeze({
    id: 1,
    title: "First Watch",
    map: "Wasteland",
    unlockLevel: 1,
    missions: Object.freeze([
      Object.freeze({ id: "c1-m1", title: "Wake the Outpost", objective: "Restore the abandoned relay." }),
      Object.freeze({ id: "c1-m2", title: "Hold the Line", objective: "Survive the first raider assault." }),
    ]),
  }),
  Object.freeze({
    id: 2,
    title: "Poisoned Ground",
    map: "Toxic Pond",
    unlockLevel: 5,
    missions: Object.freeze([
      Object.freeze({ id: "c2-m1", title: "The Green Shore", objective: "Reach the flooded pumping station." }),
      Object.freeze({ id: "c2-m2", title: "Clean Water", objective: "Defend the purifier during startup." }),
    ]),
  }),
  Object.freeze({
    id: 3,
    title: "White Signal",
    map: "Icy Mountain",
    unlockLevel: 10,
    missions: Object.freeze([
      Object.freeze({ id: "c3-m1", title: "Frozen Ascent", objective: "Climb to the mountain transmitter." }),
      Object.freeze({ id: "c3-m2", title: "Storm Warning", objective: "Protect the signal through the blizzard." }),
    ]),
  }),
  Object.freeze({
    id: 4,
    title: "Ash Kingdom",
    map: "Fiery Inferno",
    unlockLevel: 15,
    missions: Object.freeze([
      Object.freeze({ id: "c4-m1", title: "Across the Cinders", objective: "Cross the burning industrial district." }),
      Object.freeze({ id: "c4-m2", title: "Crown of Steel", objective: "Secure the fortress core." }),
    ]),
  }),
]);

export const STORE_CATALOG = Object.freeze([
  Object.freeze({ id: "scout-rifle", name: "Scout Rifle", category: "weapons", price: 250, requiredLevel: 1, maxOwned: 100 }),
  Object.freeze({ id: "breacher-cannon", name: "Breacher Cannon", category: "weapons", price: 700, requiredLevel: 6, maxOwned: 25 }),
  Object.freeze({ id: "inferno-launcher", name: "Inferno Launcher", category: "weapons", price: 1200, requiredLevel: 9, maxOwned: 50 }),
  Object.freeze({ id: "scrap-shield", name: "Scrap Shield", category: "shields", price: 300, requiredLevel: 2, maxOwned: 10 }),
  Object.freeze({ id: "heavy-armor", name: "Heavy Armor", category: "armor", price: 900, requiredLevel: 8, maxOwned: 1 }),
  Object.freeze({ id: "frag-grenade", name: "Frag Grenade", category: "grenades", price: 90, requiredLevel: 2, maxOwned: 20 }),
  Object.freeze({ id: "health-kit", name: "Health Kit", category: "health-kits", price: 110, requiredLevel: 1, maxOwned: 20 }),
  Object.freeze({ id: "motion-sensor", name: "Motion Sensor", category: "tactical-upgrades", price: 450, requiredLevel: 4, maxOwned: 5 }),
]);

const CATALOG_BY_ID = new Map(STORE_CATALOG.map(item => [item.id, item]));
const MISSION_IDS = new Set(STORY_CHAPTERS.flatMap(chapter => chapter.missions.map(mission => mission.id)));
const MAP_ORDER = new Map(MAP_UNLOCKS.map((entry, index) => [entry.map, index]));
const DIFFICULTY_MULTIPLIERS = Object.freeze({ easy: 1, medium: 1.25, expert: 1.6, insane: 2.25 });

function finiteNonNegative(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
}

function wholeNonNegative(value, fallback = 0) {
  return Math.floor(finiteNonNegative(value, fallback));
}

function cleanName(value) {
  return typeof value === "string" ? value.trim().slice(0, 32) : "Survivor";
}

export function xpForLevel(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return 500 * ((safeLevel - 1) ** 2);
}

export function levelFromXp(xp) {
  const safeXp = finiteNonNegative(xp);
  return Math.max(1, Math.floor(Math.sqrt(safeXp / 500)) + 1);
}

export function unlockedMaps(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return MAP_UNLOCKS.filter(entry => safeLevel >= entry.level).map(entry => entry.map);
}

export function kingdomUnlocked(level) {
  return Math.max(1, Math.floor(Number(level) || 1)) >= KINGDOM_UNLOCK_LEVEL;
}

function normalizeInventory(source) {
  const inventory = {};
  if (source && typeof source === "object" && !Array.isArray(source)) {
    for (const [id, quantity] of Object.entries(source)) {
      const item = CATALOG_BY_ID.get(id);
      if (!item) continue;
      const safeQuantity = Math.min(item.maxOwned, wholeNonNegative(quantity));
      if (safeQuantity > 0) inventory[id] = safeQuantity;
    }
  }
  return inventory;
}

function addLegacyWeapons(inventory, weapons) {
  if (!Array.isArray(weapons)) return inventory;
  const migrated = { ...inventory };
  for (const id of weapons) {
    const item = CATALOG_BY_ID.get(id);
    if (!item || item.category !== "weapons") continue;
    migrated[id] = Math.min(item.maxOwned, (migrated[id] || 0) + 1);
  }
  return migrated;
}

function normalizeStats(stats = {}) {
  return {
    kills: wholeNonNegative(stats.kills),
    deaths: wholeNonNegative(stats.deaths),
    matches: wholeNonNegative(stats.matches),
    wins: wholeNonNegative(stats.wins),
    survivalHighScore: wholeNonNegative(stats.survivalHighScore),
    ctfHighScore: wholeNonNegative(stats.ctfHighScore),
  };
}

export function normalizeProfile(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const suppliedXp = source.xp ?? source.experience;
  const xp = suppliedXp == null ? xpForLevel(source.level) : wholeNonNegative(suppliedXp);
  const level = levelFromXp(xp);
  const scrap = wholeNonNegative(source.scrap ?? source.coins);
  const inventory = addLegacyWeapons(normalizeInventory(source.inventory), source.weapons);

  const missionCandidates = [
    ...(Array.isArray(source.completedMissions) ? source.completedMissions : []),
    ...(typeof source.storyMission === "string" ? [source.storyMission] : []),
  ];
  const completedMissions = [...new Set(missionCandidates.filter(id => MISSION_IDS.has(id)))];

  const mapCandidates = [
    ...unlockedMaps(level),
    ...(Array.isArray(source.unlockedMaps) ? source.unlockedMaps : []),
    ...(Array.isArray(source.maps) ? source.maps : []),
  ];
  const validMapCandidates = mapCandidates.filter(map => MAP_ORDER.has(map));
  const furthestMapIndex = validMapCandidates.reduce(
    (furthest, map) => Math.max(furthest, MAP_ORDER.get(map)),
    0,
  );
  const maps = MAP_UNLOCKS
    .slice(0, furthestMapIndex + 1)
    .map(entry => entry.map)
    .concat(validMapCandidates)
    .filter((map, index, values) => values.indexOf(map) === index)
    .sort(
    (left, right) => MAP_ORDER.get(left) - MAP_ORDER.get(right),
  );
  const legacyKingdom = source.kingdomCreated === true || source.kingdom?.unlocked === true;

  return {
    version: CURRENT_PROFILE_VERSION,
    name: cleanName(source.name) || "Survivor",
    xp,
    level,
    scrap,
    unlockedMaps: maps,
    completedMissions,
    inventory,
    kingdom: {
      unlocked: legacyKingdom || kingdomUnlocked(level),
      name: typeof source.kingdom?.name === "string" ? source.kingdom.name.trim().slice(0, 32) : "",
    },
    stats: normalizeStats(source.stats),
  };
}

export function validatePurchase(profile, itemId, quantity = 1) {
  const item = CATALOG_BY_ID.get(itemId);
  if (!item) return { ok: false, reason: "unknown-item", item: null, totalPrice: 0 };

  const amount = Number(quantity);
  if (!Number.isInteger(amount) || amount < 1) {
    return { ok: false, reason: "invalid-quantity", item, totalPrice: 0 };
  }

  const normalized = normalizeProfile(profile);
  if (normalized.level < item.requiredLevel) {
    return { ok: false, reason: "level-locked", item, totalPrice: item.price * amount };
  }
  if ((normalized.inventory[item.id] || 0) + amount > item.maxOwned) {
    return { ok: false, reason: "inventory-cap", item, totalPrice: item.price * amount };
  }

  const totalPrice = item.price * amount;
  if (normalized.scrap < totalPrice) {
    return { ok: false, reason: "insufficient-scrap", item, totalPrice };
  }
  return { ok: true, reason: null, item, totalPrice };
}

export function applyPurchase(profile, itemId, quantity = 1) {
  const normalized = normalizeProfile(profile);
  const validation = validatePurchase(normalized, itemId, quantity);
  if (!validation.ok) return { ...validation, profile: normalized };

  return {
    ...validation,
    profile: {
      ...normalized,
      scrap: normalized.scrap - validation.totalPrice,
      inventory: {
        ...normalized.inventory,
        [itemId]: (normalized.inventory[itemId] || 0) + quantity,
      },
    },
  };
}

export function scoreSurvival({ kills = 0, waves = 0, secondsSurvived = 0, difficulty = "easy" } = {}) {
  const base = (wholeNonNegative(kills) * 100)
    + (wholeNonNegative(waves) * 250)
    + (Math.floor(finiteNonNegative(secondsSurvived) / 10) * 10);
  return Math.round(base * (DIFFICULTY_MULTIPLIERS[difficulty] || DIFFICULTY_MULTIPLIERS.easy));
}

export function evaluateEliminationSeries(rounds = []) {
  const wins = { red: 0, blue: 0 };
  const points = { red: 0, blue: 0 };
  let roundsPlayed = 0;

  for (const round of Array.isArray(rounds) ? rounds.slice(0, 3) : []) {
    if (wins.red === 2 || wins.blue === 2) break;
    points.red += wholeNonNegative(round?.redPoints);
    points.blue += wholeNonNegative(round?.bluePoints);
    if (round?.winner === "red" || round?.winner === "blue") wins[round.winner] += 1;
    roundsPlayed += 1;
  }

  const complete = wins.red === 2 || wins.blue === 2 || roundsPlayed === 3;
  let winner = wins.red === 2 ? "red" : wins.blue === 2 ? "blue" : null;
  if (complete && !winner && points.red !== points.blue) winner = points.red > points.blue ? "red" : "blue";
  const ranking = ["red", "blue"]
    .map(team => ({ team, wins: wins[team], points: points[team] }))
    .sort((left, right) => right.wins - left.wins || right.points - left.points || left.team.localeCompare(right.team));

  return { complete, winner, tied: complete && winner === null, roundsPlayed, wins, points, ranking };
}

export function evaluateCtfMatch({ elapsedSeconds = 0, teams = {} } = {}) {
  const durationSeconds = Math.min(CTF_DURATION_SECONDS, finiteNonNegative(elapsedSeconds));
  const scores = {};
  for (const [team, result] of Object.entries(teams && typeof teams === "object" ? teams : {})) {
    scores[team] = wholeNonNegative(result?.controlSeconds) + (wholeNonNegative(result?.captures) * 60);
  }

  const complete = durationSeconds >= CTF_DURATION_SECONDS;
  const ranked = Object.entries(scores).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const tied = complete && ranked.length > 1 && ranked[0][1] === ranked[1][1];
  const winner = complete && ranked.length > 0 && !tied ? ranked[0][0] : null;
  return {
    complete,
    winner,
    tied,
    durationSeconds,
    remainingSeconds: Math.max(0, CTF_DURATION_SECONDS - durationSeconds),
    scores,
    ranking: ranked.map(([team, score]) => ({ team, score })),
  };
}
