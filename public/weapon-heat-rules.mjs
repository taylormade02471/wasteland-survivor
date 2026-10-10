const MAX_HEAT = 100;

export const WEAPON_HEAT_PROFILES = Object.freeze({
  scout: Object.freeze({
    heatPerShot: 12,
    passiveCoolingPerSecond: 18,
    overheatedCoolingPerSecond: 28,
    lockThreshold: MAX_HEAT,
    resetThreshold: 32,
  }),
  cannon: Object.freeze({
    heatPerShot: 50,
    passiveCoolingPerSecond: 14,
    overheatedCoolingPerSecond: 24,
    lockThreshold: MAX_HEAT,
    resetThreshold: 28,
  }),
  inferno: Object.freeze({
    heatPerShot: 9,
    passiveCoolingPerSecond: 10,
    overheatedCoolingPerSecond: 21,
    lockThreshold: MAX_HEAT,
    resetThreshold: 37,
  }),
});

const WEAPON_IDS = Object.freeze(Object.keys(WEAPON_HEAT_PROFILES));

function resolveWeapon(weapon) {
  return WEAPON_IDS.includes(weapon) ? weapon : 'scout';
}

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clampHeat(value) {
  return Math.min(MAX_HEAT, Math.max(0, finiteNumber(value)));
}

function normalizeState(state, weaponOverride) {
  const weapon = resolveWeapon(weaponOverride ?? state?.weapon);
  const profile = WEAPON_HEAT_PROFILES[weapon];
  const heat = clampHeat(state?.heat);
  const overheated = heat >= profile.lockThreshold || state?.overheated === true;

  return {
    weapon,
    heat,
    overheated,
    cooling: state?.cooling === true && heat > 0,
  };
}

export function createWeaponHeatState(weapon = 'scout') {
  return {
    weapon: resolveWeapon(weapon),
    heat: 0,
    overheated: false,
    cooling: false,
  };
}

export function resetWeaponHeatState(state, weapon = state?.weapon) {
  return createWeaponHeatState(weapon);
}

export function canFire(state) {
  const normalized = normalizeState(state);
  return !normalized.overheated && normalized.heat < WEAPON_HEAT_PROFILES[normalized.weapon].lockThreshold;
}

export function applyShot(state) {
  const current = normalizeState(state);
  if (!canFire(current)) return { state: current, fired: false };

  const profile = WEAPON_HEAT_PROFILES[current.weapon];
  const heat = Math.min(profile.lockThreshold, current.heat + profile.heatPerShot);
  return {
    state: {
      weapon: current.weapon,
      heat,
      overheated: heat >= profile.lockThreshold,
      cooling: false,
    },
    fired: true,
  };
}

export function advanceCooling(state, dtSeconds) {
  const current = normalizeState(state);
  const profile = WEAPON_HEAT_PROFILES[current.weapon];
  const dt = Math.max(0, finiteNumber(dtSeconds));
  const rate = current.overheated
    ? profile.overheatedCoolingPerSecond
    : profile.passiveCoolingPerSecond;
  const heat = Math.max(0, current.heat - rate * dt);
  const overheated = current.overheated && heat > profile.resetThreshold;

  return {
    weapon: current.weapon,
    heat,
    overheated,
    cooling: current.heat > heat,
  };
}

export function getWeaponHeatViewModel(state) {
  const current = normalizeState(state);
  const profile = WEAPON_HEAT_PROFILES[current.weapon];
  let status = 'READY';
  if (current.overheated) status = 'OVERHEATED';
  else if (current.heat > 0 && current.cooling) status = 'COOLING';
  else if (current.heat > 0) status = 'HEATING';

  return {
    weapon: current.weapon,
    heat: current.heat,
    heatPercent: Math.round((current.heat / profile.lockThreshold) * 100),
    status,
    canFire: canFire(current),
  };
}
