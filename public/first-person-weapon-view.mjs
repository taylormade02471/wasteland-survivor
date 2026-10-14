export const FIRST_PERSON_WEAPON_VIEW = Object.freeze({
  rigName: "first-person-weapon-rig",
  weaponName: "first-person-authored-weapon",
  fitDimension: 1.15,
  renderOrder: 1000,
  // glTF-forward is camera-forward here (-Z). World weapons are rotated for
  // a survivor's +Z local forward, so the camera clone intentionally is not.
  ready: Object.freeze({ x: 0.58, y: -0.58, z: -1.3, rotationX: -0.16, rotationY: 0, rotationZ: -0.09 }),
  aim: Object.freeze({ x: 0.15, y: -0.39, z: -1.18, rotationX: -0.06, rotationY: 0, rotationZ: -0.018 }),
});

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, finite(value)));
}

function blend(from, to, amount) {
  return from + (to - from) * amount;
}

export function firstPersonWeaponPose(frame, { aim = 0 } = {}) {
  const target = clamp01(aim);
  const source = frame?.pose || {};
  const kickZ = finite(source.kickZ);
  const liftY = finite(source.liftY);
  const roll = finite(source.roll);
  const swayX = finite(source.swayX);
  const ready = FIRST_PERSON_WEAPON_VIEW.ready;
  const aimed = FIRST_PERSON_WEAPON_VIEW.aim;
  return Object.freeze({
    position: Object.freeze({
      x: blend(ready.x, aimed.x, target) + swayX * (1 - target),
      y: blend(ready.y, aimed.y, target) + liftY,
      // Camera-forward is negative Z. A shot kick moves the view model toward
      // the camera, so the reusable presentation kick is inverted here.
      z: blend(ready.z, aimed.z, target) - kickZ,
    }),
    rotation: Object.freeze({
      x: blend(ready.rotationX, aimed.rotationX, target),
      y: ready.rotationY,
      z: blend(ready.rotationZ, aimed.rotationZ, target) + roll,
    }),
    renderOrder: FIRST_PERSON_WEAPON_VIEW.renderOrder,
  });
}
