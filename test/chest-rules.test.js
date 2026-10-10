import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { canAccessChest, createChestPositions, nearestChest, seededRandom } from "../public/chest-rules.mjs";

test("creates one shared chest away from the player", () => {
  const values = [0, 0, .2, .2, .8, .8, .1, .9, .9, .1];
  let index = 0;
  const positions = createChestPositions({ mapRadius: 70, random: () => values[index++ % values.length] });
  assert.equal(positions.length, 1);
  assert.ok(Math.hypot(positions[0].x, positions[0].z) >= 18);
});

test("only grants chest access to a nearby player", () => {
  const chests = [{ id: "a", x: 2, z: 1 }, { id: "b", x: 40, z: 40 }];
  assert.equal(nearestChest({ x: 0, z: 0 }, chests).id, "a");
  assert.equal(canAccessChest({ x: 0, z: 0 }, chests), true);
  assert.equal(canAccessChest({ x: 15, z: 15 }, chests), false);
});

test("generates matching shared chest positions from the same room seed", () => {
  const first = createChestPositions({ random: seededRandom("wasteland:round-2") });
  const second = createChestPositions({ random: seededRandom("wasteland:round-2") });
  const different = createChestPositions({ random: seededRandom("wasteland:round-3") });
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, different);
});

test("the one-minute supply phase keeps player movement live while combat stays gated", () => {
  const game = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "game3d.js"), "utf8");
  const updateStart = game.indexOf("function update(dt)");
  const updateEnd = game.indexOf("function formatTime", updateStart);
  const update = game.slice(updateStart, updateEnd);

  assert.ok(update.includes('const prepActive = phase === "prep"'));
  assert.ok(update.indexOf('const prepActive = phase === "prep"') < update.indexOf("let mx ="));
  assert.match(update, /if \(!prepActive\) \{[\s\S]*updateSoloEnemies/);
  assert.match(update, /player\.g\.position\.addScaledVector\(forward/);
});
