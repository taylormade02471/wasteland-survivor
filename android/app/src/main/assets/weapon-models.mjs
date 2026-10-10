export const WEAPON_IDS = Object.freeze(["pulse-pistol", "compact-smg", "ranger-rifle", "riot-shotgun", "drum-lmg", "coil-carbine"]);
export const WEAPON_FAMILIES = Object.freeze(["sidearm", "ballistic", "energy"]);
export const WEAPON_ANIMATION_STATES = Object.freeze(["idle", "aim", "fire", "reload", "overheat", "lower", "raise", "swap"]);
export const MOBILE_WEAPON_BUDGET = Object.freeze({ triangles: 760, materials: 5, drawGroups: 14, particles: 18 });

const rawWeapons = {
  "pulse-pistol": {
    id: "pulse-pistol",
    displayName: "Pulse Pistol",
    family: "sidearm",
    classId: "tech",
    silhouetteTag: "short-glowing-sidearm",
    palette: { metal: "#384348", grip: "#242421", accent: "#6fe2bf", warning: "#f5be50", heat: "#e55342" },
    dimensions: { length: 0.52, receiver: 0.24, barrel: 0.2, stock: 0.08, width: 0.12, height: 0.22 },
    budget: { triangles: 360, materials: 4, drawGroups: 8, particles: 10 },
  },
  "compact-smg": {
    id: "compact-smg",
    displayName: "Compact SMG",
    family: "ballistic",
    classId: "scout",
    silhouetteTag: "stubby-folding-stock-smg",
    palette: { metal: "#454a47", grip: "#252a25", accent: "#d0a655", warning: "#e8b552", heat: "#cf4a38" },
    dimensions: { length: 0.72, receiver: 0.34, barrel: 0.28, stock: 0.18, width: 0.13, height: 0.26 },
    budget: { triangles: 470, materials: 4, drawGroups: 10, particles: 12 },
  },
  "ranger-rifle": {
    id: "ranger-rifle",
    displayName: "Ranger Rifle",
    family: "ballistic",
    classId: "ranger",
    silhouetteTag: "long-scoped-marksman-rifle",
    palette: { metal: "#56636a", grip: "#292825", accent: "#c68644", warning: "#efbd63", heat: "#d45b42" },
    dimensions: { length: 1.16, receiver: 0.42, barrel: 0.56, stock: 0.32, width: 0.12, height: 0.28 },
    budget: { triangles: 610, materials: 5, drawGroups: 12, particles: 10 },
  },
  "riot-shotgun": {
    id: "riot-shotgun",
    displayName: "Riot Shotgun",
    family: "ballistic",
    classId: "heavy",
    silhouetteTag: "wide-pump-guard-shotgun",
    palette: { metal: "#4b4c49", grip: "#302b25", accent: "#bdc5b6", warning: "#e0aa45", heat: "#c74635" },
    dimensions: { length: 0.86, receiver: 0.38, barrel: 0.36, stock: 0.28, width: 0.16, height: 0.3 },
    budget: { triangles: 560, materials: 5, drawGroups: 12, particles: 14 },
  },
  "drum-lmg": {
    id: "drum-lmg",
    displayName: "Drum LMG",
    family: "ballistic",
    classId: "heavy",
    silhouetteTag: "heavy-drum-fed-support-gun",
    palette: { metal: "#5b5a55", grip: "#2d2f2d", accent: "#d3743f", warning: "#efb654", heat: "#e15b3f" },
    dimensions: { length: 1.04, receiver: 0.46, barrel: 0.44, stock: 0.28, width: 0.2, height: 0.34 },
    budget: { triangles: 720, materials: 5, drawGroups: 14, particles: 16 },
  },
  "coil-carbine": {
    id: "coil-carbine",
    displayName: "Coil Carbine",
    family: "energy",
    classId: "tech",
    silhouetteTag: "vented-coil-tech-carbine",
    palette: { metal: "#365a5c", grip: "#202b2c", accent: "#69d6bb", warning: "#efc45b", heat: "#e85f4b" },
    dimensions: { length: 0.88, receiver: 0.36, barrel: 0.38, stock: 0.22, width: 0.13, height: 0.28 },
    budget: { triangles: 640, materials: 5, drawGroups: 13, particles: 18 },
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function weaponId(id) {
  return WEAPON_IDS.includes(id) ? id : "compact-smg";
}

export function getWeaponDefinition(id) {
  return clone(rawWeapons[weaponId(id)]);
}

function createMaterials(THREE, palette) {
  return {
    metal: new THREE.MeshStandardMaterial({ color: palette.metal, roughness: 0.64, metalness: 0.66 }),
    grip: new THREE.MeshStandardMaterial({ color: palette.grip, roughness: 0.86, metalness: 0.16 }),
    accent: new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.42, metalness: 0.42 }),
    warning: new THREE.MeshStandardMaterial({ color: palette.warning, roughness: 0.58, metalness: 0.28 }),
    heat: new THREE.MeshStandardMaterial({ color: palette.heat, roughness: 0.35, metalness: 0.22, emissive: palette.heat }),
  };
}

function part(THREE, name) {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

function socket(THREE, name, position = [0, 0, 0]) {
  const node = new THREE.Group();
  node.name = name;
  node.position.set(...position);
  node.userData.socket = name;
  return node;
}

function mesh(THREE, name, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.castShadow = true;
  object.receiveShadow = true;
  object.position.set(...position);
  object.scale.set(...scale);
  return object;
}

function cylinder(THREE, radius, length, segments = 8) {
  const object = new THREE.CylinderGeometry(radius, radius, length, segments);
  return object;
}

function createEffects(metadata) {
  const heatTint = metadata.family === "energy" ? "#7fffe0" : metadata.palette.warning;
  return {
    muzzleFlash: {
      poolKey: `weapon:muzzle:${metadata.id}`,
      shape: metadata.family === "energy" ? "ring-spark" : "cone-burst",
      color: heatTint,
      durationMs: metadata.family === "ballistic" ? 70 : 110,
      mobileBudget: { particles: metadata.budget.particles, lights: 1, sprites: 2 },
    },
    impact: {
      poolKey: `weapon:impact:${metadata.family}`,
      shape: metadata.family === "energy" ? "ion-splash" : "dust-chip",
      color: metadata.family === "energy" ? metadata.palette.accent : "#b9a278",
      durationMs: metadata.family === "ballistic" ? 180 : 220,
      mobileBudget: { particles: Math.min(MOBILE_WEAPON_BUDGET.particles, metadata.budget.particles + 2), decals: 1, sprites: 1 },
    },
  };
}

export function createWeaponModel(THREE, id = "compact-smg") {
  if (!THREE?.Group || !THREE?.Mesh) throw new TypeError("createWeaponModel requires a THREE-like namespace");
  const metadata = getWeaponDefinition(id);
  const d = metadata.dimensions;
  const materials = createMaterials(THREE, metadata.palette);
  const root = part(THREE, `weapon:${metadata.id}`);
  root.userData.weaponId = metadata.id;

  const receiver = part(THREE, `receiver:${metadata.id}`);
  const trigger = part(THREE, `trigger:${metadata.id}`);
  const bolt = part(THREE, `bolt:${metadata.id}`);
  const magazine = part(THREE, `magazine:${metadata.id}`);
  const muzzle = part(THREE, `muzzle:${metadata.id}`);
  const stock = part(THREE, `stock:${metadata.id}`);
  const barrel = part(THREE, `barrel:${metadata.id}`);
  const sight = part(THREE, `sight:${metadata.id}`);

  receiver.add(mesh(THREE, "receiver:core", new THREE.BoxGeometry(d.receiver, d.height * 0.55, d.width), materials.metal));
  receiver.add(mesh(THREE, "receiver:wet-edge", new THREE.BoxGeometry(d.receiver * 0.9, 0.028, d.width * 1.08), materials.accent, [0.02, d.height * 0.18, 0]));
  trigger.add(mesh(THREE, "trigger:guard", new THREE.BoxGeometry(0.08, 0.07, 0.035), materials.grip, [-d.receiver * 0.18, -d.height * 0.34, 0]));
  trigger.add(mesh(THREE, "trigger:finger", new THREE.BoxGeometry(0.022, 0.08, 0.024), materials.warning, [-d.receiver * 0.16, -d.height * 0.37, 0]));
  bolt.add(mesh(THREE, metadata.family === "energy" ? "bolt:charge-rail" : "bolt:slide", new THREE.BoxGeometry(d.receiver * 0.48, 0.04, d.width * 0.72), materials.warning, [0.02, d.height * 0.32, 0]));
  magazine.add(mesh(THREE, metadata.id === "drum-lmg" ? "magazine:drum" : "magazine:box", metadata.id === "drum-lmg" ? new THREE.CylinderGeometry(0.16, 0.16, 0.09, 12) : new THREE.BoxGeometry(0.12, d.height * 0.72, d.width * 0.72), materials.grip, [-d.receiver * 0.05, -d.height * 0.46, 0]));
  barrel.add(mesh(THREE, "barrel:tube", cylinder(THREE, d.width * 0.18, d.barrel, metadata.family === "energy" ? 10 : 8), materials.metal, [d.receiver * 0.5 + d.barrel * 0.5, 0.03, 0]));
  barrel.children.at(-1).rotation.z = Math.PI / 2;
  if (metadata.family === "energy") barrel.add(mesh(THREE, "barrel:coil", new THREE.BoxGeometry(d.barrel * 0.54, 0.05, d.width * 1.18), materials.accent, [d.receiver * 0.55 + d.barrel * 0.34, 0.1, 0]));
  muzzle.add(mesh(THREE, "muzzle:brake", cylinder(THREE, d.width * 0.24, 0.08, 8), materials.heat, [d.receiver * 0.5 + d.barrel + 0.04, 0.03, 0]));
  muzzle.children.at(-1).rotation.z = Math.PI / 2;
  stock.add(mesh(THREE, metadata.id === "pulse-pistol" ? "stock:end-cap" : "stock:butt", new THREE.BoxGeometry(d.stock, d.height * 0.52, d.width * 0.92), materials.grip, [-d.receiver * 0.5 - d.stock * 0.5, -0.01, 0]));
  sight.add(mesh(THREE, metadata.id === "ranger-rifle" ? "sight:scope" : "sight:iron", metadata.id === "ranger-rifle" ? new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8) : new THREE.BoxGeometry(0.16, 0.045, 0.055), materials.accent, [0.08, d.height * 0.42, 0]));
  if (metadata.id === "ranger-rifle") sight.children.at(-1).rotation.z = Math.PI / 2;

  const detailRail = mesh(THREE, "receiver:picatinny-rail", new THREE.BoxGeometry(d.receiver * .72, .035, d.width * .74), materials.dark, [d.receiver * .08, d.height * .34, 0]);
  const detailPin = mesh(THREE, "receiver:service-pin", new THREE.SphereGeometry(.022, 6, 4), materials.warning, [-d.receiver * .28, d.height * .08, -d.width * .52]);
  receiver.add(detailRail, detailPin);

  root.add(receiver, trigger, bolt, magazine, barrel, muzzle, stock, sight);
  const muzzleSocket = socket(THREE, "socket:muzzle", [d.receiver * .5 + d.barrel + .08, .03, 0]);
  const handSocket = socket(THREE, "socket:forward-hand", [d.receiver * .5 + d.barrel * .42, -.08, 0]);
  root.add(muzzleSocket, handSocket);
  root.userData.renderPipeline = "threejs-pbr-runtime-v2";
  root.userData.sockets = { muzzle: "socket:muzzle", forwardHand: "socket:forward-hand" };
  root.userData.collisionBounds = { kind: "box", length: d.length, width: d.width, height: d.height };
  return {
    root,
    parts: { root, receiver, trigger, bolt, magazine, muzzle, stock, barrel, sight },
    metadata,
    materials,
    budget: clone(metadata.budget),
    effects: createEffects(metadata),
    sockets: { muzzle: muzzleSocket, forwardHand: handSocket },
    collisionBounds: clone(root.userData.collisionBounds),
  };
}

function posePart(x = 0, y = 0, z = 0, px = 0, py = 0, pz = 0) {
  return { rotation: { x, y, z }, position: { x: px, y: py, z: pz } };
}

export function sampleWeaponPose(id = "compact-smg", input = {}) {
  const metadata = rawWeapons[weaponId(id)];
  const time = clamp(input.time, 0, 100000);
  const aim = clamp(input.aim, 0, 1);
  const fire = clamp(input.fire, 0, 1);
  const reload = clamp(input.reload, 0, 1);
  const heat = clamp(input.heat, 0, 1);
  const lower = clamp(input.lower, 0, 1);
  const raise = clamp(input.raise, 0, 1);
  const swap = clamp(input.swap, 0, 1);
  const state = WEAPON_ANIMATION_STATES.includes(input.state) ? input.state : reload > 0 ? "reload" : fire > 0 ? "fire" : heat > 0.75 ? "overheat" : lower > 0 ? "lower" : raise > 0 ? "raise" : swap > 0 ? "swap" : aim > 0.6 ? "aim" : "idle";
  const sway = Math.sin(time * 2.2 + metadata.dimensions.length) * 0.035;
  const bob = Math.cos(time * 1.7) * 0.018;
  const recoil = fire * (metadata.family === "energy" ? 0.16 : 0.28);
  const reloadDrop = state === "reload" ? Math.sin(reload * Math.PI) : 0;
  const vent = state === "overheat" ? heat : 0;
  const lowerAngle = state === "lower" ? lower * 0.72 : state === "raise" ? (1 - raise) * 0.72 : 0;
  const swapAngle = state === "swap" ? Math.sin(swap * Math.PI) * 0.52 : 0;

  return {
    state,
    root: posePart(lowerAngle, swapAngle * 0.2, sway - aim * 0.04, -recoil * 0.08, bob - lowerAngle * 0.04, swapAngle * 0.06),
    trigger: posePart(-fire * 0.34, 0, 0),
    bolt: posePart(0, 0, 0, -recoil * 0.42 - reloadDrop * 0.08, vent * 0.06, 0),
    magazine: posePart(reloadDrop * 0.24, 0, reloadDrop * 0.62, 0, -reloadDrop * 0.18, 0),
    muzzle: posePart(-recoil * 0.18, vent * 0.08, 0, recoil * 0.03, vent * 0.04, 0),
    stock: posePart(0, sway * 0.3, -aim * 0.05 + recoil * 0.14),
    barrel: posePart(-recoil * 0.08, vent * 0.04, 0),
    heat: { glow: heat, vent: vent * (0.55 + Math.sin(time * 9) * 0.2) },
  };
}

function applyPosePart(partObject, pose) {
  if (!partObject || !pose) return;
  if (pose.rotation) partObject.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
  if (pose.position) partObject.position.set(pose.position.x, pose.position.y, pose.position.z);
}

export function applyWeaponPose(model, pose) {
  if (!model?.parts || !pose) return pose;
  for (const name of ["root", "trigger", "bolt", "magazine", "muzzle", "stock", "barrel"]) applyPosePart(model.parts[name], pose[name]);
  if (model.parts.muzzle?.userData && pose.heat) model.parts.muzzle.userData.heat = pose.heat.glow;
  return pose;
}

export function createWeaponPoseController(model) {
  if (!model?.metadata?.id) throw new TypeError("createWeaponPoseController requires a weapon model");
  let time = 0;
  return {
    update(deltaSeconds = 0, input = {}) {
      time += clamp(deltaSeconds, 0, 0.25);
      return applyWeaponPose(model, sampleWeaponPose(model.metadata.id, { ...input, time }));
    },
    reset() {
      time = 0;
    },
  };
}
