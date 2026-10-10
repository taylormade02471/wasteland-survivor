import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ANIMATION_STATES,
  CHARACTER_ARCHETYPE_IDS,
  getCharacterArchetype,
} from "../public/character-models.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = path.join(root, "docs", "character-assets", "six-survivor-aaa.manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const survivorById = new Map(manifest.survivors.map(survivor => [survivor.id, survivor]));

function assertStrictlyDescending(values, label) {
  for (let index = 1; index < values.length; index++) {
    assert.ok(values[index] < values[index - 1], `${label} must decrease at index ${index}`);
  }
}

test("manifest covers exactly the six runtime survivors without claiming runtime integration", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.contractId, "wasteland-survivor.six-survivor-aaa.v1");
  assert.equal(manifest.deliveryStatus, "contract-only");
  assert.deepEqual(manifest.runtimeIntegration, {
    included: false,
    currentAssetsRemainPlaceholders: true,
    integrationRequiresSeparateReview: true,
  });
  assert.deepEqual(manifest.survivors.map(survivor => survivor.id), CHARACTER_ARCHETYPE_IDS);
  assert.equal(survivorById.size, CHARACTER_ARCHETYPE_IDS.length);

  for (const id of CHARACTER_ARCHETYPE_IDS) {
    const survivor = survivorById.get(id);
    const runtime = getCharacterArchetype(id);
    assert.equal(survivor.displayName, runtime.displayName);
    assert.equal(survivor.classId, runtime.classId);
    assert.equal(survivor.silhouetteTag, runtime.silhouetteTag);
    assert.equal(survivor.currentRuntimeAsset, runtime.modelAsset);
    assert.equal(survivor.stageStatus.highResolutionSculpt, "required");
    assert.equal(survivor.stageStatus.retopology, "required");
    assert.equal(survivor.stageStatus.uvPbrTextures, "required");
    assert.equal(survivor.stageStatus.facialRig, "required");
    assert.equal(survivor.stageStatus.skeletonSkin, "required");
    assert.equal(survivor.stageStatus.lods, "required");
    assert.equal(survivor.stageStatus.exportValidation, "required");
  }
});

test("each survivor has distinct high-resolution sculpt and deformation-ready retopology sources", () => {
  const sculpt = manifest.sharedContract.highResolutionSculpt;
  assert.equal(sculpt.sourceFormat, "blend");
  assert.ok(sculpt.targetPolygonRange.minimum >= 10_000_000);
  assert.ok(sculpt.targetPolygonRange.maximum >= sculpt.targetPolygonRange.minimum);
  for (const pass of ["anatomy", "garments", "hard-surface-gear", "surface-damage", "microdetail"]) {
    assert.ok(sculpt.requiredPasses.includes(pass), `missing sculpt pass ${pass}`);
  }

  const retopology = manifest.sharedContract.retopology;
  assert.equal(retopology.sourceFormat, "blend");
  assert.ok(retopology.lod0TriangleRange.minimum >= 35_000);
  assert.ok(retopology.lod0TriangleRange.maximum <= 100_000);
  assert.ok(retopology.lod0TriangleRange.maximum >= retopology.lod0TriangleRange.minimum);
  for (const zone of ["shoulders", "elbows", "wrists", "jaw", "eyelids", "hips", "knees", "ankles"]) {
    assert.ok(retopology.deformationZones.includes(zone), `missing deformation zone ${zone}`);
  }
  assert.equal(retopology.requireClosedManifoldBody, true);
  assert.equal(retopology.requireSilhouettePreservation, true);

  const sculptSources = new Set();
  const retopoSources = new Set();
  for (const survivor of manifest.survivors) {
    assert.match(survivor.sources.highResolutionSculpt, new RegExp(`/${survivor.id}/${survivor.id}-sculpt-v1\\.blend$`));
    assert.match(survivor.sources.retopology, new RegExp(`/${survivor.id}/${survivor.id}-retopo-v1\\.blend$`));
    assert.ok(survivor.silhouettePreservation.length >= 3);
    sculptSources.add(survivor.sources.highResolutionSculpt);
    retopoSources.add(survivor.sources.retopology);
  }
  assert.equal(sculptSources.size, CHARACTER_ARCHETYPE_IDS.length);
  assert.equal(retopoSources.size, CHARACTER_ARCHETYPE_IDS.length);
});

test("UV and cinematic PBR texture requirements are explicit and color-space safe", () => {
  const textures = manifest.sharedContract.uvPbrTextures;
  assert.equal(textures.workflow, "metallic-roughness");
  assert.deepEqual(textures.uvSets, [
    { name: "UV0", purpose: "materials", overlap: "forbidden" },
    { name: "UV1", purpose: "baked-lighting", overlap: "forbidden" },
  ]);
  assert.equal(textures.texelDensityPixelsPerMeter, 1024);
  assert.deepEqual(textures.resolution, { cinematic: 4096, gameplay: 2048, lod3: 1024 });

  const channels = Object.fromEntries(textures.channels.map(channel => [channel.name, channel]));
  assert.deepEqual(Object.keys(channels), ["baseColor", "normal", "orm", "emissive"]);
  assert.equal(channels.baseColor.colorSpace, "sRGB");
  assert.equal(channels.normal.colorSpace, "linear");
  assert.equal(channels.orm.colorSpace, "linear");
  assert.equal(channels.orm.packing, "R=ambientOcclusion,G=roughness,B=metallic");
  assert.equal(channels.emissive.colorSpace, "sRGB");
  assert.equal(textures.paddingPixelsAt4k >= 16, true);

  const textureRoots = new Set();
  for (const survivor of manifest.survivors) {
    assert.match(survivor.sources.textureRoot, new RegExp(`/${survivor.id}/textures$`));
    assert.ok(survivor.materialSets.length >= 3);
    textureRoots.add(survivor.sources.textureRoot);
  }
  assert.equal(textureRoots.size, CHARACTER_ARCHETYPE_IDS.length);
});

test("facial rig and shared humanoid skin contract support cinematic expression and gameplay animation", () => {
  const face = manifest.sharedContract.facialRig;
  assert.equal(face.rigStandard, "facs-inspired");
  assert.deepEqual(face.enabledLods, ["LOD0", "LOD1"]);
  for (const bone of ["face_root", "jaw", "eye_l", "eye_r"] ) {
    assert.ok(face.requiredBones.includes(bone), `missing facial bone ${bone}`);
  }
  for (const shape of ["blink_l", "blink_r", "jaw_open", "brow_up_l", "brow_up_r", "mouth_smile_l", "mouth_smile_r", "viseme_aa", "viseme_oh"] ) {
    assert.ok(face.requiredBlendShapes.includes(shape), `missing facial shape ${shape}`);
  }

  const skin = manifest.sharedContract.skeletonSkin;
  assert.equal(skin.skeletonId, "ws_humanoid_v1");
  assert.equal(skin.bindPose, "a-pose");
  assert.equal(skin.maxInfluencesPerVertex, 4);
  assert.equal(skin.requireNormalizedWeights, true);
  assert.equal(skin.maximumWeightSumError, 0.001);
  assert.equal(skin.allowedUnweightedVertices, 0);
  for (const bone of ["root", "pelvis", "spine_01", "spine_02", "spine_03", "neck", "head", "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l", "thigh_l", "calf_l", "foot_l", "clavicle_r", "upperarm_r", "lowerarm_r", "hand_r", "thigh_r", "calf_r", "foot_r"]) {
    assert.ok(skin.requiredBones.includes(bone), `missing humanoid bone ${bone}`);
  }
});

test("shared and class-specific sockets have stable names and valid skeleton parents", () => {
  const sockets = manifest.sharedContract.sockets;
  const socketParents = Object.fromEntries(sockets.required.map(socket => [socket.name, socket.parent]));
  assert.deepEqual(socketParents, {
    socket_weapon_r: "hand_r",
    socket_weapon_l: "hand_l",
    socket_back: "spine_03",
    socket_hip_l: "pelvis",
    socket_hip_r: "pelvis",
    socket_shoulder_l: "clavicle_l",
    socket_shoulder_r: "clavicle_r",
    socket_head_fx: "head",
    socket_camera: "head",
  });
  assert.equal(sockets.requireZeroedLocalTransform, true);
  assert.equal(sockets.requireUnitScale, true);

  const classSocketNames = new Set();
  for (const survivor of manifest.survivors) {
    assert.match(survivor.classAttachmentSocket.name, new RegExp(`^socket_class_${survivor.id}_`));
    assert.ok(manifest.sharedContract.skeletonSkin.requiredBones.includes(survivor.classAttachmentSocket.parent));
    classSocketNames.add(survivor.classAttachmentSocket.name);
  }
  assert.equal(classSocketNames.size, CHARACTER_ARCHETYPE_IDS.length);
});

test("LODs reduce geometry and materials while preserving skeleton and attachment compatibility", () => {
  const lods = manifest.sharedContract.lods;
  assert.deepEqual(lods.map(lod => lod.name), ["LOD0", "LOD1", "LOD2", "LOD3"]);
  assertStrictlyDescending(lods.map(lod => lod.maxTriangles), "LOD triangles");
  assertStrictlyDescending(lods.map(lod => lod.minimumScreenHeight), "LOD screen height");
  assert.ok(lods[0].maxTriangles <= manifest.sharedContract.retopology.lod0TriangleRange.maximum);
  assert.ok(lods.at(-1).maxTriangles <= 8_000);
  assert.ok(lods.every(lod => lod.skeletonId === manifest.sharedContract.skeletonSkin.skeletonId));
  assert.ok(lods.every(lod => lod.preserveRequiredSockets));
  assert.ok(lods.every(lod => lod.maxMaterials <= 6));
});

test("GLB export gate validates transforms, skinning, sockets, animation clips, textures, and budgets", () => {
  const validation = manifest.sharedContract.exportValidation;
  assert.equal(validation.format, "glb");
  assert.equal(validation.gltfVersion, "2.0");
  assert.equal(validation.requireSingleScene, true);
  assert.equal(validation.requireSingleSkin, true);
  assert.equal(validation.requireEmbeddedBuffers, true);
  assert.equal(validation.requireEmbeddedTextures, true);
  assert.equal(validation.requireNoUnsupportedExtensions, true);
  assert.equal(validation.maximumFileSizeMiB <= 64, true);
  assert.deepEqual(validation.requiredAnimationClips, ANIMATION_STATES);
  for (const check of [
    "root-transform-identity",
    "finite-transforms",
    "no-negative-scale",
    "skeleton-bone-set",
    "normalized-skin-weights",
    "no-unweighted-vertices",
    "required-sockets",
    "lod-budget",
    "pbr-texture-channels",
    "animation-clip-set",
  ]) {
    assert.ok(validation.failOn.includes(check), `missing export validation ${check}`);
  }

  const exportTargets = new Set();
  for (const survivor of manifest.survivors) {
    assert.match(survivor.exportTarget, new RegExp(`/${survivor.id}/${survivor.id}-operator-aaa-v1\\.glb$`));
    exportTargets.add(survivor.exportTarget);
  }
  assert.equal(exportTargets.size, CHARACTER_ARCHETYPE_IDS.length);
});
