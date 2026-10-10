import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [game, html] = await Promise.all([
  readFile(new URL("public/game3d.js", root), "utf8"),
  readFile(new URL("public/index.html", root), "utf8"),
]);

test("game imports and persists the versioned story session contract", () => {
  assert.match(game, /from "\.\/story-session-rules\.mjs"/);
  assert.match(game, /buildStorySnapshot\(/);
  assert.match(game, /validateStorySnapshot\(/);
  assert.match(game, /mergeStorySnapshot\(/);
  assert.match(game, /localStorage\.setItem\(storySnapshotKey\(/);
});

test("pause and result screens expose story saving plus a universal End Match action", () => {
  assert.match(html, /id="saveExitStoryBtn"[^>]*>Save Story &amp; Exit</);
  assert.match(html, /id="endMatchBtn"[^>]*>End Match - Back To Lobby</);
  assert.match(game, /saveExitStoryBtn[\s\S]*saveStoryAndExit\("pause-exit"\)/);
  assert.match(game, /endMatchBtn[\s\S]*endFinishedMatch\(\)/);
  assert.match(game, /function endFinishedMatch[\s\S]*saveStoryAndExit\("death-exit"\)[\s\S]*exitToLobby\(\)/);
  assert.match(game, /event\.key === "Escape"[\s\S]*phase === "over"[\s\S]*endFinishedMatch\(\)/);
});

test("story save exits to the main lobby and leaves multiplayer selectable", () => {
  const saveFlow = game.match(/function saveStoryAndExit[\s\S]*?\n\}/)?.[0] || "";
  assert.match(saveFlow, /saveProgress\(\)/);
  assert.match(saveFlow, /exitToLobby\(\)/);
  assert.match(saveFlow, /returnIntent/);
  assert.match(html, /id="teamLobbyBtn"/);
});

test("starting Story Survival restores safe progress and applies campaign map difficulty", () => {
  assert.match(game, /function restoreStorySession[\s\S]*?mergeStorySnapshot/);
  assert.match(game, /deriveStoryCampaignState\(/);
  assert.match(game, /recommendedMap/);
  assert.match(game, /difficultyRatio/);
  assert.match(game, /\$\("survivalLobbyBtn"\)\.onclick[\s\S]*restoreStorySession\(\)/);
});
