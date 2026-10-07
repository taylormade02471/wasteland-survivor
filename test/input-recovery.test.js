const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const modulePath = new URL("../public/input-recovery.mjs", `file://${__filename.replace(/\\/g, "/")}`);
const adapterPath = new URL("../public/input-recovery-adapter.mjs", `file://${__filename.replace(/\\/g, "/")}`);

function pointerEvent(type, pointerId, pointerType = "touch") {
  const event = new Event(type);
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  });
  return event;
}

class PointerTarget extends EventTarget {
  #capturedPointers = new Set();

  setPointerCapture(pointerId) {
    this.#capturedPointers.add(pointerId);
  }

  hasPointerCapture(pointerId) {
    return this.#capturedPointers.has(pointerId);
  }

  losePointerCapture(pointerId) {
    this.#capturedPointers.delete(pointerId);
    this.dispatchEvent(pointerEvent("lostpointercapture", pointerId));
  }
}

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

test("a canvas touch handoff clears mouse recovery without exposing pointer lock", async () => {
  const { applyCanvasPointerHandoff } = await import(adapterPath);
  let inputMode = "mouse";
  let pointerResumeRequired = true;
  const modes = [];

  const result = applyCanvasPointerHandoff(pointerEvent("pointerdown", 17), {
    inputMode,
    pointerResumeRequired,
    setInputMode(nextMode) {
      modes.push(nextMode);
      inputMode = nextMode;
      if (nextMode !== "mouse") pointerResumeRequired = false;
    },
  });

  assert.deepEqual(result, {
    inputMode: "touch",
    pointerLockCandidate: false,
    consumesCanvasAction: true,
  });
  assert.deepEqual(modes, ["touch"]);
  assert.equal(inputMode, "touch");
  assert.equal(pointerResumeRequired, false);
});

test("normal touch canvas input preserves the existing fire-action path", async () => {
  const { applyCanvasPointerHandoff } = await import(adapterPath);

  const result = applyCanvasPointerHandoff(pointerEvent("pointerdown", 19), {
    inputMode: "touch",
    pointerResumeRequired: false,
    setInputMode() {},
  });

  assert.equal(result.inputMode, "touch");
  assert.equal(result.pointerLockCandidate, false);
  assert.equal(result.consumesCanvasAction, false);
});

test("mouse handoff preserves the pointer-lock eligibility path", async () => {
  const { applyCanvasPointerHandoff } = await import(adapterPath);
  const modes = [];

  const result = applyCanvasPointerHandoff(pointerEvent("pointerdown", 18, "mouse"), {
    setInputMode: mode => modes.push(mode),
  });

  assert.deepEqual(result, {
    inputMode: "mouse",
    pointerLockCandidate: true,
    consumesCanvasAction: false,
  });
  assert.deepEqual(modes, ["mouse"]);
});

test("unexpected capture loss from either touch stick routes through a complete reset", async () => {
  const { bindTransientPointerInterrupts } = await import(adapterPath);
  const { resolveTransientInputReset } = await import(modulePath);
  const moveStick = new PointerTarget();
  const aimStick = new PointerTarget();
  let localInput = {
    firing: true,
    ads: true,
    keys: { w: true, arrowup: true },
    touch: { mx: 0.8, mz: -0.4, ax: 0.6, az: -0.2, fire: true },
    controllerButtons: [true, false],
  };
  const interruptions = [];
  const unbind = bindTransientPointerInterrupts({
    targets: [moveStick, aimStick],
    interrupt(reason) {
      interruptions.push(reason);
      const reset = resolveTransientInputReset({
        reason,
        pointerResumeEligible: false,
        keys: localInput.keys,
        touch: localInput.touch,
        controllerButtons: localInput.controllerButtons,
      });
      localInput = { ...localInput, ...reset.state };
    },
  });

  moveStick.dispatchEvent(pointerEvent("pointerdown", 21));
  moveStick.setPointerCapture(21);
  moveStick.losePointerCapture(21);

  assert.deepEqual(interruptions, ["pointer-capture-lost"]);
  assert.equal(localInput.firing, false);
  assert.equal(localInput.ads, false);
  assert.equal(Object.values(localInput.keys).some(Boolean), false);
  assert.deepEqual(localInput.touch, { mx: 0, mz: 0, ax: 0, az: 0, fire: false });

  localInput.touch.ax = 0.75;
  aimStick.dispatchEvent(pointerEvent("pointerdown", 22));
  aimStick.setPointerCapture(22);
  aimStick.losePointerCapture(22);

  assert.deepEqual(interruptions, ["pointer-capture-lost", "pointer-capture-lost"]);
  assert.equal(localInput.touch.ax, 0);
  unbind();
});

test("touch cancel and uncaptured leave interrupt all local transients", async () => {
  const { bindTransientPointerInterrupts } = await import(adapterPath);
  const moveStick = new PointerTarget();
  const fireButton = new PointerTarget();
  const interruptions = [];
  const unbind = bindTransientPointerInterrupts({
    targets: [moveStick, fireButton],
    interrupt: reason => interruptions.push(reason),
  });

  moveStick.dispatchEvent(pointerEvent("pointerdown", 31));
  moveStick.setPointerCapture(31);
  moveStick.dispatchEvent(pointerEvent("pointercancel", 31));

  fireButton.dispatchEvent(pointerEvent("pointerdown", 32));
  fireButton.dispatchEvent(pointerEvent("pointerleave", 32));

  assert.deepEqual(interruptions, ["pointer-capture-lost", "pointer-capture-lost"]);
  unbind();
});

test("normal pointer release does not clear a second active touch", async () => {
  const { bindTransientPointerInterrupts } = await import(adapterPath);
  const moveStick = new PointerTarget();
  const aimStick = new PointerTarget();
  const interruptions = [];
  const unbind = bindTransientPointerInterrupts({
    targets: [moveStick, aimStick],
    interrupt: reason => interruptions.push(reason),
  });

  moveStick.dispatchEvent(pointerEvent("pointerdown", 41));
  moveStick.setPointerCapture(41);
  aimStick.dispatchEvent(pointerEvent("pointerdown", 42));
  aimStick.setPointerCapture(42);
  moveStick.dispatchEvent(pointerEvent("pointerup", 41));
  moveStick.losePointerCapture(41);

  assert.deepEqual(interruptions, []);
  assert.equal(aimStick.hasPointerCapture(42), true);
  unbind();
});

test("game routes every transient touch capture owner through the tested adapter", () => {
  const game = fs.readFileSync(path.resolve(__dirname, "../public/game3d.js"), "utf8");

  assert.match(game, /import \{ applyCanvasPointerHandoff, bindTransientPointerInterrupts \} from "\.\/input-recovery-adapter\.mjs"/);
  assert.match(game, /targets: \[moveStick, aimStick, touchFireButton, touchAdsButton\]/);
  assert.match(game, /interrupt: interruptLocalInput/);
  assert.match(game, /touchStickReleases\.forEach\(release => release\(\)\)/);
  assert.match(game, /element\.addEventListener\("lostpointercapture", release\)/);
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
