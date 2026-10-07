import assert from "node:assert/strict";
import test from "node:test";

import {
  ENVIRONMENT_ANIMATION_STATES,
  ENVIRONMENT_MODEL_IDS,
  MOBILE_ENVIRONMENT_BUDGET,
  createEnvironmentModel,
  createUpgradeChestModel,
  getEnvironmentDefinition,
  sampleEnvironmentAnimation,
  seededVariant,
} from "../public/environment-models.mjs";

const REQUIRED_OBSTACLES = ["barricade", "ruined-wall", "vehicle-shell", "toxic-barrel-cluster", "ice-boulder", "lava-vent", "flooded-debris"];

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

function assertFiniteTree(value, path = "animation") {
  if (typeof value === "number") {
    assert.equal(Number.isFinite(value), true, `${path} is finite`);
    assert.ok(value >= -3 && value <= 3, `${path} is bounded`);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) assertFiniteTree(child, `${path}.${key}`);
}

test("exports seven modular obstacle definitions with colliders footprints and budgets", () => {
  assert.deepEqual(ENVIRONMENT_MODEL_IDS, REQUIRED_OBSTACLES);

  const biomes = new Set();
  for (const id of ENVIRONMENT_MODEL_IDS) {
    const definition = getEnvironmentDefinition(id);
    assert.equal(definition.id, id);
    assert.ok(definition.displayName.length > 0);
    assert.ok(definition.silhouetteTag.length > 0);
    assert.ok(["wasteland", "toxic", "ice", "lava", "flooded"].includes(definition.biome));
    assert.ok(definition.collider.kind);
    assert.ok(definition.collider.blocksPlayers);
    assert.ok(definition.footprint.width > 0);
    assert.ok(definition.footprint.depth > 0);
    assert.ok(definition.budget.triangles <= MOBILE_ENVIRONMENT_BUDGET.triangles);
    assert.ok(definition.budget.materials <= MOBILE_ENVIRONMENT_BUDGET.materials);
    biomes.add(definition.biome);
  }

  assert.ok(biomes.has("toxic"));
  assert.ok(biomes.has("ice"));
  assert.ok(biomes.has("lava"));
});

test("seeded variants are deterministic and mesh factories create distinct readable cover silhouettes", () => {
  const THREE = createFakeThree();
  const signatures = new Set();

  assert.deepEqual(seededVariant("room-a", "barricade"), seededVariant("room-a", "barricade"));
  assert.notDeepEqual(seededVariant("room-a", "barricade"), seededVariant("room-b", "barricade"));

  for (const id of ENVIRONMENT_MODEL_IDS) {
    const variant = seededVariant("test-seed", id);
    const model = createEnvironmentModel(THREE, id, { seed: "test-seed" });
    assert.equal(model.root.name, `environment:${id}`);
    assert.equal(model.metadata.id, id);
    assert.deepEqual(model.variant, variant);
    assert.ok(model.parts.root);
    assert.ok(model.parts.colliderMarker);
    assert.ok(model.collider.blocksPlayers);
    assert.ok(model.budget.triangles <= MOBILE_ENVIRONMENT_BUDGET.triangles);

    const meshes = [];
    const visit = (node) => {
      if (node.geometry) meshes.push(`${node.name}:${node.geometry.type}:${node.geometry.args.join(",")}`);
      for (const child of node.children || []) visit(child);
    };
    visit(model.root);
    assert.ok(meshes.length >= 3, `${id} has modular authored mesh pieces`);
    signatures.add(meshes.join("|"));
  }

  assert.equal(signatures.size, ENVIRONMENT_MODEL_IDS.length);
});

test("shared upgrade chest exposes lid glow and two-user interaction markers", () => {
  const THREE = createFakeThree();
  const chest = createUpgradeChestModel(THREE, { seed: "shared-room" });

  assert.equal(chest.root.name, "environment:upgrade-chest");
  assert.ok(chest.parts.lid);
  assert.ok(chest.parts.glow);
  assert.ok(chest.parts.playerOneMarker);
  assert.ok(chest.parts.playerTwoMarker);
  assert.equal(chest.interactionMarkers.length, 2);
  assert.notDeepEqual(chest.interactionMarkers[0], chest.interactionMarkers[1]);
  assert.ok(chest.collider.blocksPlayers);
  assert.ok(chest.budget.triangles <= MOBILE_ENVIRONMENT_BUDGET.triangles);
});

test("pure animation sampler covers biome motion beacon chest opening and hit reaction", () => {
  assert.deepEqual(ENVIRONMENT_ANIMATION_STATES, ["waterBob", "toxicPulse", "iceSparkle", "heatVent", "beacon", "chestOpen", "hitReaction"]);

  const inputs = [
    { state: "waterBob", time: 0.5 },
    { state: "toxicPulse", time: 0.5, intensity: 0.8 },
    { state: "iceSparkle", time: 0.5, intensity: 0.7 },
    { state: "heatVent", time: 0.5, intensity: 1 },
    { state: "beacon", time: 0.5, objective: 1 },
    { state: "chestOpen", time: 0.5, open: 1 },
    { state: "hitReaction", time: 0.5, hit: 1 },
  ];

  for (const input of inputs) {
    const first = sampleEnvironmentAnimation("toxic-barrel-cluster", input);
    const second = sampleEnvironmentAnimation("toxic-barrel-cluster", input);
    assert.deepEqual(first, second);
    assert.equal(first.state, input.state);
    assertFiniteTree(first);
  }
});
