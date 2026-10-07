const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

async function controlsTour() {
  return import("../public/controls-tour.mjs");
}

test("requires an unseen family and advances only through its ordered demonstrated actions", async () => {
  const {
    createControlsTour,
    isControlsTourRequired,
    recordControlsTourSignal,
  } = await controlsTour();

  assert.equal(isControlsTourRequired({ family: "mouse", seenFamilies: [] }), true);
  let state = createControlsTour({ family: "mouse", seenFamilies: [] });
  assert.equal(state.family, "keyboard-mouse");
  assert.deepEqual(state.steps.map(step => step.id), ["move", "aim", "fire", "pause", "ability"]);

  const outOfOrder = recordControlsTourSignal(state, { source: "pointer", kind: "down", button: 0 });
  assert.equal(outOfOrder, state);

  const signals = [
    { source: "keyboard", kind: "down", key: "w" },
    { source: "pointer", kind: "move", movementX: 4, movementY: 0 },
    { source: "pointer", kind: "down", button: 0 },
    { source: "keyboard", kind: "down", key: "Escape" },
    { source: "keyboard", kind: "down", key: "f" },
  ];
  for (const signal of signals) state = recordControlsTourSignal(state, signal);

  assert.equal(state.status, "complete");
  assert.deepEqual(state.seenFamilies, ["keyboard-mouse"]);
  assert.equal(isControlsTourRequired({ family: "keyboard", seenFamilies: state.seenFamilies }), false);
});

test("shows only touch controls and recognizes real touch control signals", async () => {
  const { createControlsTour, recordControlsTourSignal } = await controlsTour();
  let state = createControlsTour({ family: "touch", seenFamilies: [] });

  assert.deepEqual(state.steps.map(step => step.control), [
    "Move stick",
    "Aim stick",
    "Fire",
    "Pause",
    "Ability",
  ]);
  const signals = [
    { source: "touch-stick", control: "move", magnitude: 0.4 },
    { source: "touch-stick", control: "aim", magnitude: 0.4 },
    { source: "touch-button", control: "fire" },
    { source: "touch-button", control: "pause" },
    { source: "touch-button", control: "ability" },
  ];
  for (const signal of signals) state = recordControlsTourSignal(state, signal);
  assert.equal(state.status, "complete");
  assert.deepEqual(state.seenFamilies, ["touch"]);
});

test("recognizes Xbox-style controls and ignores another input family", async () => {
  const { createControlsTour, recordControlsTourSignal } = await controlsTour();
  let state = createControlsTour({ family: "controller", seenFamilies: [] });

  assert.deepEqual(state.steps.map(step => step.control), [
    "Left stick",
    "Right stick",
    "Right trigger",
    "Menu button",
    "B button",
  ]);
  assert.equal(recordControlsTourSignal(state, { source: "keyboard", kind: "down", key: "w" }), state);

  const signals = [
    { source: "controller", control: "left-stick", magnitude: 0.5 },
    { source: "controller", control: "right-stick", magnitude: 0.5 },
    { source: "controller", control: "right-trigger", value: 1 },
    { source: "controller", control: "menu", pressed: true },
    { source: "controller", control: "b", pressed: true },
  ];
  for (const signal of signals) state = recordControlsTourSignal(state, signal);
  assert.equal(state.status, "complete");
});

test("voluntary replay keeps prior completion and an unseen family becomes a non-blocking mini-tour offer", async () => {
  const {
    createControlsTour,
    recordControlsTourSignal,
    shouldOfferControlsMiniTour,
  } = await controlsTour();
  const seenFamilies = ["keyboard-mouse"];

  assert.equal(shouldOfferControlsMiniTour({ family: "touch", seenFamilies, matchActive: true }), true);
  assert.equal(shouldOfferControlsMiniTour({ family: "mouse", seenFamilies, matchActive: true }), false);
  assert.equal(shouldOfferControlsMiniTour({ family: "touch", seenFamilies, matchActive: false }), false);

  let replay = createControlsTour({ family: "keyboard", seenFamilies, mode: "replay" });
  assert.equal(replay.status, "active");
  assert.equal(replay.mode, "replay");
  const signals = [
    { source: "keyboard", kind: "down", key: "ArrowUp" },
    { source: "pointer", kind: "move", movementX: 0, movementY: 3 },
    { source: "pointer", kind: "down", button: 0 },
    { source: "keyboard", kind: "down", key: "Escape" },
    { source: "keyboard", kind: "down", key: "F" },
  ];
  for (const signal of signals) replay = recordControlsTourSignal(replay, signal);
  assert.deepEqual(replay.seenFamilies, ["keyboard-mouse"]);
});

test("normalizes stored seen families without accepting arbitrary private data", async () => {
  const { mergeSeenControlsFamilies } = await controlsTour();
  assert.deepEqual(
    mergeSeenControlsFamilies(["mouse", "touch", "not-a-family"], ["keyboard", "controller", "touch"]),
    ["keyboard-mouse", "touch", "controller"],
  );
});

test("local completion keys isolate profiles and reserve a separate guest identity", async () => {
  const { controlsTourStorageIdentity, controlsTourStorageKey } = await controlsTour();
  const playerA = { playerTag: "WS-A1B2C3D4", profileId: "profile-a" };
  const playerB = { playerTag: "WS-B1C2D3E4", profileId: "profile-b" };
  const localOnlyA = { profileId: "local-a" };
  const localOnlyB = { profileId: "local-b" };

  assert.equal(controlsTourStorageIdentity({ profile: playerA }), "tag:WS-A1B2C3D4");
  assert.equal(controlsTourStorageIdentity({ profile: { ...playerA, profileId: "another-device" } }), "tag:WS-A1B2C3D4");
  assert.notEqual(controlsTourStorageKey({ profile: playerA }), controlsTourStorageKey({ profile: playerB }));
  assert.notEqual(controlsTourStorageKey({ profile: localOnlyA }), controlsTourStorageKey({ profile: localOnlyB }));
  assert.notEqual(controlsTourStorageKey({ guest: true }), controlsTourStorageKey({ profile: playerA }));

  const storage = new Map([[controlsTourStorageKey({ profile: playerA }), JSON.stringify(["keyboard-mouse"])]]);
  assert.equal(storage.has(controlsTourStorageKey({ profile: playerB })), false);
  assert.equal(storage.has(controlsTourStorageKey({ guest: true })), false);
});

test("executable pending match policy rechecks a switched family and consumes one protected selection once", async () => {
  const {
    createPendingMatchGate,
    queuePendingMatchSelection,
    resolvePendingMatchSelection,
  } = await controlsTour();
  const calls = [];
  const firstSelection = () => calls.push("first");
  const replacementSelection = () => calls.push("replacement");
  let gate = queuePendingMatchSelection(createPendingMatchGate(), firstSelection);

  let result = resolvePendingMatchSelection(gate, { family: "keyboard", seenFamilies: [] });
  assert.equal(result.action, "tour");
  assert.equal(result.family, "keyboard-mouse");

  const protectedGate = queuePendingMatchSelection(gate, replacementSelection);
  assert.equal(protectedGate, gate);

  result = resolvePendingMatchSelection(gate, { family: "controller", seenFamilies: ["keyboard-mouse"] });
  assert.equal(result.action, "tour");
  assert.equal(result.family, "controller");

  result = resolvePendingMatchSelection(gate, { family: "controller", seenFamilies: ["keyboard-mouse", "controller"] });
  assert.equal(result.action, "start");
  gate = result.gate;
  result.selection();
  assert.deepEqual(calls, ["first"]);

  const staleResolution = resolvePendingMatchSelection(gate, { family: "controller", seenFamilies: ["keyboard-mouse", "controller"] });
  assert.equal(staleResolution.action, "idle");
  assert.deepEqual(calls, ["first"]);
});

test("optional practice queues through live phases without blocking simulation and starts when safe", async () => {
  const {
    cancelQueuedControlsTour,
    createControlsTour,
    planOptionalControlsTour,
    releaseQueuedControlsTour,
    shouldBlockControlsTourSimulation,
  } = await controlsTour();

  const decision = planOptionalControlsTour({ family: "touch", mode: "mini", phase: "combat" });
  assert.deepEqual(decision, { action: "queue", queued: { family: "touch", mode: "mini" } });
  assert.equal(shouldBlockControlsTourSimulation({ tour: null, phase: "combat" }), false);
  assert.equal(shouldBlockControlsTourSimulation({ tour: createControlsTour({ family: "touch", mode: "mini" }), phase: "combat" }), false);
  assert.equal(releaseQueuedControlsTour({ queued: decision.queued, phase: "countdown" }).action, "wait");
  assert.equal(releaseQueuedControlsTour({ queued: decision.queued, phase: "prep" }).action, "wait");

  const released = releaseQueuedControlsTour({ queued: decision.queued, phase: "over" });
  assert.equal(released.action, "start");
  assert.equal(released.family, "touch");
  assert.equal(released.mode, "mini");
  assert.equal(shouldBlockControlsTourSimulation({ tour: createControlsTour({ family: "touch", mode: "mini" }), phase: "over" }), true);

  const cancelled = cancelQueuedControlsTour(decision.queued);
  assert.equal(cancelled, null);
  assert.equal(releaseQueuedControlsTour({ queued: cancelled, phase: "over" }).action, "idle");
});

test("controller tour accepts one expected action per snapshot and requires neutral rearm", async () => {
  const { createControlsTour, recordControlsTourControllerSnapshot } = await controlsTour();
  let state = createControlsTour({ family: "controller" });
  const simultaneous = { leftStick: 1, rightStick: 1, rightTrigger: 1, menu: true, b: true };

  state = recordControlsTourControllerSnapshot(state, simultaneous);
  assert.equal(state.stepIndex, 1);
  assert.equal(state.controllerArmed, false);

  const blocked = recordControlsTourControllerSnapshot(state, simultaneous);
  assert.equal(blocked, state);
  assert.equal(blocked.stepIndex, 1);

  state = recordControlsTourControllerSnapshot(state, { leftStick: 0, rightStick: 0, rightTrigger: 0, menu: false, b: false });
  assert.equal(state.stepIndex, 1);
  assert.equal(state.controllerArmed, true);

  state = recordControlsTourControllerSnapshot(state, simultaneous);
  assert.equal(state.stepIndex, 2);
});

test("the accessible coach UI exposes replay and family-specific progress without a permanent popup", () => {
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");

  assert.match(html, /id="controlsTourModal"[^>]*class="[^"]*hidden[^"]*"[^>]*role="dialog"/);
  assert.match(html, /id="controlsTourFamily"/);
  assert.match(html, /id="controlsTourSteps"[^>]*aria-live="polite"/);
  assert.match(html, /id="controlsTourReplayBtn"[^>]*type="button"/);
  assert.match(html, /id="controlsMiniTourOffer"[^>]*class="[^"]*hidden/);
  assert.match(css, /\.controls-tour-modal\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[^{]*\{[^}]*\.controls-tour/s);
});

test("static game wiring sanity references the controls-tour policy entry points", () => {
  const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");

  assert.match(game, /from "\.\/controls-tour\.mjs"/);
  assert.match(game, /from "\.\/controls-tour-adapter\.mjs"/);
  assert.match(game, /syncControlsTourPreferencesForIdentity\(/);
  assert.match(game, /applyRequiredControlsTourLock\(/);
  assert.match(game, /async function requestMatchStart/);
  assert.match(game, /resolvePendingMatchSelection\(/);
  assert.match(game, /queuePendingMatchSelection\(/);
  assert.match(game, /shouldBlockControlsTourSimulation\(/);
  assert.match(game, /\$\("soloMode"\)\.onclick = \(\) => requestMatchStart/);
  assert.match(game, /recordControlsTourSignal\(/);
  assert.match(game, /recordControlsTourControllerSnapshot\(/);
  assert.match(game, /persistControlsTourCompletion/);
  assert.match(game, /\$\("controlsTourReplayBtn"\)\.onclick/);
  assert.match(game, /function handleSettingsController\(\)[\s\S]*controlsTourReplayBtn/);
  assert.match(game, /function handleLobbyController\(\)[\s\S]*activateLobbyCommand/);
});
