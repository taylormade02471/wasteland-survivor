import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CHARACTER_ARCHETYPE_IDS, getCharacterArchetype } from "../public/character-models.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function readGlbJson(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString("utf8", 0, 4), "glTF");
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.toString("utf8", 16, 20);
  assert.equal(jsonType, "JSON");
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).trim());
}

test("six Blender-authored survivor GLBs exist and expose gameplay handoff nodes", () => {
  const expectedNodes = {
    scout: ["head:hood", "torso:torn-teal-cloak-left", "shoulderMount:radio-whip", "weapon:compact-smg"],
    ranger: ["head:ranger-brim", "torso:rust-scarf", "torso:coat-tail", "weapon:marksman-rifle"],
    heavy: ["head:sealed-faceplate", "shield:breach-slab", "weapon:drum-lmg", "weapon:drum"],
    tech: ["backMount:antenna", "backMount:glow-cell-left", "hipMount:blue-tool-case", "weapon:coil-carbine"],
    medic: ["torso:white-field-jacket", "torso:red-harness", "hipMount:triage-pouch", "weapon:pulse-pistol"],
    warden: ["torso:high-collar", "torso:long-warden-cloak-left", "shield:tower", "weapon:riot-shotgun"],
  };

  for (const id of CHARACTER_ARCHETYPE_IDS) {
    const archetype = getCharacterArchetype(id);
    assert.match(archetype.modelAsset, new RegExp(`/3d/${id}-operator-v1\\.glb$`));
    const filePath = path.join(root, "public", archetype.modelAsset.replace(/^\.\//, ""));
    assert.ok(fs.existsSync(filePath), `${id} GLB exists`);
    assert.ok(fs.statSync(filePath).size > 20_000, `${id} GLB has mesh payload`);

    const glb = readGlbJson(filePath);
    assert.equal(glb.asset.version, "2.0");
    assert.ok(glb.meshes.length >= 12, `${id} has multiple mesh primitives`);
    assert.ok(glb.materials.length >= 5, `${id} carries authored material slots`);
    const nodeNames = new Set(glb.nodes.map((node) => node.name));
    assert.ok(nodeNames.has(`character:${id}`), `${id} has a character root`);
    for (const anchor of ["leftHandAnchor", "rightHandAnchor", "weaponAnchor", "muzzle", "classAttachmentAnchor"]) {
      assert.ok(nodeNames.has(anchor), `${id} has ${anchor}`);
    }
    for (const name of expectedNodes[id]) assert.ok(nodeNames.has(name), `${id} includes ${name}`);
  }
});

test("character asset contract is explicit about current GLB limits", () => {
  for (const id of CHARACTER_ARCHETYPE_IDS) {
    const archetype = getCharacterArchetype(id);
    assert.equal(archetype.assetContract.authoredGlbAvailable, true);
    assert.equal(archetype.assetContract.importedRig, false);
    assert.equal(archetype.assetContract.runtimeAnimationDriver, "./character-animation-runtime.mjs");
    assert.deepEqual(archetype.assetContract.animationStates, ["idle", "walk", "run", "aim", "fire", "hit", "downed", "wade"]);
    assert.match(archetype.assetContract.remainingBlocker, /skinned rigs/i);
  }
});
