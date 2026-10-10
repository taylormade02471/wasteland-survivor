import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { SURVIVAL_WAVE_STRENGTH_GROWTH, scaleEnemy, waveStrengthMultiplier } from "../public/enemy-rules.mjs";

const game = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "game3d.js"), "utf8");
const html = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "index.html"), "utf8");

test("solo Survival has no combat countdown and only completes after the spawn queue is empty", () => {
  assert.match(game, /timer = mode === "ctf" \? 300 : mode === "teams" \? 60 : null;/);
  assert.match(game, /if \(mode !== "solo" && Number\.isFinite\(timer\) && timer <= 0\)/);
  assert.match(game, /!player\.alive \|\| player\.hp <= 0\)[\s\S]*?else if \(!enemies\.length && spawnQueue === 0\) finishRound\("blue"\)/);
  assert.match(game, /if \(mode === "solo"\) storyCheckpoint = createStoryCheckpoint\(\);[\s\S]*?timer = 60;/);
});

test("the one-minute prep phase keeps simulation input and camera updates active", () => {
  assert.match(game, /const prepActive = phase === "prep";/);
  assert.match(game, /if \(prepActive\) \{[\s\S]*?\} else if \(mode !== "solo"/);
  assert.match(game, /const playerFrom = player\.g\.position\.clone\(\);[\s\S]*?resolvePlayerMapCollision\(playerFrom\);/);
  assert.match(game, /if \(!prepActive\) \{[\s\S]*?updateSoloEnemies\(dt\)/);
});

test("Survival difficulty increases enemy strength by 20 percent per cleared wave", () => {
  assert.equal(SURVIVAL_WAVE_STRENGTH_GROWTH, 0.20);
  assert.equal(waveStrengthMultiplier(1), 1);
  assert.equal(waveStrengthMultiplier(2), 1.2);
  assert.equal(waveStrengthMultiplier(3), 1.44);
  assert.ok(scaleEnemy("shooter", { wave: 2, difficulty: "medium", playerSkill: 1 }).health
    >= scaleEnemy("shooter", { wave: 1, difficulty: "medium", playerSkill: 1 }).health * 1.2);
});

test("menu-to-survival keeps movement and camera resumable after prep and chest return", () => {
  const updateStart = game.indexOf("function update(dt)");
  const updateEnd = game.indexOf("function formatTime", updateStart);
  const update = game.slice(updateStart, updateEnd);
  const prepStart = game.indexOf("function prep()");
  const prepEnd = game.indexOf("function finishRound", prepStart);
  const prep = game.slice(prepStart, prepEnd);

  assert.match(html, /id="lobbyEnterWastelandBtn"/);
  assert.match(html, /id="survivalLobbyBtn"/);
  assert.match(game, /\$\("lobbyEnterWastelandBtn"\)\.onclick = openFightMenu;/);
  assert.match(game, /function openFightMenu\(\) \{[\s\S]*?refreshLobbyNavigation\("survivalLobbyBtn"\);/);
  assert.match(game, /\$\("survivalLobbyBtn"\)\.onclick = \(\) => \{[\s\S]*?\$\("soloMode"\)\.click\(\);/);
  assert.match(game, /\$\("loadoutReadyBtn"\)\.onclick = event => \{[\s\S]*?beginCountdown\(\);[\s\S]*?requestGameplayPointerLock\(event\);/);
  assert.match(game, /\$\("closeShopBtn"\)\.onclick = \(\) => \{[\s\S]*?restoreVisibleMenuSection\(\);[\s\S]*?chestAccessGranted = false;/);
  assert.match(prep, /phase = "prep";[\s\S]*?menuOpen = false;[\s\S]*?firing = false;/);
  assert.match(update, /if \(phase === "paused" && mode === "solo"\) return;[\s\S]*?const prepActive = phase === "prep";[\s\S]*?let mx = inputPaused \|\| menuOpen \? 0/);
  assert.match(update, /const manualTouchAim = !inputPaused[\s\S]*?const manualControllerAim = !inputPaused[\s\S]*?viewYaw = normalizeYaw/);
});

test("lobby exposes only the connected-world team flow and does not expose map or legacy size selectors", () => {
  assert.match(html, /id="teamLobbyBtn"[\s\S]*?Invite friends[\s\S]*?team room/);
  assert.doesNotMatch(html, /id="teamSize[123]Btn"/);
  assert.doesNotMatch(html, /id="botTeamSize"/);
  assert.doesNotMatch(html, /id="storyMapSelect"/);
  assert.doesNotMatch(html, /data-map=/);
});
