export const CONTROL_DIRECTION_LOCK = Object.freeze({
  id: "right-positive-v1",
  mouseRadiansPerPixel: 0.0026,
});

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function snapZero(value) {
  return Math.abs(value) < Number.EPSILON ? 0 : value;
}

export function keyboardMovementAxes(keys = {}) {
  return {
    strafe: (keys.d ? 1 : 0) - (keys.a ? 1 : 0),
    vertical: (keys.s ? 1 : 0) - (keys.w ? 1 : 0),
  };
}

export function aimYawFromAxes(horizontal, vertical) {
  return Math.atan2(finite(horizontal), finite(vertical));
}

export function nextMouseYaw({ yaw = 0, movementX = 0, sensitivity = 1 } = {}) {
  return finite(yaw) + finite(movementX) * CONTROL_DIRECTION_LOCK.mouseRadiansPerPixel * Math.max(0, finite(sensitivity, 1));
}

export function firstPersonMovementDelta({ yaw = 0, strafe = 0, forward = 0, speed = 1 } = {}) {
  const safeYaw = finite(yaw);
  const safeStrafe = finite(strafe);
  const safeForward = finite(forward);
  const safeSpeed = Math.max(0, finite(speed, 1));
  const magnitude = Math.hypot(safeStrafe, safeForward) || 1;
  const forwardX = Math.sin(safeYaw);
  const forwardZ = Math.cos(safeYaw);
  const rightX = Math.cos(safeYaw);
  const rightZ = -Math.sin(safeYaw);
  return {
    x: snapZero((rightX * safeStrafe + forwardX * safeForward) / magnitude * safeSpeed),
    z: snapZero((rightZ * safeStrafe + forwardZ * safeForward) / magnitude * safeSpeed),
  };
}
