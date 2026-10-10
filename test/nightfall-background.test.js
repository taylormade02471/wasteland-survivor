const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const modulePath = new URL("../public/nightfall-background.mjs", `file://${__filename.replace(/\\/g, "/")}`);

test("low tier keeps a static lightweight background", async () => {
  const { backgroundEffectsForTier } = await import(modulePath);
  assert.deepEqual(backgroundEffectsForTier("low", false), {
    fog: false,
    waterReflection: false,
    searchlight: false,
    particles: 8,
    parallax: false,
    pulsingLights: false,
  });
});

test("medium tier enables restrained fog and water", async () => {
  const { backgroundEffectsForTier } = await import(modulePath);
  assert.deepEqual(backgroundEffectsForTier("medium", false), {
    fog: true,
    waterReflection: true,
    searchlight: false,
    particles: 20,
    parallax: true,
    pulsingLights: false,
  });
});

test("high tier enables the complete Nightfall presentation", async () => {
  const { backgroundEffectsForTier } = await import(modulePath);
  assert.deepEqual(backgroundEffectsForTier("high", false), {
    fog: true,
    waterReflection: true,
    searchlight: true,
    particles: 36,
    parallax: true,
    pulsingLights: true,
  });
});

test("reduced motion disables moving and pulsing effects at every tier", async () => {
  const { backgroundEffectsForTier } = await import(modulePath);
  for (const tier of ["low", "medium", "high"]) {
    const effects = backgroundEffectsForTier(tier, true);
    assert.equal(effects.parallax, false);
    assert.equal(effects.pulsingLights, false);
    assert.equal(effects.searchlight, false);
    assert.equal(effects.particles, 0);
  }
});

test("unknown tiers use the restrained medium rules", async () => {
  const { backgroundEffectsForTier } = await import(modulePath);
  assert.deepEqual(backgroundEffectsForTier("ultra", false), backgroundEffectsForTier("medium", false));
});

test("maps declarative menu presentation onto the existing Nightfall visual layers", async () => {
  const { nightfallPresentationStyles } = await import(modulePath);
  const presentationModule = new URL("../public/menu-presentation.mjs", `file://${__filename.replace(/\\/g, "/")}`);
  const { resolveMenuPresentation } = await import(presentationModule);
  const presentation = resolveMenuPresentation({
    section: "armory",
    focusedCommand: "dashboardStoreBtn",
    tier: "high",
    reducedMotion: false,
  });

  assert.deepEqual(nightfallPresentationStyles(presentation), {
    "--menu-camera-x": "-2.7%",
    "--menu-camera-y": "0.8%",
    "--menu-camera-scale": "1.065",
    "--menu-camera-duration": "520ms",
    "--menu-camera-drift": "0.9%",
    "--menu-amber-light": "0.66",
    "--menu-cyan-light": "0.28",
    "--menu-reflection-opacity": "0.42",
    "--menu-disturbance": "0.34",
  });
});

test("menu and low-tier CSS consume declarative camera and lighting variables", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../public/style.css"), "utf8");

  assert.match(css, /\[data-scene="menu"\] \.nightfall-color-wash\s*\{[^}]*var\(--menu-cyan-light\)[^}]*var\(--menu-amber-light\)/s);
  assert.match(css, /\[data-tier="low"\] \.nightfall-image\s*\{[^}]*translate3d\(var\(--menu-camera-x\),var\(--menu-camera-y\),0\)[^}]*scale\(var\(--menu-camera-scale\)\)/s);
});

test("selected commands use a tier-fed local speck layer without moving hit boxes", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../public/style.css"), "utf8");
  const game = fs.readFileSync(path.resolve(__dirname, "../public/game3d.js"), "utf8");

  assert.match(game, /--command-disturbance["'],\s*String\(presentation\.surface\.localDisturbance\)/);
  assert.match(css, /\.floating-command::after\s*\{[^}]*--tier-speck-alpha:\s*var\(--command-disturbance\)[^}]*--local-speck-alpha:\s*0[^}]*radial-gradient/s);
  assert.match(css, /\.floating-command:hover::after[\s\S]*?--local-speck-alpha:\s*var\(--tier-speck-alpha\)[^}]*animation:[^;}]*command-speck/s);
  assert.match(css, /@keyframes command-speck\s*\{/);
  assert.match(css, /body\[data-reduced-motion="true"\] \.floating-command::before,[^}]*\.floating-command::after\s*\{[^}]*animation:\s*none/s);
  const hitBoxState = css.match(/\.floating-command:hover,\s*\.floating-command\.is-selected,\s*\.floating-command\[aria-current="true"\],\s*\.floating-command:focus-visible\s*\{[^}]*\}/)?.[0] || "";
  assert.doesNotMatch(hitBoxState, /transform\s*:/);
});

test("menu media handoff forces the Nightfall fallback visible until playback is ready", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../public/style.css"), "utf8");
  const game = fs.readFileSync(path.resolve(__dirname, "../public/game3d.js"), "utf8");
  const holdFallback = game.match(/function holdNightfallFallback[\s\S]*?\n\}/)?.[0] || "";
  const revealBackdrop = game.match(/function revealMenuBackdrop[\s\S]*?\n\}/)?.[0] || "";
  const pauseBackdrop = game.match(/function pauseMenuBackdrop[\s\S]*?\n\}/)?.[0] || "";

  assert.match(css, /\.nightfall-background\.nightfall-media-hold\s*\{[^}]*opacity:\s*1\s*!important[^}]*transition:\s*none/s);
  assert.match(holdFallback, /nightfallBackground\.classList\.add\("nightfall-media-hold"\)/);
  assert.match(revealBackdrop, /nightfallBackground\.classList\.remove\("nightfall-media-hold"\)/);
  assert.match(pauseBackdrop, /nightfallBackground\.classList\.remove\("nightfall-media-hold"\)/);
});

test("match opening uses exactly fifteen seconds without changing non-solo round timers", async () => {
  const game = fs.readFileSync(path.resolve(__dirname, "../public/game3d.js"), "utf8");
  const rules = await import(new URL("../public/matchmaking-rules.mjs", `file://${__filename.replace(/\\/g, "/")}`));
  const countdown = rules.resolveMatchCountdown(25_000, 10_000);
  const countdownFunction = game.match(/function beginCountdown\([\s\S]*?\n\}/)?.[0] || "";
  assert.equal(countdown.secondsRemaining, 15);
  assert.equal(countdown.millisecondsRemaining, 15_000);
  assert.match(countdownFunction, /startsAt = Date\.now\(\) \+ 15000/);
  assert.match(countdownFunction, /resolveMatchCountdown\(startsAt\)/);
  assert.match(countdownFunction, /clearKeyboardInput\(\)/);
  assert.match(countdownFunction, /touch\.mx = touch\.mz = touch\.ax = touch\.az = 0/);
  assert.match(game, /timer = mode === "ctf" \? 300 : mode === "teams" \? 60 : null;/);
  assert.match(game, /timer = Math\.max\(0, \(countdownDeadline - Date\.now\(\)\) \/ 1000\);/);
});
