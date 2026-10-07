import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LOBBY_AVATARS, createLobbyProfileView } from "../public/lobby-profile-view.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");
const avatarManifest = JSON.parse(fs.readFileSync(
  path.join(root, "public", "assets", "nightfall", "characters", "index.json"),
  "utf8",
));

test("maps all six bundled survivor renders and gameplay classes", () => {
  assert.deepEqual(
    LOBBY_AVATARS,
    avatarManifest.avatars.map(avatar => ({
      id: avatar.id,
      name: avatar.name,
      classId: avatar.classId,
      image: `./assets/nightfall/characters/index/${avatar.image}`,
    })),
  );
  assert.equal(LOBBY_AVATARS.find(avatar => avatar.id === "medic").classId, "tech");
  assert.equal(LOBBY_AVATARS.find(avatar => avatar.id === "warden").classId, "heavy");
});

test("normalizes profile identity and derives level XP progress from progression rules", () => {
  const view = createLobbyProfileView({
    activeProfile: {
      name: "  <Commander>\u0000  ",
      playerTag: " ws-42 ",
      avatarType: "ranger",
    },
    progress: { totalXp: 1250, playerLevel: 99 },
  });

  assert.equal(view.displayName, "Commander");
  assert.equal(view.playerTag, "WS-42");
  assert.equal(view.level, 2);
  assert.deepEqual(view.xp, {
    total: 1250,
    earnedThisLevel: 750,
    neededThisLevel: 1500,
    percentage: 50,
    label: "750 / 1,500 XP",
  });
});

test("outputs class skill ability weapon shield and online state from current state", () => {
  const view = createLobbyProfileView({
    activeProfile: { name: "Mara", playerTag: "MARA-71", avatarType: "warden" },
    progress: { totalXp: 4500 },
    classProgress: { classId: "scout", upgrades: { fleetFoot: 3 } },
    activeWeapon: "cannon",
    weaponLevel: 12,
    shieldLevel: 4,
    online: true,
  });

  assert.deepEqual(view.avatar, {
    id: "warden",
    name: "Warden",
    classId: "heavy",
    image: "./assets/nightfall/characters/index/warden-v1.webp",
  });
  assert.equal(view.classLabel, "Heavy");
  assert.equal(view.skillLabel, "Fortified");
  assert.equal(view.abilityLabel, "Shield Brace");
  assert.deepEqual(view.weapon, { id: "cannon", label: "Cannon", level: 12 });
  assert.deepEqual(view.shield, { level: 4, label: "Level 4" });
  assert.deepEqual(view.network, { online: true, label: "Online" });
});

test("uses honest local fallbacks for missing or malformed state", () => {
  const view = createLobbyProfileView({
    activeProfile: { name: "\u0000<>  ", playerTag: { unsafe: true }, avatarType: "../../escape" },
    progress: { totalXp: Number.NaN },
    classProgress: { classId: "unknown", upgrades: "bad" },
    activeWeapon: "laser",
    weaponLevel: -40,
    shieldLevel: Infinity,
    online: "yes",
  });

  assert.equal(view.displayName, "Survivor");
  assert.equal(view.playerTag, "LOCAL PROFILE");
  assert.equal(view.level, 1);
  assert.equal(view.xp.percentage, 0);
  assert.equal(view.avatar.id, "scout");
  assert.equal(view.classLabel, "Scout");
  assert.deepEqual(view.weapon, { id: "scout", label: "Scout", level: 0 });
  assert.deepEqual(view.shield, { level: 0, label: "Unreinforced" });
  assert.deepEqual(view.network, { online: false, label: "Local / Offline" });
});

test("renders exactly three equal-weight primary fight commands with exact labels", () => {
  const fightCommands = html.match(/<div id="fightCommands"[\s\S]*?<\/div>/)?.[0] || "";
  const buttons = [...fightCommands.matchAll(/<button id="([^"]+)"[^>]*class="[^"]*lobby-fight-command[^"]*"[^>]*>[\s\S]*?<b>([^<]+)<\/b>[\s\S]*?<\/button>/g)];

  assert.deepEqual(buttons.map(match => [match[1], match[2]]), [
    ["survivalLobbyBtn", "Survival Mode"],
    ["teamLobbyBtn", "Multiplayer"],
    ["ctf6LobbyBtn", "Capture the Flag"],
  ]);
  assert.match(css, /#fightCommands\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
});

test("keeps mode choices and game options subordinate and closed by default", () => {
  assert.match(html, /id="onlineSurvivalBtn"[^>]*class="[^"]*hidden/);
  assert.match(html, /id="teamSizeChoices"[^>]*class="[^"]*hidden/);
  assert.match(html, /id="ctfPlayerChoices"[^>]*class="[^"]*hidden/);
  assert.match(html, /<details id="lobbyGameOptions"(?![^>]*\sopen)[^>]*>/);

  for (const id of ["teamSize1Btn", "teamSize2Btn", "teamSize3Btn", "botTeamSize", "botDifficulty", "storyMapSelect", "riskLevel"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing preserved subordinate control #${id}`);
  }
});

test("preserves edge routes and makes the survivor avatar and readout open the dashboard", () => {
  for (const id of ["lobbySettingsBtn", "lobbyConnectionsBtn", "dashboardBtn", "editProfileBtn", "signOutProfileBtn"]) {
    assert.match(html, new RegExp(`<button id="${id}"`), `missing edge action #${id}`);
  }
  assert.match(html, /<button id="lobbyAvatarButton"[^>]*aria-controls="dashboardModal"/);
  assert.match(html, /<button id="lobbyProfileReadout"[^>]*aria-controls="dashboardModal"/);
  assert.match(game, /\$\("lobbyAvatarButton"\)\.onclick\s*=\s*openDashboard/);
  assert.match(game, /\$\("lobbyProfileReadout"\)\.onclick\s*=\s*openDashboard/);
  assert.match(game, /\$\("lobbyConnectionsBtn"\)\.onclick\s*=\s*openConnections/);
  assert.match(css, /\.lobby-avatar-button:hover,\s*\.lobby-profile-readout:hover\s*\{[^}]*background:\s*transparent/s);
});

test("uses a stable safe-area-aware compact survivor strip on phones", () => {
  const mobile = css.match(/@media \(max-width:\s*680px\)\s*\{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(mobile, /\.lobby-survivor-hero\s*\{[^}]*grid-template-columns:\s*96px\s+minmax\(0,\s*1fr\)[^}]*height:\s*132px/s);
  assert.match(mobile, /#lobbyNavigation\s*\{[^}]*order:\s*3[^}]*display:\s*grid/s);
  assert.match(mobile, /#fightCommands\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /\.lobby-avatar-button[^}]*min-height:\s*44px/s);
  assert.match(css, /\.lobby-edge-action[^}]*min-height:\s*44px/s);
  assert.match(css, /\.lobby-edge-controls[^}]*safe-area-inset-right/s);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[^{]*\{[^}]*\.lobby-avatar-image/s);
});
