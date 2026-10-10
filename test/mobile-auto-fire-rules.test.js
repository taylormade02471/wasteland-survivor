import test from "node:test";
import assert from "node:assert/strict";
import { decideAndroidTouchAutoFire } from "../public/mobile-auto-fire-rules.mjs";

const base = {
  isAndroidApp: true,
  inputMode: "touch",
  phase: "combat",
  target: { alive: true },
  menuOpen: false,
  inputPaused: false,
  manualFire: false,
};

test("Android touch combat may acquire a live target and auto-fire", () => {
  assert.deepEqual(decideAndroidTouchAutoFire(base), {
    targetMayBeAcquired: true,
    firingRequested: true,
    reason: "android-touch-auto-fire",
  });
});

test("manual fire is an explicit override during active touch combat", () => {
  assert.deepEqual(decideAndroidTouchAutoFire({ ...base, isAndroidApp: false, manualFire: true }), {
    targetMayBeAcquired: false,
    firingRequested: true,
    reason: "manual-fire",
  });
});

test("auto-fire cannot run without an Android touch session or live target", () => {
  for (const input of [
    { ...base, isAndroidApp: false },
    { ...base, inputMode: "controller" },
    { ...base, target: null },
    { ...base, target: { alive: false } },
  ]) {
    assert.deepEqual(decideAndroidTouchAutoFire(input), {
      targetMayBeAcquired: false,
      firingRequested: false,
      reason: "auto-fire-unavailable",
    });
  }
});

test("prep, countdown, menus, and paused input never auto-fire", () => {
  for (const input of [
    { ...base, phase: "prep" },
    { ...base, phase: "countdown" },
    { ...base, menuOpen: true },
    { ...base, inputPaused: true },
  ]) {
    assert.deepEqual(decideAndroidTouchAutoFire(input), {
      targetMayBeAcquired: false,
      firingRequested: false,
      reason: "gameplay-inactive",
    });
  }
});

test("manual fire cannot override an inactive phase", () => {
  assert.deepEqual(decideAndroidTouchAutoFire({ ...base, phase: "prep", manualFire: true }), {
    targetMayBeAcquired: false,
    firingRequested: false,
    reason: "gameplay-inactive",
  });
});
