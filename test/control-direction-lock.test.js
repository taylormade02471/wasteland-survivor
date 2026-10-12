import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTROL_DIRECTION_LOCK,
  aimYawFromAxes,
  firstPersonForwardInput,
  firstPersonMovementDelta,
  keyboardMovementAxes,
  nextMouseYaw,
} from "../public/control-direction-lock.mjs";

test("the immutable control contract keeps every horizontal input right-positive", () => {
  assert.equal(Object.isFrozen(CONTROL_DIRECTION_LOCK), true);
  assert.equal(CONTROL_DIRECTION_LOCK.id, "right-positive-v1");
  assert.equal(CONTROL_DIRECTION_LOCK.mouseRadiansPerPixel, 0.0026);
  assert.deepEqual(CONTROL_DIRECTION_LOCK.keyboard, { forward: "w", back: "s", left: "a", right: "d" });
  assert.equal(CONTROL_DIRECTION_LOCK.firstPersonForwardSign, -1);

  assert.deepEqual(keyboardMovementAxes({ d: true }), { strafe: 1, vertical: 0 });
  assert.deepEqual(keyboardMovementAxes({ a: true }), { strafe: -1, vertical: 0 });
  assert.ok(aimYawFromAxes(1, 0) > 0, "right touch/controller aim must produce a positive yaw");
  assert.ok(aimYawFromAxes(-1, 0) < 0, "left touch/controller aim must produce a negative yaw");
  assert.equal(firstPersonForwardInput(-1), 1, "W must remain forward in first-person movement");
  assert.equal(firstPersonForwardInput(1), -1, "S must remain backward in first-person movement");
});

test("rightward mouse input turns right at the locked sensitivity", () => {
  const rightYaw = nextMouseYaw({ yaw: 0, movementX: 100, sensitivity: 1 });
  const leftYaw = nextMouseYaw({ yaw: 0, movementX: -100, sensitivity: 1 });
  assert.equal(rightYaw, 0.26);
  assert.equal(leftYaw, -0.26);

  const forwardAfterRightTurn = firstPersonMovementDelta({ yaw: rightYaw, forward: 1, speed: 1 });
  assert.ok(forwardAfterRightTurn.x > 0, "moving forward after a right turn must travel toward screen-right");
});

test("WASD movement remains camera-relative with D right and W forward", () => {
  assert.deepEqual(firstPersonMovementDelta({ yaw: 0, strafe: 1, speed: 1 }), { x: 1, z: 0 });
  assert.deepEqual(firstPersonMovementDelta({ yaw: 0, strafe: -1, speed: 1 }), { x: -1, z: 0 });
  assert.deepEqual(firstPersonMovementDelta({ yaw: 0, forward: 1, speed: 1 }), { x: 0, z: 1 });
  assert.deepEqual(firstPersonMovementDelta({ yaw: 0, forward: -1, speed: 1 }), { x: 0, z: -1 });
});
