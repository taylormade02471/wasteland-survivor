const assert = require("node:assert/strict");
const test = require("node:test");

const modulePath = new URL("../public/input-recovery.mjs", `file://${__filename.replace(/\\/g, "/")}`);

const eligiblePointerState = {
  phase: "combat",
  inputMode: "mouse",
  pointerType: "mouse",
  deliberateCanvasAction: true,
  finePointer: true,
  firstPerson: true,
  playerAlive: true,
  menuOpen: false,
  controlsTourActive: false,
  controllerOnly: false,
  pointerLocked: false,
  documentVisible: true,
  rendererReady: true,
};

test("allows pointer capture only for a deliberate live first-person canvas action", async () => {
  const { canCaptureGameplayPointer } = await import(modulePath);

  assert.equal(canCaptureGameplayPointer(eligiblePointerState), true);
  assert.equal(canCaptureGameplayPointer({ ...eligiblePointerState, deliberateCanvasAction: false }), false);
  assert.equal(canCaptureGameplayPointer({ ...eligiblePointerState, firstPerson: false }), false);
  assert.equal(canCaptureGameplayPointer({ ...eligiblePointerState, playerAlive: false }), false);
  assert.equal(canCaptureGameplayPointer({ ...eligiblePointerState, pointerLocked: true }), false);
});

test("rejects pointer capture in every menu and non-combat phase", async () => {
  const { canCaptureGameplayPointer } = await import(modulePath);
  const excludedPhases = [
    "setup",
    "menu",
    "lobby",
    "countdown",
    "controls-tour",
    "loadout",
    "prep",
    "paused",
    "over",
    "game-over",
    "spectator",
    "death",
  ];

  for (const phase of excludedPhases) {
    assert.equal(
      canCaptureGameplayPointer({ ...eligiblePointerState, phase }),
      false,
      `${phase} must not capture the pointer`,
    );
  }
});

test("rejects pointer capture for menus tours hidden pages and non-mouse modes", async () => {
  const { canCaptureGameplayPointer } = await import(modulePath);
  const exclusions = [
    { menuOpen: true },
    { controlsTourActive: true },
    { controllerOnly: true },
    { documentVisible: false },
    { rendererReady: false },
    { finePointer: false },
    { pointerType: "touch" },
    { pointerType: "pen" },
    { inputMode: "touch" },
    { inputMode: "controller" },
  ];

  for (const exclusion of exclusions) {
    assert.equal(canCaptureGameplayPointer({ ...eligiblePointerState, ...exclusion }), false);
  }
});

test("clears firing ADS keyboard aliases and touch input without mutating the source", async () => {
  const { clearTransientInput } = await import(modulePath);
  const source = {
    firing: true,
    ads: true,
    keys: {
      w: true,
      a: true,
      s: true,
      d: true,
      arrowup: true,
      arrowdown: true,
      arrowleft: true,
      arrowright: true,
      r: true,
    },
    touch: { mx: 0.75, mz: -0.5, ax: 0.25, az: -0.4, fire: true },
    controllerButtons: [true, false, true],
  };
  const snapshot = structuredClone(source);

  const cleared = clearTransientInput(source);

  assert.deepEqual(cleared, {
    firing: false,
    ads: false,
    keys: {
      w: false,
      a: false,
      s: false,
      d: false,
      arrowup: false,
      arrowdown: false,
      arrowleft: false,
      arrowright: false,
      r: false,
    },
    touch: { mx: 0, mz: 0, ax: 0, az: 0, fire: false },
    controllerButtonLatch: [true, false, true],
  });
  assert.deepEqual(source, snapshot);
});

test("normalizes malformed transient input to an inert state", async () => {
  const { clearTransientInput } = await import(modulePath);

  assert.deepEqual(clearTransientInput({ keys: null, touch: null, controllerButtons: "held" }), {
    firing: false,
    ads: false,
    keys: {
      w: false,
      a: false,
      s: false,
      d: false,
      arrowup: false,
      arrowdown: false,
      arrowleft: false,
      arrowright: false,
    },
    touch: { mx: 0, mz: 0, ax: 0, az: 0, fire: false },
    controllerButtonLatch: [],
  });
});

test("blur and hidden visibility clear local input and require a deliberate pointer return", async () => {
  const { resolveTransientInputReset } = await import(modulePath);
  const source = {
    keys: { w: true, arrowup: true, r: true },
    touch: { mx: 0.8, mz: -0.2, ax: 0.4, az: -0.6, fire: true },
    controllerButtons: [true, false, true],
  };

  for (const reason of ["window-blur", "document-hidden"]) {
    assert.deepEqual(resolveTransientInputReset({
      reason,
      pointerResumeEligible: true,
      ...source,
    }), {
      reason,
      shouldReset: true,
      requiresPointerClick: true,
      state: {
        firing: false,
        ads: false,
        keys: {
          w: false,
          arrowup: false,
          r: false,
          a: false,
          s: false,
          d: false,
          arrowdown: false,
          arrowleft: false,
          arrowright: false,
        },
        touch: { mx: 0, mz: 0, ax: 0, az: 0, fire: false },
        controllerButtonLatch: [true, false, true],
      },
    });
  }
});

test("pointer-lock loss and canvas exit clear input and require a new click", async () => {
  const { resolveTransientInputReset } = await import(modulePath);

  for (const reason of ["pointer-lock-lost", "canvas-exit", "pointer-capture-lost"]) {
    const result = resolveTransientInputReset({
      reason,
      pointerResumeEligible: true,
      keys: { d: true, arrowright: true, f: true },
      touch: { mx: 1, mz: 1, ax: 1, az: 1, fire: true },
      controllerButtons: [false, true],
    });

    assert.equal(result.shouldReset, true, reason);
    assert.equal(result.requiresPointerClick, true, reason);
    assert.equal(result.state.firing, false, reason);
    assert.equal(result.state.ads, false, reason);
    assert.equal(Object.values(result.state.keys).some(Boolean), false, reason);
    assert.deepEqual(result.state.touch, { mx: 0, mz: 0, ax: 0, az: 0, fire: false }, reason);
    assert.deepEqual(result.state.controllerButtonLatch, [false, true], reason);
  }
});

test("WebGL loss clears local input without requiring a synthetic pointer click", async () => {
  const { resolveTransientInputReset } = await import(modulePath);

  const result = resolveTransientInputReset({
    reason: "webgl-context-lost",
    pointerResumeEligible: true,
    keys: { a: true, q: true },
    touch: { mx: -1, mz: 0.5, ax: 0, az: 0.25, fire: true },
    controllerButtons: [true],
  });

  assert.equal(result.shouldReset, true);
  assert.equal(result.requiresPointerClick, false);
  assert.equal(Object.values(result.state.keys).some(Boolean), false);
  assert.deepEqual(result.state.touch, { mx: 0, mz: 0, ax: 0, az: 0, fire: false });
  assert.deepEqual(result.state.controllerButtonLatch, [true]);
});

test("ignores unrelated events instead of clearing active input", async () => {
  const { resolveTransientInputReset } = await import(modulePath);

  assert.deepEqual(resolveTransientInputReset({
    reason: "resize",
    pointerResumeEligible: true,
    keys: { w: true },
  }), {
    reason: "resize",
    shouldReset: false,
    requiresPointerClick: false,
    state: null,
  });
});

test("updates pixel ratio across monitors within the selected graphics tier", async () => {
  const { resolveRendererMetrics } = await import(modulePath);

  const standard = resolveRendererMetrics({
    width: 1280,
    height: 720,
    devicePixelRatio: 1,
    graphicsTier: "medium",
  });
  const highDpr = resolveRendererMetrics({
    width: 1280,
    height: 720,
    devicePixelRatio: 2.5,
    graphicsTier: "medium",
  });

  assert.deepEqual(standard, {
    width: 1280,
    height: 720,
    pixelRatio: 1,
    aspect: 16 / 9,
    bufferWidth: 1280,
    bufferHeight: 720,
    graphicsTier: "medium",
  });
  assert.deepEqual(highDpr, {
    width: 1280,
    height: 720,
    pixelRatio: 1.75,
    aspect: 16 / 9,
    bufferWidth: 2240,
    bufferHeight: 1260,
    graphicsTier: "medium",
  });
});

test("bounds renderer dimensions while preserving the viewport aspect", async () => {
  const { resolveRendererMetrics } = await import(modulePath);

  const metrics = resolveRendererMetrics({
    width: 7680,
    height: 4320,
    devicePixelRatio: 4,
    graphicsTier: "high",
  });

  assert.deepEqual(metrics, {
    width: 1365,
    height: 768,
    pixelRatio: 3,
    aspect: 16 / 9,
    bufferWidth: 4095,
    bufferHeight: 2304,
    graphicsTier: "high",
  });
  assert.ok(metrics.bufferWidth <= 4096);
  assert.ok(metrics.bufferHeight <= 2304);
});

test("uses safe renderer fallbacks for malformed metrics and tiers", async () => {
  const { resolveRendererMetrics } = await import(modulePath);

  assert.deepEqual(resolveRendererMetrics({
    width: Number.NaN,
    height: -10,
    devicePixelRatio: Number.POSITIVE_INFINITY,
    graphicsTier: "ultra",
  }), {
    width: 1,
    height: 1,
    pixelRatio: 1,
    aspect: 1,
    bufferWidth: 1,
    bufferHeight: 1,
    graphicsTier: "medium",
  });
});

test("treats inherited property names as invalid graphics tiers", async () => {
  const { resolveRendererMetrics } = await import(modulePath);

  assert.deepEqual(resolveRendererMetrics({
    width: 800,
    height: 600,
    devicePixelRatio: 2,
    graphicsTier: "toString",
  }), {
    width: 800,
    height: 600,
    pixelRatio: 1.75,
    aspect: 4 / 3,
    bufferWidth: 1400,
    bufferHeight: 1050,
    graphicsTier: "medium",
  });
});
