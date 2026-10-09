export const BIOME_KEYS = Object.freeze(["inferno", "ice", "desert", "city"]);

export const LANDMARK_IDS = Object.freeze([
  "burned-forest",
  "looted-armory",
  "ruined-library",
  "ash-castle",
  "white-house-ruin",
  "pentagon-ruin",
  "mountain-caves",
  "underpass-overpass",
  "downtown-skyscrapers",
  "desert-houses",
]);

const WORLD_SIZE = 520;
const WORLD_HALF = WORLD_SIZE / 2;
const PLAYER_RADIUS = 1.25;

const rect = (id, x, z, w, d, extras = {}) => Object.freeze({ id, x, z, w, d, ...extras });
const point = (x, z, biome = null) => Object.freeze({ x, z, ...(biome ? { biome } : {}) });

function containsRect(area, target, padding = 0) {
  return Math.abs(target.x - area.x) <= area.w / 2 + padding && Math.abs(target.z - area.z) <= area.d / 2 + padding;
}

function distanceToRect(area, target) {
  const dx = Math.max(Math.abs(target.x - area.x) - area.w / 2, 0);
  const dz = Math.max(Math.abs(target.z - area.z) - area.d / 2, 0);
  return Math.hypot(dx, dz);
}

function distanceToSegment(segment, target) {
  const dx = segment.x2 - segment.x1;
  const dz = segment.z2 - segment.z1;
  const lengthSq = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((target.x - segment.x1) * dx + (target.z - segment.z1) * dz) / lengthSq));
  return Math.hypot(target.x - (segment.x1 + dx * t), target.z - (segment.z1 + dz * t));
}

function inLinearBand(segment, target, padding = 0) {
  return distanceToSegment(segment, target) <= segment.width / 2 + padding;
}

function seededRandom(seed) {
  let state = 2166136261;
  for (const character of String(seed)) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function buildStructures() {
  const structures = [
    rect("armory-shell", -86, 184, 34, 24, { h: 5, color: 0x4a4038, kind: "armory", damaged: true }),
    rect("library-shell", 112, -170, 38, 32, { h: 7, color: 0x555b5c, kind: "library", damaged: true }),
    rect("castle-keep", -202, 18, 44, 36, { h: 9, color: 0x4b4844, kind: "castle", damaged: true }),
    rect("civic-house-shell", 166, -2, 40, 30, { h: 6, color: 0xd6d0c5, kind: "civic", damaged: true }),
    rect("pentagon-shell", 178, -90, 54, 46, { h: 5, color: 0x7b746d, rotation: .28, kind: "pentagon", damaged: true }),
  ];
  for (let index = 0; index < 9; index++) {
    structures.push(rect(`tower-${index + 1}`, 132 + (index % 3) * 34, -210 + Math.floor(index / 3) * 34, 14, 14, {
      h: 18 + (index % 4) * 7,
      color: 0x34383d,
      kind: "tower",
      damaged: true,
    }));
  }
  for (let index = 0; index < 12; index++) {
    structures.push(rect(`house-${index + 1}`, 126 + (index % 4) * 24, 126 + Math.floor(index / 4) * 24, 14, 11, {
      h: 4,
      color: 0x8b7054,
      rotation: index % 2 ? .12 : -.16,
      kind: "house",
      damaged: index % 3 === 0,
    }));
  }
  return Object.freeze(structures);
}

function buildCars(fields) {
  const cars = [];
  fields.filter(item => item.type === "cars").forEach((field, fieldIndex) => {
    const columns = 4;
    for (let index = 0; index < field.count; index++) {
      const x = field.x - field.w / 2 + 7 + index % columns * ((field.w - 14) / (columns - 1));
      const z = field.z - field.d / 2 + 5 + Math.floor(index / columns) * 8;
      cars.push(rect(`wreck-${fieldIndex + 1}-${index + 1}`, x, z, 4.2, 7.6, {
        h: 1.7,
        color: fieldIndex ? 0x9c8f72 : 0x6e1f1f,
        rotation: index * .37,
        crushed: index % 5 === 0,
      }));
    }
  });
  return Object.freeze(cars);
}

export function createConnectedWorldLayout() {
  const bounds = Object.freeze({ min: -WORLD_HALF, max: WORLD_HALF });
  const biomes = Object.freeze([
    rect("inferno", -130, 130, 250, 250, { label: "Fire Inferno", tint: 0x7d1d12, ground: 0x3b1710 }),
    rect("ice", -130, -130, 250, 250, { label: "Ice Mountain", tint: 0x8fc7e8, ground: 0xd4edf4 }),
    rect("desert", 130, 130, 250, 250, { label: "Desert Wasteland", tint: 0xd6a75f, ground: 0x9a7546 }),
    rect("city", 130, -130, 250, 250, { label: "Ruined City", tint: 0x777b82, ground: 0x3d4146 }),
  ]);
  const roads = Object.freeze([
    { id: "north-south-spine", x1: 0, z1: -242, x2: 0, z2: 242, width: 14 },
    { id: "east-west-spine", x1: -242, z1: 0, x2: 242, z2: 0, width: 14 },
    { id: "inferno-desert-road", x1: -220, z1: 150, x2: 220, z2: 150, width: 11 },
    { id: "ice-city-road", x1: -220, z1: -150, x2: 220, z2: -150, width: 11 },
    { id: "mountain-pass", x1: -210, z1: -90, x2: -30, z2: -210, width: 12, ramp: true },
    { id: "ash-bridge-approach", x1: -205, z1: 58, x2: -30, z2: 12, width: 10 },
    { id: "city-underpass-road", x1: -48, z1: 42, x2: 118, z2: 42, width: 12, underpassClearance: true },
    { id: "pentagon-bypass", x1: 72, z1: -40, x2: 218, z2: -98, width: 10 },
    { id: "white-house-avenue", x1: 78, z1: -202, x2: 190, z2: -74, width: 10 },
  ]);
  const bridges = Object.freeze([
    rect("ash-river-bridge", -72, 28, 44, 13, { height: 1.2, overpass: false }),
    rect("underpass-overpass", 0, 42, 15, 28, { height: 7.5, overpass: true, clearance: 5.8 }),
  ]);
  const tunnels = Object.freeze([
    rect("mountain-caves", -162, -112, 58, 24, { underMountain: true, clearance: 4.5 }),
    rect("ice-tunnel-east", -78, -176, 76, 18, { underMountain: true, clearance: 4.2 }),
  ]);
  const ramps = Object.freeze([
    rect("mountain-ramp-west", -132, -154, 74, 26, { from: 1, to: 10, axis: "x", kind: "terrain" }),
    rect("overpass-ramp-north", 0, 10, 13, 36, { from: 0, to: 7.5, axis: "z", kind: "overpass" }),
    rect("overpass-ramp-south", 0, 74, 13, 36, { from: 7.5, to: 0, axis: "z", kind: "overpass" }),
  ]);
  const landmarks = Object.freeze([
    rect("burned-forest", -188, 132, 78, 82, { type: "forest", blocks: false, count: 34 }),
    rect("looted-armory", -86, 184, 34, 24, { type: "armory", blocks: true, enterable: true }),
    rect("ruined-library", 112, -170, 38, 32, { type: "library", blocks: true, enterable: true }),
    rect("ash-castle", -202, 18, 58, 52, { type: "castle", blocks: true, enterable: true }),
    rect("white-house-ruin", 166, -2, 40, 30, { type: "civic", blocks: true, enterable: false }),
    rect("pentagon-ruin", 178, -90, 54, 46, { type: "civic", sides: 5, blocks: true }),
    rect("downtown-skyscrapers", 172, -172, 98, 98, { type: "skyscrapers", blocks: false, towers: 9 }),
    rect("desert-houses", 166, 156, 94, 72, { type: "houses", blocks: false, houses: 12 }),
    rect("mountain-caves", -162, -112, 58, 24, { type: "caves", blocks: false }),
    rect("underpass-overpass", 0, 42, 68, 15, { type: "overpass", blocks: false }),
  ]);
  const structures = buildStructures();
  const detail = Object.freeze([
    rect("car-field-city", 58, -74, 82, 30, { type: "cars", count: 16 }),
    rect("car-field-desert", 82, 82, 74, 28, { type: "cars", count: 12 }),
    rect("inferno-lava-river", -126, 78, 190, 12, { type: "hazardRiver" }),
    rect("ice-ravine", -116, -66, 150, 10, { type: "ravine" }),
  ]);
  const cars = buildCars(detail);
  const blockers = Object.freeze([
    ...structures.map(item => rect(item.id, item.x, item.z, item.w, item.d)),
    ...cars.map(item => rect(item.id, item.x, item.z, item.w, item.d)),
    rect("north-mountain-wall", -164, -164, 96, 54, { routePassable: true }),
    rect("city-rubble-wall", 94, -38, 72, 18),
  ]);
  const travelRoutes = Object.freeze({
    inferno: Object.freeze([point(0, 0), point(-72, 0), point(-72, 132, "inferno")]),
    ice: Object.freeze([point(0, 0), point(0, -100), point(-80, -100, "ice")]),
    desert: Object.freeze([point(0, 0), point(130, 0), point(130, 96, "desert")]),
    city: Object.freeze([point(0, 0), point(0, -150), point(80, -150, "city")]),
  });
  return Object.freeze({ size: WORLD_SIZE, playerRadius: PLAYER_RADIUS, bounds, biomes, roads, bridges, tunnels, ramps, landmarks, structures, cars, blockers, detail, travelRoutes });
}

function rampHeight(ramp, target) {
  const t = ramp.axis === "x"
    ? (target.x - (ramp.x - ramp.w / 2)) / ramp.w
    : (target.z - (ramp.z - ramp.d / 2)) / ramp.d;
  return ramp.from + (ramp.to - ramp.from) * Math.max(0, Math.min(1, t));
}

function sampleTerrainElevation(layout, target) {
  let height = 0;
  if (target.x < -52 && target.z < -54) {
    const ridge = Math.max(0, 1 - Math.hypot(target.x + 136, target.z + 144) / 106);
    height += ridge * 11;
  }
  for (const ramp of layout.ramps) {
    if (ramp.kind !== "terrain" || !containsRect(ramp, target)) continue;
    height = Math.max(height, rampHeight(ramp, target));
  }
  for (const tunnel of layout.tunnels) {
    if (containsRect(tunnel, target)) height = Math.min(height, .35);
  }
  return height;
}

export function sampleWorldElevation(layout, target) {
  let height = sampleTerrainElevation(layout, target);
  for (const ramp of layout.ramps) {
    if (!containsRect(ramp, target)) continue;
    height = Math.max(height, rampHeight(ramp, target));
  }
  for (const bridge of layout.bridges) {
    if (containsRect(bridge, target)) height = Math.max(height, bridge.height || 0);
  }
  return Number(height.toFixed(2));
}

export function createTerrainGrid(layout, { segments = 64 } = {}) {
  const safeSegments = Math.max(4, Math.round(segments));
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let zIndex = 0; zIndex <= safeSegments; zIndex++) {
    const z = layout.bounds.min + layout.size * zIndex / safeSegments;
    for (let xIndex = 0; xIndex <= safeSegments; xIndex++) {
      const x = layout.bounds.min + layout.size * xIndex / safeSegments;
      positions.push(Number(x.toFixed(3)), Number(sampleTerrainElevation(layout, { x, z }).toFixed(3)), Number(z.toFixed(3)));
      uvs.push(xIndex / safeSegments, 1 - zIndex / safeSegments);
    }
  }
  const stride = safeSegments + 1;
  for (let zIndex = 0; zIndex < safeSegments; zIndex++) {
    for (let xIndex = 0; xIndex < safeSegments; xIndex++) {
      const topLeft = zIndex * stride + xIndex;
      const bottomLeft = topLeft + stride;
      indices.push(topLeft, bottomLeft, topLeft + 1, topLeft + 1, bottomLeft, bottomLeft + 1);
    }
  }
  return Object.freeze({ segments: safeSegments, positions: Object.freeze(positions), uvs: Object.freeze(uvs), indices: Object.freeze(indices) });
}

export function createWorldScatter(layout, { seed = "connected-world", count = 72 } = {}) {
  const random = seededRandom(seed);
  const placements = [];
  const maxAttempts = Math.max(200, count * 100);
  for (let attempt = 0; attempt < maxAttempts && placements.length < count; attempt++) {
    const x = layout.bounds.min + 10 + random() * (layout.size - 20);
    const z = layout.bounds.min + 10 + random() * (layout.size - 20);
    const target = { x, z };
    const roadClearance = Math.min(...layout.roads.map(road => distanceToSegment(road, target) - road.width / 2));
    const rampClearance = Math.min(...layout.ramps.map(ramp => distanceToRect(ramp, target)));
    const pathClearance = Math.min(roadClearance, rampClearance);
    if (pathClearance < 3 || Math.hypot(x, z) < 16) continue;
    if (layout.blockers.some(blocker => containsRect(blocker, target, 2))) continue;
    placements.push(Object.freeze({
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
      scale: Number((.8 + random() * 1.8).toFixed(2)),
      rotation: Number((random() * Math.PI * 2).toFixed(3)),
      pathClearance: Number(pathClearance.toFixed(2)),
    }));
  }
  if (placements.length !== count) throw new Error(`Unable to place ${count} world props with safe path clearance`);
  return Object.freeze(placements);
}

export function biomeAt(layout, target) {
  const direct = layout.biomes.find(biome => containsRect(biome, target));
  if (direct) return direct;
  const id = target.x <= 0
    ? (target.z >= 0 ? "inferno" : "ice")
    : (target.z >= 0 ? "desert" : "city");
  return layout.biomes.find(biome => biome.id === id);
}

function movementElevation(layout, from, position) {
  const bridge = layout.bridges.find(item => item.overpass && containsRect(item, position));
  if (bridge) return from.y >= bridge.clearance * .65 ? bridge.height : sampleTerrainElevation(layout, position);
  let height = sampleTerrainElevation(layout, position);
  for (const ramp of layout.ramps) {
    if (containsRect(ramp, position)) height = Math.max(height, rampHeight(ramp, position));
  }
  for (const bridgeItem of layout.bridges) {
    if (!bridgeItem.overpass && containsRect(bridgeItem, position)) height = Math.max(height, bridgeItem.height || 0);
  }
  return height;
}

export function resolveWorldMovement(layout, from, desired) {
  const position = {
    x: Math.max(layout.bounds.min + layout.playerRadius, Math.min(layout.bounds.max - layout.playerRadius, desired.x)),
    z: Math.max(layout.bounds.min + layout.playerRadius, Math.min(layout.bounds.max - layout.playerRadius, desired.z)),
  };
  let blocked = position.x !== desired.x || position.z !== desired.z;
  const onRoad = layout.roads.some(road => inLinearBand(road, position, layout.playerRadius));
  const onRamp = layout.ramps.some(ramp => containsRect(ramp, position, layout.playerRadius));
  const inTunnel = layout.tunnels.some(tunnel => containsRect(tunnel, position, layout.playerRadius));
  for (const blocker of layout.blockers) {
    if (!containsRect(blocker, position, layout.playerRadius)) continue;
    if (inTunnel || onRamp || (blocker.routePassable && onRoad)) continue;
    position.x = from.x;
    position.z = from.z;
    blocked = true;
    break;
  }
  const y = movementElevation(layout, from, position);
  return {
    position: { x: position.x, y: Number(y.toFixed(2)), z: position.z },
    blocked,
    biome: biomeAt(layout, position).id,
  };
}
