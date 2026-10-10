import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const page = fs.readFileSync(path.join(root, "public", "render-lab.html"), "utf8");
const script = fs.readFileSync(path.join(root, "public", "render-lab.js"), "utf8");

function resolvePublicReference(reference) {
  return path.join(root, "public", reference.replace(/^\.\//, "").split(/[?#]/, 1)[0]);
}

test("3D render lab is a bundled inspection surface for authored game meshes", () => {
  assert.match(page, /id="renderStage"/);
  assert.match(page, /id="assetFamily"/);
  assert.match(page, /id="animationSelect"/);
  assert.match(script, /createCharacterModel/);
  assert.match(script, /createWeaponModel/);
  assert.match(script, /createEnvironmentModel/);
  assert.match(script, /createUpgradeChestModel/);
  assert.match(script, /createSupplyStationModel/);
  assert.match(script, /createEnemyModel/);
  assert.match(script, /ENEMY_MODEL_IDS/);
  assert.match(script, /createTacticalModel/);
  assert.match(script, /TACTICAL_MODEL_IDS/);
  assert.match(script, /TextureLoader/);
  assert.match(script, /referenceImage/);
  assert.match(script, /Character-only isolated 3D render/);
  assert.match(script, /characterRenderRoot/);
  assert.match(script, /characterViewMode = "render"/);
  assert.match(script, /Show live rig/);
  assert.match(script, /applyCharacterView/);
  assert.match(script, /GLTFLoader/);
  assert.match(script, /loadCharacterAsset/);
  assert.match(script, /modelAsset/);
  assert.match(script, /loadedCharacterRoot/);
  assert.match(script, /authoredAnimationClock/);
  assert.match(script, /animateAuthoredCharacter/);
  assert.match(script, /Authored mesh motion/);
  assert.match(page, /id="characterView"/);
  assert.match(script, /characters\/renders\/scout-v2-isolated\.png/);
  assert.match(script, /ranger-v2-isolated-clean\.png/);
  assert.match(script, /scene\.background = new THREE\.Color/);
  assert.match(page, /Drag to orbit/);
  assert.match(page, /VISUAL TARGET DECK/);
  assert.match(page, /nightfall-first-person-water-v2\.png/);
  assert.match(page, /radioactive-enemy-roster-v1\.png/);
  assert.match(page, /characters\/renders/);
  assert.match(page, /characters\/3d/);
  assert.match(page, />Enemies</);
  assert.match(page, />Tactical items</);
});

test("3D render lab never depends on a remote renderer", () => {
  assert.doesNotMatch(page, /https?:\/\//);
  assert.doesNotMatch(script, /cdn\.|unpkg|jsdelivr|skypack/i);
});

test("3D render lab local HTML, module, and model references resolve", () => {
  const sources = [
    ["public/render-lab.html", page, /(?:src|href)=["']([^"']+)["']/g],
    ["public/render-lab.js", script, /["'](\.\/[^"']+)["']/g],
    ...[
      "character-models.mjs",
      "enemy-models.mjs",
      "weapon-models.mjs",
      "environment-models.mjs",
      "tactical-models.mjs",
    ].map(file => [
      `public/${file}`,
      fs.readFileSync(path.join(root, "public", file), "utf8"),
      /["'](\.\/[^"']+)["']/g,
    ]),
  ];
  const references = [];

  for (const [source, contents, pattern] of sources) {
    for (const match of contents.matchAll(pattern)) {
      const reference = match[1];
      if (reference.startsWith("./")) references.push({ source, reference });
    }
  }

  assert.ok(references.length >= 40, `expected the render lab path surface, found ${references.length} references`);
  for (const { source, reference } of references) {
    assert.ok(fs.existsSync(resolvePublicReference(reference)), `${source} references missing ${reference}`);
  }
});
