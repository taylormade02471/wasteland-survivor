import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");

test("live gameplay routes player and bot survivor rigs through authored character archetypes", () => {
  assert.match(game, /import\s+\{\s*CHARACTER_ARCHETYPE_IDS,\s*createCharacterModel,\s*createPoseController,\s*getCharacterArchetype\s*\}/);
  assert.match(game, /function slotSurvivorArchetype\(slot,\s*fallbackIndex = 0\)/);
  assert.match(game, /allies\.push\(unit\(0x3985ff,[\s\S]*slotSurvivorArchetype\(slot,\s*allies\.length \+ 1\)/);
  assert.match(game, /spawnEnemy\(enemies\.length,\s*"shooter",\s*slotSurvivorArchetype\(slot,\s*enemies\.length \+ 3\)/);
  assert.match(game, /function spawnEnemy\(index = enemies\.length,\s*requestedType = null,\s*requestedArchetype = null\)/);
});

test("respawn deliberately releases terminal downed character poses", () => {
  assert.match(game, /function reviveUnitVisual\(unit\)/);
  assert.match(game, /unit\.visualController\?\.resetTerminalState\?\.\(\)/);
  assert.match(game, /reviveUnitVisual\(unit\);/);
});
