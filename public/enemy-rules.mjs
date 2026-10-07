const freezeProfile = profile => Object.freeze({ ...profile, affinities: Object.freeze({ ...profile.affinities }) });

export const ENEMY_ARCHETYPES = Object.freeze({
  rusher: freezeProfile({ role: "assault", health: 70, damage: 8, speed: 7.2, range: 3, unlockWave: 1, weight: 1.35, affinities: { wasteland: 1.25, toxic: 1, ice: 0.9, inferno: 1.1 } }),
  shooter: freezeProfile({ role: "midrange", health: 100, damage: 10, speed: 4.8, range: 22, unlockWave: 2, weight: 1.2, affinities: { wasteland: 1.15, toxic: 1, ice: 1, inferno: 1 } }),
  sniper: freezeProfile({ role: "range", health: 75, damage: 24, speed: 3.8, range: 48, unlockWave: 4, weight: 0.65, affinities: { wasteland: 1, toxic: 0.75, ice: 1.45, inferno: 0.9 } }),
  shield: freezeProfile({ role: "defense", health: 155, damage: 8, speed: 3.7, range: 13, unlockWave: 4, weight: 0.7, affinities: { wasteland: 1, toxic: 1.25, ice: 1.05, inferno: 0.9 } }),
  heavy: freezeProfile({ role: "tank", health: 240, damage: 18, speed: 2.8, range: 18, unlockWave: 6, weight: 0.55, affinities: { wasteland: 1.2, toxic: 0.95, ice: 0.9, inferno: 1.25 } }),
  drone: freezeProfile({ role: "flanker", health: 60, damage: 9, speed: 8.4, range: 19, unlockWave: 5, weight: 0.75, affinities: { wasteland: 0.9, toxic: 1.1, ice: 1.15, inferno: 1.3 } }),
  mutant: freezeProfile({ role: "bruiser", health: 190, damage: 20, speed: 5.3, range: 4, unlockWave: 7, weight: 0.55, affinities: { wasteland: 1, toxic: 1.55, ice: 0.7, inferno: 1.1 } }),
  boss: freezeProfile({ role: "boss", health: 900, damage: 32, speed: 3.4, range: 26, unlockWave: 10, weight: 0, affinities: { wasteland: 1, toxic: 1, ice: 1, inferno: 1 } })
});

const DIFFICULTY = Object.freeze({
  easy: Object.freeze({ growth: 0.1, pacing: 4 }),
  medium: Object.freeze({ growth: 0.22, pacing: 3 }),
  expert: Object.freeze({ growth: 0.35, pacing: 2.25 }),
  insane: Object.freeze({ growth: 0.75, pacing: 1.5 })
});

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
  return value;
}

function difficultyRules(name) {
  return DIFFICULTY[name] || DIFFICULTY.medium;
}

export function mapAffinity(type, map = "wasteland") {
  const profile = ENEMY_ARCHETYPES[type];
  if (!profile) return 0;
  return profile.affinities[map] ?? 1;
}

export function scaleEnemy(type, { wave = 1, difficulty = "medium", playerSkill = 1 } = {}) {
  const profile = ENEMY_ARCHETYPES[type];
  if (!profile) throw new RangeError(`Unknown enemy archetype: ${type}`);
  positiveInteger(wave, "wave");

  const skill = Math.max(0, Number(playerSkill) || 0);
  const growth = difficultyRules(difficulty).growth;
  const multiplier = 1 + ((wave - 1) * growth * 0.12) + (skill * growth * 0.1);

  return Object.freeze({
    type,
    role: profile.role,
    health: Math.round(profile.health * multiplier),
    damage: Math.round(profile.damage * (1 + (multiplier - 1) * 0.8) * 100) / 100,
    speed: Math.round(profile.speed * Math.min(1.35, 1 + (multiplier - 1) * 0.18) * 100) / 100,
    range: profile.range
  });
}

function weightedChoice(entries, random) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.min(0.999999999, Math.max(0, Number(random()) || 0)) * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.type;
  }
  return entries.at(-1).type;
}

export function composeWave({ wave, difficulty = "medium", map = "wasteland", playerCount = 1, random = Math.random } = {}) {
  positiveInteger(wave, "wave");
  const players = Math.max(1, Math.floor(Number(playerCount) || 1));
  const difficultyBonus = { easy: 0, medium: 1, expert: 2, insane: 3 }[difficulty] ?? 1;
  const count = 1 + Math.ceil(wave * 0.75) + Math.floor((players - 1) * 1.5) + Math.floor(difficultyBonus / 2);
  const available = Object.entries(ENEMY_ARCHETYPES)
    .filter(([type, profile]) => type !== "boss" && profile.unlockWave <= wave)
    .map(([type, profile]) => ({ type, weight: profile.weight * mapAffinity(type, map) }));
  const composition = Array.from({ length: count }, () => weightedChoice(available, random));
  if (wave % 10 === 0) composition.push("boss");
  return composition;
}

export function tacticalIntent(type, {
  distance = Infinity,
  healthRatio = 1,
  hasLineOfSight = false,
  allyCount = 0
} = {}) {
  const profile = ENEMY_ARCHETYPES[type];
  if (!profile) throw new RangeError(`Unknown enemy archetype: ${type}`);
  if (healthRatio <= 0.2 && type !== "boss" && type !== "shield") return "retreat";
  if (type === "sniper" && distance < profile.range * 0.35) return "retreat";
  if (type === "shield" && hasLineOfSight && distance <= profile.range * 1.5) return "hold";
  if ((type === "shooter" || type === "drone") && (!hasLineOfSight || allyCount >= 2)) return "flank";
  if (type === "sniper" && hasLineOfSight) return "hold";
  return "advance";
}

export function spawnSchedule({ enemyCount, wave = 1, difficulty = "medium", startAt = 0 } = {}) {
  if (!Number.isInteger(enemyCount) || enemyCount < 0) throw new RangeError("enemyCount must be a non-negative integer");
  positiveInteger(wave, "wave");
  const first = Math.max(0, Number(startAt) || 0);
  const waveAcceleration = Math.max(0.55, 1 - ((wave - 1) * 0.035));
  const interval = Math.max(0.75, difficultyRules(difficulty).pacing * waveAcceleration);
  return Array.from({ length: enemyCount }, (_, index) => Math.round((first + index * interval) * 1000) / 1000);
}
