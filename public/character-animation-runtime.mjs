export const CHARACTER_ANIMATION_STATES = Object.freeze(["idle", "walk", "run", "aim", "fire", "hit", "downed", "wade"]);

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function sampleCharacterAnimation({ state = "idle", time = 0, intensity = 1 } = {}) {
  const safeState = CHARACTER_ANIMATION_STATES.includes(state) ? state : "idle";
  const t = finite(time);
  const amount = Math.max(0, Math.min(1, finite(intensity)));
  const gait = safeState === "run" ? 1 : safeState === "walk" || safeState === "wade" ? .64 : 0;
  const cadence = safeState === "run" ? 11 : safeState === "walk" || safeState === "wade" ? 7 : 2.2;
  const stride = Math.sin(t * cadence) * gait * amount;
  const counterStride = Math.sin(t * cadence + Math.PI) * gait * amount;
  const breath = Math.sin(t * 2.2) * .018 * amount;
  const aim = safeState === "aim" || safeState === "fire" ? 1 : 0;
  const fireKick = safeState === "fire" ? Math.max(0, 1 - ((t * 8) % 1)) : 0;
  return Object.freeze({
    state: safeState,
    torso: { rotationX: breath - aim * .035, rotationY: Math.sin(t * 1.4) * .012 * amount },
    head: { rotationX: aim * -.04 + breath * .4, rotationY: Math.sin(t * 1.7) * .018 * amount },
    leftArm: { rotationX: counterStride * .14 - aim * .12, rotationZ: counterStride * .08 },
    rightArm: { rotationX: stride * .14 - aim * .12 - fireKick * .08, rotationZ: stride * -.08 },
    leftLeg: { rotationX: stride * .32 },
    rightLeg: { rotationX: counterStride * .32 },
    weapon: { rotationX: -aim * .08 - fireKick * .12 },
  });
}
