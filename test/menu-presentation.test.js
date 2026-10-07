const assert = require("node:assert/strict");
const test = require("node:test");

const modulePath = new URL("../public/menu-presentation.mjs", `file://${__filename.replace(/\\/g, "/")}`);

test("resolves a distinct declarative presentation for every menu section", async () => {
  const { resolveMenuPresentation } = await import(modulePath);
  const sections = ["home", "lobby", "survivor", "armory", "friends", "settings"];
  const presentations = sections.map(section => resolveMenuPresentation({
    section,
    focusedCommand: "survivalLobbyBtn",
    tier: "high",
    reducedMotion: false,
  }));

  assert.deepEqual(presentations.map(item => item.section), sections);
  assert.equal(new Set(presentations.map(item => JSON.stringify(item.camera))).size, sections.length);
  assert.equal(new Set(presentations.map(item => item.emphasis)).size, sections.length);
});

test("normalizes profile and connections aliases to their reviewed scene regions", async () => {
  const { resolveMenuPresentation } = await import(modulePath);

  assert.equal(resolveMenuPresentation({ section: "profile" }).section, "survivor");
  assert.equal(resolveMenuPresentation({ section: "connections" }).section, "friends");
  assert.equal(resolveMenuPresentation({ section: "unknown" }).section, "home");
});

test("full motion enables buoyancy ripples vapor and selected particle disturbance", async () => {
  const { resolveMenuPresentation } = await import(modulePath);
  const result = resolveMenuPresentation({
    section: "lobby",
    focusedCommand: "teamLobbyBtn",
    tier: "high",
    reducedMotion: false,
  });

  assert.equal(result.surface.staticTreatment, true);
  assert.ok(result.surface.buoyancyPx > 0);
  assert.ok(result.surface.loopDurationMs > 0);
  assert.ok(result.surface.rippleOpacity > 0);
  assert.ok(result.surface.vaporOpacity > 0);
  assert.ok(result.surface.vaporDriftDurationMs > 0);
  assert.ok(result.particles.disturbance > 0);
  assert.equal(result.focus.command, "teamLobbyBtn");
  assert.ok(result.focus.forwardPx > 0);
  assert.ok(result.focus.illumination > 0);
});

test("lower tiers reduce reflections and particles", async () => {
  const { resolveMenuPresentation } = await import(modulePath);
  const low = resolveMenuPresentation({ section: "lobby", tier: "low" });
  const medium = resolveMenuPresentation({ section: "lobby", tier: "medium" });
  const high = resolveMenuPresentation({ section: "lobby", tier: "high" });

  assert.ok(low.surface.reflectionOpacity < medium.surface.reflectionOpacity);
  assert.ok(medium.surface.reflectionOpacity < high.surface.reflectionOpacity);
  assert.ok(low.particles.budget < medium.particles.budget);
  assert.ok(medium.particles.budget < high.particles.budget);
});

test("reduced motion removes positional and looping effects but keeps static focus treatment", async () => {
  const { resolveMenuPresentation } = await import(modulePath);
  const result = resolveMenuPresentation({
    section: "lobby",
    focusedCommand: "ctf6LobbyBtn",
    tier: "high",
    reducedMotion: true,
  });

  assert.equal(result.camera.transitionMs, 0);
  assert.equal(result.camera.driftPercent, 0);
  assert.equal(result.surface.staticTreatment, true);
  assert.equal(result.surface.buoyancyPx, 0);
  assert.equal(result.surface.loopDurationMs, 0);
  assert.equal(result.surface.rippleOpacity, 0);
  assert.equal(result.surface.vaporDriftDurationMs, 0);
  assert.equal(result.particles.disturbance, 0);
  assert.equal(result.focus.forwardPx, 0);
  assert.ok(result.focus.illumination > 0);
});

test("saved replay has priority and fallback stays visible until playback is confirmed", async () => {
  const { resolveMenuMedia } = await import(modulePath);
  const loading = resolveMenuMedia({
    replayUrl: "blob:recent-match",
    replayType: "video/webm",
    tier: "high",
    playbackState: "loading",
  });
  const playing = resolveMenuMedia({
    replayUrl: "blob:recent-match",
    replayType: "video/webm",
    tier: "high",
    playbackState: "playing",
  });

  assert.equal(loading.kind, "replay");
  assert.deepEqual(loading.sources, [{ src: "blob:recent-match", type: "video/webm" }]);
  assert.equal(loading.fallbackVisible, true);
  assert.equal(playing.kind, "replay");
  assert.equal(playing.fallbackVisible, false);
});

test("bundled loop uses semantic WebM then MP4 source fallback when no replay plays", async () => {
  const { resolveMenuMedia } = await import(modulePath);
  const result = resolveMenuMedia({ tier: "high", playbackState: "loading" });

  assert.equal(result.kind, "bundled");
  assert.deepEqual(result.sources, [
    { src: "./assets/nightfall/backgrounds/nightfall-water-walk-loop-v1.webm", type: "video/webm" },
    { src: "./assets/nightfall/backgrounds/nightfall-water-walk-loop-v1.mp4", type: "video/mp4" },
  ]);
  assert.equal(result.fallbackVisible, true);
});

test("replay failure falls through to the bundled loop", async () => {
  const { resolveMenuMedia } = await import(modulePath);
  const result = resolveMenuMedia({
    replayUrl: "blob:recent-match",
    replayFailed: true,
    tier: "medium",
  });

  assert.equal(result.kind, "bundled");
  assert.equal(result.sources.length, 2);
});

test("autoplay decode data saver reduced motion and low tier retain the fallback with no blank frame", async () => {
  const { resolveMenuMedia } = await import(modulePath);
  const blockedCases = [
    { tier: "high", autoplayFailed: true },
    { tier: "high", decodeFailed: true },
    { tier: "high", saveData: true },
    { tier: "high", reducedMotion: true },
    { tier: "low" },
  ];

  for (const input of blockedCases) {
    const result = resolveMenuMedia({ ...input, playbackState: "playing" });
    assert.equal(result.kind, "fallback");
    assert.equal(result.fallbackVisible, true);
    assert.equal(result.autoplay, false);
    assert.deepEqual(result.sources, []);
  }
});
