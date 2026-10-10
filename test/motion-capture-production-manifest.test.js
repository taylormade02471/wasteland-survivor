import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = path.join(root, "docs", "motion-capture-production-manifest.json");
const characterModels = fs.readFileSync(path.join(root, "public", "character-models.mjs"), "utf8");
const weaponModels = fs.readFileSync(path.join(root, "public", "weapon-models.mjs"), "utf8");
const controllerRules = fs.readFileSync(path.join(root, "public", "controller-rules.mjs"), "utf8");
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");

const CHARACTER_STATES = ["idle", "walk", "run", "aim", "fire", "hit", "downed", "wade"];
const WEAPON_STATES = ["idle", "aim", "fire", "reload", "overheat", "lower", "raise", "swap"];
const CONTROLLER_SIGNALS = ["move", "look", "fire", "ads", "interact", "reload", "weapon", "pause"];
const REQUIRED_CATEGORIES = [
  "locomotion",
  "turning",
  "aim",
  "firing",
  "reload-heat-recovery",
  "hit",
  "downed-death",
  "revive-respawn",
  "interaction",
  "dialogue-cinematic",
  "facial",
];

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function allClips(manifest) {
  return manifest.clipContracts;
}

test("motion-capture manifest covers every requested production category", () => {
  const manifest = readManifest();
  const clips = allClips(manifest);
  const categories = [...new Set(clips.map(clip => clip.category))];

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.ownership.motionCapture, true);
  assert.equal(manifest.ownership.facialAnimation, true);
  assert.deepEqual(categories.sort(), [...REQUIRED_CATEGORIES].sort());
  assert.ok(clips.length >= REQUIRED_CATEGORIES.length);
  assert.equal(new Set(clips.map(clip => clip.id)).size, clips.length);
});

test("clip bindings reference the existing character, weapon, and controller vocabulary", () => {
  const manifest = readManifest();
  const clips = allClips(manifest);

  assert.match(characterModels, /ANIMATION_STATES\s*=\s*Object\.freeze\(\[([^\]]+)\]\)/);
  assert.match(weaponModels, /WEAPON_ANIMATION_STATES\s*=\s*Object\.freeze\(\[([^\]]+)\]\)/);
  assert.match(controllerRules, /interact:\s*justPressed\(0\)/);
  assert.match(controllerRules, /reload:\s*justPressed\(2\)/);
  assert.match(controllerRules, /weapon:\s*justPressed\(3\)/);

  for (const clip of clips) {
    assert.ok(clip.id && clip.id.startsWith("wasteland-survivor."));
    assert.ok(clip.category);
    assert.ok(["motion-capture", "facial-animation"].includes(clip.owner));
    assert.ok(clip.binding);
    assert.ok(clip.binding.controllerHook);
    assert.ok(clip.binding.characterPoseState || clip.binding.weaponPoseState || clip.binding.controllerSignal || clip.binding.storyPhase);

    if (clip.binding.characterPoseState) assert.ok(CHARACTER_STATES.includes(clip.binding.characterPoseState), `${clip.id} character state`);
    if (clip.binding.weaponPoseState) assert.ok(WEAPON_STATES.includes(clip.binding.weaponPoseState), `${clip.id} weapon state`);
    if (clip.binding.controllerSignal) assert.ok(CONTROLLER_SIGNALS.includes(clip.binding.controllerSignal), `${clip.id} controller signal`);
  }
});

test("lifecycle and story bindings describe existing runtime hooks without adding behavior", () => {
  const manifest = readManifest();
  const byId = new Map(allClips(manifest).map(clip => [clip.id, clip]));

  assert.match(characterModels, /export function createPoseController\(model\)/);
  assert.match(characterModels, /resetTerminalState\(\)/);
  assert.match(game, /function reviveUnitVisual\(unit\)/);
  assert.match(game, /unit\.visualController\?\.resetTerminalState\?\.\(\)/);
  assert.match(game, /function setStoryDialogueMode\(active\)/);
  assert.match(game, /setNightfallScene\("dialogue"\)/);

  const downed = byId.get("wasteland-survivor.downed-death.downed");
  assert.equal(downed.binding.characterPoseState, "downed");
  assert.equal(downed.lifecycle.terminal, true);

  const revive = byId.get("wasteland-survivor.revive-respawn.respawn");
  assert.equal(revive.binding.characterPoseState, "idle");
  assert.equal(revive.binding.lifecycleHook, "resetTerminalState");
  assert.equal(revive.lifecycle.resetsTerminalPose, true);

  const dialogue = byId.get("wasteland-survivor.dialogue-cinematic.dialogue-idle");
  assert.equal(dialogue.binding.storyPhase, "dialogue");
  assert.equal(dialogue.binding.storyScene, "dialogue");
  assert.equal(dialogue.binding.controllerHook, "setStoryDialogueMode");
});

test("facial and narrative contracts stay capture-only while hosted by existing body states", () => {
  const manifest = readManifest();
  const clips = allClips(manifest).filter(clip => ["dialogue-cinematic", "facial"].includes(clip.category));

  assert.ok(clips.length >= 2);
  for (const clip of clips) {
    assert.equal(clip.capture.runtimeSupport, "capture-only", clip.id);
    assert.equal(clip.capture.runtimeImport, false, clip.id);
    assert.ok(CHARACTER_STATES.includes(clip.binding.characterPoseState), clip.id);
    assert.equal(clip.capture.facialTrack, "required", clip.id);
  }
});
