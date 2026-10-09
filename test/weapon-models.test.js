import assert from "node:assert/strict";
import test from "node:test";

import {
  MOBILE_WEAPON_BUDGET,
  WEAPON_ANIMATION_STATES,
  WEAPON_FAMILIES,
  WEAPON_IDS,
  createWeaponModel,
  createWeaponPoseController,
  getWeaponDefinition,
  sampleWeaponPose,
} from "../public/weapon-models.mjs";

const REQUIRED_PARTS = ["root", "trigger", "bolt", "magazine", "muzzle", "stock", "barrel"];

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

test("exports six class-readable weapons across three weapon families with mobile budgets", () => {
  assert.deepEqual(WEAPON_IDS, ["pulse-pistol", "compact-smg", "ranger-rifle", "riot-shotgun", "drum-lmg", "coil-carbine"]);
  assert.deepEqual(WEAPON_FAMILIES, ["sidearm", "ballistic", "energy"]);

  const silhouettes = new Set();
  const families = new Set();
  for (const id of WEAPON_IDS) {
    const weapon = getWeaponDefinition(id);
    assert.equal(weapon.id, id);
    assert.ok(WEAPON_FAMILIES.includes(weapon.family));
    assert.match(weapon.classId, /^(scout|ranger|heavy|tech)$/);
    assert.ok(weapon.silhouetteTag.length > 0);
    assert.ok(weapon.palette.metal);
    assert.ok(weapon.budget.triangles <= MOBILE_WEAPON_BUDGET.triangles);
    assert.ok(weapon.budget.materials <= MOBILE_WEAPON_BUDGET.materials);
    silhouettes.add(weapon.silhouetteTag);
    families.add(weapon.family);
  }

  assert.equal(silhouettes.size, WEAPON_IDS.length);
  assert.deepEqual([...families].sort(), [...WEAPON_FAMILIES].sort());
  assert.equal(getWeaponDefinition("unknown").id, "compact-smg");
});

test("mesh factory builds named moving parts and distinct procedural geometry per weapon", () => {
  const THREE = createFakeThree();
  const signatures = new Set();

  for (const id of WEAPON_IDS) {
    const model = createWeaponModel(THREE, id);
    assert.equal(model.root.name, `weapon:${id}`);
    assert.equal(model.metadata.id, id);
    assert.ok(model.budget.triangles <= MOBILE_WEAPON_BUDGET.triangles);
    assert.ok(model.budget.materials <= MOBILE_WEAPON_BUDGET.materials);

    for (const part of REQUIRED_PARTS) {
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
    assert.ok(meshTypes.length >= 7, `${id} has authored receiver, barrel, sight, and kit meshes`);
    signatures.add(meshTypes.join("|"));
  }

  assert.equal(signatures.size, WEAPON_IDS.length);
});

test("pose sampler exposes deterministic combat states with bounded part transforms", () => {
  assert.deepEqual(WEAPON_ANIMATION_STATES, ["idle", "aim", "fire", "reload", "overheat", "lower", "raise", "swap"]);

  const inputs = [
    { state: "idle", time: 0.3 },
    { state: "aim", time: 1.2, aim: 1 },
    { state: "fire", time: 1.2, fire: 1, heat: 0.4 },
    { state: "reload", time: 1.2, reload: 0.75 },
    { state: "overheat", time: 1.2, heat: 1 },
    { state: "lower", time: 1.2, lower: 1 },
    { state: "raise", time: 1.2, raise: 1 },
    { state: "swap", time: 1.2, swap: 0.5 },
  ];

  for (const id of WEAPON_IDS) {
    for (const input of inputs) {
      const first = sampleWeaponPose(id, input);
      const second = sampleWeaponPose(id, input);
      assert.deepEqual(first, second);
      assert.equal(first.state, input.state);
      assertFiniteTree(first);
    }
  }
});

test("weapon descriptors are poolable and controller applies recoil and reload to moving parts", () => {
  const THREE = createFakeThree();
  const model = createWeaponModel(THREE, "drum-lmg");
  const controller = createWeaponPoseController(model);
  const effects = model.effects;

  assert.deepEqual(Object.keys(effects).sort(), ["impact", "muzzleFlash"].sort());
  assert.ok(effects.muzzleFlash.poolKey.includes("muzzle"));
  assert.ok(effects.impact.poolKey.includes("impact"));
  assert.ok(effects.muzzleFlash.mobileBudget.particles <= MOBILE_WEAPON_BUDGET.particles);
  assert.ok(effects.impact.mobileBudget.particles <= MOBILE_WEAPON_BUDGET.particles);

  const aim = controller.update(0.1, { aim: 1 });
  const fire = controller.update(0.1, { aim: 1, fire: 1 });
  const reload = controller.update(0.1, { reload: 0.8 });
  assert.equal(aim.state, "aim");
  assert.equal(fire.state, "fire");
  assert.equal(reload.state, "reload");
  assert.notEqual(model.parts.bolt.position.x, 0);
  assert.notEqual(model.parts.magazine.rotation.z, 0);
});
