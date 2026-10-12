export const SIMPLE_CHARACTER_MOTION_STATES = Object.freeze(["idle", "walk"]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : 0));

export function sampleSimpleCharacterMotion({ state = "idle", time = 0, speed = 0 } = {}) {
  const normalizedSpeed = clamp(speed, 0, 1);
  const moving = state === "walk" || normalizedSpeed > 0.08;
  const resolvedState = moving ? "walk" : "idle";
  const phase = clamp(time, 0, 100000) * (resolvedState === "walk" ? 7.5 : 2.2);
  const step = Math.sin(phase);
  const stride = resolvedState === "walk" ? normalizedSpeed : 0;

  return {
    state: resolvedState,
    position: {
      y: resolvedState === "walk" ? Math.abs(step) * 0.045 * Math.max(stride, 0.35) : Math.sin(phase) * 0.012,
      z: resolvedState === "walk" ? Math.cos(phase) * 0.012 * stride : 0,
    },
    rotation: {
      x: resolvedState === "walk" ? Math.cos(phase) * 0.018 * stride : 0,
      y: resolvedState === "walk" ? Math.sin(phase * 0.5) * 0.012 * stride : Math.sin(phase * 0.5) * 0.004,
      z: resolvedState === "walk" ? step * 0.018 * stride : Math.sin(phase) * 0.006,
    },
  };
}
