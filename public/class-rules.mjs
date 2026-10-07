export const DEFAULT_CLASS_ID = "scout";
export const CLASS_IDS = Object.freeze(["scout", "ranger", "heavy", "tech"]);

const rawDefinitions = {
  scout: {
    id: "scout",
    label: "Scout",
    baseStats: { maxHealth: 100, maxShield: 35, moveSpeedMultiplier: 1.16, spreadMultiplier: 1, scrapMultiplier: 1 },
    passive: { id: "light-footed", label: "Light Footed", description: "Moves faster than every other class." },
    ability: { id: "dash", label: "Dash", description: "Burst quickly in the current movement direction.", durationMs: 700, cooldownMs: 12000, modifiers: { moveSpeedMultiplier: 1.85 } },
    upgrades: [
      { id: "fleetFoot", label: "Fleet Foot", description: "Increase movement speed.", maxRank: 3, cost: 1, stat: "moveSpeedMultiplier", perRank: 0.04 },
      { id: "trailArmor", label: "Trail Armor", description: "Increase maximum health.", maxRank: 3, cost: 1, stat: "maxHealth", perRank: 6 },
      { id: "dashCapacitor", label: "Dash Capacitor", description: "Reduce Dash cooldown.", maxRank: 3, cost: 1, stat: "abilityCooldownMultiplier", perRank: -0.08 },
    ],
  },
  ranger: {
    id: "ranger",
    label: "Ranger",
    baseStats: { maxHealth: 105, maxShield: 40, moveSpeedMultiplier: 1, spreadMultiplier: 0.76, scrapMultiplier: 1 },
    passive: { id: "steady-aim", label: "Steady Aim", description: "Has reduced weapon spread and steadier long-range aim." },
    ability: { id: "focus", label: "Focus", description: "Temporarily improves target acquisition and accuracy.", durationMs: 6000, cooldownMs: 20000, modifiers: { spreadMultiplier: 0.45, targetAcquisitionMultiplier: 1.4 } },
    upgrades: [
      { id: "steadyHands", label: "Steady Hands", description: "Further reduce weapon spread.", maxRank: 3, cost: 1, stat: "spreadMultiplier", perRank: -0.06 },
      { id: "fieldTraining", label: "Field Training", description: "Increase maximum health.", maxRank: 3, cost: 1, stat: "maxHealth", perRank: 7 },
      { id: "focusOptics", label: "Focus Optics", description: "Reduce Focus cooldown.", maxRank: 3, cost: 1, stat: "abilityCooldownMultiplier", perRank: -0.08 },
    ],
  },
  heavy: {
    id: "heavy",
    label: "Heavy",
    baseStats: { maxHealth: 130, maxShield: 50, moveSpeedMultiplier: 0.88, spreadMultiplier: 1.06, scrapMultiplier: 1 },
    passive: { id: "fortified", label: "Fortified", description: "Has increased health and shield capacity at the cost of movement speed." },
    ability: { id: "shield-brace", label: "Shield Brace", description: "Temporarily reduces incoming damage.", durationMs: 5000, cooldownMs: 22000, modifiers: { incomingDamageMultiplier: 0.42 } },
    upgrades: [
      { id: "reinforcedFrame", label: "Reinforced Frame", description: "Increase maximum health.", maxRank: 3, cost: 1, stat: "maxHealth", perRank: 10 },
      { id: "shieldCore", label: "Shield Core", description: "Increase maximum shield.", maxRank: 3, cost: 1, stat: "maxShield", perRank: 15 },
      { id: "braceServos", label: "Brace Servos", description: "Reduce Shield Brace cooldown.", maxRank: 3, cost: 1, stat: "abilityCooldownMultiplier", perRank: -0.08 },
    ],
  },
  tech: {
    id: "tech",
    label: "Tech Runner",
    baseStats: { maxHealth: 100, maxShield: 45, moveSpeedMultiplier: 1.04, spreadMultiplier: 1, scrapMultiplier: 1.28 },
    passive: { id: "salvage-expert", label: "Salvage Expert", description: "Collects additional scrap from every source." },
    ability: { id: "repair-pulse", label: "Repair Pulse", description: "Restores personal shields and provides reduced support to nearby teammates.", durationMs: 1200, cooldownMs: 18000, modifiers: { selfShieldRestore: 35, allyShieldRestore: 18 } },
    upgrades: [
      { id: "efficientSalvage", label: "Efficient Salvage", description: "Increase collected scrap.", maxRank: 3, cost: 1, stat: "scrapMultiplier", perRank: 0.09 },
      { id: "pulseAmplifier", label: "Pulse Amplifier", description: "Increase maximum shield.", maxRank: 3, cost: 1, stat: "maxShield", perRank: 10 },
      { id: "rapidRepair", label: "Rapid Repair", description: "Reduce Repair Pulse cooldown.", maxRank: 3, cost: 1, stat: "abilityCooldownMultiplier", perRank: -0.08 },
    ],
  },
};

function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) deepFreeze(child);
  }
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function classIdOrFallback(classId) {
  return CLASS_IDS.includes(classId) ? classId : DEFAULT_CLASS_ID;
}

export const CLASS_DEFINITIONS = deepFreeze(rawDefinitions);

export function getClassDefinition(classId) {
  return clone(CLASS_DEFINITIONS[classIdOrFallback(classId)]);
}

export function createClassProgress(classId = DEFAULT_CLASS_ID) {
  return {
    version: 1,
    classId: classIdOrFallback(classId),
    upgradePoints: 0,
    upgrades: {},
    abilityReadyAt: 0,
  };
}

export function normalizeClassProgress(savedProgress) {
  const source = savedProgress && typeof savedProgress === "object" ? savedProgress : {};
  const classId = classIdOrFallback(source.classId);
  const definition = CLASS_DEFINITIONS[classId];
  const sourceUpgrades = source.upgrades && typeof source.upgrades === "object" ? source.upgrades : {};
  const upgrades = {};

  for (const upgrade of definition.upgrades) {
    const rank = Math.min(upgrade.maxRank, Math.max(0, Math.floor(finiteNumber(sourceUpgrades[upgrade.id]))));
    if (rank > 0) upgrades[upgrade.id] = rank;
  }

  return {
    version: 1,
    classId,
    upgradePoints: Math.max(0, Math.floor(finiteNumber(source.upgradePoints))),
    upgrades,
    abilityReadyAt: Math.max(0, finiteNumber(source.abilityReadyAt)),
  };
}

export function applyClassUpgrade(savedProgress, upgradeId) {
  const progress = normalizeClassProgress(savedProgress);
  const definition = CLASS_DEFINITIONS[progress.classId];
  const upgrade = definition.upgrades.find((candidate) => candidate.id === upgradeId);

  if (!upgrade) return { applied: false, reason: "invalid-upgrade", progress };
  const currentRank = progress.upgrades[upgrade.id] || 0;
  if (currentRank >= upgrade.maxRank) return { applied: false, reason: "max-rank", progress };
  if (progress.upgradePoints < upgrade.cost) return { applied: false, reason: "insufficient-points", progress };

  return {
    applied: true,
    reason: null,
    progress: {
      ...progress,
      upgradePoints: progress.upgradePoints - upgrade.cost,
      upgrades: { ...progress.upgrades, [upgrade.id]: currentRank + 1 },
    },
  };
}

export function getClassStats(savedProgress) {
  const progress = normalizeClassProgress(savedProgress);
  const definition = CLASS_DEFINITIONS[progress.classId];
  const stats = { ...definition.baseStats, abilityCooldownMultiplier: 1 };

  for (const upgrade of definition.upgrades) {
    const rank = progress.upgrades[upgrade.id] || 0;
    if (rank > 0) stats[upgrade.stat] = finiteNumber(stats[upgrade.stat]) + upgrade.perRank * rank;
  }

  for (const key of Object.keys(stats)) stats[key] = Number(stats[key].toFixed(4));
  return stats;
}

export function canUseAbility(savedProgress, nowMs = Date.now()) {
  const progress = normalizeClassProgress(savedProgress);
  return Math.max(0, finiteNumber(nowMs)) >= progress.abilityReadyAt;
}

export function activateAbility(savedProgress, nowMs = Date.now()) {
  const progress = normalizeClassProgress(savedProgress);
  const now = Math.max(0, finiteNumber(nowMs));
  if (now < progress.abilityReadyAt) {
    return {
      activated: false,
      reason: "cooldown",
      remainingMs: progress.abilityReadyAt - now,
      progress,
      effect: null,
    };
  }

  const definition = CLASS_DEFINITIONS[progress.classId];
  const stats = getClassStats(progress);
  const cooldownMs = Math.round(definition.ability.cooldownMs * stats.abilityCooldownMultiplier);
  return {
    activated: true,
    reason: null,
    remainingMs: cooldownMs,
    progress: { ...progress, abilityReadyAt: now + cooldownMs },
    effect: {
      id: definition.ability.id,
      startedAt: now,
      endsAt: now + definition.ability.durationMs,
      modifiers: clone(definition.ability.modifiers),
    },
  };
}
