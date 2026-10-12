export const SIMPLE_WORLD_PROP_IDS = Object.freeze([
  "metal-trash-can",
  "broken-chair",
  "scavenger-table",
  "street-dumpster",
  "tire-stack",
  "traffic-cone",
  "tanker-car",
]);

const WORLD_FIELD_ASSETS = Object.freeze({
  "burnt-car-wreck": {
    label: "Burnt Car Wreck",
    runtimePath: "./assets/nightfall/aaa/world/meshy/burnt-car-wreck-meshy-v2.glb",
    fit: { maxDimension: 7.2 },
    collider: { radius: 3.1, height: 1.8, blocksPlayers: true },
  },
  "collapsed-building": {
    label: "Collapsed Building",
    runtimePath: "./assets/nightfall/aaa/world/meshy/collapsed-building-meshy-v1.glb",
    fit: { maxDimension: 22 },
    collider: { radius: 8.2, height: 8, blocksPlayers: true },
  },
  "ruined-utility-outpost": {
    label: "Ruined Utility Outpost",
    runtimePath: "./assets/nightfall/aaa/world/meshy/ruined-utility-outpost-meshy-v1.glb",
    fit: { maxDimension: 17 },
    collider: { radius: 6.5, height: 6.8, blocksPlayers: true },
  },
  "water-tower": {
    label: "Rusted Water Tower",
    runtimePath: "./assets/nightfall/aaa/world/meshy/water-tower-meshy-v1.glb",
    fit: { maxDimension: 12 },
    collider: { radius: 4.7, height: 11, blocksPlayers: true },
  },
  "blown-up-bus": {
    label: "Blown-up Civilian Bus",
    runtimePath: "./assets/nightfall/aaa/world/meshy/blown-up-bus-meshy-v1.glb",
    fit: { maxDimension: 12 },
    collider: { radius: 5, height: 3.2, blocksPlayers: true },
  },
  "ruined-railway-track": {
    label: "Ruined Railway Track",
    runtimePath: "./assets/nightfall/aaa/world/meshy/ruined-railway-track-meshy-v1.glb",
    fit: { maxDimension: 18 },
    collider: { radius: 7, height: 0.8, blocksPlayers: false },
  },
  "destroyed-barrels": {
    label: "Destroyed Toxic Barrels",
    runtimePath: "./assets/nightfall/aaa/world/meshy/destroyed-barrels-meshy-v2.glb",
    fit: { maxDimension: 4.6 },
    collider: { radius: 2, height: 2.2, blocksPlayers: true },
  },
  "rusty-locomotive": {
    label: "Rusty Locomotive",
    runtimePath: "./assets/nightfall/aaa/world/meshy/rusty-locomotive-meshy-v1.glb",
    fit: { maxDimension: 16 },
    collider: { radius: 6.6, height: 4.8, blocksPlayers: true },
  },
  "metal-trash-can": {
    label: "Dented Trash Can",
    runtimePath: "./assets/nightfall/aaa/world/meshy/props/metal-trash-can-v1.glb",
    fit: { maxDimension: 1.25 },
    collider: { radius: 0.46, height: 1.15, blocksPlayers: false },
  },
  "broken-chair": {
    label: "Broken Chair",
    runtimePath: "./assets/nightfall/aaa/world/meshy/props/broken-chair-v1.glb",
    fit: { maxDimension: 1.15 },
    collider: { radius: 0.55, height: 1.05, blocksPlayers: false },
  },
  "scavenger-table": {
    label: "Scavenger Work Table",
    runtimePath: "./assets/nightfall/aaa/world/meshy/props/scavenger-table-v1.glb",
    fit: { maxDimension: 2.4 },
    collider: { radius: 1.15, height: 1.1, blocksPlayers: true },
  },
  "street-dumpster": {
    label: "Rusted Street Dumpster",
    runtimePath: "./assets/nightfall/aaa/world/meshy/props/street-dumpster-v1.glb",
    fit: { maxDimension: 2.8 },
    collider: { radius: 1.35, height: 1.55, blocksPlayers: true },
  },
  "tire-stack": {
    label: "Abandoned Tire Stack",
    runtimePath: "./assets/nightfall/aaa/world/meshy/props/tire-stack-v1.glb",
    fit: { maxDimension: 1.5 },
    collider: { radius: 0.75, height: 1.1, blocksPlayers: false },
  },
  "traffic-cone": {
    label: "Faded Traffic Cone",
    runtimePath: "./assets/nightfall/aaa/world/meshy/props/traffic-cone-v1.glb",
    fit: { maxDimension: 0.85 },
    collider: { radius: 0.3, height: 0.8, blocksPlayers: false },
  },
  "tanker-car": {
    label: "Ruptured Tanker Car",
    runtimePath: "./assets/nightfall/aaa/world/meshy/props/tanker-car-v1.glb",
    fit: { maxDimension: 13.5 },
    collider: { radius: 5.6, height: 4.2, blocksPlayers: true },
  },
  "rail-signal": {
    label: "Railway Signal",
    runtimePath: "./assets/nightfall/aaa/world/meshy/props/rail-signal-v1.glb",
    fit: { maxDimension: 7.2 },
    collider: { radius: 0.8, height: 6.8, blocksPlayers: false },
  },
  "wrecked-pickup": {
    label: "Wrecked Pickup",
    runtimePath: "./assets/nightfall/aaa/world/meshy/props/wrecked-pickup-v1.glb",
    fit: { maxDimension: 6.2 },
    collider: { radius: 2.8, height: 1.9, blocksPlayers: true },
  },
});

export const WORLD_FIELD_ASSET_IDS = Object.freeze(Object.keys(WORLD_FIELD_ASSETS));

const PLACEMENTS = Object.freeze([
  { id: "city-collapse", assetId: "collapsed-building", x: 150, z: -196, rotation: -0.18 },
  { id: "desert-outpost", assetId: "ruined-utility-outpost", x: 184, z: 184, rotation: 0.22 },
  { id: "toxic-water-tower", assetId: "water-tower", x: -188, z: -126, rotation: -0.18 },
  { id: "city-bus", assetId: "blown-up-bus", x: 72, z: -82, rotation: 0.48 },
  { id: "inferno-track", assetId: "ruined-railway-track", x: -154, z: 92, rotation: 0.12 },
  { id: "inferno-locomotive", assetId: "rusty-locomotive", x: -157, z: 96, rotation: 0.12 },
  { id: "inferno-signal", assetId: "rail-signal", x: -143, z: 105, rotation: 0.12 },
  { id: "ice-tanker", assetId: "tanker-car", x: -76, z: -202, rotation: -0.31 },
  { id: "toxic-barrels-a", assetId: "destroyed-barrels", x: 104, z: 52, rotation: 0.8 },
  { id: "toxic-barrels-b", assetId: "destroyed-barrels", x: 118, z: 65, rotation: -0.32 },
  { id: "city-car-a", assetId: "burnt-car-wreck", x: 56, z: -62, rotation: 0.34 },
  { id: "city-pickup", assetId: "wrecked-pickup", x: 85, z: -66, rotation: -0.28 },
  { id: "desert-car-a", assetId: "burnt-car-wreck", x: 72, z: 82, rotation: -0.61 },
  { id: "city-dumpster", assetId: "street-dumpster", x: 122, z: -128, rotation: 0.08 },
  { id: "armory-dumpster", assetId: "street-dumpster", x: -72, z: 178, rotation: -0.4 },
  { id: "outpost-table", assetId: "scavenger-table", x: 174, z: 172, rotation: 0.2 },
  { id: "library-table", assetId: "scavenger-table", x: 96, z: -160, rotation: -0.36 },
  { id: "chair-a", assetId: "broken-chair", x: 98, z: -156, rotation: 1.08 },
  { id: "chair-b", assetId: "broken-chair", x: 171, z: 170, rotation: -0.78 },
  { id: "trash-a", assetId: "metal-trash-can", x: 42, z: -44, rotation: 0.2 },
  { id: "trash-b", assetId: "metal-trash-can", x: 112, z: -132, rotation: -0.1 },
  { id: "trash-c", assetId: "metal-trash-can", x: -66, z: 172, rotation: 0.48 },
  { id: "tires-a", assetId: "tire-stack", x: 64, z: -72, rotation: 0.15 },
  { id: "tires-b", assetId: "tire-stack", x: -92, z: 168, rotation: -0.22 },
  { id: "cone-a", assetId: "traffic-cone", x: 10, z: -36, rotation: 0 },
  { id: "cone-b", assetId: "traffic-cone", x: 14, z: -42, rotation: 0.2 },
  { id: "cone-c", assetId: "traffic-cone", x: 18, z: -48, rotation: -0.15 },
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getWorldFieldAsset(id) {
  const asset = WORLD_FIELD_ASSETS[id];
  if (!asset) throw new RangeError(`Unknown world field asset: ${id}`);
  return { id, ...clone(asset) };
}

export function getWorldFieldPlacements() {
  return clone(PLACEMENTS);
}
