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
    "ffaLobbyBtn",
    "teamLobbyBtn",
    "ctf6LobbyBtn",
    "ctfPlayerChoices",
    "dashboardBtn",
    "editProfileBtn",
    "lobbyConnectionsBtn",
    "lobbySettingsBtn",
    "signOutProfileBtn",
    "lobbyGameOptions",
    "botDifficulty",
    "riskLevel",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} remains present`);
  }

  assert.match(html, /id="survivalLobbyBtn"[^>]*data-lobby-control/);
  assert.match(html, /id="ffaLobbyBtn"[^>]*data-lobby-control/);
  assert.match(html, /id="teamLobbyBtn"[^>]*data-lobby-control/);
  assert.match(html, /id="ctf6LobbyBtn"[^>]*data-lobby-control/);
  assert.match(html, />Solo Survival</);
  assert.match(html, />Free For All</);
  assert.match(html, />Team Play</);
  assert.match(html, />Capture the Flag</);
  assert.match(html, /Invite friends, join with a code/);
  assert.doesNotMatch(html, /1v1|2v2|3v3/);
  assert.doesNotMatch(html, /id="storyMapSelect"|data-map=/);
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
