export const TOUCH_PRIMARY_CONTROLS = Object.freeze(["fire", "lock", "ability", "more"]);
export const TOUCH_UTILITY_CONTROLS = Object.freeze(["reload", "weapon", "interact", "ads", "pause"]);
export const ANDROID_SINGLE_STICK_CONTROLS = Object.freeze(["fire", "menu", "reload", "ability"]);

function round(value) {
  return value === 0 ? 0 : Math.round(value * 1_000) / 1_000;
}

export function normalizeTouchStick({ dx = 0, dy = 0, radius = 38 } = {}) {
  const safeDx = Number.isFinite(Number(dx)) ? Number(dx) : 0;
  const safeDy = Number.isFinite(Number(dy)) ? Number(dy) : 0;
  const safeRadius = Math.max(1, Number.isFinite(Number(radius)) ? Number(radius) : 38);
  const distance = Math.hypot(safeDx, safeDy);
  if (!distance) return { x: 0, z: 0, magnitude: 0 };

  const magnitude = Math.min(1, distance / safeRadius);
  return {
    x: round((safeDx / distance) * magnitude),
    z: round((safeDy / distance) * magnitude),
    magnitude: round(magnitude),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyDeadZone(value, deadZone) {
  const magnitude = Math.abs(value);
  if (magnitude <= deadZone) return 0;
  return Math.sign(value) * ((magnitude - deadZone) / (1 - deadZone));
}

export function resolveAndroidSingleStick({ x = 0, y = 0, deadZone = 0.12, maxTurnRate = 2.4 } = {}) {
  const horizontal = clamp(Number.isFinite(Number(x)) ? Number(x) : 0, -1, 1);
  const vertical = clamp(Number.isFinite(Number(y)) ? Number(y) : 0, -1, 1);
  const safeDeadZone = clamp(Number.isFinite(Number(deadZone)) ? Number(deadZone) : 0.12, 0, .8);
  const forward = -applyDeadZone(vertical, safeDeadZone);
  const turn = applyDeadZone(horizontal, safeDeadZone);
  const safeTurnRate = Math.max(0, Number.isFinite(Number(maxTurnRate)) ? Number(maxTurnRate) : 2.4);

  return {
    forward: round(forward),
    turnRate: round(turn * safeTurnRate),
    pitch: 0,
    active: Boolean(forward || turn),
  };
}

export function shouldAutoFireFromTouch({ aiming = false, targetInCrosshair = false, manualFire = false } = {}) {
  return Boolean(manualFire || (aiming && targetInCrosshair));
}
