import assert from "node:assert/strict";
import test from "node:test";

import {
  ENEMY_MODEL_IDS,
  MOBILE_ENEMY_BUDGET,
  createEnemyModel,
  getEnemyModelDefinition,
} from "../public/enemy-models.mjs";

function createFakeThree() {
  class Object3D {
    constructor() {
      this.children = [];
      this.name = "";
      this.position = { x: 0, y: 0, z: 0, set: (x = 0, y = 0, z = 0) => Object.assign(this.position, { x, y, z }) };
      this.rotation = { x: 0, y: 0, z: 0, set: (x = 0, y = 0, z = 0) => Object.assign(this.rotation, { x, y, z }) };
      this.scale = { x: 1, y: 1, z: 1, set: (x = 1, y = x, z = x) => Object.assign(this.scale, { x, y, z }) };
      this.userData = {};
    }
    add(...children) { this.children.push(...children); return this; }
  }
  class Group extends Object3D {}
  class Mesh extends Object3D {
    constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
  }
  class Geometry { constructor(type, args) { this.type = type; this.args = args; } }
  class Material { constructor(options) { this.options = options; } }
  return {
    Object3D,
    Group,
    Mesh,
    MeshStandardMaterial: Material,
    BoxGeometry: class extends Geometry { constructor(...args) { super("BoxGeometry", args); } },
    ConeGeometry: class extends Geometry { constructor(...args) { super("ConeGeometry", args); } },
    CylinderGeometry: class extends Geometry { constructor(...args) { super("CylinderGeometry", args); } },
    SphereGeometry: class extends Geometry { constructor(...args) { super("SphereGeometry", args); } },
  };
}

test("every enemy archetype has a dedicated 3D model contract and concept reference", () => {
  assert.deepEqual(ENEMY_MODEL_IDS, ["rusher", "shooter", "sniper", "shield", "heavy", "drone", "mutant", "boss"]);
  const THREE = createFakeThree();
  const signatures = new Set();
  for (const id of ENEMY_MODEL_IDS) {
    const definition = getEnemyModelDefinition(id);
    const model = createEnemyModel(THREE, id);
    assert.equal(model.root.name, `enemy:${id}`);
    assert.equal(model.metadata.id, id);
    const referenceId = id === "shield" ? "shield-brute" : id;
    assert.ok(definition.referenceImage.endsWith(`/${referenceId}-v1.webp`));
    assert.ok(model.parts.mutation);
    assert.ok(model.budget.triangles > 0);
    assert.ok(model.budget.triangles <= MOBILE_ENEMY_BUDGET.triangles);
    signatures.add(model.parts.mutation.children.map(child => child.name).join("|"));
  }
  assert.equal(signatures.size, ENEMY_MODEL_IDS.length);
});

test("unknown enemy ids fall back to the readable rusher model", () => {
  assert.equal(getEnemyModelDefinition("missing").id, "rusher");
});
