const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");
const index = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const activity = fs.readFileSync(path.join(root, "android", "app", "src", "main", "java", "com", "wastelandsurvivor", "app", "MainActivity.java"), "utf8");

test("audio stops when the web page or Android activity leaves the foreground", () => {
  assert.match(game, /function suspendAudioForLifecycle\(\)/);
  assert.match(game, /stopMusic\(\);/);
  assert.match(game, /audioContext\?\.state === "running"/);
  assert.match(game, /wasteland:app-paused/);
  assert.match(game, /visibilityState === "hidden"/);
  assert.match(activity, /android-app-paused/);
  assert.match(index, /nightfall-ambient-v1\.mp3/);
  assert.match(game, /bundledMusic\.play\(\)/);
  assert.doesNotMatch(game, /musicTimer\s*=\s*setInterval/);
});
