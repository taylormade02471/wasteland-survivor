import assert from "node:assert/strict";
import test from "node:test";

import {
  createConnectedWorldLayout,
  resolveWorldMovement,
  shouldEnforceArenaBoundaryCollision,
} from "../public/world-layout.mjs";

test("world collision slides along a visible blocker instead of snapping backwards", () => {
  const layout = createConnectedWorldLayout();
  const car = layout.cars[0];
  const from = { x: car.x - 5, y: 0, z: car.z - 5 };
  const attempted = { x: car.x, z: car.z };
  const result = resolveWorldMovement(layout, from, attempted);

  assert.equal(result.blocked, true);
  assert.notDeepEqual({ x: result.position.x, z: result.position.z }, { x: from.x, z: from.z });
  assert.ok(result.position.x === from.x || result.position.z === from.z);
});

test("large connected worlds do not apply a smaller hidden arena wall", () => {
  assert.equal(shouldEnforceArenaBoundaryCollision({ width: 520 }, { width: 210 }), false);
  assert.equal(shouldEnforceArenaBoundaryCollision({ width: 210 }, { width: 210 }), true);
});
