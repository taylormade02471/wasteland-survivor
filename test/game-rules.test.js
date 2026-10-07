import test from "node:test";
import assert from "node:assert/strict";

import {
  aimPresetForDifficulty,
  normalizeAimSettings,
  resolveInputMode,
  shouldAutoLock,
  shouldDuckMusic,
} from "../public/game-rules.mjs";

test("input mode gives controller precedence, then mouse, then touch", () => {
  assert.equal(resolveInputMode({ coarsePointer: true, mouseInputActive: true, controllerConnected: true }), "controller");
  assert.equal(resolveInputMode({ coarsePointer: true, mouseInputActive: true, controllerConnected: false }), "mouse");
  assert.equal(resolveInputMode({ coarsePointer: true, mouseInputActive: false, controllerConnected: false }), "touch");
  assert.equal(resolveInputMode({ coarsePointer: false, mouseInputActive: false, controllerConnected: false }), "mouse");
});

test("aim settings clamp numeric values and reject invalid presets", () => {
  assert.deepEqual(
    normalizeAimSettings({ sensitivity: 4, adsSensitivity: 0.1, assistStrength: -2, preset: "magic" }),
    { sensitivity: 2, adsSensitivity: 0.5, assistStrength: 0, preset: "assist" },
  );
  assert.deepEqual(
    normalizeAimSettings({ sensitivity: 1.35, adsSensitivity: 1.1, assistStrength: 0.8, preset: "manual" }),
    { sensitivity: 1.35, adsSensitivity: 1.1, assistStrength: 0.8, preset: "manual" },
  );
});

test("difficulty chooses full, assist, then manual aim presets", () => {
  assert.equal(aimPresetForDifficulty(0.1), "full");
  assert.equal(aimPresetForDifficulty(0.22), "assist");
  assert.equal(aimPresetForDifficulty(0.35), "manual");
  assert.equal(aimPresetForDifficulty(0.75), "manual");
});

test("Easy touch play auto-locks when there is no manual aim", () => {
  assert.equal(shouldAutoLock({ coarsePointer: true, difficultyRatio: 0.1, manualAim: false }), true);
});

test("manual aim and harder difficulties disable phone auto-lock", () => {
  assert.equal(shouldAutoLock({ coarsePointer: true, difficultyRatio: 0.1, manualAim: true }), false);
  assert.equal(shouldAutoLock({ coarsePointer: true, difficultyRatio: 0.22, manualAim: false }), false);
  assert.equal(shouldAutoLock({ coarsePointer: false, difficultyRatio: 0.1, manualAim: false }), false);
  assert.equal(shouldAutoLock({ coarsePointer: true, difficultyRatio: 0.1, manualAim: false, mouseInputActive: true }), false);
  assert.equal(shouldAutoLock({ coarsePointer: true, difficultyRatio: 0.1, manualAim: false, controllerInputActive: true }), false);
});

test("music ducks only while voice is active and unmuted", () => {
  assert.equal(shouldDuckMusic({ voiceActive: true, voiceMuted: false }), true);
  assert.equal(shouldDuckMusic({ voiceActive: true, voiceMuted: true }), false);
  assert.equal(shouldDuckMusic({ voiceActive: false, voiceMuted: false }), false);
});
