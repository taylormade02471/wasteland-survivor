import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../public/vendor/three.module.js";
import { cloneSkinnedScene } from "../public/skeleton-clone.mjs";

test("cloneSkinnedScene binds each cloned skinned mesh to cloned bones", () => {
  const source = new THREE.Group();
  const sourceBone = new THREE.Bone();
  sourceBone.name = "source-bone";
  const sourceMesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  source.add(sourceBone, sourceMesh);
  sourceMesh.bind(new THREE.Skeleton([sourceBone]));

  const cloned = cloneSkinnedScene(source);
  const clonedMesh = cloned.getObjectsByProperty("isSkinnedMesh", true)[0];
  const clonedBone = cloned.getObjectByName("source-bone");

  assert.ok(clonedMesh);
  assert.notEqual(clonedMesh.skeleton, sourceMesh.skeleton);
  assert.equal(clonedMesh.skeleton.bones[0], clonedBone);
  assert.notEqual(clonedMesh.skeleton.bones[0], sourceBone);
});
