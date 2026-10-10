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

test("scales idle and selected focus deliberately across every tier", async () => {
  const { resolveMenuPresentation } = await import(modulePath);
  const expected = {
    low: { idle: 0.38, selected: 0.70, forwardPx: 2, disturbance: 0.08 },
    medium: { idle: 0.48, selected: 0.85, forwardPx: 4, disturbance: 0.20 },
    high: { idle: 0.58, selected: 1, forwardPx: 6, disturbance: 0.34 },
  };

  for (const [tier, values] of Object.entries(expected)) {
    const idle = resolveMenuPresentation({ section: "lobby", tier, reducedMotion: false });
    const selected = resolveMenuPresentation({ section: "lobby", focusedCommand: "teamLobbyBtn", tier, reducedMotion: false });
    const reducedIdle = resolveMenuPresentation({ section: "lobby", tier, reducedMotion: true });
    const reduced = resolveMenuPresentation({ section: "lobby", focusedCommand: "teamLobbyBtn", tier, reducedMotion: true });

    assert.equal(idle.focus.illumination, values.idle, `${tier} idle illumination`);
    assert.equal(idle.focus.forwardPx, 0, `${tier} idle movement`);
    assert.equal(idle.focus.selectedIllumination, values.selected, `${tier} available focus illumination`);
    assert.equal(idle.focus.selectedForwardPx, values.forwardPx, `${tier} available focus movement`);
    assert.equal(selected.focus.illumination, values.selected, `${tier} selected illumination`);
    assert.equal(selected.focus.forwardPx, values.forwardPx, `${tier} selected movement`);
    assert.equal(selected.surface.localDisturbance, values.disturbance, `${tier} local disturbance`);
    assert.equal(reducedIdle.focus.illumination, values.idle, `${tier} reduced-motion idle illumination`);
    assert.equal(reducedIdle.focus.forwardPx, 0, `${tier} reduced-motion idle movement`);
    assert.equal(reducedIdle.focus.selectedForwardPx, 0, `${tier} reduced-motion available movement`);
    assert.equal(reducedIdle.surface.localDisturbance, 0, `${tier} reduced-motion idle disturbance`);
    assert.equal(reduced.focus.illumination, values.selected, `${tier} reduced-motion illumination`);
    assert.equal(reduced.focus.forwardPx, 0, `${tier} reduced-motion movement`);
    assert.equal(reduced.surface.localDisturbance, 0, `${tier} reduced-motion disturbance`);
  }
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

test("bundled loop uses the shipped water-walk MP4 when no replay plays", async () => {
  const { resolveMenuMedia } = await import(modulePath);
  const result = resolveMenuMedia({ tier: "high", playbackState: "loading" });

  assert.equal(result.kind, "bundled");
  assert.deepEqual(result.sources, [
    { src: "./assets/nightfall/video/nightfall-water-walk-v1.mp4", type: "video/mp4" },
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
  assert.equal(result.sources.length, 1);
});

test("autoplay decode data saver and reduced motion retain the fallback with no blank frame", async () => {
  const { resolveMenuMedia } = await import(modulePath);
  const blockedCases = [
    { tier: "high", autoplayFailed: true },
    { tier: "high", decodeFailed: true },
    { tier: "high", saveData: true },
    { tier: "high", reducedMotion: true },
  ];

  for (const input of blockedCases) {
    const result = resolveMenuMedia({ ...input, playbackState: "playing" });
    assert.equal(result.kind, "fallback");
    assert.equal(result.fallbackVisible, true);
    assert.equal(result.autoplay, false);
    assert.deepEqual(result.sources, []);
  }
});

test("low graphics tier still uses the bundled water-walk loop", async () => {
  const { resolveMenuMedia } = await import(modulePath);
  const result = resolveMenuMedia({ tier: "low", playbackState: "loading" });

  assert.equal(result.kind, "bundled");
  assert.equal(result.autoplay, true);
  assert.deepEqual(result.sources, [
    { src: "./assets/nightfall/video/nightfall-water-walk-v1.mp4", type: "video/mp4" },
  ]);
});
