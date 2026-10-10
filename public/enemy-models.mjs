import { createCharacterModel, measureCharacterModelBudget } from "./character-models.mjs";

export const ENEMY_MODEL_IDS = Object.freeze(["rusher", "shooter", "sniper", "shield", "heavy", "drone", "mutant", "boss"]);
export const MOBILE_ENEMY_BUDGET = Object.freeze({ triangles: 1900, materials: 8, drawGroups: 34 });

const rawDefinitions = Object.freeze({
  rusher: { id: "rusher", displayName: "Rad Rusher", baseArchetype: "scout", silhouetteTag: "horned-radioactive-runner", referenceImage: "./assets/nightfall/enemies/index/rusher-v1.webp", palette: { primary: "#7c3d32", accent: "#ff6a3d", glow: "#b8ff54", dark: "#1c2620" }, scale: .96 },
  shooter: { id: "shooter", displayName: "Fallout Shooter", baseArchetype: "ranger", silhouetteTag: "spore-coated-rifle-hunter", referenceImage: "./assets/nightfall/enemies/index/shooter-v1.webp", palette: { primary: "#5c5142", accent: "#d6ad54", glow: "#9cff58", dark: "#20251f" }, scale: 1 },
  sniper: { id: "sniper", displayName: "Waste Sniper", baseArchetype: "ranger", silhouetteTag: "long-limbed-radioactive-observer", referenceImage: "./assets/nightfall/enemies/index/sniper-v1.webp", palette: { primary: "#4b3c66", accent: "#b97aff", glow: "#e1c4ff", dark: "#1d1828" }, scale: 1.05 },
  shield: { id: "shield", displayName: "Crystal Shield Brute", baseArchetype: "heavy", silhouetteTag: "crystal-plated-route-blocker", referenceImage: "./assets/nightfall/enemies/index/shield-brute-v1.webp", palette: { primary: "#285a70", accent: "#4dbbff", glow: "#b3f0ff", dark: "#14262c" }, scale: 1.08 },
  heavy: { id: "heavy", displayName: "Irradiated Heavy", baseArchetype: "heavy", silhouetteTag: "overgrown-armored-gun-carrier", referenceImage: "./assets/nightfall/enemies/index/heavy-v1.webp", palette: { primary: "#673733", accent: "#ff694f", glow: "#ffbd62", dark: "#261c1d" }, scale: 1.15 },
  drone: { id: "drone", displayName: "Contaminated Drone", baseArchetype: "tech", silhouetteTag: "floating-toxic-surveillance-unit", referenceImage: "./assets/nightfall/enemies/index/drone-v1.webp", palette: { primary: "#1d5f61", accent: "#66fcf1", glow: "#c9fff4", dark: "#102527" }, scale: .78 },
  mutant: { id: "mutant", displayName: "Toxic Mutant", baseArchetype: "heavy", silhouetteTag: "spined-radioactive-bruiser", referenceImage: "./assets/nightfall/enemies/index/mutant-v1.webp", palette: { primary: "#4f702e", accent: "#8cff4d", glow: "#d6ff93", dark: "#1d291c" }, scale: 1.12 },
  boss: { id: "boss", displayName: "The Left-Behind", baseArchetype: "warden", silhouetteTag: "crowned-apocalypse-overseer", referenceImage: "./assets/nightfall/enemies/index/boss-v1.webp", palette: { primary: "#705327", accent: "#ffcf40", glow: "#fff0a8", dark: "#2b2115" }, scale: 1.34 },
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function getEnemyModelDefinition(id) {
  return clone(rawDefinitions[ENEMY_MODEL_IDS.includes(id) ? id : "rusher"]);
}

function material(THREE, color, emissive = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .3, emissive: color, emissiveIntensity: emissive });
}

function part(THREE, name) {
  const group = new THREE.Group();
  group.name = name;
  return group;
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

function addMutationParts(THREE, mutation, definition) {
  const colors = definition.palette;
  const shell = material(THREE, colors.primary, .05);
  const accent = material(THREE, colors.accent, .08);
  const glow = material(THREE, colors.glow, .7);
  const dark = material(THREE, colors.dark, 0);
  const cone = (name, position, radius = .11, height = .34, rotation = [0, 0, 0]) => mutation.add(mesh(THREE, name, new THREE.ConeGeometry(radius, height, 6), accent, position, rotation));

  if (definition.id === "rusher") {
    cone("mutation:horn-left", [-.16, 1.98, -.02], .09, .3, [0, 0, -.42]);
    cone("mutation:horn-right", [.16, 1.98, -.02], .09, .3, [0, 0, .42]);
    mutation.add(mesh(THREE, "mutation:chest-core", new THREE.SphereGeometry(.13, 8, 6), glow, [0, 1.25, -.28]));
  } else if (definition.id === "shooter") {
    mutation.add(mesh(THREE, "mutation:spore-pack-left", new THREE.SphereGeometry(.16, 8, 6), shell, [-.42, 1.5, .2]));
    mutation.add(mesh(THREE, "mutation:spore-pack-right", new THREE.SphereGeometry(.12, 8, 6), shell, [.42, 1.55, .2]));
    mutation.add(mesh(THREE, "mutation:visor-slit", new THREE.BoxGeometry(.25, .035, .045), glow, [0, 1.8, -.2]));
  } else if (definition.id === "sniper") {
    cone("mutation:crest", [0, 2.1, .02], .12, .58, [0, 0, 0]);
    mutation.add(mesh(THREE, "mutation:long-lens", new THREE.CylinderGeometry(.055, .055, .42, 8), glow, [.16, 1.56, -.3], [Math.PI / 2, 0, 0]));
    mutation.add(mesh(THREE, "mutation:back-cloak", new THREE.BoxGeometry(.48, .84, .08), dark, [0, 1.08, .25]));
  } else if (definition.id === "shield") {
    mutation.add(mesh(THREE, "mutation:crystal-shield", new THREE.ConeGeometry(.48, .18, 6), glow, [-.68, 1.08, -.22], [Math.PI / 2, 0, 0], [1, 1, 1.6]));
    cone("mutation:shoulder-crystal", [-.52, 1.62, 0], .16, .5, [0, 0, -.35]);
    mutation.add(mesh(THREE, "mutation:shield-core", new THREE.BoxGeometry(.1, .62, .05), accent, [-.68, 1.08, -.34]));
  } else if (definition.id === "heavy") {
    mutation.add(mesh(THREE, "mutation:chest-plate", new THREE.BoxGeometry(.72, .42, .16), shell, [0, 1.28, -.26]));
    mutation.add(mesh(THREE, "mutation:reactor", new THREE.CylinderGeometry(.13, .13, .08, 10), glow, [0, 1.27, -.36], [Math.PI / 2, 0, 0]));
    mutation.add(mesh(THREE, "mutation:ammo-pod", new THREE.BoxGeometry(.22, .5, .18), accent, [.48, 1.12, .02]));
  } else if (definition.id === "drone") {
    mutation.add(mesh(THREE, "mutation:drone-core", new THREE.SphereGeometry(.38, 10, 8), shell, [0, 1.28, 0], [0, 0, 0], [1, .72, 1]));
    mutation.add(mesh(THREE, "mutation:drone-eye", new THREE.SphereGeometry(.1, 8, 6), glow, [0, 1.28, -.34]));
    mutation.add(mesh(THREE, "mutation:drone-wing-left", new THREE.BoxGeometry(.68, .06, .12), accent, [-.48, 1.3, 0], [0, 0, -.12]));
    mutation.add(mesh(THREE, "mutation:drone-wing-right", new THREE.BoxGeometry(.68, .06, .12), accent, [.48, 1.3, 0], [0, 0, .12]));
  } else if (definition.id === "mutant") {
    cone("mutation:spike-left", [-.48, 1.55, .12], .14, .48, [0, 0, -.8]);
    cone("mutation:spike-right", [.48, 1.62, .12], .14, .48, [0, 0, .8]);
    cone("mutation:spike-back", [0, 1.72, .3], .16, .58, [Math.PI / 2, 0, 0]);
    mutation.add(mesh(THREE, "mutation:toxic-sack", new THREE.SphereGeometry(.18, 8, 6), glow, [0, 1.05, .24]));
  } else if (definition.id === "boss") {
    cone("mutation:crown-left", [-.22, 2.08, 0], .12, .58, [0, 0, -.35]);
    cone("mutation:crown-center", [0, 2.18, 0], .14, .72);
    cone("mutation:crown-right", [.22, 2.08, 0], .12, .58, [0, 0, .35]);
    mutation.add(mesh(THREE, "mutation:boss-core", new THREE.SphereGeometry(.21, 10, 8), glow, [0, 1.26, -.3]));
    mutation.add(mesh(THREE, "mutation:boss-collar", new THREE.CylinderGeometry(.35, .35, .12, 8), accent, [0, 1.6, .04]));
  }
}

export function createEnemyModel(THREE, id = "rusher") {
  const definition = getEnemyModelDefinition(id);
  const base = createCharacterModel(THREE, definition.baseArchetype);
  const root = part(THREE, `enemy:${definition.id}`);
  const mutation = part(THREE, `mutation:${definition.id}`);
  addMutationParts(THREE, mutation, definition);
  root.add(base.root, mutation);
  root.scale.setScalar?.(definition.scale);
  if (root.scale?.set && !root.scale.setScalar) root.scale.set(definition.scale, definition.scale, definition.scale);
  root.userData.enemyType = definition.id;
  root.userData.sourceReference = definition.referenceImage;
  const muzzleSocket = new THREE.Group();
  muzzleSocket.name = "socket:enemy-muzzle";
  muzzleSocket.position.set(.34, 1.18, -.46);
  const hitSocket = new THREE.Group();
  hitSocket.name = "socket:enemy-hit-center";
  hitSocket.position.set(0, 1.1, 0);
  root.add(muzzleSocket, hitSocket);
  root.userData.renderPipeline = "threejs-pbr-runtime-v2";
  root.userData.sockets = { muzzle: "socket:enemy-muzzle", hitCenter: "socket:enemy-hit-center" };
  root.userData.collisionBounds = { kind: "capsule", radius: .48 * definition.scale, height: 1.9 * definition.scale };
  root.userData.assetContract = "Three.js PBR mutated enemy mesh with authored-ready sockets, collision bounds, and concept-art palette.";
  const budget = measureCharacterModelBudget(root);
  return {
    root,
    parts: { ...base.parts, root, mutation },
    metadata: { ...definition, baseArchetype: definition.baseArchetype },
    materials: base.materials,
    controllerModel: { ...base, root: base.root },
    budget,
    declaredBudget: clone(MOBILE_ENEMY_BUDGET),
    sockets: { muzzle: muzzleSocket, hitCenter: hitSocket },
    collisionBounds: clone(root.userData.collisionBounds),
  };
}
