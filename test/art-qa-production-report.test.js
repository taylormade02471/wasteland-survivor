import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const reportPath = path.join(root, "docs", "art-qa-production-report.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

const EXPECTED_PENDING = [
  "high-resolution-source-meshes",
  "facial-rigs",
  "cinematic-textures",
  "mocap-clips",
];

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function readGlbJson(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString("utf8", 0, 4), "glTF", filePath);
  assert.equal(buffer.readUInt32LE(4), 2, filePath);
  assert.equal(buffer.readUInt32LE(8), buffer.length, filePath);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.toString("utf8", 16, 20), "JSON", filePath);
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).trim());
}

test("art QA report separates verified runtime exports from pending source art", () => {
  assert.equal(report.status, "runtime-export-verified-source-art-pending");
  assert.equal(report.verifiedRuntimeAssets.status, "verified");
  assert.equal(report.verifiedRuntimeAssets.verificationLevel, "static-filesystem-and-contract");
  assert.equal(report.verifiedRuntimeAssets.visualRuntimeProof, "not-performed");
  assert.deepEqual(report.pendingSourceArt.map(item => item.id), EXPECTED_PENDING);
  assert.ok(report.pendingSourceArt.every(item => item.status === "pending"));
  assert.ok(report.pendingSourceArt.every(item => item.releaseReady === false));
  assert.equal(report.releaseDecision.runtimeExportReady, true);
  assert.equal(report.releaseDecision.sourceArtComplete, false);
  assert.equal(report.releaseDecision.visualBrowserOrDeviceApproval, false);
  assert.deepEqual(report.releaseDecision.blockingSourceArt, EXPECTED_PENDING);
});

test("verified survivor exports are local glTF 2.0 files with authored mesh evidence", () => {
  const exportEntry = report.verifiedRuntimeAssets.assets.find(asset => asset.id === "survivor-glb-exports");
  assert.ok(exportEntry, "survivor GLB export evidence is required");
  assert.equal(exportEntry.status, "verified");
  assert.equal(exportEntry.paths.length, 6);

  for (const relativePath of exportEntry.paths) {
    const filePath = absolute(relativePath);
    assert.ok(fs.existsSync(filePath), relativePath);
    assert.ok(fs.statSync(filePath).size > 20_000, relativePath);
    const glb = readGlbJson(filePath);
    assert.equal(glb.asset?.version, "2.0", relativePath);
    assert.ok(Array.isArray(glb.meshes) && glb.meshes.length >= 12, relativePath);
    assert.ok(Array.isArray(glb.materials) && glb.materials.length >= 5, relativePath);
  }

  const factoryEntry = report.verifiedRuntimeAssets.assets.find(asset => asset.id === "runtime-art-factories");
  assert.ok(factoryEntry, "procedural runtime art factory evidence is required");
  assert.equal(factoryEntry.status, "verified");
  for (const relativePath of factoryEntry.paths) assert.ok(fs.existsSync(absolute(relativePath)), relativePath);
});

test("render-lab and the existing asset audit provide local runtime inspection evidence", () => {
  const renderLab = report.verifiedRuntimeAssets.assets.find(asset => asset.id === "local-render-lab");
  assert.ok(renderLab, "local render-lab evidence is required");
  for (const relativePath of renderLab.paths) assert.ok(fs.existsSync(absolute(relativePath)), relativePath);

  const page = fs.readFileSync(absolute("public/render-lab.html"), "utf8");
  const script = fs.readFileSync(absolute("public/render-lab.js"), "utf8");
  assert.match(page, /id="renderStage"/);
  assert.match(page, /id="assetFamily"/);
  assert.match(script, /GLTFLoader/);
  assert.match(script, /loadCharacterAsset/);
  assert.match(script, /Show authored 3D mesh/);
  assert.doesNotMatch(page, /https?:\/\//i);
  assert.doesNotMatch(script, /cdn\.|unpkg|jsdelivr|skypack/i);

  const audit = JSON.parse(fs.readFileSync(absolute("output/wasteland-survivor-3d-asset-audit.json"), "utf8"));
  assert.equal(audit.summary?.missingAssets?.length, 0);
  assert.equal(audit.renderLab?.status, "ready");
});

test("pending source-art categories have specification evidence but no authored source roots", () => {
  const manifestPath = absolute("public/assets/nightfall/characters/aaa-production-manifest.json");
  assert.ok(fs.existsSync(manifestPath));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.status, "production-specification");

  for (const item of report.pendingSourceArt) {
    assert.equal(item.status, "pending", item.id);
    assert.equal(item.releaseReady, false, item.id);
    assert.equal(item.specificationPath, "public/assets/nightfall/characters/aaa-production-manifest.json");
    assert.ok(item.evidence.length > 0, item.id);
    assert.ok(item.runtimeProxyDoesNotCount.length > 0, item.id);
    const existingSourceRoots = item.candidateRoots.filter(candidate => fs.existsSync(absolute(candidate)));
    assert.deepEqual(existingSourceRoots, [], `${item.id} must not claim an authored source package from runtime assets`);
  }
});
