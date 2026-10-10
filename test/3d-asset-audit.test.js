import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const reportPath = path.join(root, "output", "wasteland-survivor-3d-asset-audit.json");

test("3D asset audit is complete and render-lab reachable", () => {
  assert.ok(fs.existsSync(reportPath), "run scripts/run-3d-asset-audit.mjs before this assertion");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.deepEqual(report.counts, {
    survivorModels: 6,
    enemyModels: 8,
    weaponModels: 6,
    obstacleModels: 7,
    supplyStations: 2,
    tacticalModels: 3,
    sharedChests: 1,
    mapPresets: 4,
    armorIntegratedSets: 6,
  });
  assert.equal(report.summary.missingAssets.length, 0);
  assert.equal(report.renderLab.status, "ready");
  assert.equal(report.renderLab.bundledLocalOnly, true);
  assert.equal(report.gameplayIntegration.dedicatedEnemyFactoryImported, true);
  assert.equal(report.gameplayIntegration.enemySpawnPassesType, true);
  assert.equal(report.gameplayIntegration.armorIntegratedIntoSurvivorRigs, true);
  assert.equal(report.gameplayIntegration.tacticalModelsInspectable, true);
});
