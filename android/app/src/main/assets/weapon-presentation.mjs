export const WEAPON_PRESENTATION_PROFILES = Object.freeze({
  scout: Object.freeze({
    modelId: "compact-smg",
    reloadMs: 900,
    recoilKick: 0.24,
    shellVelocity: 2.8,
    muzzleFlashMs: 72,
    smokeMs: 260,
    impactSparkCount: 5,
    flashColor: "#ffd86a",
    flashScale: 0.44,
    heatGlow: 0.28,
    accessibilityLabel: "Scout rifle firing cue",
  }),
  cannon: Object.freeze({
    modelId: "riot-shotgun",
    reloadMs: 1150,
    recoilKick: 0.42,
    shellVelocity: 3.6,
    muzzleFlashMs: 96,
    smokeMs: 330,
    impactSparkCount: 8,
    flashColor: "#ffb347",
    flashScale: 0.58,
    heatGlow: 0.38,
    accessibilityLabel: "Cannon blast firing cue",
  }),
  inferno: Object.freeze({
    modelId: "coil-carbine",
    reloadMs: 1250,
    recoilKick: 0.3,
    shellVelocity: 2.4,
    muzzleFlashMs: 118,
    smokeMs: 380,
    impactSparkCount: 11,
    flashColor: "#7dff8a",
    flashScale: 0.5,
    heatGlow: 0.72,
    accessibilityLabel: "Inferno energy firing cue",
  }),
});

const MAX_EFFECT_MS = 2000;

function resolveWeapon(weapon) {
  return Object.hasOwn(WEAPON_PRESENTATION_PROFILES, weapon) ? weapon : "scout";
}

function profileFor(state) {
  return WEAPON_PRESENTATION_PROFILES[resolveWeapon(state?.weapon)];
}

function clamp(value, min, max, fallback = min) {
  const number = Number(value);
  if (Number.isNaN(number)) return fallback;
  if (number === Infinity) return max;
  if (number === -Infinity) return min;
  return Math.min(max, Math.max(min, number));
}

function finiteDeltaSeconds(value) {
  return clamp(value, 0, 60, 0);
}

function round(value, places = 3) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function normalizeState(state) {
  const weapon = resolveWeapon(state?.weapon);
  return {
    weapon,
    reloading: state?.reloading === true,
    reloadProgress: clamp(state?.reloadProgress, 0, 1, 0),
    reloadElapsed: clamp(state?.reloadElapsed, 0, 60, 0),
    recoil: clamp(state?.recoil, 0, 2, 0),
    muzzleFlashMs: clamp(state?.muzzleFlashMs, 0, MAX_EFFECT_MS, 0),
    smokeMs: clamp(state?.smokeMs, 0, MAX_EFFECT_MS, 0),
    shots: Math.max(0, Math.floor(clamp(state?.shots, 0, Number.MAX_SAFE_INTEGER, 0))),
    shellsEjected: Math.max(0, Math.floor(clamp(state?.shellsEjected, 0, Number.MAX_SAFE_INTEGER, 0))),
  };
}

export function createWeaponPresentationState(weapon = "scout") {
  return {
    weapon: resolveWeapon(weapon),
    reloading: false,
    reloadProgress: 0,
    reloadElapsed: 0,
    recoil: 0,
    muzzleFlashMs: 0,
    smokeMs: 0,
    shots: 0,
    shellsEjected: 0,
  };
}

export function triggerWeaponShot(state) {
  const current = normalizeState(state);
  if (current.reloading) return { state: current, cue: { type: "blocked" } };

  const profile = profileFor(current);
  return {
    state: {
      ...current,
      shots: current.shots + 1,
      shellsEjected: current.shellsEjected + 1,
      recoil: Math.min(2, current.recoil + profile.recoilKick),
      muzzleFlashMs: profile.muzzleFlashMs,
      smokeMs: profile.smokeMs,
    },
    cue: { type: "shot", shell: true, impactSparks: profile.impactSparkCount },
  };
}

export function beginWeaponReload(state) {
  const current = normalizeState(state);
  if (current.reloading) return { state: current, cue: { type: "blocked" } };
  return {
    state: { ...current, reloading: true, reloadProgress: 0, reloadElapsed: 0 },
    cue: { type: "reload-start" },
  };
}

export function advanceWeaponPresentation(state, dtSeconds) {
  const current = normalizeState(state);
  const profile = profileFor(current);
  const dt = finiteDeltaSeconds(dtSeconds);
  const reloadElapsed = current.reloading
    ? Math.min(profile.reloadMs / 1000, current.reloadElapsed + dt)
    : current.reloadElapsed;
  const reloadProgress = current.reloading
    ? Math.min(1, reloadElapsed / (profile.reloadMs / 1000))
    : current.reloadProgress;

  return {
    ...current,
    reloading: current.reloading && reloadProgress < 1,
    reloadElapsed,
    reloadProgress,
    recoil: Math.max(0, current.recoil - dt * 1.8),
    muzzleFlashMs: Math.max(0, current.muzzleFlashMs - dt * 1000),
    smokeMs: Math.max(0, current.smokeMs - dt * 1000),
  };
}

export function weaponPresentationView(state) {
  const current = normalizeState(state);
  let status = "READY";
  if (current.reloading) status = "RELOADING";
  else if (current.muzzleFlashMs > 0) status = "FIRING";
  else if (current.smokeMs > 0) status = "SMOKING";
  return {
    weapon: current.weapon,
    modelId: profileFor(current).modelId,
    status,
    reloadProgress: current.reloadProgress,
    recoil: current.recoil,
    muzzleFlash: current.muzzleFlashMs > 0,
    smoke: current.smokeMs > 0,
  };
}

export function sampleWeaponPresentationFrame(state, options = {}) {
  const current = normalizeState(state);
  const profile = profileFor(current);
  const aim = clamp(options.aim, 0, 1, 0);
  const viewportWidth = clamp(options.viewportWidth, 240, 3840, 960);
  const flashProgress = profile.muzzleFlashMs > 0
    ? clamp(current.muzzleFlashMs / profile.muzzleFlashMs, 0, 1, 0)
    : 0;
  const smokeProgress = profile.smokeMs > 0 ? clamp(current.smokeMs / profile.smokeMs, 0, 1, 0) : 0;
  const recoil = clamp(current.recoil / Math.max(profile.recoilKick, 0.001), 0, 2, 0);
  const compactViewport = viewportWidth < 520;
  const flashScale = profile.flashScale * (compactViewport ? 0.78 : 1) * (0.72 + flashProgress * 0.28);
  const aimTighten = 1 - aim * 0.34;

  return {
    weapon: current.weapon,
    modelId: profile.modelId,
    aim: round(aim),
    pose: {
      kickZ: round(-current.recoil * 0.34 * aimTighten),
      liftY: round(current.recoil * 0.11 * aimTighten),
      roll: round((current.weapon === "cannon" ? -0.034 : -0.018) * recoil * aimTighten),
      swayX: round((1 - aim) * 0.018),
    },
    muzzleFlash: {
      visible: flashProgress > 0,
      color: profile.flashColor,
      opacity: round(flashProgress),
      scale: round(flashScale),
      maxScreenFraction: compactViewport ? 0.16 : 0.18,
    },
    shellEjection: {
      visible: current.shellsEjected > 0 && smokeProgress > 0,
      velocityX: round(profile.shellVelocity * (0.82 + recoil * 0.08)),
      velocityY: round(0.42 + recoil * 0.08),
      spin: round((current.shots % 2 === 0 ? -1 : 1) * (0.35 + recoil * 0.18)),
    },
    heatGlow: round(profile.heatGlow * Math.max(flashProgress, smokeProgress * 0.55)),
    accessibility: {
      label: profile.accessibilityLabel,
      icon: current.weapon === "inferno" ? "energy-flash" : current.weapon === "cannon" ? "blast-flash" : "rifle-flash",
    },
  };
}
