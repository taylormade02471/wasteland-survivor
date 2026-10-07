const freeze = (value) => Object.freeze(value);

export const WEAPON_FAMILIES = freeze({
  scout: freeze({
    id: "scout", name: "Scout", unlockKills: 3, maxLevel: Infinity,
    basePrice: 12, priceStep: 2, magazineSize: 30, reserveAmmo: 180,
    reloadMs: 900, automaticReloadMs: 1100, baseDamage: 12,
    damagePerLevel: 1.6, baseFireDelayMs: 160, minimumFireDelayMs: 75,
    baseSpreadDegrees: 0.9, minimumSpreadDegrees: 0.2,
    baseRecoil: 0.92, minimumRecoil: 0.28,
    falloffStart: 18, falloffEnd: 52, minimumDamageMultiplier: 0.58,
  }),
  cannon: freeze({
    id: "cannon", name: "Cannon", unlockKills: 6, maxLevel: 100,
    basePrice: 28, priceStep: 5, magazineSize: 12, reserveAmmo: 60,
    reloadMs: 900, automaticReloadMs: 1100, baseDamage: 52,
    damagePerLevel: 4, fireDelayMs: 520, spreadDegrees: 5.73, recoil: 1.65,
    penetration: 2, barrelLevels: freeze([50, 75, 100]),
    falloffStart: 22, falloffEnd: 60, minimumDamageMultiplier: 0.6,
  }),
  inferno: freeze({
    id: "inferno", name: "Inferno", unlockKills: 9, maxLevel: 50,
    basePrice: 42, priceStep: 5, magazineSize: 8, reserveAmmo: 32,
    reloadMs: 900, automaticReloadMs: 1100, baseDamage: 74,
    damagePerLevel: 5.2, fireDelayMs: 660, spreadDegrees: 7.45, recoil: 2.15,
    penetration: 3, barrelLevels: freeze([25, 38, 50]),
    falloffStart: 16, falloffEnd: 48, minimumDamageMultiplier: 0.66,
  }),
});

export const TACTICAL_ITEMS = freeze({
  frag: freeze({ id: "frag", effect: "explosive", radius: 5, power: 90, durationMs: 0, startingCount: 2 }),
  flash: freeze({ id: "flash", effect: "disorient", radius: 7, power: 0, durationMs: 2600, startingCount: 1 }),
  stim: freeze({ id: "stim", effect: "heal", radius: 0, power: 45, durationMs: 1200, startingCount: 2 }),
});

function requireWeapon(weaponId) {
  const weapon = WEAPON_FAMILIES[weaponId];
  if (!weapon) throw new RangeError(`Unknown weapon: ${weaponId}`);
  return weapon;
}

function normalizeLevel(weapon, level) {
  if (!Number.isInteger(level) || level < 0 || level > weapon.maxLevel) {
    throw new RangeError(`Invalid ${weapon.name} level: ${level}`);
  }
  return level;
}

function cloneState(state) {
  return {
    ...state,
    weapons: Object.fromEntries(Object.entries(state.weapons).map(([id, weapon]) => [id, { ...weapon }])),
    tacticals: { ...state.tacticals },
  };
}

function round(value, places = 4) {
  const scale = 10 ** places;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function barrelCount(weapon, level) {
  return 1 + (weapon.barrelLevels?.filter((milestone) => level >= milestone).length || 0);
}

export function getWeaponProfile(weaponId, level = 0) {
  const weapon = requireWeapon(weaponId);
  normalizeLevel(weapon, level);
  const projectiles = barrelCount(weapon, level);
  const effectiveLevel = level / projectiles;

  if (weaponId === "scout") {
    return {
      id: weapon.id, name: weapon.name, level,
      damage: round(weapon.baseDamage + level * weapon.damagePerLevel),
      fireDelayMs: Math.max(weapon.minimumFireDelayMs, weapon.baseFireDelayMs - level),
      projectiles, penetration: Math.floor(level / 25),
      spreadDegrees: round(Math.max(weapon.minimumSpreadDegrees, weapon.baseSpreadDegrees - level * 0.01)),
      recoil: round(Math.max(weapon.minimumRecoil, weapon.baseRecoil - level * 0.008)),
      magazineSize: weapon.magazineSize, reloadMs: weapon.reloadMs,
      automaticReloadMs: weapon.automaticReloadMs, falloffStart: weapon.falloffStart,
      falloffEnd: weapon.falloffEnd, minimumDamageMultiplier: weapon.minimumDamageMultiplier,
    };
  }

  return {
    id: weapon.id, name: weapon.name, level,
    damage: round(weapon.baseDamage + effectiveLevel * weapon.damagePerLevel),
    fireDelayMs: weapon.fireDelayMs, projectiles, penetration: weapon.penetration,
    spreadDegrees: weapon.spreadDegrees, recoil: weapon.recoil,
    magazineSize: weapon.magazineSize, reloadMs: weapon.reloadMs,
    automaticReloadMs: weapon.automaticReloadMs, falloffStart: weapon.falloffStart,
    falloffEnd: weapon.falloffEnd, minimumDamageMultiplier: weapon.minimumDamageMultiplier,
  };
}

export function createCombatState({ kills = 0, scrap = 0, activeWeapon = "scout" } = {}) {
  requireWeapon(activeWeapon);
  return {
    kills: Math.max(0, Math.floor(kills)),
    scrap: Math.max(0, Math.floor(scrap)),
    activeWeapon,
    nextFireAt: 0,
    weapons: Object.fromEntries(Object.entries(WEAPON_FAMILIES).map(([id, weapon]) => [id, {
      level: 0,
      magazine: weapon.magazineSize,
      reserve: weapon.reserveAmmo,
      reloadEndsAt: null,
    }])),
    tacticals: Object.fromEntries(Object.entries(TACTICAL_ITEMS).map(([id, tactical]) => [id, tactical.startingCount])),
  };
}

export function isWeaponUnlocked(weaponId, kills) {
  const weapon = requireWeapon(weaponId);
  return Number.isFinite(kills) && kills >= weapon.unlockKills;
}

export function getUpgradeCost(weaponId, level) {
  const weapon = requireWeapon(weaponId);
  normalizeLevel(weapon, level);
  return weapon.basePrice + Math.floor(level / 10) * weapon.priceStep;
}

export function applyUpgrade(state, weaponId) {
  const weapon = requireWeapon(weaponId);
  const current = state.weapons[weaponId];
  if (!current) return { ok: false, reason: "missing-weapon", state };
  if (!isWeaponUnlocked(weaponId, state.kills)) return { ok: false, reason: "locked", state };
  if (current.level >= weapon.maxLevel) return { ok: false, reason: "max-level", state };
  const cost = getUpgradeCost(weaponId, current.level);
  if (state.scrap < cost) return { ok: false, reason: "insufficient-scrap", cost, state };
  const next = cloneState(state);
  next.scrap -= cost;
  next.weapons[weaponId].level++;
  return { ok: true, cost, state: next, profile: getWeaponProfile(weaponId, next.weapons[weaponId].level) };
}

export function takeShot(state, timestamp) {
  const current = state.weapons[state.activeWeapon];
  if (current.reloadEndsAt !== null) return { ok: false, reason: "reloading", autoReloadRequired: false, state };
  if (timestamp < state.nextFireAt) return { ok: false, reason: "cooldown", autoReloadRequired: false, state };
  if (current.magazine <= 0) return { ok: false, reason: "empty", autoReloadRequired: true, state };
  const profile = getWeaponProfile(state.activeWeapon, current.level);
  const next = cloneState(state);
  next.weapons[state.activeWeapon].magazine--;
  next.nextFireAt = timestamp + profile.fireDelayMs;
  return { ok: true, autoReloadRequired: false, state: next, profile };
}

export function startReload(state, timestamp, { automatic = false } = {}) {
  const current = state.weapons[state.activeWeapon];
  const profile = getWeaponProfile(state.activeWeapon, current.level);
  if (current.reloadEndsAt !== null) return { ok: false, reason: "already-reloading", state };
  if (current.magazine >= profile.magazineSize) return { ok: false, reason: "magazine-full", state };
  if (current.reserve <= 0) return { ok: false, reason: "no-reserve-ammo", state };
  const next = cloneState(state);
  next.weapons[state.activeWeapon].reloadEndsAt = timestamp + (automatic ? profile.automaticReloadMs : profile.reloadMs);
  return { ok: true, state: next, reloadEndsAt: next.weapons[state.activeWeapon].reloadEndsAt };
}

export function completeReload(state, timestamp) {
  const current = state.weapons[state.activeWeapon];
  if (current.reloadEndsAt === null || timestamp < current.reloadEndsAt) return { completed: false, state };
  const profile = getWeaponProfile(state.activeWeapon, current.level);
  const amount = Math.min(profile.magazineSize - current.magazine, current.reserve);
  const next = cloneState(state);
  next.weapons[state.activeWeapon].magazine += amount;
  next.weapons[state.activeWeapon].reserve -= amount;
  next.weapons[state.activeWeapon].reloadEndsAt = null;
  return { completed: true, amount, state: next };
}

function seededUnit(seed) {
  let value = (seed >>> 0) + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export function calculateShotPattern(profile, { shotIndex = 0, seed = 0, aiming = false } = {}) {
  const aimMultiplier = aiming ? 0.55 : 1;
  const center = (profile.projectiles - 1) / 2;
  return Array.from({ length: profile.projectiles }, (_, index) => {
    const randomYaw = seededUnit(seed + shotIndex * 101 + index * 17) * 2 - 1;
    const randomPitch = seededUnit(seed + shotIndex * 211 + index * 31 + 7) * 2 - 1;
    const barrelOffset = (index - center) * profile.spreadDegrees;
    return {
      yawDegrees: round((barrelOffset + randomYaw * profile.spreadDegrees * 0.35) * aimMultiplier),
      pitchDegrees: round((profile.recoil + randomPitch * profile.spreadDegrees * 0.18) * aimMultiplier),
    };
  });
}

export function calculateDamage(profile, { distance = 0, penetrations = 0, headshot = false } = {}) {
  if (penetrations > profile.penetration) return 0;
  const range = Math.max(0, distance);
  let rangeMultiplier = 1;
  if (range >= profile.falloffEnd) rangeMultiplier = profile.minimumDamageMultiplier;
  else if (range > profile.falloffStart) {
    const progress = (range - profile.falloffStart) / (profile.falloffEnd - profile.falloffStart);
    rangeMultiplier = 1 - progress * (1 - profile.minimumDamageMultiplier);
  }
  const penetrationMultiplier = 0.8 ** Math.max(0, penetrations);
  return round(profile.damage * rangeMultiplier * penetrationMultiplier * (headshot ? 1.5 : 1), 2);
}

export function createHitFeedback({
  targetId, damage, remainingHealth, headshot = false, penetrations = 0,
  weaponId, timestamp = 0,
}) {
  requireWeapon(weaponId);
  const eliminated = remainingHealth <= 0;
  return {
    type: "combat:hit", targetId, weaponId, damage: round(Math.max(0, damage), 2),
    remainingHealth: Math.max(0, round(remainingHealth, 2)), headshot: Boolean(headshot),
    penetrations: Math.max(0, Math.floor(penetrations)), eliminated,
    marker: eliminated ? "elimination" : headshot ? "headshot" : "hit", timestamp,
  };
}

export function switchWeapon(state, direction = 1) {
  const unlocked = Object.keys(WEAPON_FAMILIES).filter((id) => isWeaponUnlocked(id, state.kills));
  if (unlocked.length === 0) return { ok: false, reason: "no-unlocked-weapons", state };
  const currentIndex = Math.max(0, unlocked.indexOf(state.activeWeapon));
  const step = direction < 0 ? -1 : 1;
  const nextId = unlocked[(currentIndex + step + unlocked.length) % unlocked.length];
  const next = cloneState(state);
  next.weapons[state.activeWeapon].reloadEndsAt = null;
  next.activeWeapon = nextId;
  next.nextFireAt = 0;
  return { ok: true, state: next, weaponId: nextId };
}

export function useTacticalItem(state, tacticalId, { timestamp = 0 } = {}) {
  const tactical = TACTICAL_ITEMS[tacticalId];
  if (!tactical) return { ok: false, reason: "unknown-tactical", state };
  if ((state.tacticals[tacticalId] || 0) <= 0) return { ok: false, reason: "empty", state };
  const next = cloneState(state);
  next.tacticals[tacticalId]--;
  return {
    ok: true,
    state: next,
    event: {
      type: "combat:tactical", tacticalId, effect: tactical.effect, radius: tactical.radius,
      power: tactical.power, durationMs: tactical.durationMs, timestamp,
    },
  };
}
