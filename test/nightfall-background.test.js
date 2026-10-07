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

test("match opening uses exactly fifteen seconds without changing round timers", () => {
  const game = fs.readFileSync(path.resolve(__dirname, "../public/game3d.js"), "utf8");
  const countdownFunction = game.match(/function beginCountdown\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(countdownFunction, /countdown = 15;/);
  assert.match(countdownFunction, /timer = 15;/);
  assert.match(countdownFunction, /countdownDeadline = Date\.now\(\) \+ 15000;/);
  assert.match(countdownFunction, /countdownNumber"\)\.textContent = "15"/);
  assert.match(countdownFunction, /clearKeyboardInput\(\)/);
  assert.match(countdownFunction, /touch\.mx = touch\.mz = touch\.ax = touch\.az = 0/);
  assert.match(game, /timer = mode === "ctf" \? 300 : 60;/);
  assert.match(game, /timer = Math\.max\(0, \(countdownDeadline - Date\.now\(\)\) \/ 1000\);/);
});
