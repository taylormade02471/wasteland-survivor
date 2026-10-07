import assert from "node:assert/strict";
import test from "node:test";

import {
  ANIMATION_STATES,
  CHARACTER_ARCHETYPE_IDS,
  MOBILE_CHARACTER_BUDGET,
  createCharacterModel,
  createPoseController,
  getCharacterArchetype,
  sampleCharacterPose,
} from "../public/character-models.mjs";

const REQUIRED_RIG_PARTS = [
  "root",
  "hips",
  "torso",
  "head",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg",
  "weapon",
  "backMount",
];

function createFakeThree() {
  class Object3D {
    constructor() {
      this.children = [];
      this.name = "";
      this.position = { x: 0, y: 0, z: 0, set: (x = 0, y = 0, z = 0) => Object.assign(this.position, { x, y, z }) };
      this.rotation = { x: 0, y: 0, z: 0, set: (x = 0, y = 0, z = 0) => Object.assign(this.rotation, { x, y, z }) };
      this.scale = { x: 1, y: 1, z: 1, set: (x = 1, y = x, z = x) => Object.assign(this.scale, { x, y, z }) };
      this.userData = {};
      this.castShadow = false;
      this.receiveShadow = false;
    }
    add(...children) {
      this.children.push(...children);
      return this;
    }
  }
  class Group extends Object3D {}
  class Mesh extends Object3D {
    constructor(geometry, material) {
      super();
      this.geometry = geometry;
      this.material = material;
    }
  }
  class Geometry {
    constructor(type, args) {
      this.type = type;
      this.args = args;
    }
  }
  class MeshStandardMaterial {
    constructor(options) {
      this.options = options;
    }
  }
  return {
    Group,
    Mesh,
    MeshStandardMaterial,
    BoxGeometry: class BoxGeometry extends Geometry { constructor(...args) { super("BoxGeometry", args); } },
    CapsuleGeometry: class CapsuleGeometry extends Geometry { constructor(...args) { super("CapsuleGeometry", args); } },
    ConeGeometry: class ConeGeometry extends Geometry { constructor(...args) { super("ConeGeometry", args); } },
    CylinderGeometry: class CylinderGeometry extends Geometry { constructor(...args) { super("CylinderGeometry", args); } },
    SphereGeometry: class SphereGeometry extends Geometry { constructor(...args) { super("SphereGeometry", args); } },
  };
}

function assertFiniteTree(value, path = "pose") {
  if (typeof value === "number") {
    assert.equal(Number.isFinite(value), true, `${path} is finite`);
    assert.ok(value >= -2.5 && value <= 2.5, `${path} is bounded`);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) assertFiniteTree(child, `${path}.${key}`);
}

test("exports six normalized survivor archetypes with distinct gameplay-neutral metadata", () => {
  assert.deepEqual(CHARACTER_ARCHETYPE_IDS, ["scout", "ranger", "heavy", "tech", "medic", "warden"]);
  const signatures = new Set();

  for (const id of CHARACTER_ARCHETYPE_IDS) {
    const archetype = getCharacterArchetype(id);
    assert.equal(archetype.id, id);
    assert.equal(typeof archetype.displayName, "string");
    assert.ok(archetype.displayName.length > 0);
    assert.match(archetype.classId, /^(scout|ranger|heavy|tech)$/);
    assert.ok(archetype.silhouetteTag);
    assert.ok(archetype.palette.primary);
    assert.ok(archetype.palette.accent);
    assert.ok(archetype.weapon.kind);
    assert.ok(archetype.mobileBudget.triangles <= MOBILE_CHARACTER_BUDGET.triangles);
    assert.ok(archetype.mobileBudget.materials <= MOBILE_CHARACTER_BUDGET.materials);
    signatures.add(JSON.stringify({
      classId: archetype.classId,
      silhouette: archetype.silhouetteTag,
      proportions: archetype.proportions,
      mounts: archetype.mounts,
      weapon: archetype.weapon,
    }));
  }

  assert.equal(signatures.size, CHARACTER_ARCHETYPE_IDS.length);
  assert.equal(getCharacterArchetype("unknown").id, "scout");
});

test("mesh factory builds named rig parts and distinct authored geometry for every archetype", () => {
  const THREE = createFakeThree();
  const geometrySignatures = new Set();

  for (const id of CHARACTER_ARCHETYPE_IDS) {
    const model = createCharacterModel(THREE, id);
    assert.equal(model.root.name, `character:${id}`);
    assert.equal(model.metadata.id, id);
    assert.equal(model.budget.triangles <= MOBILE_CHARACTER_BUDGET.triangles, true);
    assert.equal(model.budget.materials <= MOBILE_CHARACTER_BUDGET.materials, true);

    for (const part of REQUIRED_RIG_PARTS) {
      assert.ok(model.parts[part], `${id} includes ${part}`);
      assert.equal(typeof model.parts[part].name, "string");
      if (part !== "root") assert.ok(model.parts[part].name.includes(part));
    }

    const meshTypes = [];
    const visit = (node) => {
      if (node.geometry) meshTypes.push(`${node.name}:${node.geometry.type}:${node.geometry.args.join(",")}`);
      for (const child of node.children || []) visit(child);
    };
    visit(model.root);
    assert.ok(meshTypes.length >= 12, `${id} has authored body and kit meshes`);
    geometrySignatures.add(meshTypes.join("|"));
  }

  assert.equal(geometrySignatures.size, CHARACTER_ARCHETYPE_IDS.length);
});

test("pose sampler exposes required states with finite bounded values including stable downed death", () => {
  assert.deepEqual(ANIMATION_STATES, ["idle", "walk", "run", "aim", "fire", "hit", "downed", "wade"]);

  const samples = [
    { state: "idle", time: 0.5 },
    { state: "walk", time: 1.1, speed: 0.45 },
    { state: "run", time: 1.1, speed: 1 },
    { state: "aim", time: 2, aim: 1 },
    { state: "fire", time: 2, aim: 1, fire: 1 },
    { state: "hit", time: 2, hit: 1 },
    { state: "wade", time: 3, speed: 0.6, waterDepth: 0.8 },
    { state: "downed", time: 1000, speed: 1, aim: 1, fire: 1, hit: 1, downed: true },
    { state: "downed", time: 1001, speed: 0, aim: 0, fire: 0, hit: 0, downed: true },
  ];

  for (const id of CHARACTER_ARCHETYPE_IDS) {
    for (const input of samples) {
      const pose = sampleCharacterPose(id, input);
      assert.equal(pose.state, input.state);
      assertFiniteTree(pose);
    }
  }

  assert.deepEqual(
    sampleCharacterPose("heavy", { state: "downed", time: 1000, downed: true }),
    sampleCharacterPose("heavy", { state: "downed", time: 1001, downed: true }),
  );
});

test("pose controller applies deterministic updates to rig parts", () => {
  const THREE = createFakeThree();
  const model = createCharacterModel(THREE, "ranger");
  const controller = createPoseController(model);

  const first = controller.update(0.25, { speed: 0.8, aim: 1, fire: 0, hit: 0, downed: false, waterDepth: 0 });
  const second = controller.update(0.25, { speed: 0.8, aim: 1, fire: 1, hit: 0, downed: false, waterDepth: 0 });
  assert.equal(first.state, "aim");
  assert.equal(second.state, "fire");
  assert.notEqual(model.parts.weapon.rotation.x, 0);

  const deathPose = controller.update(1, { speed: 1, aim: 1, fire: 1, hit: 1, downed: true, waterDepth: 1 });
  const deathSnapshot = JSON.stringify({
    root: model.parts.root.rotation,
    torso: model.parts.torso.rotation,
    weapon: model.parts.weapon.rotation,
  });
  controller.update(1, { speed: 0, aim: 0, fire: 0, hit: 0, downed: true, waterDepth: 0 });
  assert.equal(deathPose.state, "downed");
  assert.equal(JSON.stringify({
    root: model.parts.root.rotation,
    torso: model.parts.torso.rotation,
    weapon: model.parts.weapon.rotation,
  }), deathSnapshot);
});
