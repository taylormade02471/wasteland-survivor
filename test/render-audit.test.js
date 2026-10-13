import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { summarizeRenderCoverage } from "../public/render-audit.mjs";

const gameSource = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("render coverage distinguishes authored actors from pending terrain", () => {
  assert.deepEqual(summarizeRenderCoverage({
    characterCount: 1,
    enemyCount: 3,
    weaponCount: 1,
    terrainState: "authored",
  }), {
    characters: 1,
    enemies: 3,
    weapons: 1,
    terrain: "authored",
    complete: true,
  });
  assert.equal(summarizeRenderCoverage({ terrainState: "procedural-fallback" }).complete, false);
});

test("runtime publishes authored actor and terrain coverage on the canvas", () => {
  assert.match(gameSource, /render-audit\.mjs/);
  assert.match(gameSource, /authoredCharacterCount/);
  assert.match(gameSource, /authoredEnemyCount/);
  assert.match(gameSource, /authoredWeaponCount/);
  assert.match(gameSource, /terrainTextureState/);
});
