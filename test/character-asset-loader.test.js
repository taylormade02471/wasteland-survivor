import assert from "node:assert/strict";
import test from "node:test";

import { getCharacterArchetype } from "../public/character-models.mjs";
import { loadCharacterAsset, normalizeCharacterAsset } from "../public/character-asset-loader.mjs";

function object3d({ name = "", children = [], position = { x: 0, y: 0, z: 0 }, scale = { x: 1, y: 1, z: 1 } } = {}) {
  return { name, children, position, scale, traverse(callback) { callback(this); children.forEach(child => child.traverse(callback)); } };
}

test("normalizes a valid loaded scene with the roster asset identity", () => {
  const scene = object3d({ name: "character:scout", children: [object3d({ name: "mesh" })] });
  const normalized = normalizeCharacterAsset({ scene, archetype: getCharacterArchetype("scout") });

  assert.equal(normalized.ok, true);
  assert.equal(normalized.archetypeId, "scout");
  assert.equal(normalized.scene, scene);
});

test("accepts a glTF Scene wrapper when its authored character child matches", () => {
  const scene = object3d({ name: "Scene", children: [object3d({ name: "characterscout" })] });
  const normalized = normalizeCharacterAsset({ scene, archetype: getCharacterArchetype("scout") });

  assert.equal(normalized.ok, true);
  assert.equal(normalized.scene, scene);
});

test("loadCharacterAsset is loader-injected and applies shadows, scale, and ground offset", async () => {
  const scene = object3d({ name: "character:ranger", children: [object3d({ name: "mesh" })] });
  const normalized = await loadCharacterAsset({
    archetype: getCharacterArchetype("ranger"),
    loader: { loadAsync: async path => ({ scene, path }) },
    scale: 1.25,
    groundY: 2,
  });

  assert.equal(normalized.ok, true);
  assert.equal(normalized.path, getCharacterArchetype("ranger").modelAsset);
  assert.equal(scene.scale.x, 1.25);
  assert.equal(scene.scale.y, 1.25);
  assert.equal(scene.scale.z, 1.25);
  assert.equal(scene.position.y, 2);
  assert.equal(scene.castShadow, true);
  assert.equal(scene.receiveShadow, true);
  assert.equal(scene.children[0].castShadow, true);
  assert.equal(scene.children[0].receiveShadow, true);
});

test("invalid scene and loader failures use the procedural fallback without throwing", async () => {
  const fallback = object3d({ name: "procedural:scout" });
  const result = await loadCharacterAsset({
    archetype: getCharacterArchetype("scout"),
    loader: { loadAsync: async () => ({ scene: object3d({ name: "wrong-root" }) }) },
    fallbackFactory: () => fallback,
  });

  assert.equal(result.ok, false);
  assert.equal(result.usedFallback, true);
  assert.equal(result.scene, fallback);
  assert.match(result.reason, /root/i);
});

test("missing loader or malformed archetype returns a clean fallback result", async () => {
  const fallback = object3d({ name: "procedural:scout" });
  const result = await loadCharacterAsset({ archetype: { id: "scout" }, fallbackFactory: () => fallback });

  assert.equal(result.ok, false);
  assert.equal(result.usedFallback, true);
  assert.equal(result.scene, fallback);
  assert.match(result.reason, /loader|modelAsset/i);
});

test("fallbackFactory exceptions never escape the loader", async () => {
  const result = await loadCharacterAsset({
    archetype: getCharacterArchetype("heavy"),
    loader: { loadAsync: async () => { throw new Error("network down"); } },
    fallbackFactory: () => { throw new Error("fallback unavailable"); },
  });

  assert.equal(result.ok, false);
  assert.equal(result.usedFallback, true);
  assert.equal(result.scene, null);
  assert.match(result.reason, /network down/i);
});

test("traverse and property-normalization exceptions return structured fallbacks", async () => {
  const result = await loadCharacterAsset({
    archetype: getCharacterArchetype("tech"),
    loader: { loadAsync: async () => ({
      scene: {
        name: "character:tech",
        position: { get y() { throw new Error("position unavailable"); } },
        traverse() { throw new Error("scene traversal failed"); },
      },
    }) },
    fallbackFactory: () => object3d({ name: "procedural:tech" }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.usedFallback, true);
  assert.equal(result.scene.name, "procedural:tech");
  assert.match(result.reason, /traversal|position|normaliz/i);
});

test("supports callback-style loader success and applies normalization", async () => {
  const scene = object3d({ name: "character:medic" });
  const result = await loadCharacterAsset({
    archetype: getCharacterArchetype("medic"),
    loader: { load(path, onLoad) { onLoad({ scene, path }); } },
    scale: 0.9,
  });

  assert.equal(result.ok, true);
  assert.equal(result.path, getCharacterArchetype("medic").modelAsset);
  assert.equal(scene.scale.x, 0.9);
});

test("supports callback-style loader errors with a clean fallback", async () => {
  const fallback = object3d({ name: "procedural:warden" });
  const result = await loadCharacterAsset({
    archetype: getCharacterArchetype("warden"),
    loader: { load(path, onLoad, onProgress, onError) { onError(new Error(`failed: ${path}`)); } },
    fallbackFactory: () => fallback,
  });

  assert.equal(result.ok, false);
  assert.equal(result.usedFallback, true);
  assert.equal(result.scene, fallback);
  assert.match(result.reason, /failed: .*warden-operator-v1\.glb/i);
});
