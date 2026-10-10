import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  TOUCH_PRIMARY_CONTROLS,
  TOUCH_UTILITY_CONTROLS,
  normalizeTouchStick,
  shouldAutoFireFromTouch,
} from "../public/touch-control-rules.mjs";

test("touch sticks use their actual radius and preserve diagonal magnitude", () => {
  assert.deepEqual(normalizeTouchStick({ dx: 40, dy: 0, radius: 40 }), { x: 1, z: 0, magnitude: 1 });
  assert.deepEqual(normalizeTouchStick({ dx: 80, dy: 80, radius: 40 }), { x: 0.707, z: 0.707, magnitude: 1 });
  assert.deepEqual(normalizeTouchStick({ dx: 0, dy: 0, radius: 40 }), { x: 0, z: 0, magnitude: 0 });
});

test("phone combat exposes four primary actions and moves the rest into utility controls", () => {
  assert.deepEqual(TOUCH_PRIMARY_CONTROLS, ["fire", "lock", "ability", "more"]);
  assert.deepEqual(TOUCH_UTILITY_CONTROLS, ["reload", "weapon", "interact", "ads", "pause"]);

  const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /id="touchPrimaryActions"/);
  assert.match(html, /id="touchUtilityBtn"/);
  assert.match(html, /id="touchLockBtn"/);
  assert.match(html, /id="touchUtilityTray"/);
  assert.match(html, /id="touchAssistStatus"/);
  assert.match(fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8"), /shouldAutoFireFromTouch/);
  const css = fs.readFileSync(new URL("../public/style.css", import.meta.url), "utf8");
  assert.match(css, /\.touch-action-zone[^}]*pointer-events:\s*auto/);
  assert.match(css, /\.touch-primary-actions[^}]*pointer-events:\s*auto/);
});

test("touch aim can auto-fire only while a target is under the crosshair", () => {
  assert.equal(shouldAutoFireFromTouch({ aiming: true, targetInCrosshair: true }), true);
  assert.equal(shouldAutoFireFromTouch({ aiming: true, targetInCrosshair: false }), false);
  assert.equal(shouldAutoFireFromTouch({ manualFire: true }), true);
});
