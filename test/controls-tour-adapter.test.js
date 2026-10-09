const assert = require("node:assert/strict");
const test = require("node:test");

async function controlsTourAdapter() {
  return import("../public/controls-tour-adapter.mjs");
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function profile(playerTag, profileId) {
  return { playerTag, profileId, backendSession: `session-${profileId}` };
}

function createPreferenceWriter() {
  const storage = new Map();
  return {
    storage,
    read(capture) {
      return [
        ...(storage.get(capture.storageKey) || []),
        ...(capture.profileRef?.controlsTourSeenFamilies || []),
      ];
    },
    apply({ capture, families }) {
      const saved = [...families];
      storage.set(capture.storageKey, saved);
      if (capture.profileRef) capture.profileRef.controlsTourSeenFamilies = saved;
      return saved;
    },
  };
}

test("a delayed preference response saves to the unchanged initiating player", async () => {
  const { syncControlsTourPreferencesForIdentity } = await controlsTourAdapter();
  const playerA = profile("WS-A1B2C3D4", "profile-a");
  let currentIdentity = { profile: playerA, guest: false };
  const remote = deferred();
  const writer = createPreferenceWriter();

  const sync = syncControlsTourPreferencesForIdentity({
    identityInput: currentIdentity,
    getCurrentIdentityInput: () => currentIdentity,
    localFamilies: ["keyboard-mouse"],
    requestFamilies: () => remote.promise,
    applyFamilies: value => writer.apply(value),
  });
  remote.resolve(["touch"]);

  const result = await sync;
  assert.equal(result.status, "applied");
  assert.deepEqual(result.families, ["keyboard-mouse", "touch"]);
  assert.deepEqual(playerA.controlsTourSeenFamilies, ["keyboard-mouse", "touch"]);
  assert.equal(writer.storage.size, 1);
});

test("a delayed same-player response preserves a newly completed linked-profile family", async () => {
  const { syncControlsTourPreferencesForIdentity } = await controlsTourAdapter();
  const playerA = profile("WS-A1B2C3D4", "profile-a");
  const currentIdentity = { profile: playerA, guest: false };
  const remote = deferred();
  const writer = createPreferenceWriter();
  let capture;

  const sync = syncControlsTourPreferencesForIdentity({
    identityInput: currentIdentity,
    getCurrentIdentityInput: () => currentIdentity,
    localFamilies: ["keyboard-mouse"],
    requestFamilies: captured => {
      capture = captured;
      return remote.promise;
    },
    readCurrentFamilies: captured => writer.read(captured),
    applyFamilies: value => writer.apply(value),
  });
  writer.apply({ capture, families: ["keyboard-mouse", "touch"] });
  remote.resolve(["keyboard-mouse"]);

  const result = await sync;
  assert.equal(result.status, "applied");
  assert.deepEqual(result.families, ["keyboard-mouse", "touch"]);
  assert.deepEqual(playerA.controlsTourSeenFamilies, ["keyboard-mouse", "touch"]);
  assert.deepEqual(writer.storage.get(capture.storageKey), ["keyboard-mouse", "touch"]);
});

test("a delayed same-guest response preserves a newly completed local-key family", async () => {
  const { syncControlsTourPreferencesForIdentity } = await controlsTourAdapter();
  const currentIdentity = { profile: null, guest: true };
  const remote = deferred();
  const writer = createPreferenceWriter();
  let capture;

  const sync = syncControlsTourPreferencesForIdentity({
    identityInput: currentIdentity,
    getCurrentIdentityInput: () => currentIdentity,
    localFamilies: ["keyboard-mouse"],
    requestFamilies: captured => {
      capture = captured;
      return remote.promise;
    },
    readCurrentFamilies: captured => writer.read(captured),
    applyFamilies: value => writer.apply(value),
  });
  writer.apply({ capture, families: ["keyboard-mouse", "touch"] });
  remote.resolve(["keyboard-mouse"]);

  const result = await sync;
  assert.equal(result.status, "applied");
  assert.deepEqual(result.families, ["keyboard-mouse", "touch"]);
  assert.equal(capture.profileRef, null);
  assert.deepEqual(writer.storage.get(capture.storageKey), ["keyboard-mouse", "touch"]);
});

test("a delayed Player A response is discarded after switching to Player B", async () => {
  const { controlsTourStorageKey } = await import("../public/controls-tour.mjs");
  const { syncControlsTourPreferencesForIdentity } = await controlsTourAdapter();
  const playerA = profile("WS-A1B2C3D4", "profile-a");
  const playerB = profile("WS-B1C2D3E4", "profile-b");
  let currentIdentity = { profile: playerA, guest: false };
  const remote = deferred();
  const writer = createPreferenceWriter();

  const sync = syncControlsTourPreferencesForIdentity({
    identityInput: currentIdentity,
    getCurrentIdentityInput: () => currentIdentity,
    localFamilies: ["keyboard-mouse"],
    requestFamilies: () => remote.promise,
    applyFamilies: value => writer.apply(value),
  });
  currentIdentity = { profile: playerB, guest: false };
  remote.resolve(["controller"]);

  const result = await sync;
  assert.equal(result.status, "stale");
  assert.deepEqual(result.families, ["keyboard-mouse"]);
  assert.equal(writer.storage.has(controlsTourStorageKey({ profile: playerB })), false);
  assert.equal(writer.storage.size, 0);
  assert.equal(playerA.controlsTourSeenFamilies, undefined);
  assert.equal(playerB.controlsTourSeenFamilies, undefined);
});

test("a delayed Player A response is discarded after switching to Guest", async () => {
  const { controlsTourStorageKey } = await import("../public/controls-tour.mjs");
  const { syncControlsTourPreferencesForIdentity } = await controlsTourAdapter();
  const playerA = profile("WS-A1B2C3D4", "profile-a");
  let currentIdentity = { profile: playerA, guest: false };
  const remote = deferred();
  const writer = createPreferenceWriter();

  const sync = syncControlsTourPreferencesForIdentity({
    identityInput: currentIdentity,
    getCurrentIdentityInput: () => currentIdentity,
    localFamilies: ["keyboard-mouse"],
    requestFamilies: () => remote.promise,
    applyFamilies: value => writer.apply(value),
  });
  currentIdentity = { profile: null, guest: true };
  remote.resolve(["touch"]);

  const result = await sync;
  assert.equal(result.status, "stale");
  assert.equal(writer.storage.has(controlsTourStorageKey({ guest: true })), false);
  assert.equal(writer.storage.size, 0);
  assert.equal(playerA.controlsTourSeenFamilies, undefined);
});

test("required modal locking makes only background surfaces inert and reverses cleanly", async () => {
  const { applyRequiredControlsTourLock } = await controlsTourAdapter();
  const classes = new Set();
  const bodyClassList = {
    toggle(name, enabled) {
      if (enabled) classes.add(name);
      else classes.delete(name);
    },
  };
  const lobby = { inert: false };
  const gameMenu = { inert: false };
  const practiceCanvas = { inert: false };

  assert.equal(applyRequiredControlsTourLock({ required: true, bodyClassList, backgroundTargets: [lobby, gameMenu] }), true);
  assert.equal(classes.has("controls-tour-required"), true);
  assert.equal(lobby.inert, true);
  assert.equal(gameMenu.inert, true);
  assert.equal(practiceCanvas.inert, false);

  assert.equal(applyRequiredControlsTourLock({ required: false, bodyClassList, backgroundTargets: [lobby, gameMenu] }), false);
  assert.equal(classes.has("controls-tour-required"), false);
  assert.equal(lobby.inert, false);
  assert.equal(gameMenu.inert, false);
});
