export const CHARACTER_ARCHETYPE_IDS = Object.freeze(["scout", "ranger", "heavy", "tech", "medic", "warden"]);
export const ANIMATION_STATES = Object.freeze(["idle", "walk", "run", "aim", "fire", "hit", "downed", "wade"]);
export const MOBILE_CHARACTER_BUDGET = Object.freeze({ triangles: 1400, materials: 6, drawGroups: 28 });

const rawArchetypes = {
  scout: {
    id: "scout",
    displayName: "Dust Scout",
    classId: "scout",
    silhouetteTag: "light-hooded-runner",
    proportions: { height: 1.74, shoulder: 0.78, torso: 0.88, limb: 1.08, bulk: 0.82 },
    palette: { primary: "#5f6f55", secondary: "#202922", accent: "#d8b55a", cloth: "#3d342a", visor: "#8ed4cf" },
    mounts: { shoulder: "left-radio-whip", back: "rolled-bedroll", hip: "small-satchel" },
    weapon: { kind: "compact-smg", grip: "two-hand", length: 0.72 },
    mobileBudget: { triangles: 980, materials: 5, drawGroups: 22 },
  },
  ranger: {
    id: "ranger",
    displayName: "Ranger",
    classId: "ranger",
    silhouetteTag: "long-coat-marksman",
    proportions: { height: 1.82, shoulder: 0.86, torso: 0.96, limb: 1, bulk: 0.92 },
    palette: { primary: "#596874", secondary: "#1c252b", accent: "#c78d45", cloth: "#302824", visor: "#b7dbe8" },
    mounts: { shoulder: "scope-pack", back: "long-rifle-sling", hip: "ammo-belt" },
    weapon: { kind: "marksman-rifle", grip: "shouldered", length: 1.06 },
    mobileBudget: { triangles: 1160, materials: 5, drawGroups: 24 },
  },
  heavy: {
    id: "heavy",
    displayName: "Heavy",
    classId: "heavy",
    silhouetteTag: "wide-armored-bruiser",
    proportions: { height: 1.88, shoulder: 1.14, torso: 1.08, limb: 0.9, bulk: 1.24 },
    palette: { primary: "#65615b", secondary: "#252729", accent: "#d36f3d", cloth: "#38332d", visor: "#f1cf7b" },
    mounts: { shoulder: "double-pauldron", back: "shield-tank", hip: "box-magazines" },
    weapon: { kind: "drum-lmg", grip: "braced", length: 1.02 },
    mobileBudget: { triangles: 1280, materials: 6, drawGroups: 22 },
  },
  tech: {
    id: "tech",
    displayName: "Tech Runner",
    classId: "tech",
    silhouetteTag: "antenna-salvage-tech",
    proportions: { height: 1.78, shoulder: 0.82, torso: 0.92, limb: 1.02, bulk: 0.9 },
    palette: { primary: "#3f686a", secondary: "#172426", accent: "#69d6bb", cloth: "#2d3435", visor: "#e2fff3" },
    mounts: { shoulder: "sensor-fin", back: "tool-frame", hip: "repair-pods" },
    weapon: { kind: "coil-carbine", grip: "two-hand", length: 0.84 },
    mobileBudget: { triangles: 1160, materials: 6, drawGroups: 23 },
  },
  medic: {
    id: "medic",
    displayName: "Field Medic",
    classId: "tech",
    silhouetteTag: "clean-pack-support",
    proportions: { height: 1.7, shoulder: 0.8, torso: 0.9, limb: 1, bulk: 0.86 },
    palette: { primary: "#6f776f", secondary: "#22312c", accent: "#f2f0da", cloth: "#32413a", visor: "#9be4d4" },
    mounts: { shoulder: "white-cross-pad", back: "medical-pack", hip: "triage-pouch" },
    weapon: { kind: "pulse-pistol", grip: "one-hand", length: 0.46 },
    mobileBudget: { triangles: 1040, materials: 6, drawGroups: 21 },
  },
  warden: {
    id: "warden",
    displayName: "Warden",
    classId: "heavy",
    silhouetteTag: "tall-shield-keeper",
    proportions: { height: 1.94, shoulder: 1.02, torso: 1.14, limb: 0.94, bulk: 1.08 },
    palette: { primary: "#4e5e64", secondary: "#151d21", accent: "#bfc7b5", cloth: "#2c3235", visor: "#d9ede5" },
    mounts: { shoulder: "high-collar-guard", back: "tower-shield", hip: "restraint-cases" },
    weapon: { kind: "riot-shotgun", grip: "guard", length: 0.82 },
    mobileBudget: { triangles: 1220, materials: 6, drawGroups: 23 },
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

function archetypeId(id) {
  return CHARACTER_ARCHETYPE_IDS.includes(id) ? id : "scout";
}

export function getCharacterArchetype(id) {
  return clone(rawArchetypes[archetypeId(id)]);
}

const REQUIRED_THREE_CONSTRUCTORS = Object.freeze([
  "Group",
  "Mesh",
  "MeshStandardMaterial",
  "BoxGeometry",
  "ConeGeometry",
  "CylinderGeometry",
  "SphereGeometry",
]);

function assertThreeNamespace(THREE) {
  const missing = REQUIRED_THREE_CONSTRUCTORS.filter((key) => typeof THREE?.[key] !== "function");
  if (missing.length) {
    throw new TypeError(`createCharacterModel requires a THREE namespace with ${REQUIRED_THREE_CONSTRUCTORS.join(", ")}; missing ${missing.join(", ")}`);
  }
}

function createMaterials(THREE, palette) {
  return {
    primary: new THREE.MeshStandardMaterial({ color: palette.primary, roughness: 0.78, metalness: 0.18 }),
    secondary: new THREE.MeshStandardMaterial({ color: palette.secondary, roughness: 0.84, metalness: 0.24 }),
    accent: new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.68, metalness: 0.2 }),
    cloth: new THREE.MeshStandardMaterial({ color: palette.cloth, roughness: 0.92, metalness: 0.06 }),
    visor: new THREE.MeshStandardMaterial({ color: palette.visor, roughness: 0.45, metalness: 0.38 }),
  };
}

function part(THREE, name) {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

function anchor(THREE, name, position = [0, 0, 0]) {
  const object = typeof THREE.Object3D === "function" ? new THREE.Object3D() : new THREE.Group();
  object.name = name;
  object.position.set(...position);
  return object;
}

function setScale(object, x, y, z) {
  object.scale.set(x, y, z);
  return object;
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

function capsule(THREE, radius, length, segments = 6) {
  return THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(radius, length, 4, segments) : new THREE.CylinderGeometry(radius, radius, length + radius * 2, segments);
}

function addWeapon(THREE, root, materials, archetype) {
  const weapon = part(THREE, `weapon:${archetype.weapon.kind}`);
  const muzzle = anchor(THREE, "muzzle", [archetype.weapon.length * 0.76, 0.01, 0]);
  const length = archetype.weapon.length;
  const stock = archetype.weapon.kind.includes("pistol") ? 0.16 : 0.28;
  weapon.add(mesh(THREE, "weapon:receiver", new THREE.BoxGeometry(length * 0.42, 0.12, 0.14), materials.secondary, [0, 0, 0]));
  weapon.add(mesh(THREE, "weapon:barrel", new THREE.CylinderGeometry(0.035, 0.035, length * 0.58, 6), materials.accent, [length * 0.42, 0.01, 0], [1, 1, 1]));
  weapon.children.at(-1).rotation.z = Math.PI / 2;
  weapon.add(mesh(THREE, "weapon:grip", new THREE.BoxGeometry(0.09, 0.22, 0.08), materials.cloth, [-length * 0.08, -0.16, 0]));
  if (!archetype.weapon.kind.includes("pistol")) weapon.add(mesh(THREE, "weapon:stock", new THREE.BoxGeometry(stock, 0.16, 0.12), materials.cloth, [-length * 0.34, -0.01, 0]));
  if (archetype.weapon.kind.includes("drum")) weapon.add(mesh(THREE, "weapon:drum", new THREE.CylinderGeometry(0.15, 0.15, 0.08, 10), materials.accent, [-0.02, -0.12, 0]));
  if (archetype.weapon.kind.includes("rifle") || archetype.weapon.kind.includes("carbine")) weapon.add(mesh(THREE, "weapon:sight", new THREE.BoxGeometry(0.18, 0.07, 0.08), materials.visor, [0.08, 0.11, 0]));
  weapon.add(muzzle);
  weapon.position.set(0.36, 0.98, -0.42);
  root.add(weapon);
  return { weapon, muzzle };
}

function addKit(THREE, root, materials, archetype) {
  const backMount = part(THREE, `backMount:${archetype.mounts.back}`);
  const hipMount = part(THREE, `hipMount:${archetype.mounts.hip}`);
  const shoulderMount = part(THREE, `shoulderMount:${archetype.mounts.shoulder}`);
  const classAttachmentAnchor = anchor(THREE, "classAttachmentAnchor", [0, 1.38, 0.26]);
  let shield = null;

  const backWide = archetype.id === "heavy" ? 0.46 : 0.34;
  backMount.add(mesh(THREE, "backMount:pack", new THREE.BoxGeometry(backWide, 0.72, 0.16), materials.secondary, [0, 1.18, 0.22]));
  if (archetype.id === "scout") backMount.add(mesh(THREE, "backMount:roll", new THREE.CylinderGeometry(0.11, 0.11, 0.54, 8), materials.cloth, [0, 1.56, 0.26]));
  if (archetype.id === "ranger") {
    backMount.add(mesh(THREE, "backMount:scope-pack", new THREE.BoxGeometry(0.22, 0.22, 0.12), materials.visor, [0.18, 1.54, 0.31]));
    const sling = mesh(THREE, "backMount:rifle-sling", new THREE.CylinderGeometry(0.018, 0.018, 0.92, 5), materials.accent, [-0.2, 1.23, 0.31]);
    sling.rotation.z = -0.58;
    backMount.add(sling);
  }
  if (archetype.id === "tech") {
    backMount.add(mesh(THREE, "backMount:antenna", new THREE.CylinderGeometry(0.014, 0.014, 0.58, 5), materials.accent, [0.16, 1.8, 0.24]));
    backMount.add(mesh(THREE, "backMount:tool-frame", new THREE.BoxGeometry(0.42, 0.48, 0.08), materials.accent, [-0.04, 1.24, 0.32]));
  }
  if (archetype.id === "medic") backMount.add(mesh(THREE, "backMount:med-cross", new THREE.BoxGeometry(0.3, 0.08, 0.04), materials.accent, [0, 1.25, 0.32]));
  hipMount.add(mesh(THREE, "hipMount:left", new THREE.BoxGeometry(0.16, 0.22, 0.12), materials.accent, [-0.36, 0.78, 0]));
  hipMount.add(mesh(THREE, "hipMount:right", new THREE.BoxGeometry(0.16, 0.22, 0.12), materials.secondary, [0.36, 0.78, 0]));
  if (archetype.id === "medic") hipMount.add(mesh(THREE, "hipMount:triage-pouch", new THREE.BoxGeometry(0.2, 0.16, 0.1), materials.visor, [-0.48, 0.72, -0.04]));
  shoulderMount.add(mesh(THREE, "shoulderMount:left", new THREE.BoxGeometry(0.24, 0.12, 0.18), materials.accent, [-0.42, 1.55, 0]));
  if (archetype.id === "scout") {
    const whip = mesh(THREE, "shoulderMount:radio-whip", new THREE.CylinderGeometry(0.01, 0.01, 0.62, 5), materials.visor, [-0.52, 1.86, 0.12]);
    whip.rotation.z = -0.22;
    shoulderMount.add(whip);
  }
  if (archetype.id === "heavy" || archetype.id === "warden") shoulderMount.add(mesh(THREE, "shoulderMount:right", new THREE.BoxGeometry(0.24, 0.12, 0.18), materials.accent, [0.42, 1.55, 0]));
  backMount.add(classAttachmentAnchor);

  root.add(backMount, hipMount, shoulderMount);
  return { backMount, hipMount, shoulderMount, classAttachmentAnchor, shield };
}

function geometryTriangleCount(geometry) {
  if (!geometry) return 0;
  if (Number.isFinite(geometry.index?.count)) return Math.ceil(geometry.index.count / 3);
  if (Number.isFinite(geometry.attributes?.position?.count)) return Math.ceil(geometry.attributes.position.count / 3);
  const type = geometry.type || "";
  if (type.includes("Box")) return 12;
  if (type.includes("Sphere")) return 160;
  if (type.includes("Capsule")) return 96;
  if (type.includes("Cylinder")) return 32;
  if (type.includes("Cone")) return 24;
  return 24;
}

export function measureCharacterModelBudget(root) {
  const materials = new Set();
  const budget = { meshes: 0, materials: 0, triangles: 0 };
  const visit = (node) => {
    if (node?.geometry) {
      budget.meshes += 1;
      budget.triangles += geometryTriangleCount(node.geometry);
      const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of nodeMaterials) if (material) materials.add(material);
    }
    for (const child of node?.children || []) visit(child);
  };
  visit(root);
  budget.materials = materials.size;
  return budget;
}

export function createCharacterModel(THREE, id = "scout") {
  assertThreeNamespace(THREE);
  const metadata = getCharacterArchetype(id);
  const p = metadata.proportions;
  const materials = createMaterials(THREE, metadata.palette);
  const root = part(THREE, `character:${metadata.id}`);
  root.userData.characterArchetype = metadata.id;

  const hips = part(THREE, `hips:${metadata.id}`);
  const torso = part(THREE, `torso:${metadata.id}`);
  const head = part(THREE, `head:${metadata.id}`);
  const leftArm = part(THREE, `leftArm:${metadata.id}`);
  const rightArm = part(THREE, `rightArm:${metadata.id}`);
  const leftLeg = part(THREE, `leftLeg:${metadata.id}`);
  const rightLeg = part(THREE, `rightLeg:${metadata.id}`);
  const leftHandAnchor = anchor(THREE, "leftHandAnchor", [-0.46 * p.shoulder, 0.76, -0.15]);
  const rightHandAnchor = anchor(THREE, "rightHandAnchor", [0.46 * p.shoulder, 0.76, -0.15]);
  const weaponAnchor = anchor(THREE, "weaponAnchor", [0.36, 0.98, -0.42]);

  hips.add(mesh(THREE, "hips:pelvis", new THREE.BoxGeometry(0.52 * p.shoulder, 0.26, 0.28 * p.bulk), materials.cloth, [0, 0.82, 0]));
  torso.add(mesh(THREE, "torso:chest", capsule(THREE, 0.24 * p.bulk, 0.5 * p.torso), materials.primary, [0, 1.26, 0], [p.shoulder, p.torso, 0.86]));
  torso.add(mesh(THREE, "torso:vest", new THREE.BoxGeometry(0.48 * p.shoulder, 0.48 * p.torso, 0.11 * p.bulk), materials.secondary, [0, 1.28, -0.18]));
  if (metadata.id === "ranger") torso.add(mesh(THREE, "torso:coat-tail", new THREE.BoxGeometry(0.42, 0.54, 0.08), materials.cloth, [0, 0.86, 0.16]));
  if (metadata.id === "warden") torso.add(mesh(THREE, "torso:high-collar", new THREE.BoxGeometry(0.58, 0.18, 0.2), materials.secondary, [0, 1.58, 0.08]));
  head.add(mesh(THREE, "head:helmet", new THREE.SphereGeometry(0.19 * p.bulk, 10, 8), materials.primary, [0, 1.78 * (p.height / 1.8), 0]));
  head.add(mesh(THREE, "head:visor", new THREE.BoxGeometry(0.22, 0.055, 0.035), materials.visor, [0, 1.78 * (p.height / 1.8), -0.17]));
  if (metadata.id === "scout") head.add(mesh(THREE, "head:hood", new THREE.ConeGeometry(0.24, 0.24, 8), materials.cloth, [0, 1.9 * (p.height / 1.8), 0.03]));

  const armY = 1.28;
  leftArm.add(mesh(THREE, "leftArm:upper", capsule(THREE, 0.07 * p.bulk, 0.36 * p.limb), materials.primary, [-0.38 * p.shoulder, armY, 0]));
  leftArm.add(mesh(THREE, "leftArm:forearm", capsule(THREE, 0.06 * p.bulk, 0.34 * p.limb), materials.cloth, [-0.44 * p.shoulder, 0.88, -0.1]));
  leftArm.add(leftHandAnchor);
  rightArm.add(mesh(THREE, "rightArm:upper", capsule(THREE, 0.07 * p.bulk, 0.36 * p.limb), materials.primary, [0.38 * p.shoulder, armY, 0]));
  rightArm.add(mesh(THREE, "rightArm:forearm", capsule(THREE, 0.06 * p.bulk, 0.34 * p.limb), materials.cloth, [0.44 * p.shoulder, 0.88, -0.1]));
  rightArm.add(rightHandAnchor);
  if (metadata.id === "warden") {
    const shield = part(THREE, "shield:tower");
    shield.add(mesh(THREE, "shield:tower", new THREE.BoxGeometry(0.34, 0.92, 0.1), materials.secondary, [-0.58, 0.98, -0.16]));
    shield.add(mesh(THREE, "shield:rim", new THREE.BoxGeometry(0.4, 0.08, 0.12), materials.accent, [-0.58, 1.42, -0.17]));
    leftArm.add(shield);
  }
  leftLeg.add(mesh(THREE, "leftLeg:boot", capsule(THREE, 0.085 * p.bulk, 0.66 * p.limb), materials.secondary, [-0.16 * p.shoulder, 0.32, 0]));
  rightLeg.add(mesh(THREE, "rightLeg:boot", capsule(THREE, 0.085 * p.bulk, 0.66 * p.limb), materials.secondary, [0.16 * p.shoulder, 0.32, 0]));

  setScale(root, 1, p.height / 1.8, 1);
  root.add(hips, torso, head, leftArm, rightArm, leftLeg, rightLeg, weaponAnchor);
  const kit = addKit(THREE, root, materials, metadata);
  const { weapon, muzzle } = addWeapon(THREE, root, materials, metadata);
  const shield = leftArm.children.find((child) => child.name === "shield:tower") || null;
  const measuredBudget = measureCharacterModelBudget(root);
  const budget = clone(measuredBudget);
  const declaredBudget = clone(metadata.mobileBudget);

  return {
    root,
    parts: {
      root,
      hips,
      torso,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      ...kit,
      weapon,
      muzzle,
      leftHandAnchor,
      rightHandAnchor,
      weaponAnchor,
      shield,
    },
    metadata,
    materials,
    budget,
    declaredBudget,
    measuredBudget,
  };
}

function posePart(x = 0, y = 0, z = 0, px = 0, py = 0, pz = 0) {
  return { rotation: { x, y, z }, position: { x: px, y: py, z: pz } };
}

export function sampleCharacterPose(id = "scout", input = {}) {
  const archetype = rawArchetypes[archetypeId(id)];
  const downed = input.downed === true || input.state === "downed";
  const speed = clamp(input.speed, 0, 1);
  const aim = clamp(input.aim, 0, 1);
  const fire = clamp(input.fire, 0, 1);
  const hit = clamp(input.hit, 0, 1);
  const waterDepth = clamp(input.waterDepth, 0, 1);
  const time = downed ? 0 : clamp(input.time, 0, 100000);
  const state = downed ? "downed" : ANIMATION_STATES.includes(input.state) ? input.state : waterDepth > 0.15 ? "wade" : fire > 0 ? "fire" : hit > 0 ? "hit" : aim > 0.65 ? "aim" : speed > 0.72 ? "run" : speed > 0.08 ? "walk" : "idle";

  if (state === "downed") {
    return {
      state,
      root: posePart(0, 0, -1.35, 0, 0.12, 0),
      hips: posePart(0.08, 0, 0.06),
      torso: posePart(0.24, 0, -0.38),
      head: posePart(-0.18, 0, 0.12),
      leftArm: posePart(0.42, 0.1, -0.52),
      rightArm: posePart(0.32, -0.08, -0.42),
      leftLeg: posePart(0.18, 0, 0.34),
      rightLeg: posePart(-0.12, 0, -0.22),
      weapon: posePart(0.18, 0.16, -0.64, 0.1, -0.14, -0.08),
    };
  }

  const gait = Math.sin(time * (state === "run" ? 10 : 6));
  const stride = (state === "run" ? 0.54 : state === "walk" ? 0.34 : state === "wade" ? 0.22 : 0) * speed;
  const breath = Math.sin(time * 2.4) * 0.025;
  const aimLift = aim * 0.34;
  const recoil = fire * 0.28;
  const flinch = hit * 0.3;
  const wadeLift = state === "wade" ? waterDepth * 0.16 : 0;
  const weight = archetype.proportions.bulk - 1;

  return {
    state,
    root: posePart(-flinch * 0.2, 0, gait * stride * 0.04, 0, wadeLift + Math.abs(gait) * stride * 0.025, 0),
    hips: posePart(0, gait * stride * 0.08, -gait * stride * 0.05),
    torso: posePart(breath - flinch, 0, aim * -0.08 + weight * 0.04),
    head: posePart(aim * -0.08 - hit * 0.12, 0, aim * -0.04),
    leftArm: posePart(-gait * stride * 0.46 - aimLift, 0, aim * -0.32),
    rightArm: posePart(gait * stride * 0.46 - aimLift - recoil, 0, aim * -0.38 - recoil * 0.22),
    leftLeg: posePart(gait * stride, 0, 0),
    rightLeg: posePart(-gait * stride, 0, 0),
    weapon: posePart(-aimLift - recoil, 0.02 * gait, -0.08 * aim - recoil * 0.35, 0, 0, -0.12 * aim),
  };
}

function applyPosePart(part, pose) {
  if (!part || !pose) return;
  if (pose.rotation) part.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
  if (pose.position) part.position.set(pose.position.x, pose.position.y, pose.position.z);
}

export function applyCharacterPose(model, pose) {
  if (!model?.parts || !pose) return pose;
  for (const name of ["root", "hips", "torso", "head", "leftArm", "rightArm", "leftLeg", "rightLeg", "weapon"]) {
    applyPosePart(model.parts[name], pose[name]);
  }
  return pose;
}

export function createPoseController(model) {
  if (!model?.metadata?.id) throw new TypeError("createPoseController requires a character model");
  let time = 0;
  let terminalPose = null;

  return {
    update(deltaSeconds = 0, input = {}) {
      time += clamp(deltaSeconds, 0, 0.25);
      if (terminalPose) return applyCharacterPose(model, terminalPose);
      const pose = sampleCharacterPose(model.metadata.id, { ...input, time });
      if (pose.state === "downed") terminalPose = pose;
      return applyCharacterPose(model, pose);
    },
    resetTerminalState() {
      terminalPose = null;
    },
    reset() {
      time = 0;
      terminalPose = null;
    },
  };
}
