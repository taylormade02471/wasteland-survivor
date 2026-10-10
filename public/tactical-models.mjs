export const TACTICAL_MODEL_IDS = Object.freeze(["frag", "flash", "stim"]);
export const MOBILE_TACTICAL_BUDGET = Object.freeze({ triangles: 260, materials: 4, drawGroups: 8 });

const definitions = Object.freeze({
  frag: { id: "frag", displayName: "Fragmentation Grenade", silhouetteTag: "ribbed-impact-grenade", palette: { body: "#3d4a3f", accent: "#d2ab4d", glow: "#ff784c" } },
  flash: { id: "flash", displayName: "Flash Charge", silhouetteTag: "compact-flash-device", palette: { body: "#c2c6bd", accent: "#e7b84f", glow: "#fff2a1" } },
  stim: { id: "stim", displayName: "Stim Injector", silhouetteTag: "field-medical-injector", palette: { body: "#5c7673", accent: "#f0eee0", glow: "#72e7ca" } },
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function getTacticalModelDefinition(id) {
  return clone(definitions[TACTICAL_MODEL_IDS.includes(id) ? id : "frag"]);
}

function material(THREE, color, emissive = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .28, emissive: color, emissiveIntensity: emissive });
}

function mesh(THREE, name, geometry, materialValue, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, materialValue);
  object.name = name;
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function triangleCount(geometry) {
  if (geometry?.index?.count) return Math.ceil(geometry.index.count / 3);
  if (geometry?.attributes?.position?.count) return Math.ceil(geometry.attributes.position.count / 3);
  if (geometry?.type?.includes("Cylinder")) return 32;
  if (geometry?.type?.includes("Sphere")) return 96;
  if (geometry?.type?.includes("Box")) return 12;
  return 24;
}

export function createTacticalModel(THREE, id = "frag") {
  const definition = getTacticalModelDefinition(id);
  const root = new THREE.Group();
  root.name = `tactical:${definition.id}`;
  const body = material(THREE, definition.palette.body);
  const accent = material(THREE, definition.palette.accent);
  const glow = material(THREE, definition.palette.glow, .65);
  const parts = new THREE.Group();
  parts.name = `parts:${definition.id}`;
  if (definition.id === "stim") {
    parts.add(mesh(THREE, "body:injector", new THREE.CylinderGeometry(.11, .11, .58, 8), body));
    parts.add(mesh(THREE, "body:plunger", new THREE.CylinderGeometry(.065, .065, .18, 8), accent, [0, .37, 0]));
    parts.add(mesh(THREE, "body:fluid", new THREE.CylinderGeometry(.07, .07, .2, 8), glow, [0, .02, 0]));
  } else {
    parts.add(mesh(THREE, "body:canister", new THREE.CylinderGeometry(.16, .16, .42, 8), body, [0, 0, 0], [0, 0, Math.PI / 2]));
    parts.add(mesh(THREE, "body:cap", new THREE.CylinderGeometry(.19, .19, .08, 8), accent, [0, .24, 0]));
    parts.add(mesh(THREE, "body:pin", new THREE.TorusGeometry(.1, .018, 5, 8), accent, [.11, .2, 0], [Math.PI / 2, 0, 0]));
    parts.add(mesh(THREE, "body:core", new THREE.SphereGeometry(.075, 8, 6), glow, [0, 0, -.16]));
    if (definition.id === "flash") parts.add(mesh(THREE, "body:flash-band", new THREE.BoxGeometry(.34, .06, .34), glow, [0, 0, 0]));
  }
  root.add(parts);
  root.userData.tacticalId = definition.id;
  root.userData.assetContract = "Bundled procedural tactical mesh matched to the gameplay item definition.";
  const materials = new Set();
  let triangles = 0;
  parts.traverse?.((node) => { if (!node.geometry) return; triangles += triangleCount(node.geometry); materials.add(node.material); });
  return { root, parts, metadata: definition, budget: { meshes: parts.children.length, materials: materials.size, triangles }, declaredBudget: clone(MOBILE_TACTICAL_BUDGET) };
}
