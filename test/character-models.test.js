import assert from "node:assert/strict";
import test from "node:test";

import {
  ANIMATION_STATES,
  CHARACTER_ARCHETYPE_IDS,
  MOBILE_CHARACTER_BUDGET,
  createCharacterModel,
  createPoseController,
  getCharacterArchetype,
  measureCharacterModelBudget,
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
  "muzzle",
  "leftHandAnchor",
  "rightHandAnchor",
  "weaponAnchor",
];

function createFakeThree() {
  class Transform {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x = 0, y = x, z = x) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    copy(source) {
      this.x = source.x;
      this.y = source.y;
      this.z = source.z;
      return this;
    }
  }
  class Object3D {
    constructor() {
      this.children = [];
      this.parent = null;
      this.name = "";
      this.position = new Transform();
      this.rotation = new Transform();
      this.scale = new Transform(1, 1, 1);
      this.userData = {};
      this.castShadow = false;
      this.receiveShadow = false;
    }
    add(...children) {
      for (const child of children) child.parent = this;
      this.children.push(...children);
      return this;
    }
    traverse(visitor) {
      visitor(this);
      for (const child of this.children) child.traverse(visitor);
    }
    getObjectByName(name) {
      let found = null;
      this.traverse((node) => {
        if (!found && node.name === name) found = node;
      });
      return found;
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
    constructor(type, args, triangles) {
      this.type = type;
      this.args = args;
      this.index = { count: triangles * 3 };
      this.attributes = { position: { count: triangles * 3 } };
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
    Object3D,
    BoxGeometry: class BoxGeometry extends Geometry { constructor(...args) { super("BoxGeometry", args, 12); } },
    CapsuleGeometry: class CapsuleGeometry extends Geometry { constructor(...args) { super("CapsuleGeometry", args, Math.max(24, (args[3] || 6) * 12)); } },
    ConeGeometry: class ConeGeometry extends Geometry { constructor(...args) { super("ConeGeometry", args, Math.max(12, (args[2] || 8) * 2)); } },
    CylinderGeometry: class CylinderGeometry extends Geometry { constructor(...args) { super("CylinderGeometry", args, Math.max(12, (args[3] || 8) * 4)); } },
    SphereGeometry: class SphereGeometry extends Geometry { constructor(...args) { super("SphereGeometry", args, Math.max(24, (args[1] || 8) * (args[2] || 6) * 2)); } },
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
    const imageId = id === "tech" ? "tech-runner" : id === "medic" ? "field-medic" : id;
    assert.match(archetype.referenceImage, new RegExp("/index/" + imageId + "-v1\\.webp$"));
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
    assert.deepEqual(model.measuredBudget, measureCharacterModelBudget(model.root));
    assert.deepEqual(model.budget, model.measuredBudget);
    assert.deepEqual(model.declaredBudget, model.metadata.mobileBudget);
    assert.ok(model.declaredBudget.triangles >= model.measuredBudget.triangles);
    assert.ok(model.declaredBudget.drawGroups >= model.measuredBudget.meshes);
    assert.ok(model.declaredBudget.materials >= model.measuredBudget.materials);
    assert.ok(model.measuredBudget.meshes <= MOBILE_CHARACTER_BUDGET.drawGroups);
    assert.ok(model.measuredBudget.materials <= MOBILE_CHARACTER_BUDGET.materials);
    assert.ok(model.measuredBudget.triangles <= MOBILE_CHARACTER_BUDGET.triangles);
    assert.ok(model.declaredBudget.triangles <= MOBILE_CHARACTER_BUDGET.triangles);
    assert.ok(model.declaredBudget.drawGroups <= MOBILE_CHARACTER_BUDGET.drawGroups);
    assert.ok(model.declaredBudget.materials <= MOBILE_CHARACTER_BUDGET.materials);

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

test("class-defining equipment is materially modeled as named visible geometry", () => {
  const THREE = createFakeThree();
  const expectedMeshes = {
    scout: ["head:hood", "head:hood-cowl", "torso:torn-teal-cloak-left", "shoulderMount:radio-whip"],
    ranger: ["head:ranger-brim", "torso:rust-scarf", "torso:coat-tail", "backMount:scope-pack", "backMount:rifle-sling"],
    heavy: ["head:sealed-faceplate", "torso:belly-armor", "shield:breach-slab", "shoulderMount:left", "shoulderMount:right", "weapon:drum"],
    tech: ["backMount:antenna", "backMount:tool-frame", "backMount:glow-cell-left", "hipMount:blue-tool-case"],
    medic: ["torso:white-field-jacket", "torso:red-harness", "backMount:med-cross", "hipMount:triage-pouch"],
    warden: ["torso:high-collar", "torso:long-warden-cloak-left", "torso:long-warden-cloak-right", "shield:tower"],
  };

  for (const [id, names] of Object.entries(expectedMeshes)) {
    const model = createCharacterModel(THREE, id);
    for (const name of names) assert.ok(model.root.getObjectByName(name), `${id} includes ${name}`);
  }

  const warden = createCharacterModel(THREE, "warden");
  assert.ok(warden.parts.shield, "warden exposes shield anchor/part");
  assert.equal(warden.parts.shield.parent, warden.parts.leftArm);
});

test("models carry source-reference and asset-contract handoff data without claiming imported meshes", () => {
  const THREE = createFakeThree();

  for (const id of CHARACTER_ARCHETYPE_IDS) {
    const model = createCharacterModel(THREE, id);
    assert.match(model.metadata.sourceReference.image, new RegExp(`${id === "tech" ? "tech-runner" : id === "medic" ? "field-medic" : id}-v1\\.webp$`));
    assert.equal(model.root.userData.sourceReference, model.metadata.sourceReference.image);
    assert.equal(model.root.userData.assetContract.kind, "procedural-three-runtime");
    assert.equal(model.root.userData.assetContract.importedRig, false);
    assert.match(model.root.userData.assetContract.remainingBlocker, /mesh-generation/i);
    assert.ok(model.metadata.visualTargets.length >= 4, `${id} documents source-driven visual targets`);
  }
});

test("factory rejects incomplete THREE namespaces before building partial models", () => {
  const THREE = createFakeThree();
  assert.throws(() => createCharacterModel({}, "scout"), /THREE namespace.*Group.*Mesh.*BoxGeometry/i);
  assert.throws(
    () => createCharacterModel({ ...THREE, ConeGeometry: undefined, Mesh: class Mesh { constructor() { throw new Error("partial construction started"); } } }, "scout"),
    /ConeGeometry/i,
  );
  assert.throws(() => createCharacterModel({ ...THREE, CylinderGeometry: undefined }, "ranger"), /CylinderGeometry/i);
  assert.throws(() => createCharacterModel({ ...THREE, MeshStandardMaterial: undefined }, "heavy"), /MeshStandardMaterial/i);
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

test("pose controller latches terminal downed state until deliberate reset", () => {
  const THREE = createFakeThree();
  const model = createCharacterModel(THREE, "warden");
  const controller = createPoseController(model);

  const downed = controller.update(0.1, { downed: true, speed: 1, aim: 1, fire: 1, hit: 1 });
  const latchedSnapshot = JSON.stringify({
    pose: downed,
    root: model.parts.root.rotation,
    torso: model.parts.torso.rotation,
    weapon: model.parts.weapon.rotation,
  });

  const missingFlag = controller.update(0.25, {});
  const falseFlag = controller.update(0.25, { downed: false, speed: 1, aim: 1, fire: 1, hit: 1 });
  assert.equal(missingFlag.state, "downed");
  assert.equal(falseFlag.state, "downed");
  assert.equal(JSON.stringify({
    pose: falseFlag,
    root: model.parts.root.rotation,
    torso: model.parts.torso.rotation,
    weapon: model.parts.weapon.rotation,
  }), latchedSnapshot);

  controller.resetTerminalState();
  const revived = controller.update(0.1, { downed: false, speed: 0, aim: 0, fire: 0, hit: 0 });
  assert.equal(revived.state, "idle");
});
