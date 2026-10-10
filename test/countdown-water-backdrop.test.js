const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "public/game3d.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/style.css"), "utf8");

test("the preparation countdown keeps the bundled water-walk video visible before 3D combat", () => {
  const countdownStart = game.indexOf('function beginCountdown(');
  const combatStart = game.indexOf('function nextCombat(');
  assert.ok(countdownStart >= 0 && combatStart > countdownStart);
  const countdown = game.slice(countdownStart, combatStart);
  assert.match(countdown, /countdown-active/);
  assert.match(countdown, /homeBackdrop\.play\(\)/);
  assert.doesNotMatch(countdown, /pauseMenuBackdrop\(\)/);

  const combat = game.slice(combatStart, game.indexOf('function prep(', combatStart));
  assert.match(combat, /countdown-active/);
  assert.match(combat, /pauseMenuBackdrop\(\)/);
  assert.match(css, /body\.countdown-active \.home-backdrop\.is-ready/);
});
