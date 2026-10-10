import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CHARACTER_ARCHETYPE_IDS, getCharacterArchetype } from "../public/character-models.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = path.join(root, "public", "assets", "nightfall", "characters", "aaa-production-manifest.json");

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

test("AAA character manifest covers every survivor and preserves current asset references", () => {
  const manifest = readManifest();
  assert.equal(manifest.status, "production-specification");
  assert.equal(manifest.characters.length, CHARACTER_ARCHETYPE_IDS.length);
  assert.deepEqual(manifest.characters.map((character) => character.id), CHARACTER_ARCHETYPE_IDS);
  for (const character of manifest.characters) {
    const archetype = getCharacterArchetype(character.id);
    assert.equal(character.currentGlb, archetype.modelAsset.replace(/^\.\/assets\/nightfall\/characters\//, ""));
    assert.ok(character.productionPackage.endsWith("-aaa-v1"));
    assert.ok(character.referenceImage.startsWith("index/"));
  }
});

test("AAA contract defines rig, facial, cinematic material, animation, socket, and LOD gates", () => {
  const manifest = readManifest();
  assert.equal(manifest.rig.skin.maxInfluences, 4);
  assert.equal(manifest.rig.facialRig.required, true);
  assert.ok(manifest.rig.requiredBones.includes("jaw"));
  assert.ok(manifest.materials.pbrChannels.includes("baseColor"));
  assert.ok(manifest.materials.pbrChannels.includes("metallicRoughness"));
  assert.ok(manifest.animationLibrary.requiredClips.includes("fire"));
  assert.ok(manifest.animationLibrary.requiredClips.includes("respawn"));
  for (const socket of ["weaponAnchor", "muzzle", "classAttachmentAnchor", "footstepL", "footstepR"]) {
    assert.ok(manifest.sockets.includes(socket), `${socket} is required`);
  }
  assert.deepEqual(manifest.lods.map((lod) => lod.id), ["lod0-hero", "lod1-gameplay", "lod2-mobile", "lod3-crowd"]);
  assert.ok(manifest.export.validation.includes("skeleton-bind-pose-roundtrip"));
});
