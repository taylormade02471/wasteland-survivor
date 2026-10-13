import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTROL_DIRECTION_LOCK,
  aimYawFromAxes,
  firstPersonForwardInput,
  firstPersonMovementDelta,
  keyboardMovementAxes,
  mouseYawDelta,
  nextMouseYaw,
  wrapYaw,
} from "../public/control-direction-lock.mjs";

test("the immutable control contract keeps screen and world horizontal inputs explicit", () => {
  assert.equal(Object.isFrozen(CONTROL_DIRECTION_LOCK), true);
  assert.equal(CONTROL_DIRECTION_LOCK.id, "right-positive-v1");
  assert.equal(CONTROL_DIRECTION_LOCK.mouseRadiansPerPixel, 0.0026);
  assert.equal(CONTROL_DIRECTION_LOCK.mouseYawSign, -1, "mouse yaw follows camera-right screen space");
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
  assert.equal(mouseYawDelta({ movementX: 100, sensitivity: 1 }), -0.26);
  assert.equal(mouseYawDelta({ movementX: -100, sensitivity: 1 }), 0.26);
  const rightYaw = nextMouseYaw({ yaw: 0, movementX: 100, sensitivity: 1 });
  const leftYaw = nextMouseYaw({ yaw: 0, movementX: -100, sensitivity: 1 });
  assert.equal(rightYaw, -0.26);
  assert.equal(leftYaw, 0.26);

  const forwardAfterRightTurn = firstPersonMovementDelta({ yaw: rightYaw, forward: 1, speed: 1 });
  assert.ok(forwardAfterRightTurn.x < 0, "moving forward after a right turn must travel toward camera-right");
});

test("rightward mouse input stays screen-right from the default south-facing heading", () => {
  const yaw = Math.PI;
  const turned = nextMouseYaw({ yaw, movementX: 1 });
  const facing = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const right = { x: -Math.cos(yaw), z: Math.sin(yaw) };
  const nextFacing = { x: Math.sin(turned), z: Math.cos(turned) };
  const turnDirection = (nextFacing.x - facing.x) * right.x + (nextFacing.z - facing.z) * right.z;
  assert.ok(turnDirection > 0, "positive mouse movement must turn toward the camera's local right");
});

test("mouse yaw wraps after complete turns without changing right-positive direction", () => {
  assert.equal(wrapYaw(Math.PI * 4 + 0.25), 0.25);
  assert.equal(wrapYaw(-Math.PI * 4 - 0.25), -0.25);
  const fullTurn = nextMouseYaw({ yaw: 0, movementX: (Math.PI * 2) / 0.0026 });
  assert.ok(Math.abs(fullTurn) < 1e-12, "a full 360-degree pan must return to the same heading");
  assert.ok(nextMouseYaw({ yaw: 0, movementX: 1 }) < 0, "rightward movement remains camera-right after wrapping");
});

test("WASD movement remains camera-relative with D right and W forward", () => {
  assert.deepEqual(firstPersonMovementDelta({ yaw: 0, strafe: 1, speed: 1 }), { x: 1, z: 0 });
  assert.deepEqual(firstPersonMovementDelta({ yaw: 0, strafe: -1, speed: 1 }), { x: -1, z: 0 });
  assert.deepEqual(firstPersonMovementDelta({ yaw: 0, forward: 1, speed: 1 }), { x: 0, z: 1 });
  assert.deepEqual(firstPersonMovementDelta({ yaw: 0, forward: -1, speed: 1 }), { x: 0, z: -1 });
});
