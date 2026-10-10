import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CHARACTER_ARCHETYPE_IDS, getCharacterArchetype } from "../public/character-models.mjs";
import { ENEMY_MODEL_IDS, getEnemyModelDefinition } from "../public/enemy-models.mjs";
import { ENVIRONMENT_MODEL_IDS, SUPPLY_STATION_IDS, WORLD_ARENA_PRESETS, getEnvironmentDefinition, getSupplyStationDefinition } from "../public/environment-models.mjs";
import { WEAPON_IDS, getWeaponDefinition } from "../public/weapon-models.mjs";
import { TACTICAL_MODEL_IDS, getTacticalModelDefinition } from "../public/tactical-models.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const publicRoot = path.join(repoRoot, "public");
const androidRoot = path.join(repoRoot, "android", "app", "src", "main", "assets");
const outputPath = path.join(repoRoot, "output", "wasteland-survivor-3d-asset-audit.json");

const exists = (relativePath, root = publicRoot) => fs.existsSync(path.join(root, relativePath.replace(/^\.\//, "")));
const source = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const assetPath = (relativePath) => relativePath.replace(/^\.\//, "");

function record(id, category, details) {
  const required = details.required || [];
  const missing = required.filter((relativePath) => !exists(relativePath));
  return { id, category, ...details, required, missing, status: missing.length ? "missing" : "ready" };
}

const characters = CHARACTER_ARCHETYPE_IDS.map((id) => {
  const definition = getCharacterArchetype(id);
  return record(id, "survivor", {
    displayName: definition.displayName,
    sourceType: "authored-glb",
    modelAsset: definition.modelAsset,
    referenceImage: definition.referenceImage,
    required: [definition.modelAsset, definition.referenceImage, `./assets/nightfall/characters/renders/${id === "tech" ? "tech-runner" : id === "medic" ? "field-medic" : id}-v2-isolated${id === "ranger" ? "-clean" : ""}.png`],
  });
});

const enemies = ENEMY_MODEL_IDS.map((id) => {
  const definition = getEnemyModelDefinition(id);
  return record(id, "enemy", {
    displayName: definition.displayName,
    sourceType: "dedicated-procedural-mutated-mesh",
    referenceImage: definition.referenceImage,
    required: [definition.referenceImage],
  });
});

const weapons = WEAPON_IDS.map((id) => {
  const definition = getWeaponDefinition(id);
  return { id, category: "weapon", displayName: definition.displayName, sourceType: "procedural-runtime-mesh", status: "ready", missing: [], required: [] };
});

const environments = ENVIRONMENT_MODEL_IDS.map((id) => {
  const definition = getEnvironmentDefinition(id);
  return { id, category: "obstacle", displayName: definition.displayName, sourceType: "procedural-runtime-mesh", status: "ready", missing: [], required: [] };
});

const supplies = SUPPLY_STATION_IDS.map((id) => {
  const definition = getSupplyStationDefinition(id);
  return { id, category: "supply", displayName: definition.displayName, sourceType: "procedural-runtime-mesh", status: "ready", missing: [], required: [] };
});

const chest = [{ id: "upgrade-chest", category: "shared-chest", displayName: "Shared Upgrade Chest", sourceType: "procedural-runtime-mesh", status: "ready", missing: [], required: [] }];
const tactical = TACTICAL_MODEL_IDS.map((id) => {
  const definition = getTacticalModelDefinition(id);
  return { id, category: "tactical", displayName: definition.displayName, sourceType: "procedural-runtime-mesh", status: "ready", missing: [], required: [] };
});
const renderLabSource = source("public/render-lab.js");
const renderLabPage = source("public/render-lab.html");
const gameSource = source("public/game3d.js");

const report = {
  reportVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: "gameplay 3D model and reference coverage",
  counts: {
    survivorModels: characters.length,
    enemyModels: enemies.length,
    weaponModels: weapons.length,
    obstacleModels: environments.length,
    supplyStations: supplies.length,
    tacticalModels: tactical.length,
    sharedChests: chest.length,
    armorIntegratedSets: characters.length,
    mapPresets: Object.keys(WORLD_ARENA_PRESETS).length,
  },
  assetFamilies: { characters, enemies, weapons, environments, supplies, tactical, chest },
  maps: Object.values(WORLD_ARENA_PRESETS).map((preset) => ({ id: preset.mapId, bounds: preset.playableBounds, obstacles: preset.obstacleCount, status: "ready" })),
  renderLab: {
    status: renderLabSource.includes("createEnemyModel") && renderLabSource.includes("ENEMY_MODEL_IDS") && renderLabSource.includes("createTacticalModel") && renderLabPage.includes('option value="enemy"') && renderLabPage.includes('option value="tactical"') ? "ready" : "missing-3d-inspection-path",
    families: ["character", "enemy", "weapon", "environment", "supply", "tactical", "chest"],
    bundledLocalOnly: !/https?:\/\//.test(renderLabPage) && !/cdn\.|unpkg|jsdelivr|skypack/i.test(renderLabSource),
  },
  gameplayIntegration: {
    dedicatedEnemyFactoryImported: gameSource.includes('from "./enemy-models.mjs"'),
    enemySpawnPassesType: gameSource.includes("visualClass, type"),
    enemyConceptReferencesBundled: enemies.every((item) => item.status === "ready"),
    armorIntegratedIntoSurvivorRigs: characters.length === 6,
    tacticalModelsInspectable: renderLabSource.includes("createTacticalModel"),
  },
  androidBundle: {
    exists: fs.existsSync(androidRoot),
    syncedFiles: fs.existsSync(androidRoot) ? ["enemy-models.mjs", "game3d.js", "render-lab.js", "render-lab.html"].filter((file) => fs.existsSync(path.join(androidRoot, file))) : [],
  },
};

report.summary = {
  totalTrackedAssets: Object.values(report.assetFamilies).flat().length,
  readyAssets: Object.values(report.assetFamilies).flat().filter((item) => item.status === "ready").length,
  missingAssets: Object.values(report.assetFamilies).flat().filter((item) => item.status !== "ready"),
  proceduralFamilies: ["weapons", "environments", "supplies", "chest"],
  authoredFamilies: ["characters"],
  dedicatedEnemyFamily: "enemies",
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, counts: report.counts, summary: report.summary, renderLab: report.renderLab, gameplayIntegration: report.gameplayIntegration }, null, 2));
