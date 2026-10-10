import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const game = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("pre-match confirmation can return to the lobby", () => {
  assert.match(html, /id="loadoutRoomModal"[\s\S]*id="loadoutLobbyBtn"[^>]*>Return to Lobby/);
  assert.match(game, /\$\('loadoutLobbyBtn'\)\.onclick = exitToLobby;/);
});

test("mobile entry dock follows the same profile entry path", () => {
  assert.match(html, /id="mobileEntryBtn"/);
  assert.match(game, /\$\("mobileEntryBtn"\)\.onclick = enterProfile;/);
});

test("visible match actions have an explicit route", () => {
  for (const id of ["survivalLobbyBtn", "ffaLobbyBtn", "teamLobbyBtn", "ctf6LobbyBtn", "createRoomBtn", "joinRoomBtn", "quickMatchBtn"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(game, /\$\("survivalLobbyBtn"\)\.onclick/);
  assert.match(game, /\$\("ffaLobbyBtn"\)\.onclick/);
  assert.match(game, /\$\("teamLobbyBtn"\)\.onclick/);
  assert.match(game, /\$\("ctf6LobbyBtn"\)\.onclick/);
  assert.match(game, /\$\("createRoomBtn"\)\?\.addEventListener\("click"/);
  assert.match(game, /\$\("joinRoomBtn"\)\?\.addEventListener\("click"/);
  assert.match(game, /\$\("quickMatchBtn"\)\?\.addEventListener\("click"/);
});
