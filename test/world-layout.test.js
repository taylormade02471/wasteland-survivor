import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  BIOME_KEYS,
  LANDMARK_IDS,
  createTerrainGrid,
  createConnectedWorldLayout,
  createWorldScatter,
  resolveWorldMovement,
  sampleWorldElevation,
} from "../public/world-layout.mjs";

function walkRoute(layout, route, stepSize = 2) {
  let state = { x: route[0].x, y: sampleWorldElevation(layout, route[0]), z: route[0].z };
  for (const waypoint of route.slice(1)) {
    const distance = Math.hypot(waypoint.x - state.x, waypoint.z - state.z);
    const steps = Math.max(1, Math.ceil(distance / stepSize));
    const start = { ...state };
    for (let step = 1; step <= steps; step++) {
      const desired = {
        x: start.x + (waypoint.x - start.x) * step / steps,
        z: start.z + (waypoint.z - start.z) * step / steps,
      };
      const result = resolveWorldMovement(layout, state, desired);
      assert.equal(result.blocked, false, `route blocked near ${desired.x},${desired.z}`);
      state = result.position;
    }
  }
  return state;
}

test("connected world includes all requested biomes and traversal landmarks", () => {
  const layout = createConnectedWorldLayout();
  assert.deepEqual(BIOME_KEYS, ["inferno", "ice", "desert", "city"]);
  assert.equal(layout.size, 520);
  for (const biome of BIOME_KEYS) {
    assert.ok(layout.biomes.some(zone => zone.id === biome), `missing ${biome}`);
  }
  for (const id of LANDMARK_IDS) {
    assert.ok(layout.landmarks.some(landmark => landmark.id === id), `missing ${id}`);
  }
  assert.ok(layout.roads.length >= 8);
  assert.ok(layout.bridges.some(bridge => bridge.overpass));
  assert.ok(layout.tunnels.some(tunnel => tunnel.underMountain));
});

test("world elevation supports climbable mountain ramps and cave floors", () => {
  const layout = createConnectedWorldLayout();
  const base = sampleWorldElevation(layout, { x: 0, z: 0 });
  const ridge = sampleWorldElevation(layout, { x: -116, z: -150 });
  const cave = sampleWorldElevation(layout, { x: -164, z: -112 });
  assert.ok(ridge > base + 5);
  assert.ok(cave < ridge - 4);
});

test("terrain grid renders the same continuous elevation model used by movement", () => {
  const layout = createConnectedWorldLayout();
  const first = createTerrainGrid(layout, { segments: 32 });
  const second = createTerrainGrid(layout, { segments: 32 });
  assert.deepEqual(first, second);
  assert.equal(first.positions.length, 33 * 33 * 3);
  assert.equal(first.indices.length, 32 * 32 * 6);
  const heights = first.positions.filter((_, index) => index % 3 === 1);
  assert.ok(Math.max(...heights) >= 9);
  assert.ok(new Set(heights).size > 20);
});

test("road routes connect the spawn hub to every biome without crossing a blocker", () => {
  const layout = createConnectedWorldLayout();
  assert.equal(Object.keys(layout.travelRoutes).length, BIOME_KEYS.length);
  for (const biome of BIOME_KEYS) {
    const destination = walkRoute(layout, layout.travelRoutes[biome]);
    assert.equal(destination && layout.travelRoutes[biome].at(-1).biome, biome);
  }
});

test("overpass supports a high deck route and a separate ground-level underpass", () => {
  const layout = createConnectedWorldLayout();
  const underpass = walkRoute(layout, [{ x: -36, z: 42 }, { x: 36, z: 42 }]);
  assert.ok(underpass.y < 1, `underpass height was ${underpass.y}`);

  const overpass = walkRoute(layout, [{ x: 0, z: -18 }, { x: 0, z: 42 }]);
  assert.ok(overpass.y > 7, `overpass height was ${overpass.y}`);
});

test("world scatter is deterministic and keeps traversal corridors clear", () => {
  const layout = createConnectedWorldLayout();
  const first = createWorldScatter(layout, { seed: "nightfall", count: 90 });
  const second = createWorldScatter(layout, { seed: "nightfall", count: 90 });
  assert.deepEqual(first, second);
  assert.equal(first.length, 90);
  assert.ok(first.every(item => item.pathClearance >= 3));
});

test("destroyed cars are deterministic physical obstacles rather than visual-only props", () => {
  const layout = createConnectedWorldLayout();
  assert.equal(layout.cars.length, 28);
  const car = layout.cars[0];
  const result = resolveWorldMovement(layout, { x: car.x - 8, y: 0, z: car.z }, car);
  assert.equal(result.blocked, true);
  assert.ok(result.position.x < car.x);
});

test("game renderer consumes terrain and structure data with instanced clutter", () => {
  const game = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");
  assert.match(game, /createTerrainGrid/);
  assert.match(game, /createWorldScatter/);
  assert.match(game, /worldLayout\.structures/);
  assert.match(game, /worldLayout\.ramps/);
  assert.match(game, /new THREE\.InstancedMesh/);
});

test("movement resolver clamps borders, blocks solid landmarks, and allows roads under overpass", () => {
  const layout = createConnectedWorldLayout();
  const border = resolveWorldMovement(layout, { x: 0, y: 0, z: 0 }, { x: 999, z: 999 });
  assert.equal(border.blocked, true);
  assert.ok(border.position.x <= layout.bounds.max - layout.playerRadius);
  assert.ok(border.position.z <= layout.bounds.max - layout.playerRadius);

  const wall = resolveWorldMovement(layout, { x: 151, y: 0, z: -2 }, { x: 166, z: -2 });
  assert.equal(wall.blocked, true);
  assert.ok(wall.position.x < 160);

  const underpass = resolveWorldMovement(layout, { x: -16, y: 0, z: 42 }, { x: 16, z: 42 });
  assert.equal(underpass.blocked, false);
  assert.ok(underpass.position.x > 10);
  assert.ok(underpass.position.y < 1);
});
