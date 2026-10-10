import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  advanceVirtualMouseLook,
  centerVirtualMouseLook,
  mouseLookRates,
  virtualMouseLookFromPoint,
} from "../public/mouse-look-rules.mjs";

test("mouse capture starts from the center and accumulates toward a bounded edge", () => {
  const centered = centerVirtualMouseLook();
  const moved = advanceVirtualMouseLook(centered, { movementX: 480, movementY: -270 }, { width: 960, height: 540 });
  const clamped = advanceVirtualMouseLook(moved, { movementX: 2000, movementY: -2000 }, { width: 960, height: 540 });

  assert.deepEqual(centered, { x: 0, y: 0 });
  assert.deepEqual(moved, { x: 1, y: -1 });
  assert.deepEqual(clamped, { x: 1, y: -1 });
});

test("right turns right, top looks up, and speed grows toward the edge", () => {
  const center = mouseLookRates({ x: 0.02, y: -0.02 });
  const halfway = mouseLookRates({ x: 0.5, y: -0.5 });
  const edge = mouseLookRates({ x: 1, y: -1 });

  assert.deepEqual(center, { yawRate: 0, pitchRate: 0 });
  assert.ok(halfway.yawRate < 0);
  assert.ok(halfway.pitchRate > 0);
  assert.ok(Math.abs(edge.yawRate) > Math.abs(halfway.yawRate));
  assert.ok(edge.pitchRate > halfway.pitchRate);
});

test("an unlocked cursor maps its screen position to the same virtual stick", () => {
  assert.deepEqual(virtualMouseLookFromPoint({ clientX: 500, clientY: 250 }, { left: 0, top: 0, width: 1000, height: 500 }), { x: 0, y: 0 });
  assert.deepEqual(virtualMouseLookFromPoint({ clientX: 1000, clientY: 0 }, { left: 0, top: 0, width: 1000, height: 500 }), { x: 1, y: -1 });
});

test("the live first-person loop applies virtual mouse turn continuously and recenters on capture", () => {
  const game = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "game3d.js"), "utf8");

  assert.match(game, /mouseLookRates\(virtualMouseLook/);
  assert.match(game, /virtualMouseLook = centerVirtualMouseLook\(\)/);
  assert.match(game, /advanceVirtualMouseLook\(/);
  assert.match(game, /virtualMouseLookFromPoint\(/);
});
