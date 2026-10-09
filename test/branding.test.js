const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const legacyStorageKeys = [
  "wastland-survivor-audio",
  "wastland-survivor-best",
  "wastland-survivor-controller-only",
  "wastland-survivor-device-id",
  "wastland-survivor-last-replay",
  "wastland-survivor-music",
  "wastland-survivor-music-source",
  "wastland-survivor-music-volume",
  "wastland-survivor-offline",
  "wastland-survivor-profile",
  "wastland-survivor-profiles",
  "wastland-survivor-risk",
  "wastland-survivor-volume",
];

test("uses the official Wasteland Survivor branding", () => {
  assert.match(html, /<title>Wasteland Survivor<\/title>/);
  assert.match(html, /<h1>Wasteland Survivor<\/h1>/);
  assert.doesNotMatch(html, />Wastland Survivor</);
  assert.match(game, /Wasteland Survivor/);
  assert.equal(packageJson.name, "wasteland-survivor");
});

test("includes Nightfall social and install metadata hooks", () => {
  assert.match(html, /<meta name="theme-color" content="#[0-9a-fA-F]{6}"\s*\/>/);
  assert.match(html, /<meta property="og:title" content="Wasteland Survivor"\s*\/>/);
  assert.match(html, /<meta property="og:image" content="assets\/nightfall\/thumbnails\/wasteland-survivor-share-v1\.png"\s*\/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"\s*\/>/);
  assert.match(html, /<meta name="twitter:title" content="Wasteland Survivor"\s*\/>/);
  assert.match(html, /<meta name="twitter:image" content="assets\/nightfall\/thumbnails\/wasteland-survivor-share-v1\.png"\s*\/>/);
  assert.match(html, /<link rel="icon" href="assets\/nightfall\/icons\/icon-512-v1\.png"\s*\/>/);
  assert.match(html, /<link rel="apple-touch-icon" href="assets\/nightfall\/icons\/icon-512-v1\.png"\s*\/>/);
  assert.match(html, /<link rel="manifest" href="site\.webmanifest"\s*\/>/);
});

test("preserves every legacy Wastland Survivor storage key", () => {
  const discovered = [...game.matchAll(/["'](wastland-survivor-[a-z-]+)["']/g)]
    .map((match) => match[1]);
  assert.deepEqual([...new Set(discovered)].sort(), legacyStorageKeys);
});

test("preserves gameplay-critical DOM ids", () => {
  const requiredIds = [
    "game", "welcomeScreen", "lobbyScreen", "enterWastlandBtn", "returnWastlandBtn",
    "survivalLobbyBtn", "teamLobbyBtn", "ctf6LobbyBtn", "menuToggle", "gameMenu",
    "resumeGameBtn", "frontViewBtn", "menuSettingsBtn", "exitGameBtn", "touchControls",
    "moveStick", "aimStick", "settingsModal", "closeSettingsBtn"
  ];

  for (const id of requiredIds) assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
});

test("touch controls cannot intercept the pre-match loadout", () => {
  assert.match(game, /classList\.add\("loadout-active"\)/);
  assert.match(game, /classList\.remove\("loadout-active"\)/);
  assert.match(styles, /body\.loadout-active #touchControls[^}]*pointer-events:\s*none/);
});

test("touch landscape HUD reserves space for combat controls without overlapping menus", () => {
  const landscapeRules = styles.match(/@media \(pointer: coarse\) and \(orientation: landscape\) \{([\s\S]*)\}\s*$/)?.[1] || "";
  assert.match(landscapeRules, /\.brand\s*\{[^}]*display:\s*none/);
  assert.match(landscapeRules, /#hud\s*\{[^}]*grid-template-columns/);
  assert.match(landscapeRules, /#topRightMenu\s+\.mode-control[^}]*display:\s*none/);
  assert.match(landscapeRules, /#missionText[^}]*display:\s*none/);
});
