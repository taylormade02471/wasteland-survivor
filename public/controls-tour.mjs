const FAMILY_ALIASES = Object.freeze({
  keyboard: "keyboard-mouse",
  mouse: "keyboard-mouse",
  "keyboard-mouse": "keyboard-mouse",
  touch: "touch",
  controller: "controller",
});
const PLAYER_TAG_PATTERN = /^WS-[A-F0-9]{6,8}$/;
const LIVE_GAME_PHASES = new Set(["countdown", "combat", "prep"]);
const CONTROLS_TOUR_STORAGE_PREFIX = "wastland-survivor-controls-tour-seen";

const FAMILY_STEPS = Object.freeze({
  "keyboard-mouse": Object.freeze([
    Object.freeze({ id: "move", title: "Move", control: "WASD or arrow keys", instruction: "Press a movement key." }),
    Object.freeze({ id: "aim", title: "Aim", control: "Mouse", instruction: "Move the mouse to look around." }),
    Object.freeze({ id: "fire", title: "Fire", control: "Left mouse button", instruction: "Press the primary mouse button." }),
    Object.freeze({ id: "pause", title: "Pause and menu", control: "Escape", instruction: "Press Escape to open the field menu." }),
    Object.freeze({ id: "ability", title: "Ability", control: "F key", instruction: "Press F to activate your survivor ability." }),
  ]),
  touch: Object.freeze([
    Object.freeze({ id: "move", title: "Move", control: "Move stick", instruction: "Drag the left move stick." }),
    Object.freeze({ id: "aim", title: "Aim", control: "Aim stick", instruction: "Drag the right aim stick." }),
    Object.freeze({ id: "fire", title: "Fire", control: "Fire", instruction: "Tap Fire." }),
    Object.freeze({ id: "pause", title: "Pause and menu", control: "Pause", instruction: "Tap Pause." }),
    Object.freeze({ id: "ability", title: "Ability", control: "Ability", instruction: "Tap Ability." }),
  ]),
  controller: Object.freeze([
    Object.freeze({ id: "move", title: "Move", control: "Left stick", instruction: "Move the left stick." }),
    Object.freeze({ id: "aim", title: "Aim", control: "Right stick", instruction: "Move the right stick." }),
    Object.freeze({ id: "fire", title: "Fire", control: "Right trigger", instruction: "Press the right trigger." }),
    Object.freeze({ id: "pause", title: "Pause and menu", control: "Menu button", instruction: "Press the Menu button." }),
    Object.freeze({ id: "ability", title: "Ability", control: "B button", instruction: "Press B to activate your survivor ability." }),
  ]),
});

export function normalizeControlsFamily(value) {
  return FAMILY_ALIASES[String(value || "").toLowerCase()] || "keyboard-mouse";
}

export function controlsTourStorageIdentity({ profile = null, guest = false } = {}) {
  if (guest) return "guest:offline";
  const playerTag = String(profile?.playerTag || "").trim().toUpperCase();
  if (PLAYER_TAG_PATTERN.test(playerTag)) return `tag:${playerTag}`;
  const profileId = String(profile?.profileId || "").trim();
  return profileId ? `profile:${profileId}` : "profile:unassigned";
}

export function controlsTourStorageKey(input = {}) {
  return `${CONTROLS_TOUR_STORAGE_PREFIX}:${encodeURIComponent(controlsTourStorageIdentity(input))}`;
}

export function mergeSeenControlsFamilies(...sources) {
  const seen = [];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const value of source) {
      const key = FAMILY_ALIASES[String(value || "").toLowerCase()];
      if (key && !seen.includes(key)) seen.push(key);
    }
  }
  return seen;
}

export function controlsForFamily(family) {
  return FAMILY_STEPS[normalizeControlsFamily(family)];
}

export function isControlsTourRequired({ family, seenFamilies = [] } = {}) {
  return !mergeSeenControlsFamilies(seenFamilies).includes(normalizeControlsFamily(family));
}

export function shouldOfferControlsMiniTour({ family, seenFamilies = [], matchActive = false, tourActive = false } = {}) {
  const seen = mergeSeenControlsFamilies(seenFamilies);
  return Boolean(matchActive && !tourActive && seen.length && !seen.includes(normalizeControlsFamily(family)));
}

export function createControlsTour({ family, seenFamilies = [], mode = "required" } = {}) {
  const normalizedFamily = normalizeControlsFamily(family);
  const normalizedMode = ["required", "replay", "mini"].includes(mode) ? mode : "required";
  return Object.freeze({
    family: normalizedFamily,
    mode: normalizedMode,
    status: "active",
    stepIndex: 0,
    steps: controlsForFamily(normalizedFamily),
    seenFamilies: mergeSeenControlsFamilies(seenFamilies),
    controllerArmed: normalizedFamily === "controller",
  });
}

export function createPendingMatchGate() {
  return Object.freeze({ nextId: 1, pending: null });
}

export function queuePendingMatchSelection(gate = createPendingMatchGate(), selection) {
  if (gate.pending || typeof selection !== "function") return gate;
  return Object.freeze({
    nextId: gate.nextId + 1,
    pending: Object.freeze({ id: gate.nextId, selection }),
  });
}

export function cancelPendingMatchSelection(gate = createPendingMatchGate()) {
  if (!gate.pending) return gate;
  return Object.freeze({ nextId: gate.nextId, pending: null });
}

export function resolvePendingMatchSelection(gate = createPendingMatchGate(), { family, seenFamilies = [] } = {}) {
  if (!gate.pending) return { action: "idle", gate, family: null, selection: null };
  const normalizedFamily = normalizeControlsFamily(family);
  if (isControlsTourRequired({ family: normalizedFamily, seenFamilies })) {
    return { action: "tour", gate, family: normalizedFamily, selection: null };
  }
  return {
    action: "start",
    gate: cancelPendingMatchSelection(gate),
    family: normalizedFamily,
    selection: gate.pending.selection,
  };
}

export function isLiveControlsTourPhase(phase) {
  return LIVE_GAME_PHASES.has(String(phase || ""));
}

export function planOptionalControlsTour({ family, mode = "mini", phase } = {}) {
  const queued = Object.freeze({
    family: normalizeControlsFamily(family),
    mode: mode === "replay" ? "replay" : "mini",
  });
  return isLiveControlsTourPhase(phase) ? { action: "queue", queued } : { action: "start", queued };
}

export function releaseQueuedControlsTour({ queued = null, phase, tourActive = false } = {}) {
  if (!queued) return { action: "idle", family: null, mode: null };
  if (tourActive || isLiveControlsTourPhase(phase)) return { action: "wait", family: queued.family, mode: queued.mode };
  return { action: "start", family: queued.family, mode: queued.mode };
}

export function cancelQueuedControlsTour() {
  return null;
}

export function shouldBlockControlsTourSimulation({ tour = null, phase } = {}) {
  return Boolean(tour?.status === "active" && !isLiveControlsTourPhase(phase));
}

export function recognizeControlsTourAction(family, signal = {}) {
  const normalizedFamily = normalizeControlsFamily(family);
  if (normalizedFamily === "keyboard-mouse") {
    if (signal.source === "keyboard" && signal.kind === "down") {
      const key = String(signal.key || "").toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) return "move";
      if (key === "escape") return "pause";
      if (key === "f") return "ability";
    }
    if (signal.source === "pointer" && signal.kind === "move" && Math.hypot(Number(signal.movementX) || 0, Number(signal.movementY) || 0) >= 2) return "aim";
    if (signal.source === "pointer" && signal.kind === "down" && Number(signal.button || 0) === 0) return "fire";
    return null;
  }
  if (normalizedFamily === "touch") {
    if (signal.source === "touch-stick" && Number(signal.magnitude) >= 0.2) return signal.control === "move" ? "move" : signal.control === "aim" ? "aim" : null;
    if (signal.source === "touch-button" && ["fire", "pause", "ability"].includes(signal.control)) return signal.control;
    return null;
  }
  if (signal.source !== "controller") return null;
  if (signal.control === "left-stick" && Number(signal.magnitude) >= 0.2) return "move";
  if (signal.control === "right-stick" && Number(signal.magnitude) >= 0.2) return "aim";
  if (signal.control === "right-trigger" && Number(signal.value) >= 0.2) return "fire";
  if (signal.control === "menu" && signal.pressed) return "pause";
  if (signal.control === "b" && signal.pressed) return "ability";
  return null;
}

export function recordControlsTourSignal(state, signal) {
  if (!state || state.status !== "active") return state;
  const action = recognizeControlsTourAction(state.family, signal);
  if (action !== state.steps[state.stepIndex]?.id) return state;
  const stepIndex = state.stepIndex + 1;
  const complete = stepIndex >= state.steps.length;
  return Object.freeze({
    ...state,
    status: complete ? "complete" : "active",
    stepIndex,
    seenFamilies: complete ? mergeSeenControlsFamilies(state.seenFamilies, [state.family]) : state.seenFamilies,
  });
}

function controllerSnapshotNeutral(snapshot = {}) {
  return Number(snapshot.leftStick || 0) < 0.2
    && Number(snapshot.rightStick || 0) < 0.2
    && Number(snapshot.rightTrigger || 0) < 0.2
    && !snapshot.menu
    && !snapshot.b;
}

function controllerSignalForStep(stepId, snapshot = {}) {
  if (stepId === "move") return { source: "controller", control: "left-stick", magnitude: Number(snapshot.leftStick) || 0 };
  if (stepId === "aim") return { source: "controller", control: "right-stick", magnitude: Number(snapshot.rightStick) || 0 };
  if (stepId === "fire") return { source: "controller", control: "right-trigger", value: Number(snapshot.rightTrigger) || 0 };
  if (stepId === "pause") return { source: "controller", control: "menu", pressed: Boolean(snapshot.menu) };
  if (stepId === "ability") return { source: "controller", control: "b", pressed: Boolean(snapshot.b) };
  return null;
}

export function recordControlsTourControllerSnapshot(state, snapshot = {}) {
  if (!state || state.status !== "active" || state.family !== "controller") return state;
  const neutral = controllerSnapshotNeutral(snapshot);
  if (!state.controllerArmed) {
    return neutral ? Object.freeze({ ...state, controllerArmed: true }) : state;
  }
  if (neutral) return state;
  const signal = controllerSignalForStep(state.steps[state.stepIndex]?.id, snapshot);
  const advanced = signal ? recordControlsTourSignal(state, signal) : state;
  return advanced === state ? state : Object.freeze({ ...advanced, controllerArmed: false });
}
