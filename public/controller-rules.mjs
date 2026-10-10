const DEFAULT_DEADZONE = 0.18;
const TRIGGER_THRESHOLD = 0.2;

const numberOrZero = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function normalizeYaw(value = 0) {
  const turn = Math.PI * 2;
  return ((numberOrZero(value) + Math.PI) % turn + turn) % turn - Math.PI;
}

export function normalizeStick(x = 0, y = 0, deadzone = DEFAULT_DEADZONE) {
  const rawX = numberOrZero(x);
  const rawY = numberOrZero(y);
  const rawMagnitude = Math.hypot(rawX, rawY);
  const safeDeadzone = Math.max(0, Math.min(0.95, numberOrZero(deadzone)));
  if (rawMagnitude <= safeDeadzone) return { x: 0, y: 0, magnitude: 0 };

  const clampedMagnitude = Math.min(1, rawMagnitude);
  const magnitude = (clampedMagnitude - safeDeadzone) / (1 - safeDeadzone);
  const directionX = rawX / rawMagnitude;
  const directionY = rawY / rawMagnitude;
  return {
    x: directionX * magnitude,
    y: directionY * magnitude,
    magnitude,
  };
}

export function neutralGamepadSample() {
  return {
    connected: false,
    id: "",
    index: null,
    mapping: "",
    move: { x: 0, y: 0, magnitude: 0 },
    look: { x: 0, y: 0, magnitude: 0 },
    fire: false,
    ads: false,
    menuHeld: false,
    bHeld: false,
    interact: false,
    ability: false,
    reload: false,
    weapon: false,
    pause: false,
    switchTarget: false,
    dpadUp: false,
    dpadDown: false,
    dpadLeft: false,
    dpadRight: false,
    dpadUpHeld: false,
    dpadDownHeld: false,
    dpadLeftHeld: false,
    dpadRightHeld: false,
    active: false,
    buttonLatch: [],
  };
}

function buttonValue(button) {
  if (!button) return 0;
  return Math.max(numberOrZero(button.value), button.pressed ? 1 : 0);
}

function rawGamepadActive(gamepad) {
  if (!gamepad?.connected) return false;
  const axesActive = Array.from(gamepad.axes || []).some(axis => Math.abs(numberOrZero(axis)) > DEFAULT_DEADZONE);
  const buttonsActive = Array.from(gamepad.buttons || []).some(button => buttonValue(button) > TRIGGER_THRESHOLD);
  return axesActive || buttonsActive;
}

export function chooseGamepad(gamepads = [], rememberedIndex = null) {
  const connected = Array.from(gamepads || []).filter(gamepad => gamepad?.connected);
  if (!connected.length) return null;
  const active = connected.find(rawGamepadActive);
  if (active) return active;
  const remembered = connected.find(gamepad => gamepad.index === rememberedIndex);
  if (remembered) return remembered;
  return connected.find(gamepad => gamepad.mapping === "standard") || connected[0];
}

export function sampleGamepad(gamepad, previousButtons = []) {
  if (!gamepad?.connected) return neutralGamepadSample();

  const buttons = Array.from(gamepad.buttons || []);
  const buttonLatch = buttons.map(button => Boolean(button?.pressed));
  const justPressed = index => Boolean(buttonLatch[index] && !previousButtons?.[index]);
  const axes = Array.from(gamepad.axes || []);
  const move = normalizeStick(axes[0], axes[1]);
  const look = normalizeStick(axes[2], axes[3]);
  const fire = buttonValue(buttons[7]) > TRIGGER_THRESHOLD;
  const ads = buttonValue(buttons[6]) > TRIGGER_THRESHOLD;

  return {
    connected: true,
    id: String(gamepad.id || "Controller"),
    index: Number.isInteger(gamepad.index) ? gamepad.index : 0,
    mapping: String(gamepad.mapping || "unknown"),
    move,
    look,
    fire,
    ads,
    menuHeld: Boolean(buttonLatch[9]),
    bHeld: Boolean(buttonLatch[1]),
    interact: justPressed(0),
    ability: justPressed(1),
    reload: justPressed(2),
    weapon: justPressed(3),
    pause: justPressed(9),
    switchTarget: justPressed(11),
    dpadUp: justPressed(12),
    dpadDown: justPressed(13),
    dpadLeft: justPressed(14),
    dpadRight: justPressed(15),
    dpadUpHeld: Boolean(buttonLatch[12]),
    dpadDownHeld: Boolean(buttonLatch[13]),
    dpadLeftHeld: Boolean(buttonLatch[14]),
    dpadRightHeld: Boolean(buttonLatch[15]),
    active: move.magnitude > 0 || look.magnitude > 0 || fire || ads || buttonLatch.some(Boolean),
    buttonLatch,
  };
}

export function advanceControllerLook(
  view = {},
  look = {},
  deltaSeconds = 0,
  { sensitivity = 2.4, invertY = false, maxPitch = 0.9 } = {},
) {
  const dt = Math.max(0, numberOrZero(deltaSeconds));
  const speed = Math.max(0, numberOrZero(sensitivity));
  const pitchLimit = Math.max(0, Math.min(Math.PI / 2, numberOrZero(maxPitch)));
  const horizontal = numberOrZero(look.x);
  const vertical = numberOrZero(look.y) * (invertY ? 1 : -1);
  return {
    yaw: normalizeYaw(numberOrZero(view.yaw) + horizontal * speed * dt),
    pitch: Math.max(-pitchLimit, Math.min(pitchLimit, numberOrZero(view.pitch) + vertical * speed * dt)),
  };
}

export function cameraDirectionFromView(view = {}) {
  const yaw = numberOrZero(view.yaw);
  const pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, numberOrZero(view.pitch)));
  const horizontalScale = Math.cos(pitch);
  return {
    x: Math.sin(yaw) * horizontalScale,
    y: Math.sin(pitch),
    z: Math.cos(yaw) * horizontalScale,
  };
}
