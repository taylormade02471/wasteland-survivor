const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");
const androidHtml = fs.readFileSync(path.join(root, "android", "app", "src", "main", "assets", "index.html"), "utf8");
const androidCss = fs.readFileSync(path.join(root, "android", "app", "src", "main", "assets", "android-platform.css"), "utf8");
const androidGame = fs.readFileSync(path.join(root, "android", "app", "src", "main", "assets", "android-platform.js"), "utf8");

test("title screen uses the selected Nightfall cover and rail layout", () => {
  assert.match(html, /class="title-cover-art"[^>]+nightfall-six-survivors-v2\.png/);
  assert.match(html, /id="homeBackdrop"[^>]*muted[^>]*autoplay[^>]*loop[^>]*playsinline/);
  assert.match(html, /nightfall-water-walk-v1\.mp4/);
  assert.match(css, /\.title-cover-art\s*\{/);
  assert.match(css, /body\.menu-active \.home-backdrop\.is-ready\s*\{/);
  assert.match(css, /\.welcome-screen\s*\{[^}]*display:\s*grid/);
  assert.match(css, /\.title-hero-copy\s*\{[^}]*position:\s*relative/);
  assert.match(css, /\.profile-step\s*\{[^}]*display:\s*grid/);
  assert.match(html, /data-armory-tab="weapons"/);
  assert.match(html, /data-armory-tab="protection"/);
  assert.match(game, /function selectArmoryTab/);
  assert.match(css, /body:has\(#welcomeScreen:not\(\.hidden\)\) #hud/);
  assert.match(game, /https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.180\.0/);
  assert.doesNotMatch(game, /mobile-profile-ready/);
});

test("Android wrapper owns phone-only profile and menu presentation overrides", () => {
  assert.match(androidHtml, /android-platform\.css/);
  assert.match(androidHtml, /android-platform\.js/);
  assert.match(androidCss, /body\.mobile-profile-ready \.mobile-entry-dock/);
  assert.match(androidCss, /\.game-menu-panel \{[^}]*overflow-y:\s*auto/);
  assert.match(androidGame, /resumeGameBtn/);
  assert.match(androidGame, /mobileEntryBtn/);
});

test("touch gameplay keeps distinct left movement and right aim sticks", () => {
  assert.match(html, /id="moveStick" class="touch-stick"/);
  assert.match(html, /id="aimStick" class="touch-stick aim-swipe"/);
  assert.match(css, /#touchControls\s*\{[^}]*justify-content:\s*space-between/);
});

test("phone gameplay uses a simple two-thumb control layout", () => {
  assert.match(css, /@media \(pointer: coarse\) and \(orientation: portrait\) and \(max-width: 700px\)[\s\S]*?#touchControls \{ inset: 0; display: block/);
  assert.match(css, /\.touch-move-zone \{ position: absolute; left:/);
  assert.match(css, /\.touch-action-zone \{ position: absolute; right:/);
  assert.match(css, /\.touch-action-grid \{ grid-template-columns: repeat\(2, 52px\)/);
  assert.match(css, /\.touch-action-grid \.primary-action \{ min-height: 52px/);
});
