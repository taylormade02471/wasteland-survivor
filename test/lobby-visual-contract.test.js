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
  assert.match(html, />Survival(?: Mode)?</);
  assert.match(html, />Multiplayer</);
  assert.match(html, />Capture the Flag</);
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
