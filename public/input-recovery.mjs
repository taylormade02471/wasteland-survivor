const MOVEMENT_KEYS = [
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
];

const RENDER_LIMITS = {
  low: { maxPixelRatio: 1, maxBufferWidth: 1920, maxBufferHeight: 1080 },
  medium: { maxPixelRatio: 1.75, maxBufferWidth: 3072, maxBufferHeight: 1728 },
  high: { maxPixelRatio: 3, maxBufferWidth: 4096, maxBufferHeight: 2304 },
};

const TRANSIENT_RESET_REASONS = new Set([
  "window-blur",
  "document-hidden",
  "pointer-lock-lost",
  "canvas-exit",
  "pointer-capture-lost",
  "webgl-context-lost",
]);

const POINTER_RETURN_REASONS = new Set([
  "window-blur",
  "document-hidden",
  "pointer-lock-lost",
  "canvas-exit",
  "pointer-capture-lost",
]);

function positiveNumber(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function canCaptureGameplayPointer({
  phase,
  inputMode,
  pointerType,
  deliberateCanvasAction = false,
  finePointer = false,
  firstPerson = false,
  playerAlive = false,
  menuOpen = false,
  controlsTourActive = false,
  controllerOnly = false,
  pointerLocked = false,
  documentVisible = true,
  rendererReady = true,
} = {}) {
  return phase === "combat"
    && inputMode === "mouse"
    && pointerType === "mouse"
    && deliberateCanvasAction
    && finePointer
    && firstPerson
    && playerAlive
    && !menuOpen
    && !controlsTourActive
    && !controllerOnly
    && !pointerLocked
    && documentVisible
    && rendererReady;
}

export function clearTransientInput({ keys, controllerButtons } = {}) {
  const clearedKeys = {};
  if (keys && typeof keys === "object" && !Array.isArray(keys)) {
    Object.keys(keys).forEach(key => {
      clearedKeys[key.toLowerCase()] = false;
    });
  }
  MOVEMENT_KEYS.forEach(key => {
    if (!(key in clearedKeys)) clearedKeys[key] = false;
  });

  return {
    firing: false,
    ads: false,
    keys: clearedKeys,
    touch: { mx: 0, mz: 0, ax: 0, az: 0, fire: false },
    controllerButtonLatch: Array.isArray(controllerButtons) ? controllerButtons.map(Boolean) : [],
  };
}

export function resolveTransientInputReset({
  reason = "",
  pointerResumeEligible = false,
  keys,
  touch,
  controllerButtons,
} = {}) {
  const shouldReset = TRANSIENT_RESET_REASONS.has(reason);
  return {
    reason,
    shouldReset,
    requiresPointerClick: shouldReset
      && pointerResumeEligible
      && POINTER_RETURN_REASONS.has(reason),
    state: shouldReset ? clearTransientInput({ keys, touch, controllerButtons }) : null,
  };
}

export function resolveRendererMetrics({
  width,
  height,
  devicePixelRatio,
  graphicsTier,
} = {}) {
  const viewportWidth = positiveNumber(width);
  const viewportHeight = positiveNumber(height);
  const tier = Object.hasOwn(RENDER_LIMITS, graphicsTier) ? graphicsTier : "medium";
  const limits = RENDER_LIMITS[tier];
  const pixelRatio = Math.min(
    limits.maxPixelRatio,
    Math.max(1, positiveNumber(devicePixelRatio)),
  );
  const scale = Math.min(
    1,
    limits.maxBufferWidth / (viewportWidth * pixelRatio),
    limits.maxBufferHeight / (viewportHeight * pixelRatio),
  );
  const renderWidth = Math.max(1, Math.floor(viewportWidth * scale));
  const renderHeight = Math.max(1, Math.floor(viewportHeight * scale));

  return {
    width: renderWidth,
    height: renderHeight,
    pixelRatio,
    aspect: viewportWidth / viewportHeight,
    bufferWidth: Math.round(renderWidth * pixelRatio),
    bufferHeight: Math.round(renderHeight * pixelRatio),
    graphicsTier: tier,
  };
}
