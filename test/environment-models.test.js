import assert from "node:assert/strict";
import test from "node:test";

import {
  ENVIRONMENT_ANIMATION_STATES,
  ENVIRONMENT_MODEL_IDS,
  LOBBY_LOADOUT_VISUAL_CONTRACT,
  MOBILE_ENVIRONMENT_BUDGET,
  SUPPLY_STATION_IDS,
  WAYPOINT_ARROW_DESCRIPTOR,
  WORLD_ARENA_PRESETS,
  createEnvironmentModel,
  createSupplyStationModel,
  createUpgradeChestModel,
  getEnvironmentDefinition,
  getSupplyStationDefinition,
  sampleArenaPlacements,
  sampleEnvironmentAnimation,
  sampleWaypointArrow,
  seededVariant,
} from "../public/environment-models.mjs";

const REQUIRED_OBSTACLES = ["barricade", "ruined-wall", "vehicle-shell", "toxic-barrel-cluster", "ice-boulder", "lava-vent", "flooded-debris"];

function createFakeThree() {
  class Object3D {
    constructor() {
      this.children = [];
      this.name = "";
      this.position = { x: 0, y: 0, z: 0, set: (x = 0, y = 0, z = 0) => Object.assign(this.position, { x, y, z }) };
      this.rotation = { x: 0, y: 0, z: 0, set: (x = 0, y = 0, z = 0) => Object.assign(this.rotation, { x, y, z }) };
      this.scale = { x: 1, y: 1, z: 1, set: (x = 1, y = x, z = x) => Object.assign(this.scale, { x, y, z }) };
      this.userData = {};
      this.castShadow = false;
      this.receiveShadow = false;
    }
    add(...children) {
      this.children.push(...children);
      return this;
    }
  }
  class Group extends Object3D {}
  class Mesh extends Object3D {
    constructor(geometry, material) {
      super();
      this.geometry = geometry;
      this.material = material;
    }
  }
  class Geometry {
    constructor(type, args) {
      this.type = type;
      this.args = args;
    }
  }
  class MeshStandardMaterial {
    constructor(options) {
      this.options = options;
    }
  }
  return {
    Group,
    Mesh,
    MeshStandardMaterial,
    BoxGeometry: class BoxGeometry extends Geometry { constructor(...args) { super("BoxGeometry", args); } },
    ConeGeometry: class ConeGeometry extends Geometry { constructor(...args) { super("ConeGeometry", args); } },
    CylinderGeometry: class CylinderGeometry extends Geometry { constructor(...args) { super("CylinderGeometry", args); } },
    SphereGeometry: class SphereGeometry extends Geometry { constructor(...args) { super("SphereGeometry", args); } },
  };
}

function assertFiniteTree(value, path = "animation") {
  if (typeof value === "number") {
    assert.equal(Number.isFinite(value), true, `${path} is finite`);
    assert.ok(value >= -3 && value <= 3, `${path} is bounded`);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) assertFiniteTree(child, `${path}.${key}`);
}

test("exports seven modular obstacle definitions with colliders footprints and budgets", () => {
  assert.deepEqual(ENVIRONMENT_MODEL_IDS, REQUIRED_OBSTACLES);

  const biomes = new Set();
  for (const id of ENVIRONMENT_MODEL_IDS) {
    const definition = getEnvironmentDefinition(id);
    assert.equal(definition.id, id);
    assert.ok(definition.displayName.length > 0);
    assert.ok(definition.silhouetteTag.length > 0);
    assert.ok(["wasteland", "toxic", "ice", "lava", "flooded"].includes(definition.biome));
    assert.ok(definition.collider.kind);
    assert.ok(definition.collider.blocksPlayers);
    assert.ok(definition.footprint.width > 0);
    assert.ok(definition.footprint.depth > 0);
    assert.ok(definition.budget.triangles <= MOBILE_ENVIRONMENT_BUDGET.triangles);
    assert.ok(definition.budget.materials <= MOBILE_ENVIRONMENT_BUDGET.materials);
    biomes.add(definition.biome);
  }

  assert.ok(biomes.has("toxic"));
  assert.ok(biomes.has("ice"));
  assert.ok(biomes.has("lava"));
});

test("seeded variants are deterministic and mesh factories create distinct readable cover silhouettes", () => {
  const THREE = createFakeThree();
  const signatures = new Set();

  assert.deepEqual(seededVariant("room-a", "barricade"), seededVariant("room-a", "barricade"));
  assert.notDeepEqual(seededVariant("room-a", "barricade"), seededVariant("room-b", "barricade"));

  for (const id of ENVIRONMENT_MODEL_IDS) {
    const variant = seededVariant("test-seed", id);
    const model = createEnvironmentModel(THREE, id, { seed: "test-seed" });
    assert.equal(model.root.name, `environment:${id}`);
    assert.equal(model.metadata.id, id);
    assert.deepEqual(model.variant, variant);
    assert.ok(model.parts.root);
    assert.ok(model.parts.colliderMarker);
    assert.ok(model.collider.blocksPlayers);
    assert.ok(model.budget.triangles <= MOBILE_ENVIRONMENT_BUDGET.triangles);

    const meshes = [];
    const visit = (node) => {
      if (node.geometry) meshes.push(`${node.name}:${node.geometry.type}:${node.geometry.args.join(",")}`);
      for (const child of node.children || []) visit(child);
    };
    visit(model.root);
    assert.ok(meshes.length >= 3, `${id} has modular authored mesh pieces`);
    signatures.add(meshes.join("|"));
  }

  assert.equal(signatures.size, ENVIRONMENT_MODEL_IDS.length);
});

test("shared upgrade chest exposes lid glow and two-user interaction markers", () => {
  const THREE = createFakeThree();
  const chest = createUpgradeChestModel(THREE, { seed: "shared-room" });

  assert.equal(chest.root.name, "environment:upgrade-chest");
  assert.ok(chest.parts.lid);
  assert.ok(chest.parts.glow);
  assert.ok(chest.parts.playerOneMarker);
  assert.ok(chest.parts.playerTwoMarker);
  assert.equal(chest.interactionMarkers.length, 2);
  assert.notDeepEqual(chest.interactionMarkers[0], chest.interactionMarkers[1]);
  assert.ok(chest.collider.blocksPlayers);
  assert.ok(chest.budget.triangles <= MOBILE_ENVIRONMENT_BUDGET.triangles);
});

test("pure animation sampler covers biome motion beacon chest opening and hit reaction", () => {
  assert.deepEqual(ENVIRONMENT_ANIMATION_STATES, ["waterBob", "toxicPulse", "iceSparkle", "heatVent", "beacon", "chestOpen", "hitReaction"]);

  const inputs = [
    { state: "waterBob", time: 0.5 },
    { state: "toxicPulse", time: 0.5, intensity: 0.8 },
    { state: "iceSparkle", time: 0.5, intensity: 0.7 },
    { state: "heatVent", time: 0.5, intensity: 1 },
    { state: "beacon", time: 0.5, objective: 1 },
    { state: "chestOpen", time: 0.5, open: 1 },
    { state: "hitReaction", time: 0.5, hit: 1 },
  ];

  for (const input of inputs) {
    const first = sampleEnvironmentAnimation("toxic-barrel-cluster", input);
    const second = sampleEnvironmentAnimation("toxic-barrel-cluster", input);
    assert.deepEqual(first, second);
    assert.equal(first.state, input.state);
    assertFiniteTree(first);
  }
});

test("supply station factories build readable distinct gun-upgrade and ammunition silhouettes", () => {
  const THREE = createFakeThree();
  assert.deepEqual(SUPPLY_STATION_IDS, ["gun-upgrade-station", "ammunition-supply-crate"]);

  const upgrade = getSupplyStationDefinition("gun-upgrade-station");
  const ammo = getSupplyStationDefinition("ammunition-supply-crate");
  assert.equal(upgrade.role, "weapon-upgrade");
  assert.equal(ammo.role, "ammunition");
  assert.notEqual(upgrade.silhouetteTag, ammo.silhouetteTag);
  assert.notEqual(upgrade.palette.accent, ammo.palette.accent);
  assert.ok(upgrade.palette.accent === "#e2ad42" || upgrade.palette.glow === "#67df70");
  assert.ok(ammo.palette.accent === "#d8dcc6" || ammo.palette.metal === "#4f6046");

  const upgradeModel = createSupplyStationModel(THREE, "gun-upgrade-station", { seed: "arena-17" });
  const ammoModel = createSupplyStationModel(THREE, "ammunition-supply-crate", { seed: "arena-17" });
  for (const model of [upgradeModel, ammoModel]) {
    assert.equal(model.collider.blocksPlayers, true);
    assert.ok(model.footprint.width > 0.8);
    assert.ok(model.budget.triangles <= MOBILE_ENVIRONMENT_BUDGET.triangles);
    assert.ok(model.parts.root);
    assert.ok(model.parts.socket);
    assert.ok(model.parts.interactionMarker);
    assert.equal(model.interaction.socket.kind, model.metadata.role);
    assert.ok(model.interaction.marker.radius >= 0.75);
  }

  const signature = (model) => model.root.children.flatMap((child) => child.children.length ? child.children.map((mesh) => mesh.name) : child.name).join("|");
  assert.notEqual(signature(upgradeModel), signature(ammoModel));
  assert.deepEqual(createSupplyStationModel(THREE, "gun-upgrade-station", { seed: "arena-17" }).variant, upgradeModel.variant);
});

test("waypoint arrow samples restrained distance-aware guidance without center-screen dominance", () => {
  assert.equal(WAYPOINT_ARROW_DESCRIPTOR.kind, "supply-waypoint-chevron");
  assert.equal(WAYPOINT_ARROW_DESCRIPTOR.accessibility.icon, "chevron");
  assert.match(WAYPOINT_ARROW_DESCRIPTOR.accessibility.labelTemplate, /\{supplyName\}/);

  const onscreen = sampleWaypointArrow({
    player: { x: 0, z: 0, heading: 0 },
    target: { x: 12, z: -8 },
    viewport: { width: 390, height: 844 },
    supplyName: "Ammo",
  });
  const offscreen = sampleWaypointArrow({
    player: { x: 0, z: 0, heading: Math.PI },
    target: { x: 90, z: 0 },
    viewport: { width: 390, height: 844 },
    supplyName: "Ammo",
  });
  const near = sampleWaypointArrow({
    player: { x: 0, z: 0, heading: 0 },
    target: { x: 1.2, z: 0.5 },
    viewport: { width: 390, height: 844 },
    supplyName: "Ammo",
  });

  assert.deepEqual(onscreen, sampleWaypointArrow({
    player: { x: 0, z: 0, heading: 0 },
    target: { x: 12, z: -8 },
    viewport: { width: 390, height: 844 },
    supplyName: "Ammo",
  }));
  assert.equal(onscreen.visible, true);
  assert.equal(onscreen.offscreen, false);
  assert.ok(onscreen.ui.x >= 32 && onscreen.ui.x <= 358);
  assert.ok(onscreen.ui.y >= 32 && onscreen.ui.y <= 812);
  assert.ok(onscreen.ui.scale <= 0.82);
  assert.equal(offscreen.offscreen, true);
  assert.ok(offscreen.ui.x === 32 || offscreen.ui.x === 358 || offscreen.ui.y === 32 || offscreen.ui.y === 812);
  assert.equal(near.visible, false);
  assert.ok(near.opacity < 0.25);
});

test("expanded arena presets produce deterministic non-overlapping placements with navigable lanes", () => {
  assert.deepEqual(Object.keys(WORLD_ARENA_PRESETS).sort(), ["fiery-inferno", "icy-mountain", "toxic-pond", "wasteland"].sort());

  for (const [id, preset] of Object.entries(WORLD_ARENA_PRESETS)) {
    assert.ok(preset.playableBounds.radius >= 96, `${id} uses larger bounds`);
    assert.ok(preset.spawnClearance >= 18);
    assert.ok(preset.landmarkSpacing >= 28);
    assert.ok(preset.pathWidth >= 7);
    assert.ok(preset.supplySeparation >= 30);
    assert.ok(preset.chestObjectiveSafetyRadius >= 16);
    assert.ok(preset.mobileRenderBudget.drawGroups <= 70);

    const first = sampleArenaPlacements(id, { seed: "lanes-1" });
    const second = sampleArenaPlacements(id, { seed: "lanes-1" });
    assert.deepEqual(first, second);
    assert.equal(first.mapId, id);
    assert.ok(first.obstacles.length >= preset.obstacleCount.min);
    assert.ok(first.obstacles.length <= preset.obstacleCount.max);
    assert.ok(first.supplies.length >= 2);
    assert.ok(first.navigation.lanes.every((lane) => lane.width >= preset.pathWidth));

    for (let a = 0; a < first.blockers.length; a += 1) {
      for (let b = a + 1; b < first.blockers.length; b += 1) {
        const left = first.blockers[a];
        const right = first.blockers[b];
        const distance = Math.hypot(left.x - right.x, left.z - right.z);
        assert.ok(distance >= left.radius + right.radius + 1.5, `${id} blockers do not overlap`);
      }
    }
  }
});

test("lobby loadout visual contract stays slim combined and controller friendly", () => {
  const contract = LOBBY_LOADOUT_VISUAL_CONTRACT;
  assert.equal(contract.version, 1);
  assert.equal(contract.backdropTreatment, "cinematic-backdrop-with-restrained-plates");
  assert.deepEqual(contract.prohibitedPatterns, ["nested-cards", "blocky-grid-panels", "giant-center-overlay"]);
  assert.ok(contract.desktop.profileRail.maxWidth <= 280);
  assert.ok(contract.mobile.profileRail.maxHeight <= 74);
  assert.ok(contract.loadoutRibbon.drawer.maxHeight <= 180);
  assert.ok(contract.backingPlate.opacity <= 0.72);
  assert.deepEqual(contract.controllerFocus.order, ["profile-rail", "mode-strip", "loadout-ribbon", "floating-primary", "floating-secondary"]);
  assert.equal(contract.modeStrip.presentation, "compact-segmented-strip");
  assert.equal(contract.loadoutRibbon.presentation, "integrated-ribbon-drawer");
});
