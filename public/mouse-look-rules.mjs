const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function centerVirtualMouseLook() {
  return { x: 0, y: 0 };
}

export function advanceVirtualMouseLook(current = {}, movement = {}, viewport = {}) {
  const halfWidth = Math.max(1, finite(viewport.width) / 2);
  const halfHeight = Math.max(1, finite(viewport.height) / 2);
  return {
    x: clamp(finite(current.x) + finite(movement.movementX) / halfWidth, -1, 1),
    y: clamp(finite(current.y) + finite(movement.movementY) / halfHeight, -1, 1),
  };
}

export function virtualMouseLookFromPoint(point = {}, rectangle = {}) {
  const width = Math.max(1, finite(rectangle.width));
  const height = Math.max(1, finite(rectangle.height));
  const centerX = finite(rectangle.left) + width / 2;
  const centerY = finite(rectangle.top) + height / 2;
  return {
    x: clamp((finite(point.clientX) - centerX) / (width / 2), -1, 1),
    y: clamp((finite(point.clientY) - centerY) / (height / 2), -1, 1),
  };
}

export function mouseLookRates(look = {}, {
  deadzone = 0.06,
  curve = 1.4,
  maxYawRate = 3.2,
  maxPitchRate = 2.4,
} = {}) {
  const safeDeadzone = clamp(finite(deadzone), 0, 0.9);
  const safeCurve = Math.max(0.2, finite(curve) || 1);
  const shape = value => {
    const magnitude = Math.abs(clamp(finite(value), -1, 1));
    if (magnitude <= safeDeadzone) return 0;
    const normalized = (magnitude - safeDeadzone) / (1 - safeDeadzone);
    return Math.sign(value) * Math.pow(normalized, safeCurve);
  };
  const yawRate = -shape(look.x) * Math.max(0, finite(maxYawRate));
  const pitchRate = -shape(look.y) * Math.max(0, finite(maxPitchRate));
  return {
    yawRate: Object.is(yawRate, -0) ? 0 : yawRate,
    pitchRate: Object.is(pitchRate, -0) ? 0 : pitchRate,
  };
}
