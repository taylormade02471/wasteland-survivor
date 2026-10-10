export const ENVIRONMENT_MODEL_IDS = Object.freeze(["barricade", "ruined-wall", "vehicle-shell", "toxic-barrel-cluster", "ice-boulder", "lava-vent", "flooded-debris"]);
export const ENVIRONMENT_ANIMATION_STATES = Object.freeze(["waterBob", "toxicPulse", "iceSparkle", "heatVent", "beacon", "chestOpen", "hitReaction"]);
export const MOBILE_ENVIRONMENT_BUDGET = Object.freeze({ triangles: 1100, materials: 6, drawGroups: 18, particles: 24 });
export const SUPPLY_STATION_IDS = Object.freeze(["gun-upgrade-station", "ammunition-supply-crate"]);
export const WAYPOINT_ARROW_DESCRIPTOR = Object.freeze({
  kind: "supply-waypoint-chevron",
  palette: { fill: "#f2bd4d", shadow: "#171714", edge: "#fff0a8" },
  sizePx: { min: 22, max: 34 },
  clampMarginPx: 32,
  nearFadeMeters: 4.5,
  farScaleMeters: 90,
  accessibility: {
    icon: "chevron",
    labelTemplate: "{supplyName} supply marker",
    textWhenOffscreen: "Supply is off screen",
  },
});
export const WORLD_ARENA_PRESETS = Object.freeze({
  wasteland: {
    mapId: "wasteland",
    playableBounds: { radius: 112, width: 210, depth: 210 },
    spawnClearance: 20,
    landmarkSpacing: 34,
    pathWidth: 8,
    obstacleDensity: 0.18,
    obstacleCount: { min: 18, max: 24 },
    boundaryFeatures: [
      { type: "perimeter-wall", kind: "wall", x: 0, z: -98, width: 168, depth: 2.6, height: 4.2, rotation: 0, palette: "scrap", visualDefinition: "rusted scrap wall along the northern combat edge" },
      { type: "ruined-building", kind: "building", x: -54, z: 44, width: 18, depth: 14, height: 8, rotation: -0.18, palette: "concrete", visualDefinition: "collapsed two-story concrete shell with open firing lanes" },
      { type: "dry-riverbed", kind: "river", x: 46, z: 10, width: 12, depth: 112, height: 0.08, rotation: 0.52, palette: "dust", visualDefinition: "sunken dry riverbed that draws a readable map boundary" },
    ],
    supplySeparation: 36,
    chestObjectiveSafetyRadius: 18,
    mobileRenderBudget: { drawGroups: 62, materials: 18, particles: 56 },
  },
  "toxic-pond": {
    mapId: "toxic-pond",
    playableBounds: { radius: 124, width: 220, depth: 230 },
    spawnClearance: 22,
    landmarkSpacing: 38,
    pathWidth: 9,
    obstacleDensity: 0.16,
    obstacleCount: { min: 16, max: 22 },
    boundaryFeatures: [
      { type: "perimeter-wall", kind: "wall", x: 0, z: -104, width: 174, depth: 2.8, height: 4.6, rotation: 0, palette: "industrial", visualDefinition: "corroded industrial wall at the poisoned perimeter" },
      { type: "industrial-building", kind: "building", x: -58, z: 48, width: 20, depth: 15, height: 8.5, rotation: 0.16, palette: "toxic", visualDefinition: "half-sunk pump house with glowing toxic windows" },
      { type: "toxic-river", kind: "river", x: 48, z: 4, width: 13, depth: 118, height: 0.1, rotation: -0.42, palette: "toxic", visualDefinition: "glowing green runoff river separating safe lanes from hazards" },
    ],
    supplySeparation: 40,
    chestObjectiveSafetyRadius: 20,
    mobileRenderBudget: { drawGroups: 64, materials: 18, particles: 62 },
  },
  "icy-mountain": {
    mapId: "icy-mountain",
    playableBounds: { radius: 118, width: 206, depth: 232 },
    spawnClearance: 24,
    landmarkSpacing: 36,
    pathWidth: 8,
    obstacleDensity: 0.17,
    obstacleCount: { min: 17, max: 23 },
    boundaryFeatures: [
      { type: "ice-cliff", kind: "wall", x: 0, z: -106, width: 160, depth: 4.2, height: 7.8, rotation: 0.03, palette: "ice", visualDefinition: "jagged blue ice cliff closing the mountain edge" },
      { type: "stone-wall", kind: "building", x: -50, z: 52, width: 20, depth: 12, height: 6.6, rotation: -0.28, palette: "stone", visualDefinition: "snow-packed stone ruins forming hard cover" },
      { type: "frozen-river", kind: "river", x: 45, z: 0, width: 14, depth: 116, height: 0.08, rotation: 0.34, palette: "ice", visualDefinition: "pale frozen river line that defines a slippery boundary" },
    ],
    supplySeparation: 38,
    chestObjectiveSafetyRadius: 18,
    mobileRenderBudget: { drawGroups: 60, materials: 17, particles: 54 },
  },
  "fiery-inferno": {
    mapId: "fiery-inferno",
    playableBounds: { radius: 120, width: 218, depth: 218 },
    spawnClearance: 24,
    landmarkSpacing: 40,
    pathWidth: 9,
    obstacleDensity: 0.15,
    obstacleCount: { min: 15, max: 21 },
    boundaryFeatures: [
      { type: "basalt-wall", kind: "wall", x: 0, z: -100, width: 170, depth: 3.4, height: 5.8, rotation: 0, palette: "basalt", visualDefinition: "black basalt wall lit by orange cracks" },
      { type: "burned-building", kind: "building", x: -56, z: 42, width: 18, depth: 14, height: 7.4, rotation: 0.24, palette: "burned", visualDefinition: "burned-out building shell with ember-lit windows" },
      { type: "lava-river", kind: "river", x: 48, z: 8, width: 12, depth: 112, height: 0.12, rotation: -0.48, palette: "lava", visualDefinition: "bright lava river marking an obvious danger boundary" },
    ],
    supplySeparation: 42,
    chestObjectiveSafetyRadius: 22,
    mobileRenderBudget: { drawGroups: 66, materials: 18, particles: 68 },
  },
});
export const LOBBY_LOADOUT_VISUAL_CONTRACT = Object.freeze({
  version: 1,
  backdropTreatment: "cinematic-backdrop-with-restrained-plates",
  prohibitedPatterns: ["nested-cards", "blocky-grid-panels", "giant-center-overlay"],
  backingPlate: { opacity: 0.64, blurPx: 10, border: "single-hairline" },
  desktop: {
    profileRail: { placement: "left", maxWidth: 260, minHeight: 560 },
    modeStrip: { placement: "top-center", height: 54 },
    floatingControls: { placement: "bottom-right", maxWidth: 340 },
  },
  mobile: {
    profileRail: { placement: "top", maxHeight: 68 },
    modeStrip: { placement: "below-profile", height: 46 },
    floatingControls: { placement: "bottom-safe-area", maxHeight: 84 },
  },
  modeStrip: { presentation: "compact-segmented-strip", density: "single-row", focusRing: "amber-inner-line" },
  loadoutRibbon: {
    presentation: "integrated-ribbon-drawer",
    closedHeight: 58,
    drawer: { maxHeight: 168, columnsDesktop: 4, columnsMobile: 2 },
  },
  controllerFocus: {
    order: ["profile-rail", "mode-strip", "loadout-ribbon", "floating-primary", "floating-secondary"],
    wrap: true,
    defaultTarget: "floating-primary",
  },
});

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

const rawSupplyStations = {
  "gun-upgrade-station": {
    id: "gun-upgrade-station",
    displayName: "Weapon Upgrade Station",
    role: "weapon-upgrade",
    silhouetteTag: "upright-workbench-with-overhead-tool-arm",
    palette: { metal: "#4d514d", dark: "#202422", accent: "#e2ad42", glow: "#67df70" },
    footprint: { width: 1.65, depth: 1.0, height: 1.35 },
    collider: { kind: "box", blocksPlayers: true, width: 1.48, depth: 0.86, height: 1.22 },
    interaction: {
      socket: { kind: "weapon-upgrade", x: 0, y: 0.94, z: -0.48, accepts: ["scrap", "weapon-family", "class-upgrade"] },
      marker: { id: "upgrade-use", x: 0, z: -0.92, radius: 0.92, prompt: "Upgrade weapon" },
    },
    budget: { triangles: 820, materials: 5, drawGroups: 15, particles: 14 },
  },
  "ammunition-supply-crate": {
    id: "ammunition-supply-crate",
    displayName: "Ammunition Supply Crate",
    role: "ammunition",
    silhouetteTag: "low-stacked-open-ammo-crates-with-flag",
    palette: { metal: "#4f6046", dark: "#232920", accent: "#d8dcc6", glow: "#eff1d8" },
    footprint: { width: 1.85, depth: 1.12, height: 0.82 },
    collider: { kind: "box", blocksPlayers: true, width: 1.7, depth: 0.98, height: 0.78 },
    interaction: {
      socket: { kind: "ammunition", x: 0.18, y: 0.56, z: -0.42, accepts: ["ammo", "magazine", "tactical-refill"] },
      marker: { id: "ammo-use", x: 0, z: -0.94, radius: 0.86, prompt: "Resupply ammo" },
    },
    budget: { triangles: 740, materials: 5, drawGroups: 14, particles: 8 },
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

function environmentId(id) {
  return ENVIRONMENT_MODEL_IDS.includes(id) ? id : "barricade";
}

function supplyStationId(id) {
  return SUPPLY_STATION_IDS.includes(id) ? id : "gun-upgrade-station";
}

export function getEnvironmentDefinition(id) {
  return clone(rawEnvironment[environmentId(id)]);
}

export function getSupplyStationDefinition(id) {
  return clone(rawSupplyStations[supplyStationId(id)]);
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
  const stableId = ENVIRONMENT_MODEL_IDS.includes(id) ? environmentId(id) : supplyStationId(id);
  const base = random01(`${seed}:${stableId}:a`);
  const secondary = random01(`${seed}:${stableId}:b`);
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

function addSupplyStationMeshes(THREE, root, materials, definition, variant) {
  if (definition.id === "gun-upgrade-station") {
    root.add(mesh(THREE, "upgrade:workbench", new THREE.BoxGeometry(1.42, 0.34, 0.72), materials.metal, [0, 0.38, 0]));
    root.add(mesh(THREE, "upgrade:back-rack", new THREE.BoxGeometry(1.18, 0.82, 0.12), materials.dark, [0, 0.94, 0.34]));
    root.add(mesh(THREE, "upgrade:tool-arm", new THREE.CylinderGeometry(0.035, 0.035, 0.94, 8), materials.accent, [0.42, 1.23, -0.08]));
    root.children.at(-1).rotation.z = 0.42 + variant.yaw;
    root.add(mesh(THREE, "upgrade:weapon-clamp", new THREE.BoxGeometry(0.62, 0.08, 0.12), materials.accent, [0, 0.72, -0.36]));
    root.add(mesh(THREE, "upgrade:toxic-calibrator", new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8), materials.glow, [-0.46, 0.76, -0.22]));
    return;
  }
  root.add(mesh(THREE, "ammo:lower-crate-left", new THREE.BoxGeometry(0.76, 0.42, 0.82), materials.metal, [-0.36, 0.24, 0]));
  root.add(mesh(THREE, "ammo:lower-crate-right", new THREE.BoxGeometry(0.76, 0.42, 0.82), materials.metal, [0.48, 0.24, 0.08]));
  root.add(mesh(THREE, "ammo:open-lid", new THREE.BoxGeometry(0.84, 0.08, 0.62), materials.dark, [-0.38, 0.56, -0.28]));
  root.children.at(-1).rotation.x = -0.44;
  root.add(mesh(THREE, "ammo:dirty-white-band", new THREE.BoxGeometry(1.42, 0.09, 0.05), materials.accent, [0.04, 0.42, -0.44]));
  root.add(mesh(THREE, "ammo:small-flag", new THREE.BoxGeometry(0.08, 0.54, 0.28), materials.glow, [0.82, 0.78, -0.18]));
}

export function createSupplyStationModel(THREE, id = "gun-upgrade-station", options = {}) {
  if (!THREE?.Group || !THREE?.Mesh) throw new TypeError("createSupplyStationModel requires a THREE-like namespace");
  const metadata = getSupplyStationDefinition(id);
  const variant = seededVariant(options.seed, metadata.id);
  const materials = createMaterials(THREE, metadata.palette);
  const root = part(THREE, `supply:${metadata.id}`);
  const socket = part(THREE, `socket:${metadata.role}`);
  const interactionMarker = part(THREE, `interaction:${metadata.interaction.marker.id}`);
  const colliderMarker = part(THREE, `collider:${metadata.id}`);
  root.userData.supplyStationId = metadata.id;
  root.rotation.y = variant.yaw;
  root.scale.set(variant.scale, variant.scale, variant.scale);
  socket.position.set(metadata.interaction.socket.x, metadata.interaction.socket.y, metadata.interaction.socket.z);
  socket.userData.socket = clone(metadata.interaction.socket);
  interactionMarker.position.set(metadata.interaction.marker.x, 0, metadata.interaction.marker.z);
  interactionMarker.userData.marker = clone(metadata.interaction.marker);
  colliderMarker.userData.collider = clone(metadata.collider);
  addSupplyStationMeshes(THREE, root, materials, metadata, variant);
  root.add(socket, interactionMarker, colliderMarker);
  return {
    root,
    parts: { root, socket, interactionMarker, colliderMarker },
    metadata,
    variant,
    materials,
    collider: clone(metadata.collider),
    footprint: clone(metadata.footprint),
    interaction: clone(metadata.interaction),
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

function normalizePoint(point = {}) {
  return { x: Number(point.x) || 0, z: Number(point.z) || 0 };
}

export function sampleWaypointArrow(input = {}) {
  const player = normalizePoint(input.player);
  const target = normalizePoint(input.target);
  const heading = Number(input.player?.heading) || 0;
  const viewport = {
    width: Math.max(160, Number(input.viewport?.width) || 390),
    height: Math.max(160, Number(input.viewport?.height) || 844),
  };
  const dx = target.x - player.x;
  const dz = target.z - player.z;
  const distance = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, -dz) - heading;
  const forward = Math.cos(angle);
  const side = Math.sin(angle);
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const margin = WAYPOINT_ARROW_DESCRIPTOR.clampMarginPx;
  const projectedX = centerX + side * centerX * 0.72;
  const projectedY = centerY - forward * centerY * 0.46;
  const behind = forward < -0.12;
  const outside = behind || distance > 60 || projectedX < margin || projectedX > viewport.width - margin || projectedY < margin || projectedY > viewport.height - margin;
  const ui = {
    x: Math.round(outside && Math.abs(side) > 0.35 ? (side > 0 ? viewport.width - margin : margin) : clamp(projectedX, margin, viewport.width - margin)),
    y: Math.round(outside && Math.abs(side) <= 0.35 ? (forward > 0 ? margin : viewport.height - margin) : clamp(behind ? viewport.height - margin : projectedY, margin, viewport.height - margin)),
  };
  const near = clamp(distance / WAYPOINT_ARROW_DESCRIPTOR.nearFadeMeters, 0, 1);
  const far = clamp(distance / WAYPOINT_ARROW_DESCRIPTOR.farScaleMeters, 0, 1);
  const maxOpacity = distance < WAYPOINT_ARROW_DESCRIPTOR.nearFadeMeters ? 0.72 : outside ? 0.95 : 0.72;
  const supplyName = String(input.supplyName || "Supply");
  return {
    visible: distance >= 2.2 && near > 0.2,
    offscreen: outside,
    distance: Number(distance.toFixed(3)),
    rotation: Number(angle.toFixed(4)),
    opacity: Number((near * maxOpacity).toFixed(4)),
    ui: {
      x: ui.x,
      y: ui.y,
      scale: Number((0.58 + far * 0.24).toFixed(4)),
    },
    accessibility: {
      icon: WAYPOINT_ARROW_DESCRIPTOR.accessibility.icon,
      label: WAYPOINT_ARROW_DESCRIPTOR.accessibility.labelTemplate.replace("{supplyName}", supplyName),
    },
  };
}

function presetId(id) {
  return WORLD_ARENA_PRESETS[id] ? id : "wasteland";
}

function collides(candidate, blockers, padding = 1.5) {
  return blockers.some((blocker) => Math.hypot(candidate.x - blocker.x, candidate.z - blocker.z) < candidate.radius + blocker.radius + padding);
}

export function sampleArenaPlacements(id = "wasteland", options = {}) {
  const mapId = presetId(id);
  const preset = clone(WORLD_ARENA_PRESETS[mapId]);
  const blockers = [];
  const obstacles = [];
  const countSpread = preset.obstacleCount.max - preset.obstacleCount.min + 1;
  const count = preset.obstacleCount.min + Math.floor(random01(`${options.seed}:${mapId}:count`) * countSpread);
  const obstacleIds = mapId === "toxic-pond"
    ? ["toxic-barrel-cluster", "flooded-debris", "barricade", "ruined-wall"]
    : mapId === "icy-mountain"
      ? ["ice-boulder", "ruined-wall", "vehicle-shell", "barricade"]
      : mapId === "fiery-inferno"
        ? ["lava-vent", "ruined-wall", "vehicle-shell", "barricade"]
        : ["barricade", "ruined-wall", "vehicle-shell", "flooded-debris"];

  for (let attempt = 0; obstacles.length < count && attempt < count * 8; attempt += 1) {
    const index = attempt;
    const obstacleId = obstacleIds[index % obstacleIds.length];
    const laneOffset = preset.pathWidth * 0.95;
    const ring = 34 + (obstacles.length % 5) * 13 + Math.floor(attempt / count) * 5 + random01(`${options.seed}:${mapId}:ring:${index}`) * 7;
    const angle = attempt * 2.399963 + random01(`${options.seed}:${mapId}:angle:${index}`) * 0.38;
    const candidate = {
      id: `${obstacleId}:${obstacles.length}`,
      type: obstacleId,
      x: Number((Math.cos(angle) * ring + Math.sign(Math.cos(angle) || 1) * laneOffset).toFixed(3)),
      z: Number((Math.sin(angle) * ring + Math.sign(Math.sin(angle) || 1) * laneOffset).toFixed(3)),
      radius: Number((getEnvironmentDefinition(obstacleId).footprint.width * 0.5 + 0.7).toFixed(3)),
    };
    if (Math.abs(candidate.x) < preset.pathWidth * 0.8 || Math.abs(candidate.z) < preset.pathWidth * 0.8 || collides(candidate, blockers)) continue;
    blockers.push(candidate);
    obstacles.push({ ...candidate, variant: seededVariant(`${options.seed}:${index}`, obstacleId) });
  }

  const supplyDistance = preset.supplySeparation / 2;
  const supplies = [
    { id: "gun-upgrade-station", x: -supplyDistance, z: -preset.landmarkSpacing * 0.62, radius: 1.7 },
    { id: "ammunition-supply-crate", x: supplyDistance, z: preset.landmarkSpacing * 0.62, radius: 1.6 },
  ];
  const objective = { id: "shared-upgrade-chest", x: 0, z: -preset.chestObjectiveSafetyRadius, radius: 2.2 };
  const boundaries = (preset.boundaryFeatures || []).map((feature, index) => ({
    id: `${mapId}:boundary:${index}`,
    type: feature.type,
    kind: feature.kind,
    x: feature.x,
    z: feature.z,
    width: feature.width,
    depth: feature.depth,
    height: feature.height,
    rotation: feature.rotation,
    palette: feature.palette,
    visualDefinition: feature.visualDefinition,
    blocksPlayers: true,
    radius: Number((Math.max(feature.width, feature.depth) * 0.5).toFixed(3)),
  }));
  return {
    mapId,
    preset,
    blockers: [...blockers, ...supplies, objective],
    boundaries,
    obstacles,
    supplies,
    objective,
    navigation: {
      lanes: [
        { id: "north-south", axis: "z", width: preset.pathWidth, x: 0 },
        { id: "east-west", axis: "x", width: preset.pathWidth, z: 0 },
      ],
      spawnClearZones: [
        { id: "alpha", x: -preset.spawnClearance, z: 0, radius: preset.spawnClearance },
        { id: "bravo", x: preset.spawnClearance, z: 0, radius: preset.spawnClearance },
      ],
    },
  };
}
