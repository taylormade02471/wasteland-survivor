import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  LOBBY_AVATARS,
  PUBLIC_PLAYER_TAG_PATTERN,
  applyAuthoritativePlayerIdentity,
  backfillProfileIdentities,
  createLobbyProfileView,
  createStablePlayerTag,
  ensureProfileIdentity,
  reduceLobbyConnectivity,
  resolveLobbyConnectivity,
} from "../public/lobby-profile-view.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");
const avatarManifest = JSON.parse(fs.readFileSync(
  path.join(root, "public", "assets", "nightfall", "characters", "index.json"),
  "utf8",
));

test("maps all six bundled survivor renders and gameplay classes", () => {
  assert.deepEqual(LOBBY_AVATARS.map(({ id, name, classId, image }) => ({ id, name, classId, image })), [
    { id: "scout", name: "Dust Scout", classId: "scout", image: "./assets/nightfall/characters/renders/scout-v2-isolated.png" },
    { id: "ranger", name: "Ranger", classId: "ranger", image: "./assets/nightfall/characters/renders/ranger-v2-isolated-clean.png" },
    { id: "heavy", name: "Heavy", classId: "heavy", image: "./assets/nightfall/characters/renders/heavy-v2-isolated.png" },
    { id: "tech", name: "Tech Runner", classId: "tech", image: "./assets/nightfall/characters/renders/tech-runner-v2-isolated.png" },
    { id: "medic", name: "Field Medic", classId: "tech", image: "./assets/nightfall/characters/renders/field-medic-v2-isolated.png" },
    { id: "warden", name: "Warden", classId: "heavy", image: "./assets/nightfall/characters/renders/warden-v2-isolated.png" },
  ]);
  assert.equal(LOBBY_AVATARS.find(avatar => avatar.id === "medic").classId, "tech");
  assert.equal(LOBBY_AVATARS.find(avatar => avatar.id === "warden").classId, "heavy");
});

test("normalizes profile identity and derives level XP progress from progression rules", () => {
  const view = createLobbyProfileView({
    activeProfile: {
      name: "  <Commander>\u0000  ",
      playerTag: " ws-a1b2c3d4 ",
      avatarType: "ranger",
    },
    progress: { totalXp: 1250, playerLevel: 99 },
  });

  assert.equal(view.displayName, "Commander");
  assert.equal(view.playerTag, "WS-A1B2C3D4");
  assert.equal(view.level, 2);
  assert.deepEqual(view.xp, {
    total: 1250,
    earnedThisLevel: 750,
    neededThisLevel: 1500,
    percentage: 50,
    label: "750 / 1,500 XP",
  });
});

test("creates and backfills stable public tags without using private profile fields", () => {
  const first = ensureProfileIdentity({
    profileId: "profile-123",
    name: "Mara",
    avatarType: "ranger",
    contact: "private@example.com",
  });
  const edited = ensureProfileIdentity({ ...first, name: "Mara Prime", avatarType: "warden" });

  assert.match(first.playerTag, PUBLIC_PLAYER_TAG_PATTERN);
  assert.equal(first.playerTag, createStablePlayerTag("profile-123"));
  assert.equal(edited.playerTag, first.playerTag);
  assert.doesNotMatch(first.playerTag, /MARA|PRIVATE|EXAMPLE/);

  const backfill = backfillProfileIdentities([
    { profileId: "existing-id", name: "Existing" },
    { name: "Legacy", contact: "555-0100" },
  ], () => "generated-legacy-id");

  assert.equal(backfill.changed, true);
  assert.equal(backfill.profiles[0].profileId, "existing-id");
  assert.equal(backfill.profiles[0].playerTag, createStablePlayerTag("existing-id"));
  assert.equal(backfill.profiles[1].profileId, "generated-legacy-id");
  assert.equal(backfill.profiles[1].playerTag, createStablePlayerTag("generated-legacy-id"));
});

test("keeps a proposed tag through sync and persists a strict authoritative collision alternate", () => {
  const local = ensureProfileIdentity({ profileId: "profile-sync", name: "Mara" });
  const accepted = applyAuthoritativePlayerIdentity(local, {
    id: "server-player",
    playerTag: local.playerTag,
  });
  const collisionAlternate = applyAuthoritativePlayerIdentity(accepted, {
    id: "server-player",
    playerTag: "WS-A1B2C3D4",
  });
  const malformed = applyAuthoritativePlayerIdentity(collisionAlternate, {
    id: "server-player",
    playerTag: "private@example.com",
  });

  assert.equal(accepted.playerTag, local.playerTag);
  assert.equal(accepted.backendPlayerId, "server-player");
  assert.equal(collisionAlternate.playerTag, "WS-A1B2C3D4");
  assert.equal(malformed.playerTag, "WS-A1B2C3D4");
  assert.match(game, /playerTag:\s*profile\.playerTag/);
  assert.match(game, /Object\.assign\(profile, applyAuthoritativePlayerIdentity\(profile, publicPlayer\)\)/);
  assert.match(game, /saveProfile\(profile\)/);
});

test("resolves live connectivity from current successes rather than a stale saved session", () => {
  const stale = { backendSession: "saved-but-stale", offlineMode: false };
  assert.deepEqual(resolveLobbyConnectivity(stale), { online: false, label: "Local / Offline" });

  const recovered = reduceLobbyConnectivity(stale, { type: "player-service-success" });
  assert.deepEqual(resolveLobbyConnectivity(recovered), { online: true, label: "Online" });

  const failedAgain = reduceLobbyConnectivity(recovered, { type: "player-service-failure" });
  assert.deepEqual(resolveLobbyConnectivity(failedAgain), { online: false, label: "Local / Offline" });

  const socketRecovered = reduceLobbyConnectivity(failedAgain, { type: "lobby-socket-open" });
  assert.deepEqual(resolveLobbyConnectivity(socketRecovered), { online: true, label: "Online" });
  assert.deepEqual(
    resolveLobbyConnectivity(reduceLobbyConnectivity(socketRecovered, { type: "offline-changed", offlineMode: true })),
    { online: false, label: "Local / Offline" },
  );
  assert.match(game, /connectivity:\s*\{ \.\.\.lobbyConnectivity, offlineMode \}/);
  assert.doesNotMatch(game, /online:\s*!offlineMode\s*&&\s*Boolean\(activeProfile\?\.backendSession/);
});

test("outputs class skill ability weapon shield and online state from current state", () => {
  const view = createLobbyProfileView({
    activeProfile: { name: "Mara", playerTag: "WS-AABBCCDD", avatarType: "warden" },
    progress: { totalXp: 4500 },
    classProgress: { classId: "scout", upgrades: { fleetFoot: 3 } },
    activeWeapon: "cannon",
    weaponLevel: 12,
    shieldLevel: 4,
    connectivity: { playerServiceReachable: true },
  });

  assert.deepEqual(view.avatar, {
    id: "warden",
    name: "Warden",
    classId: "heavy",
    image: "./assets/nightfall/characters/renders/warden-v2-isolated.png",
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
  assert.equal(view.playerTag, "TAG UNAVAILABLE");
  assert.equal(view.level, 1);
  assert.equal(view.xp.percentage, 0);
  assert.equal(view.avatar.id, "scout");
  assert.equal(view.classLabel, "Scout");
  assert.deepEqual(view.weapon, { id: "scout", label: "Scout", level: 0 });
  assert.deepEqual(view.shield, { level: 0, label: "Unreinforced" });
  assert.deepEqual(view.network, { online: false, label: "Local / Offline" });
});

test("renders the approved primary fight commands with exact labels", () => {
  const fightCommands = html.match(/<div id="fightCommands"[\s\S]*?<\/div>/)?.[0] || "";
  const buttons = [...fightCommands.matchAll(/<button id="([^"]+)"[^>]*class="[^"]*lobby-fight-command[^"]*"[^>]*>[\s\S]*?<b>([^<]+)<\/b>[\s\S]*?<\/button>/g)];

  assert.deepEqual(buttons.map(match => [match[1], match[2]]), [
    ["survivalLobbyBtn", "Solo Survival"],
    ["ffaLobbyBtn", "Free For All"],
    ["teamLobbyBtn", "Team Play"],
    ["ctf6LobbyBtn", "Capture the Flag"],
  ]);
  assert.match(css, /#fightCommands\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
});

test("keeps mode choices and game options subordinate and closed by default", () => {
  assert.match(html, /id="onlineSurvivalBtn"[^>]*class="[^"]*hidden/);
  assert.match(html, /id="ctfPlayerChoices"[^>]*class="[^"]*hidden/);
  assert.match(html, /<details id="lobbyGameOptions"(?![^>]*\sopen)[^>]*>/);

  for (const id of ["botDifficulty", "riskLevel"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing preserved subordinate control #${id}`);
  }
  assert.doesNotMatch(html, /1v1|2v2|3v3|id="storyMapSelect"|data-map=/);
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

test("keeps portrait and short-landscape lobby content inside horizontal safe areas", () => {
  assert.match(
    css,
    /@media \(max-width:\s*680px\),\s*\(orientation:\s*landscape\) and \(max-height:\s*520px\) and \(max-width:\s*960px\)\s*\{[\s\S]*?#lobbyScreen\s*\{[^}]*padding:\s*max\([^;]*safe-area-inset-top[^;]*\)\s+max\(12px,\s*env\(safe-area-inset-right\)\)\s+max\([^;]*safe-area-inset-bottom[^;]*\)\s+max\(12px,\s*env\(safe-area-inset-left\)\)/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*680px\),\s*\(orientation:\s*landscape\) and \(max-height:\s*520px\) and \(max-width:\s*960px\)\s*\{[\s\S]*?#lobbyBackBtn\s*\{[^}]*position:\s*relative[^}]*inset:\s*auto/,
  );
});

test("keeps all three primary commands in one short-landscape viewport row", () => {
  const query = "@media (orientation: landscape) and (max-height: 520px) and (max-width: 960px)";
  const start = css.indexOf(query);
  const end = css.indexOf("@media", start + query.length);
  const shortLandscape = start >= 0 ? css.slice(start, end >= 0 ? end : undefined) : "";

  assert.match(shortLandscape, /#fightCommands\s*\{[^}]*width:\s*100%[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(shortLandscape, /#fightCommands \.floating-command\s*\{[^}]*height:\s*64px[^}]*min-height:\s*64px/);
  assert.match(shortLandscape, /#fightCommands \.floating-command small\s*\{[^}]*font-size:\s*9px/);
});
