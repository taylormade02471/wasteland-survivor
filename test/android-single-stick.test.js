import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import * as touchRules from "../public/touch-control-rules.mjs";

test("Android single stick moves forward without changing the level camera", () => {
  assert.equal(typeof touchRules.resolveAndroidSingleStick, "function");
  if (typeof touchRules.resolveAndroidSingleStick !== "function") return;
  assert.deepEqual(touchRules.resolveAndroidSingleStick({ x: 0, y: -1 }), {
    forward: 1,
    turnRate: 0,
    pitch: 0,
    active: true,
  });
});

test("Android single stick turns right with a bounded rate and stops in the dead zone", () => {
  assert.equal(typeof touchRules.resolveAndroidSingleStick, "function");
  if (typeof touchRules.resolveAndroidSingleStick !== "function") return;
  const turning = touchRules.resolveAndroidSingleStick({ x: 1, y: 0, maxTurnRate: 2.4 });
  const stopped = touchRules.resolveAndroidSingleStick({ x: 0.05, y: 0, maxTurnRate: 2.4 });

  assert.equal(turning.turnRate, 2.4);
  assert.equal(turning.forward, 0);
  assert.equal(turning.pitch, 0);
  assert.equal(stopped.turnRate, 0);
  assert.equal(stopped.active, false);
});

test("Android phone keeps four thumb actions while the web layout remains separate", () => {
  assert.deepEqual(touchRules.ANDROID_SINGLE_STICK_CONTROLS, ["fire", "menu", "reload", "ability"]);
});

test("Android uses one movement-turn stick and hides the duplicate look cluster", () => {
  const game = fs.readFileSync(path.join(process.cwd(), "public", "game3d.js"), "utf8");
  const styles = fs.readFileSync(path.join(process.cwd(), "public", "style.css"), "utf8");
  assert.match(game, /classList\.toggle\("android-app", isAndroidApp\)/);
  assert.match(styles, /body\.android-app \.touch-aim-cluster\s*\{[^}]*display:\s*none/s);
  assert.match(styles, /body\.android-app \.touch-primary-actions/);
});
