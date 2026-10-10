const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function rules() {
  return import("../public/controller-rules.mjs");
}

function gamepad({ axes = [0, 0, 0, 0], down = [], values = {}, mapping = "standard", index = 0 } = {}) {
  return {
    id: "Xbox Wireless Controller",
    index,
    connected: true,
    mapping,
    axes,
    buttons: Array.from({ length: 17 }, (_, buttonIndex) => ({
      pressed: down.includes(buttonIndex),
      value: values[buttonIndex] ?? (down.includes(buttonIndex) ? 1 : 0),
    })),
  };
}

test("radial dead zones reject drift and preserve full stick range", async () => {
  const { normalizeStick } = await rules();

  assert.deepEqual(normalizeStick(0.08, -0.09), { x: 0, y: 0, magnitude: 0 });
  assert.deepEqual(normalizeStick(0, -1), { x: 0, y: -1, magnitude: 1 });

  const diagonal = normalizeStick(0.7, 0.7);
  assert.ok(diagonal.magnitude > 0.9 && diagonal.magnitude <= 1);
  assert.ok(Math.abs(diagonal.x - diagonal.y) < 0.0001);
});

test("standard Xbox layout maps sticks, triggers, and edge actions", async () => {
  const { sampleGamepad } = await rules();
  const previousButtons = Array(17).fill(false);
  const sample = sampleGamepad(gamepad({
    axes: [0.75, -0.5, -0.4, 0.6],
    down: [0, 1, 2, 3, 9, 11, 12],
    values: { 6: 0.7, 7: 0.9 },
  }), previousButtons);

  assert.ok(sample.move.x > 0);
  assert.ok(sample.move.y < 0);
  assert.ok(sample.look.x < 0);
  assert.ok(sample.look.y > 0);
  assert.equal(sample.fire, true);
  assert.equal(sample.ads, true);
  assert.equal(sample.interact, true);
  assert.equal(sample.ability, true);
  assert.equal(sample.reload, true);
  assert.equal(sample.weapon, true);
  assert.equal(sample.pause, true);
  assert.equal(sample.switchTarget, true);
  assert.equal(sample.dpadUp, true);
  assert.equal(sample.active, true);
});

test("held buttons do not repeat edge actions and released trigger stops firing", async () => {
  const { sampleGamepad } = await rules();
  const held = gamepad({ down: [0, 9], values: { 7: 1 } });
  const first = sampleGamepad(held, Array(17).fill(false));
  const second = sampleGamepad(held, first.buttonLatch);
  const released = sampleGamepad(gamepad(), second.buttonLatch);

  assert.equal(first.interact, true);
  assert.equal(first.pause, true);
  assert.equal(second.interact, false);
  assert.equal(second.pause, false);
  assert.equal(second.fire, true);
  assert.equal(released.fire, false);
  assert.equal(released.active, false);
});

test("relative look follows standard first-person directions and clamps pitch", async () => {
  const { advanceControllerLook } = await rules();
  const first = advanceControllerLook({ yaw: 1, pitch: 0 }, { x: 0.5, y: -0.5 }, 0.25, {
    sensitivity: 2,
    maxPitch: 0.8,
  });
  const second = advanceControllerLook(first, { x: 0.5, y: -1 }, 1, {
    sensitivity: 2,
    maxPitch: 0.8,
  });

  assert.equal(first.yaw, 0.75);
  assert.equal(first.pitch, 0.25);
  assert.equal(second.yaw, -0.25);
  assert.equal(second.pitch, 0.8);
  assert.notEqual(first.yaw, Math.atan2(0.5, -0.5));
});

test("controller yaw stays bounded while look input remains deterministic", async () => {
  const { advanceControllerLook, normalizeYaw } = await rules();
  const advanced = advanceControllerLook({ yaw: Math.PI - 0.01, pitch: 0 }, { x: -1, y: 0 }, 1, { sensitivity: 4 });

  assert.equal(normalizeYaw(advanced.yaw), advanced.yaw);
  assert.ok(advanced.yaw >= -Math.PI && advanced.yaw <= Math.PI);
});

test("camera direction includes both horizontal turn and vertical pitch", async () => {
  const { cameraDirectionFromView } = await rules();
  const lookingRight = cameraDirectionFromView({ yaw: -Math.PI / 2, pitch: 0 });
  const lookingUp = cameraDirectionFromView({ yaw: 0, pitch: Math.PI / 4 });
  const lookingDown = cameraDirectionFromView({ yaw: 0, pitch: -Math.PI / 4 });

  assert.ok(lookingRight.x < -0.999);
  assert.ok(Math.abs(lookingRight.y) < 0.0001);
  assert.ok(Math.abs(lookingRight.z) < 0.0001);
  assert.ok(lookingUp.y > 0.7);
  assert.ok(lookingDown.y < -0.7);
});

test("the first-person camera applies right-stick pitch to the rendered view", () => {
  const game = fs.readFileSync(path.join(__dirname, "..", "public", "game3d.js"), "utf8");

  assert.match(game, /cameraDirectionFromView\(\{ yaw: viewYaw, pitch: viewPitch \}\)/);
  assert.match(game, /camera\.lookAt\(camera\.position\.clone\(\)\.addScaledVector\(viewDirection, 30\)\)/);
});

test("missing or disconnected gamepads return a complete neutral snapshot", async () => {
  const { neutralGamepadSample, sampleGamepad } = await rules();
  assert.deepEqual(sampleGamepad(null, [true]), neutralGamepadSample());
  assert.deepEqual(sampleGamepad({ connected: false }, [true]), neutralGamepadSample());
});

test("active controller selection favors input activity then the remembered pad", async () => {
  const { chooseGamepad } = await rules();
  const quiet = gamepad({ index: 0 });
  const moving = gamepad({ index: 1, axes: [0.8, 0, 0, 0] });

  assert.equal(chooseGamepad([quiet, moving], null)?.index, 1);
  assert.equal(chooseGamepad([quiet, moving], 0)?.index, 1);
  assert.equal(chooseGamepad([quiet, gamepad({ index: 1 })], 0)?.index, 0);
});
