import assert from "node:assert/strict";
import test from "node:test";
import { TACTICAL_MODEL_IDS, MOBILE_TACTICAL_BUDGET, createTacticalModel, getTacticalModelDefinition } from "../public/tactical-models.mjs";

function fakeThree() {
  class O { constructor() { this.children = []; this.name = ""; this.position = { set() {} }; this.rotation = { set() {} }; this.scale = { set() {} }; this.userData = {}; } add(...items) { this.children.push(...items); } traverse(fn) { fn(this); this.children.forEach((child) => child.traverse?.(fn)); } }
  class G extends O { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }
  class Geo { constructor(type) { this.type = type; } }
  class Mat { constructor(options) { this.options = options; } }
  return { Group: O, Mesh: G, MeshStandardMaterial: Mat, CylinderGeometry: class extends Geo { constructor() { super("CylinderGeometry"); } }, SphereGeometry: class extends Geo { constructor() { super("SphereGeometry"); } }, BoxGeometry: class extends Geo { constructor() { super("BoxGeometry"); } }, TorusGeometry: class extends Geo { constructor() { super("TorusGeometry"); } } };
}

test("tactical inventory has distinct inspectable 3D meshes", () => {
  const THREE = fakeThree();
  const signatures = new Set();
  for (const id of TACTICAL_MODEL_IDS) {
    const model = createTacticalModel(THREE, id);
    assert.equal(model.root.name, `tactical:${id}`);
    assert.equal(model.metadata.id, id);
    assert.ok(model.budget.triangles > 0 && model.budget.triangles <= MOBILE_TACTICAL_BUDGET.triangles);
    signatures.add(model.parts.children.map((child) => child.name).join("|"));
    assert.equal(getTacticalModelDefinition(id).id, id);
  }
  assert.equal(signatures.size, TACTICAL_MODEL_IDS.length);
});
