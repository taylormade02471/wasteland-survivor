const ACTIVE_PHASE = "combat";

function gameplayIsActive(input = {}) {
  return input.phase === ACTIVE_PHASE && input.menuOpen !== true && input.inputPaused !== true;
}

function hasLiveTarget(target) {
  return Boolean(target && target.alive !== false);
}

/**
 * Decides whether Android touch auto-fire may acquire and fire at a target.
 * Integration should pass the current frame's state and use both returned flags.
 */
export function decideAndroidTouchAutoFire(input = {}) {
  const manualFire = input.manualFire === true;
  if (!gameplayIsActive(input)) {
    return {
      targetMayBeAcquired: false,
      firingRequested: false,
      reason: "gameplay-inactive",
    };
  }

  if (manualFire) {
    return {
      targetMayBeAcquired: Boolean(input.isAndroidApp === true && input.inputMode === "touch" && hasLiveTarget(input.target)),
      firingRequested: true,
      reason: "manual-fire",
    };
  }

  const autoFireAllowed = input.isAndroidApp === true
    && input.inputMode === "touch"
    && hasLiveTarget(input.target);
  return {
    targetMayBeAcquired: autoFireAllowed,
    firingRequested: autoFireAllowed,
    reason: autoFireAllowed ? "android-touch-auto-fire" : "auto-fire-unavailable",
  };
}
