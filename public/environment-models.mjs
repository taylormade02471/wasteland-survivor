export const ENVIRONMENT_MODEL_IDS = Object.freeze(["barricade", "ruined-wall", "vehicle-shell", "toxic-barrel-cluster", "ice-boulder", "lava-vent", "flooded-debris"]);
export const ENVIRONMENT_ANIMATION_STATES = Object.freeze(["waterBob", "toxicPulse", "iceSparkle", "heatVent", "beacon", "chestOpen", "hitReaction"]);
export const MOBILE_ENVIRONMENT_BUDGET = Object.freeze({ triangles: 1100, materials: 6, drawGroups: 18, particles: 24 });

const rawEnvironment = {
  barricade: {
    id: "barricade",
    displayName: "Scrap Barricade",
    biome: "wasteland",
    silhouetteTag: "waist-high-sawtooth-scrap-cover",
    palette: { metal: "#555852", dark: "#252827", accent: "#d7a44b", glow: "#e45845" },
    footprint: { width: 2.4, depth: 0.62, height: 1.05 },
    collider: { kind: "box", blocksPlayers: true, width: 2.3, depth: 0.58, height: 1.05 },
    budget: { triangles: 520, materials: 4, drawGroups: 11, particles: 6 },
  },
  "ruined-wall": {
    id: "ruined-wall",
    displayName: "Ruined Wall",
    biome: "wasteland",
    silhouetteTag: "broken-tall-concrete-slab",
    palette: { metal: "#72716a", dark: "#343330", accent: "#c37b42", glow: "#e95845" },
    footprint: { width: 2.1, depth: 0.42, height: 1.75 },
    collider: { kind: "box", blocksPlayers: true, width: 2.0, depth: 0.4, height: 1.7 },
    budget: { triangles: 610, materials: 4, drawGroups: 12, particles: 4 },
  },
  "vehicle-shell": {
    id: "vehicle-shell",
    displayName: "Vehicle Shell",
    biome: "wasteland",
    silhouetteTag: "low-hollow-armored-car-husk",
    palette: { metal: "#474d4d", dark: "#202425", accent: "#ba6f3f", glow: "#f0b54d" },
    footprint: { width: 2.9, depth: 1.35, height: 1.2 },
    collider: { kind: "box", blocksPlayers: true, width: 2.75, depth: 1.22, height: 1.05 },
    budget: { triangles: 900, materials: 5, drawGroups: 16, particles: 6 },
  },
  "toxic-barrel-cluster": {
    id: "toxic-barrel-cluster",
    displayName: "Toxic Barrel Cluster",
    biome: "toxic",
    silhouetteTag: "stacked-green-warning-barrels",
    palette: { metal: "#3d4741", dark: "#1f2722", accent: "#d6b44c", glow: "#65e05d" },
    footprint: { width: 1.25, depth: 1.05, height: 1.1 },
    collider: { kind: "cylinder", blocksPlayers: true, radius: 0.72, height: 1.1 },
    budget: { triangles: 760, materials: 5, drawGroups: 14, particles: 20 },
  },
  "ice-boulder": {
    id: "ice-boulder",
    displayName: "Ice Boulder",
    biome: "ice",
    silhouetteTag: "jagged-blue-white-cover-boulder",
    palette: { metal: "#8caeb6", dark: "#384c55", accent: "#d6f3ff", glow: "#baf6ff" },
    footprint: { width: 1.65, depth: 1.45, height: 1.35 },
    collider: { kind: "box", blocksPlayers: true, width: 1.5, depth: 1.32, height: 1.2 },
    budget: { triangles: 660, materials: 4, drawGroups: 12, particles: 16 },
  },
  "lava-vent": {
    id: "lava-vent",
    displayName: "Lava Vent",
    biome: "lava",
    silhouetteTag: "cracked-black-rock-amber-vent",
    palette: { metal: "#282725", dark: "#161513", accent: "#b86b34", glow: "#ff7b31" },
    footprint: { width: 1.55, depth: 1.55, height: 0.55 },
    collider: { kind: "cylinder", blocksPlayers: true, radius: 0.86, height: 0.55 },
    budget: { triangles: 700, materials: 5, drawGroups: 13, particles: 24 },
  },
  "flooded-debris": {
    id: "flooded-debris",
    displayName: "Flooded Debris",
    biome: "flooded",
    silhouetteTag: "floating-planks-and-submerged-metal",
    palette: { metal: "#4d5c5e", dark: "#253133", accent: "#a08358", glow: "#78c4d2" },
    footprint: { width: 2.0, depth: 1.25, height: 0.48 },
    collider: { kind: "box", blocksPlayers: true, width: 1.85, depth: 1.05, height: 0.48 },
    budget: { triangles: 580, materials: 5, drawGroups: 12, particles: 12 },
  },
};

const chestDefinition = {
  id: "upgrade-chest",
  displayName: "Shared Upgrade Chest",
  biome: "wasteland",
  silhouetteTag: "waist-high-two-player-supply-crate",
  palette: { metal: "#535a56", dark: "#202826", accent: "#efbc55", glow: "#65e05d" },
  footprint: { width: 1.2, depth: 0.82, height: 0.72 },
  collider: { kind: "box", blocksPlayers: true, width: 1.14, depth: 0.78, height: 0.72 },
  budget: { triangles: 680, materials: 5, drawGroups: 12, particles: 18 },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function environmentId(id) {
  return ENVIRONMENT_MODEL_IDS.includes(id) ? id : "barricade";
}

export function getEnvironmentDefinition(id) {
  return clone(rawEnvironment[environmentId(id)]);
}

function hashSeed(seed) {
  const text = String(seed ?? "default");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random01(seed) {
  let state = hashSeed(seed) || 1;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return ((state >>> 0) % 10000) / 10000;
}

export function seededVariant(seed = "default", id = "barricade") {
  const base = random01(`${seed}:${environmentId(id)}:a`);
  const secondary = random01(`${seed}:${environmentId(id)}:b`);
  return {
    index: Math.floor(base * 4),
    yaw: Number(((base - 0.5) * 0.32).toFixed(4)),
    scale: Number((0.92 + secondary * 0.16).toFixed(4)),
    wear: Number((0.35 + base * 0.6).toFixed(4)),
  };
}

function createMaterials(THREE, palette) {
  return {
    metal: new THREE.MeshStandardMaterial({ color: palette.metal, roughness: 0.78, metalness: 0.36 }),
    dark: new THREE.MeshStandardMaterial({ color: palette.dark, roughness: 0.86, metalness: 0.28 }),
    accent: new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.62, metalness: 0.2 }),
    glow: new THREE.MeshStandardMaterial({ color: palette.glow, roughness: 0.38, metalness: 0.14, emissive: palette.glow }),
  };
}

function part(THREE, name) {
  const group = new THREE.Group();
  group.name = name;
  return group;
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

function addObstacleMeshes(THREE, root, materials, definition, variant) {
  const f = definition.footprint;
  if (definition.id === "toxic-barrel-cluster") {
    for (let index = 0; index < 4; index += 1) {
      const barrel = mesh(THREE, `barrel:${index}`, new THREE.CylinderGeometry(0.24, 0.24, 0.72, 10), index === 1 ? materials.glow : materials.metal, [(index % 2 - 0.5) * 0.42, 0.36 + Math.floor(index / 2) * 0.26, Math.floor(index / 2) * 0.28]);
      root.add(barrel);
      root.add(mesh(THREE, `barrel:warning-band:${index}`, new THREE.BoxGeometry(0.42, 0.055, 0.03), materials.accent, [barrel.position.x, barrel.position.y + 0.13, barrel.position.z - 0.24]));
    }
    return;
  }
  if (definition.id === "ice-boulder") {
    root.add(mesh(THREE, "ice:core", new THREE.SphereGeometry(0.62, 8, 6), materials.metal, [0, 0.54, 0], [1.1, 0.8, 0.92]));
    root.add(mesh(THREE, "ice:shard:left", new THREE.ConeGeometry(0.22, 0.7, 5), materials.accent, [-0.38, 0.8, 0.12]));
    root.add(mesh(THREE, "ice:shard:right", new THREE.ConeGeometry(0.18, 0.58, 5), materials.glow, [0.44, 0.72, -0.18]));
    return;
  }
  if (definition.id === "lava-vent") {
    root.add(mesh(THREE, "vent:basalt-ring", new THREE.CylinderGeometry(0.82, 0.7, 0.22, 10), materials.dark, [0, 0.11, 0]));
    root.add(mesh(THREE, "vent:crack-glow", new THREE.BoxGeometry(1.25, 0.035, 0.12), materials.glow, [0, 0.25, 0]));
    root.add(mesh(THREE, "vent:warning-rock", new THREE.ConeGeometry(0.28, 0.48, 5), materials.accent, [0.42, 0.36, -0.32]));
    return;
  }
  if (definition.id === "flooded-debris") {
    root.add(mesh(THREE, "debris:plank-long", new THREE.BoxGeometry(f.width, 0.12, 0.24), materials.accent, [0, 0.2, -0.18]));
    root.add(mesh(THREE, "debris:metal-sheet", new THREE.BoxGeometry(1.2, 0.08, 0.58), materials.metal, [0.22, 0.14, 0.22]));
    root.add(mesh(THREE, "debris:float-marker", new THREE.CylinderGeometry(0.12, 0.12, 0.36, 8), materials.glow, [-0.72, 0.26, 0.22]));
    return;
  }
  if (definition.id === "vehicle-shell") {
    root.add(mesh(THREE, "vehicle:hull", new THREE.BoxGeometry(f.width, 0.66, f.depth), materials.metal, [0, 0.48, 0]));
    root.add(mesh(THREE, "vehicle:open-cabin", new THREE.BoxGeometry(1.05, 0.52, 0.72), materials.dark, [-0.36, 0.88, 0]));
    root.add(mesh(THREE, "vehicle:amber-panel", new THREE.BoxGeometry(0.38, 0.12, 0.04), materials.accent, [0.72, 0.84, -f.depth * 0.52]));
    root.add(mesh(THREE, "vehicle:wheel-left", new THREE.CylinderGeometry(0.22, 0.22, 0.12, 8), materials.dark, [-0.82, 0.2, -0.64]));
    return;
  }
  const brokenHeight = definition.id === "ruined-wall" ? f.height : f.height * 0.72;
  root.add(mesh(THREE, "cover:slab-main", new THREE.BoxGeometry(f.width, brokenHeight, f.depth), materials.metal, [0, brokenHeight * 0.5, 0]));
  root.add(mesh(THREE, "cover:dark-brace", new THREE.BoxGeometry(f.width * 0.18, brokenHeight * 1.05, f.depth * 1.25), materials.dark, [-f.width * 0.32, brokenHeight * 0.52, 0]));
  root.add(mesh(THREE, "cover:warning-edge", new THREE.BoxGeometry(f.width * 0.54, 0.08, f.depth * 1.3), materials.accent, [f.width * 0.12, brokenHeight * 0.82, 0]));
  if (variant.index % 2 === 0) root.add(mesh(THREE, "cover:red-cloth-strip", new THREE.BoxGeometry(0.12, 0.44, 0.035), materials.glow, [f.width * 0.38, brokenHeight * 0.58, -f.depth * 0.58]));
}

export function createEnvironmentModel(THREE, id = "barricade", options = {}) {
  if (!THREE?.Group || !THREE?.Mesh) throw new TypeError("createEnvironmentModel requires a THREE-like namespace");
  const metadata = getEnvironmentDefinition(id);
  const variant = seededVariant(options.seed, metadata.id);
  const materials = createMaterials(THREE, metadata.palette);
  const root = part(THREE, `environment:${metadata.id}`);
  const colliderMarker = part(THREE, `collider:${metadata.id}`);
  root.userData.environmentId = metadata.id;
  root.rotation.y = variant.yaw;
  root.scale.set(variant.scale, variant.scale, variant.scale);
  colliderMarker.userData.collider = clone(metadata.collider);
  addObstacleMeshes(THREE, root, materials, metadata, variant);
  root.add(colliderMarker);
  return {
    root,
    parts: { root, colliderMarker },
    metadata,
    variant,
    materials,
    collider: clone(metadata.collider),
    footprint: clone(metadata.footprint),
    budget: clone(metadata.budget),
  };
}

export function createUpgradeChestModel(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh) throw new TypeError("createUpgradeChestModel requires a THREE-like namespace");
  const metadata = clone(chestDefinition);
  const variant = seededVariant(options.seed, "barricade");
  const materials = createMaterials(THREE, metadata.palette);
  const root = part(THREE, "environment:upgrade-chest");
  const base = part(THREE, "chest:base");
  const lid = part(THREE, "chest:lid");
  const glow = part(THREE, "chest:glow");
  const playerOneMarker = part(THREE, "interaction:player-one");
  const playerTwoMarker = part(THREE, "interaction:player-two");
  const colliderMarker = part(THREE, "collider:upgrade-chest");

  base.add(mesh(THREE, "chest:wet-metal-crate", new THREE.BoxGeometry(1.08, 0.42, 0.72), materials.metal, [0, 0.22, 0]));
  lid.add(mesh(THREE, "chest:hinged-lid", new THREE.BoxGeometry(1.14, 0.16, 0.78), materials.dark, [0, 0.52, 0]));
  glow.add(mesh(THREE, "chest:upgrade-glow", new THREE.BoxGeometry(0.82, 0.04, 0.5), materials.glow, [0, 0.46, 0]));
  playerOneMarker.position.set(-0.82, 0, -0.52);
  playerTwoMarker.position.set(0.82, 0, -0.52);
  colliderMarker.userData.collider = clone(metadata.collider);
  root.rotation.y = variant.yaw;
  root.add(base, lid, glow, playerOneMarker, playerTwoMarker, colliderMarker);
  return {
    root,
    parts: { root, base, lid, glow, playerOneMarker, playerTwoMarker, colliderMarker },
    metadata,
    variant,
    materials,
    collider: clone(metadata.collider),
    footprint: clone(metadata.footprint),
    interactionMarkers: [
      { id: "player-one", x: -0.82, z: -0.52, radius: 0.72 },
      { id: "player-two", x: 0.82, z: -0.52, radius: 0.72 },
    ],
    budget: clone(metadata.budget),
  };
}

function posePart(x = 0, y = 0, z = 0, px = 0, py = 0, pz = 0, scale = 1) {
  return { rotation: { x, y, z }, position: { x: px, y: py, z: pz }, scale };
}

export function sampleEnvironmentAnimation(id = "barricade", input = {}) {
  const definition = rawEnvironment[environmentId(id)];
  const time = clamp(input.time, 0, 100000);
  const intensity = clamp(input.intensity ?? input.objective ?? input.hit ?? input.open, 0, 1);
  const open = clamp(input.open, 0, 1);
  const hit = clamp(input.hit, 0, 1);
  const state = ENVIRONMENT_ANIMATION_STATES.includes(input.state) ? input.state : open > 0 ? "chestOpen" : hit > 0 ? "hitReaction" : definition.biome === "flooded" ? "waterBob" : definition.biome === "toxic" ? "toxicPulse" : definition.biome === "ice" ? "iceSparkle" : definition.biome === "lava" ? "heatVent" : "beacon";
  const wave = Math.sin(time * 2.4);
  const fast = Math.sin(time * 9.0);
  const pulse = 0.5 + wave * 0.5;

  return {
    state,
    root: state === "hitReaction" ? posePart(-hit * 0.08, hit * 0.06, -hit * 0.1, hit * 0.04, 0, 0) : posePart(0, state === "beacon" ? time % (Math.PI * 2) : 0, 0, 0, state === "waterBob" ? wave * 0.08 : 0, 0),
    lid: posePart(state === "chestOpen" ? -open * 1.12 : 0, 0, 0, 0, open * 0.08, 0),
    glow: { intensity: state === "chestOpen" ? 0.35 + open * 0.65 : state === "toxicPulse" || state === "heatVent" || state === "iceSparkle" ? 0.35 + pulse * intensity : 0.45 },
    beacon: posePart(0, state === "beacon" ? time * 1.8 : 0, 0, 0, state === "beacon" ? 0.16 + pulse * 0.08 : 0, 0, state === "beacon" ? 1 + pulse * 0.12 : 1),
    water: { bob: state === "waterBob" ? wave * 0.08 : 0, ripple: state === "waterBob" ? 0.5 + fast * 0.18 : 0 },
    toxic: { pulse: state === "toxicPulse" ? pulse * intensity : 0, vent: state === "toxicPulse" ? intensity * 0.4 : 0 },
    ice: { sparkle: state === "iceSparkle" ? (0.45 + fast * 0.25) * intensity : 0 },
    heat: { shimmer: state === "heatVent" ? (0.55 + fast * 0.18) * intensity : 0, vent: state === "heatVent" ? pulse * intensity : 0 },
  };
}
