const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");

test("lobby visual shell preserves existing action hooks and primary modes", () => {
  for (const id of [
    "lobbyBackBtn",
    "lobbyPlayer",
    "lobbyAvatarButton",
    "lobbyProfileReadout",
    "survivalLobbyBtn",
    "teamLobbyBtn",
    "ctf6LobbyBtn",
    "teamSizeChoices",
    "ctfPlayerChoices",
    "dashboardBtn",
    "editProfileBtn",
    "lobbyConnectionsBtn",
    "lobbySettingsBtn",
    "signOutProfileBtn",
    "lobbyGameOptions",
    "botTeamSize",
    "botDifficulty",
    "storyMapSelect",
    "riskLevel",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} remains present`);
  }

  assert.match(html, /id="survivalLobbyBtn"[^>]*data-lobby-control/);
  assert.match(html, /id="teamLobbyBtn"[^>]*data-lobby-control/);
  assert.match(html, /id="ctf6LobbyBtn"[^>]*data-lobby-control/);
  assert.match(html, />Solo Practice</);
  assert.match(html, />Multiplayer</);
  assert.match(html, />Capture the Flag</);
});

test("signed-in lobby removes the redundant avatar square and prioritizes profile plus solo and multiplayer", () => {
  assert.match(html, /id="lobbyAvatarButton"/);
  assert.match(html, /id="lobbyProfileReadout"/);
  assert.match(html, /id="survivalLobbyBtn"[\s\S]*?<b>Solo Practice<\/b>/);
  assert.match(html, /id="teamLobbyBtn"[\s\S]*?<b>Multiplayer<\/b>/);
  assert.match(css, /#lobbyScreen\s+\.lobby-avatar-button\s*\{[^}]*display:\s*none/s);
  assert.match(css, /@media \(min-width:\s*761px\) and \(min-height:\s*521px\)\s*\{[\s\S]*?#lobbyScreen\s+\.lobby-survivor-hero\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media \(min-width:\s*761px\) and \(min-height:\s*521px\)\s*\{[\s\S]*?#lobbyScreen\s+\.lobby-survivor-hero\s*\{[^}]*grid-template-columns:\s*minmax\(240px,\s*310px\)[^}]*justify-content:\s*end/s);
  assert.match(css, /@media \(max-width:\s*760px\)\s*\{[\s\S]*?#lobbyScreen\s+\.lobby-survivor-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("lobby CSS implements slim combined rails and avoids blocky card layout", () => {
  assert.match(css, /#lobbyScreen[\s\S]*grid-template-columns:\s*minmax\(210px,\s*260px\)\s+minmax\(0,\s*1fr\)\s+minmax\(260px,\s*340px\)/);
  assert.match(css, /\.lobby-survivor-hero[\s\S]*grid-area:\s*profile/);
  assert.match(css, /#fightCommands[\s\S]*grid-area:\s*modes/);
  assert.match(css, /#fightCommands[\s\S]*grid-column:\s*2/);
  assert.match(css, /\.lobby-game-options[\s\S]*grid-area:\s*loadout/);
  assert.match(css, /\.lobby-edge-controls[\s\S]*grid-area:\s*actions/);
  assert.match(css, /border-radius:\s*8px/);
  assert.doesNotMatch(css, /border-radius:\s*(?:1[0-9]|[2-9][0-9])px/);
});
