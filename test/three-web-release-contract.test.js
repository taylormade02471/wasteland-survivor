import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SIMPLE_WORLD_PROP_IDS,
  WORLD_FIELD_ASSET_IDS,
  getWorldFieldAsset,
  getWorldFieldPlacements,
} from "../public/world-field-assets.mjs";
import { getPreviewCharacterModelPaths, loadFirstAvailableModel } from "../public/live-character-preview.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gameSource = fs.readFileSync(path.join(repo, "public", "game3d.js"), "utf8");
const pageSource = fs.readFileSync(path.join(repo, "public", "index.html"), "utf8");
const styleSource = fs.readFileSync(path.join(repo, "public", "style.css"), "utf8");
const serverSource = fs.readFileSync(path.join(repo, "server.js"), "utf8");
const vercelIgnoreSource = fs.readFileSync(path.join(repo, ".vercelignore"), "utf8");

function readGlbJson(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString("utf8", 0, 4), "glTF", `${filePath} must be a binary glTF`);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").trim());
}

function collectGlbFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectGlbFiles(filePath) : entry.name.endsWith(".glb") ? [filePath] : [];
  });
}

test("curated world field catalog covers scenery and compact props", () => {
  assert.ok(WORLD_FIELD_ASSET_IDS.length >= 17);
  assert.deepEqual(SIMPLE_WORLD_PROP_IDS, [
    "metal-trash-can",
    "broken-chair",
    "scavenger-table",
    "street-dumpster",
    "tire-stack",
    "traffic-cone",
    "tanker-car",
  ]);

  for (const id of WORLD_FIELD_ASSET_IDS) {
    const asset = getWorldFieldAsset(id);
    assert.match(asset.runtimePath, /^\.\/assets\/nightfall\/aaa\/world\/meshy\/.+\.glb$/);
    assert.ok(asset.fit.maxDimension > 0, `${id} needs a display size`);
    assert.ok(asset.collider.radius > 0, `${id} needs a collision radius`);
  }

  const placements = getWorldFieldPlacements();
  assert.ok(placements.length >= 27);
  assert.ok(placements.every(item => WORLD_FIELD_ASSET_IDS.includes(item.assetId)));

  for (const id of ["water-tower", "rail-signal", "wrecked-pickup"]) {
    assert.ok(WORLD_FIELD_ASSET_IDS.includes(id), `${id} should be in the authored field catalog`);
    assert.ok(placements.some(item => item.assetId === id), `${id} should be placed in the connected world`);
  }

  for (const id of WORLD_FIELD_ASSET_IDS) {
    const asset = getWorldFieldAsset(id);
    const localAsset = path.join(repo, "public", asset.runtimePath.slice(2));
    assert.ok(fs.existsSync(localAsset), `${id} GLB is missing from the release`);
  }
  for (const relative of [
    "assets/nightfall/aaa/characters/meshy/scout-meshy-v1.glb",
    "assets/nightfall/aaa/characters/meshy/ranger-meshy-v2.glb",
    "assets/nightfall/aaa/characters/meshy/heavy-meshy-v1.glb",
    "assets/nightfall/aaa/characters/meshy/tech-runner-meshy-v1.glb",
    "assets/nightfall/aaa/characters/meshy/field-medic-meshy-v1.glb",
    "assets/nightfall/aaa/characters/meshy/warden-meshy-v1.glb",
    "assets/nightfall/aaa/characters/menu/scout-meshy-v1-menu-v1.glb",
    "assets/nightfall/aaa/characters/menu/ranger-meshy-v2-menu-v1.glb",
    "assets/nightfall/aaa/characters/menu/heavy-meshy-v1-menu-v1.glb",
    "assets/nightfall/aaa/characters/menu/tech-runner-meshy-v1-menu-v1.glb",
    "assets/nightfall/aaa/characters/menu/field-medic-meshy-v1-menu-v1.glb",
    "assets/nightfall/aaa/characters/menu/warden-meshy-v1-menu-v1.glb",
  ]) {
    assert.ok(fs.existsSync(path.join(repo, "public", relative)), `${relative} is missing from the release`);
  }
});

test("release includes authored survivor, enemy, weapon, and music assets", () => {
  const required = [
    "assets/nightfall/aaa/characters/meshy/scout-meshy-v1.glb",
    "assets/nightfall/aaa/characters/meshy/ranger-meshy-v2.glb",
    "assets/nightfall/aaa/characters/meshy/heavy-meshy-v1.glb",
    "assets/nightfall/aaa/characters/meshy/tech-runner-meshy-v1.glb",
    "assets/nightfall/aaa/characters/meshy/field-medic-meshy-v1.glb",
    "assets/nightfall/aaa/characters/meshy/warden-meshy-v1.glb",
    "assets/nightfall/aaa/enemies/meshy/mutated-creature-meshy-v1.glb",
    "assets/nightfall/aaa/enemies/meshy/shooter-meshy-v1.glb",
    "assets/nightfall/aaa/enemies/meshy/marksman-meshy-v1.glb",
    "assets/nightfall/aaa/enemies/meshy/shield-soldier-meshy-v1.glb",
    "assets/nightfall/aaa/enemies/meshy/heavy-gunner-meshy-v1.glb",
    "assets/nightfall/aaa/enemies/meshy/drone-meshy-v1.glb",
    "assets/nightfall/aaa/enemies/meshy/mutant-meshy-v1.glb",
    "assets/nightfall/aaa/enemies/meshy/boss-commander-meshy-v1.glb",
    "assets/nightfall/aaa/weapons/meshy/scout-meshy-v1.glb",
    "assets/nightfall/aaa/weapons/meshy/cannon-meshy-v1.glb",
    "assets/nightfall/aaa/weapons/meshy/inferno-meshy-v1.glb",
    "assets/nightfall/music/we-walk-the-ruins-menu-theme.mp3",
    "assets/nightfall/music/wasteland-gameplay-ambient.mp3",
    "assets/nightfall/music/the-coat-beside-the-door.mp3",
    "assets/nightfall/music/winter-folded-in-the-seams.mp3",
    "assets/nightfall/music/answer-back-in-flame.mp3",
    "assets/nightfall/music/fire-in-our-hands.mp3",
    "assets/nightfall/music/we-hunt-now.mp3",
    "assets/nightfall/music/phantom-nightfall-files-cover-v1.jpg",
    "assets/wasteland-terrain-v2.png",
    "assets/toxic-terrain-v2.png",
    "assets/icy-mountain-terrain-v2.png",
    "assets/fire-inferno-terrain-v2.png",
    "assets/nightfall/icons/scrap-gold-v1.svg",
    "assets/nightfall/icons/scrap-silver-v1.svg",
  ];
  for (const relative of required) {
    assert.ok(fs.existsSync(path.join(repo, "public", relative)), `${relative} is missing from the release`);
  }
});

test("nightfall manifest merges the rendered world, menu, terrain, scrap, and soundtrack catalog", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, "public", "assets", "nightfall", "manifest.json"), "utf8"));
  assert.equal(manifest.assets.heroVideo, "/assets/nightfall/backgrounds/nightfall-loading-loop-v1.mp4");
  assert.equal(manifest.assets.lobbyVideo, "/assets/nightfall/backgrounds/nightfall-lobby-squad-loop-v1.mp4");
  assert.equal(manifest.assets.terrainTextures.length, 4);
  assert.equal(manifest.assets.scrapIcons.gold, "/assets/nightfall/icons/scrap-gold-v1.svg");
  assert.equal(manifest.assets.scrapIcons.silver, "/assets/nightfall/icons/scrap-silver-v1.svg");
  assert.deepEqual(manifest.assets.renderQuality.passes, [12, 14, 16, 18, 20]);
  assert.equal(manifest.assets.renderQuality.finalPass, 5);
  assert.deepEqual(manifest.assets.authored3D, {
    survivorModels: 12,
    enemyModels: 8,
    weaponModels: 3,
    worldAndPropModels: 17,
    menuModels: 6,
    storagePrefix: "gs://taylormade-wasteland-survivor-media-212187593712/wasteland-survivor/nightfall-v2/assets",
  });
  assert.equal(manifest.assets.soundtrack.author, "Phantom");
  assert.equal(manifest.assets.soundtrack.album, "Wasteland Survivor: Nightfall Files");
});

test("supplied Phantom tracks carry readable attribution metadata", () => {
  const expected = {
    "the-coat-beside-the-door.mp3": "The Coat Beside the Door",
    "winter-folded-in-the-seams.mp3": "Winter Folded in the Seams",
    "answer-back-in-flame.mp3": "Answer Back in Flame",
    "fire-in-our-hands.mp3": "Fire in Our Hands",
    "we-hunt-now.mp3": "We Hunt Now",
  };
  const musicRoot = path.join(repo, "public", "assets", "nightfall", "music");
  for (const [fileName, title] of Object.entries(expected)) {
    const text = fs.readFileSync(path.join(musicRoot, fileName), "utf8");
    assert.match(text, /Phantom/, `${fileName} should credit Phantom`);
    assert.match(text, /Wasteland Survivor: Nightfall Files/, `${fileName} should carry the game album`);
    assert.match(text, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${fileName} should carry its readable title`);
    assert.doesNotMatch(text, /System\.Collections\.Hashtable\.title/, `${fileName} has stale conversion metadata`);
  }
});

test("authored 3D release assets contain meshes, materials, and embedded texture images", () => {
  const root = path.join(repo, "public", "assets", "nightfall", "aaa");
  const glbs = collectGlbFiles(root);
  assert.ok(glbs.length >= 31, "the authored 3D bundle should include the complete release catalog");
  for (const filePath of glbs) {
    const json = readGlbJson(filePath);
    assert.ok(json.meshes?.length > 0, `${filePath} has no mesh primitives`);
    assert.ok(json.materials?.length > 0, `${filePath} has no materials`);
    assert.ok(json.images?.length > 0, `${filePath} has no embedded texture images`);
  }
});

test("cloned authored materials preserve sRGB textures and bounded PBR values", () => {
  assert.match(gameSource, /function prepareAuthoredMaterial\(source\)/);
  assert.match(gameSource, /material\.map\.colorSpace = THREE\.SRGBColorSpace/);
  assert.match(gameSource, /material\.roughness = THREE\.MathUtils\.clamp/);
  assert.match(gameSource, /material\.metalness = THREE\.MathUtils\.clamp/);
});

test("authored enemy GLBs contain skinned combat motion clips", () => {
  const enemyRoot = path.join(repo, "public", "assets", "nightfall", "aaa", "enemies", "meshy");
  for (const fileName of fs.readdirSync(enemyRoot).filter(name => name.endsWith(".glb"))) {
    const json = readGlbJson(path.join(enemyRoot, fileName));
    assert.equal(json.skins?.[0]?.name, "NightfallEnemySkin", `${fileName} has an enemy skin`);
    assert.deepEqual(json.animations?.map(animation => animation.name), ["Idle", "Move", "Attack", "Hit"], `${fileName} has combat clips`);
    assert.ok(json.meshes[0].primitives[0].attributes.JOINTS_0 != null, `${fileName} has joints`);
    assert.ok(json.meshes[0].primitives[0].attributes.WEIGHTS_0 != null, `${fileName} has weights`);
  }
});

test("preferred character art falls back safely when an authored GLB is unavailable", async () => {
  const preferred = "./assets/nightfall/aaa/characters/meshy/scout-meshy-v1.glb";
  const fallback = "./assets/nightfall/characters/3d/scout-operator-v1.glb";
  const attempted = [];
  const loader = {
    load(file, onLoad, _onProgress, onError) {
      attempted.push(file);
      if (file === preferred) onError(new Error("not in this cache"));
      else onLoad({ scene: { name: "fallback-scout" } });
    },
  };

  const asset = await loadFirstAvailableModel({ loader, paths: [preferred, fallback] });
  assert.equal(asset.scene.name, "fallback-scout");
  assert.deepEqual(attempted, [preferred, fallback]);
});

test("configured external media falls back to the bundled authored model", async () => {
  const preferred = "./assets/nightfall/aaa/characters/meshy/scout-meshy-v1.glb";
  const attempted = [];
  const previousWindow = globalThis.window;
  globalThis.window = { __WASTELAND_MEDIA__: { url: value => `https://storage.googleapis.com/game-media/${value.replace(/^\.\//, "")}` } };
  try {
    const loader = {
      load(file, onLoad, _onProgress, onError) {
        attempted.push(file);
        if (file.startsWith("https://")) onError(new Error("external object not published yet"));
        else onLoad({ scene: { name: "bundled-scout" } });
      },
    };
    const asset = await loadFirstAvailableModel({ loader, paths: [preferred] });
    assert.equal(asset.scene.name, "bundled-scout");
    assert.deepEqual(attempted, [
      "https://storage.googleapis.com/game-media/assets/nightfall/aaa/characters/meshy/scout-meshy-v1.glb",
      preferred,
    ]);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("the deployed shell wires authored 3D map props and a live survivor preview", () => {
  assert.ok(fs.existsSync(path.join(repo, "public", "vendor", "GLTFLoader.js")), "GLTFLoader must ship with the web release");
  assert.match(gameSource, /import \* as THREE from "\.\/vendor\/three\.module\.js"/);
  assert.match(gameSource, /from "\.\/world-field-assets\.mjs"/);
  assert.match(gameSource, /function addWorldFieldAssets\(/);
  assert.match(gameSource, /function addUtilityPoles\(/);
  assert.match(gameSource, /addUtilityPoles\(\)/);
  assert.match(gameSource, /addWorldFieldAssets\(\)/);
  assert.match(gameSource, /createLiveCharacterPreview/);
  assert.match(gameSource, /const AUTHORED_ENEMY_MODELS/);
  assert.match(gameSource, /const AUTHORED_WEAPON_MODELS/);
  assert.match(gameSource, /function attachAuthoredEnemy/);
  assert.match(gameSource, /function attachAuthoredWeapon/);
  assert.match(gameSource, /function playBundledMusic/);
  assert.match(gameSource, /function chooseBundledTrack/);
  assert.match(gameSource, /bundledMusic\.onended/);
  assert.match(gameSource, /playBundledMusic\("gameplay"\)/);
  assert.match(gameSource, /function beginCountdown/);
  assert.match(gameSource, /function openLobby/);
  assert.match(gameSource, /function resumeBundledMusicFromGesture/);
  assert.match(gameSource, /function startSceneMusic/);
  assert.match(gameSource, /\["menu", "countdown", "combat", "prep"\]/);
  assert.match(gameSource, /const homeScreenVisible = phase === "menu" && lobbyScreen\.classList\.contains\("hidden"\)/);
  assert.match(gameSource, /function addMapVisuals/);
  assert.match(gameSource, /addMapVisuals\(\)/);
  assert.match(gameSource, /function updateMapVisuals/);
  assert.match(gameSource, /updateMapVisuals\(dt\)/);
  assert.match(gameSource, /if \(!beacon\.userData\?\.ring \|\| !beacon\.userData\?\.core\) return;/);
  assert.match(gameSource, /function addMountainVisuals/);
  assert.match(gameSource, /function addInfernoFireVisuals/);
  assert.match(gameSource, /function addBurnedArmoryVisual/);
  assert.match(gameSource, /burned-armory-last-outpost/);
  assert.match(gameSource, /assets\/wasteland-terrain-v2\.png/);
  assert.match(gameSource, /assets\/toxic-terrain-v2\.png/);
  assert.match(gameSource, /assets\/icy-mountain-terrain-v2\.png/);
  assert.match(gameSource, /assets\/fire-inferno-terrain-v2\.png/);
  assert.match(pageSource, /scrap-gold-v1\.svg/);
  assert.match(pageSource, /scrap-silver-v1\.svg/);
  assert.match(gameSource, /function resumeHomeBackdropFromGesture\(/);
  assert.match(gameSource, /document\.addEventListener\("pointerdown", resumeHomeBackdropFromGesture/);
  assert.match(pageSource, /id="lobbyAvatarCanvas"/);
  assert.match(pageSource, /id="homeBackdrop"[\s\S]*nightfall-loading-loop-v1\.mp4/);
  assert.match(pageSource, /id="lobbyBackdropVideo"[\s\S]*nightfall-lobby-squad-loop-v1\.mp4/);
  assert.match(pageSource, /value="bundled">Wasteland soundtrack/);
  assert.doesNotMatch(pageSource, /id="homeBackdrop"[^>]*\sposter=/);
  assert.doesNotMatch(pageSource, /id="lobbyBackdropArt"/);
  assert.doesNotMatch(pageSource, /class="title-survivor"/);
});

test("terrain texture loading keeps the external media route and restores the bundled texture on load failure", () => {
  assert.match(gameSource, /function createProceduralTerrainTexture\(path\)/);
  assert.match(gameSource, /new THREE\.CanvasTexture\(canvas\)/);
  assert.match(gameSource, /function loadTerrainTexture\(path\)/);
  assert.match(gameSource, /const fallbackPath = String\(path \|\| ""\)\.replace/);
  assert.match(gameSource, /const loader = new THREE\.TextureLoader\(\);/);
  assert.match(gameSource, /const texture = procedural;/);
  assert.match(gameSource, /const bundledPath = fallbackPath \|\| path;/);
  assert.match(gameSource, /loadPath\(bundledPath\);/);
  assert.match(gameSource, /if \(path && path !== bundledPath\) loadPath\(path\);/);
  assert.match(gameSource, /const bundledPath = fallbackPath \|\| path;/);
  assert.match(gameSource, /loadPath\(bundledPath\);/);
  assert.match(gameSource, /if \(path && path !== bundledPath\) loadPath\(path\);/);
  assert.match(gameSource, /activeTerrainTexture = loaded/);
  assert.match(gameSource, /ground\.material\.map = loaded/);
  assert.doesNotMatch(gameSource, /texture\.source = loaded\.source/);
  assert.match(gameSource, /const texture = loadTerrainTexture\(runtimeAssetPath\(cfg\.texture\)\)/);
});

test("terrain surfaces add authored biome detail when texture sampling is unavailable", () => {
  assert.match(gameSource, /function addTerrainSurfaceDetail\(mapId\)/);
  assert.match(gameSource, /terrain-detail:\$\{mapId\}/);
  assert.match(gameSource, /addTerrainSurfaceDetail\(mapKey\)/);
  assert.match(gameSource, /new THREE\.MeshStandardMaterial\(\{[\s\S]*roughness: \.94[\s\S]*metalness: \.02/);
  assert.match(gameSource, /mesh\.receiveShadow = true/);
});

test("terrain materials add bounded relief from the authored texture", () => {
  assert.match(gameSource, /bumpMap: texture/);
  assert.match(gameSource, /bumpScale: renderQuality\.pass >= 5 \? \.16 : renderQuality\.pass >= 3 \? \.12 : \.08/);
});

test("each gameplay map receives a deterministic authored atmosphere", () => {
  assert.match(gameSource, /const biomeSkyTextures = new Map\(\)/);
  assert.match(gameSource, /function createBiomeSkyTexture\(mapId = "wasteland"\)/);
  assert.match(gameSource, /wasteland: \["#0b1017", "#4b3b32", "#c27e4a"\]/);
  assert.match(gameSource, /toxic: \["#071713", "#1c4937", "#77b75e"\]/);
  assert.match(gameSource, /ice: \["#102333", "#638fa8", "#d9f2ff"\]/);
  assert.match(gameSource, /inferno: \["#150b13", "#4d1b1e", "#e35b2d"\]/);
  assert.match(gameSource, /scene\.background = createBiomeSkyTexture\(mapKey\)/);
});

test("biome weather adds tier-bounded ambient particles without touching collision", () => {
  assert.match(gameSource, /function addBiomeWeatherVisuals\(root\)/);
  assert.match(gameSource, /biome-weather:\$\{weatherKind\}/);
  assert.match(gameSource, /points\.geometry\.attributes\.position\.needsUpdate = true/);
  assert.match(gameSource, /const count = pass >= 5 \? 96 : pass >= 3 \? 48 : 20/);
});

test("toxic and ice maps add animated surface rings without collision blockers", () => {
  assert.match(gameSource, /function addBiomeSurfaceRings\(root\)/);
  assert.match(gameSource, /biome-surface-ring:\$\{mapKey\}/);
  assert.match(gameSource, /root\.userData\.surfaceRings = rings/);
  assert.match(gameSource, /mapVisuals\.userData\.surfaceRings\?\.forEach/);
  assert.match(gameSource, /ring\.userData\.mapAnim = "surface-ring"/);
  assert.match(gameSource, /addBiomeSurfaceRings\(root\)/);
});

test("the gameplay renderer drives authored character motion states", () => {
  assert.match(gameSource, /character-animation-runtime\.mjs/);
  assert.match(gameSource, /updateAuthoredCharacterAnimations\(dt\)/);
  assert.match(gameSource, /sampleCharacterAnimation\(\{ state, time:/);
  assert.match(gameSource, /compact mobile variant/);
  assert.match(gameSource, /animationBaseY/);
});

test("authored GLB animation clips drive live character and enemy states", () => {
  assert.match(gameSource, /new THREE\.AnimationMixer\(root\)/);
  assert.match(gameSource, /mixer\.clipAction\(clip\)/);
  assert.match(gameSource, /driveAuthoredAnimation\(authoredRoot, authoredState, dt\)/);
  assert.match(gameSource, /if \(!group\.userData\.authoredCharacter && !group\.userData\.authoredEnemy\) continue;/);
  assert.match(gameSource, /const authoredState = group\.userData\.authoredEnemy/);
  assert.match(gameSource, /group\.userData\.hitPulseMs = Math\.max\(0, \(group\.userData\.hitPulseMs \|\| 0\) - dt \* 1000\)/);
  assert.match(gameSource, /\? \(!actor\.alive \|\| group\.userData\.hitPulseMs > 0 \? "hit" : actor\.cooldown > 0 \? "attack" : moved \? "move" : "idle"\)/);
  assert.match(gameSource, /driveAuthoredAnimation\(authoredRoot, authoredState, dt\)/);
  assert.match(gameSource, /next\.reset\(\)\.fadeIn\(\.12\)\.play\(\)/);
});

test("quest completion visibly announces the authored story and currency reward", () => {
  assert.match(gameSource, /QUEST COMPLETE: \$\{questResult\.quest\.title\}/);
  assert.match(gameSource, /\+\$\{questResult\.reward\.gold\} GOLD/);
  assert.match(gameSource, /\+\$\{questResult\.reward\.silver\} SILVER/);
  assert.match(gameSource, /discoveryToastUntil = performance\.now\(\) \+ 4200/);
  assert.match(gameSource, /scrap-gold-v1\.svg/);
  assert.match(gameSource, /scrap-silver-v1\.svg/);
  assert.match(styleSource, /\.discovery-toast \.reward-chip/);
});

test("world props expose authored-load state while preserving a readable fallback", () => {
  assert.match(gameSource, /holder\.userData\.assetState = "fallback-loading"/);
  assert.match(gameSource, /holder\.userData\.assetState = "authored"/);
  assert.match(gameSource, /holder\.userData\.assetState = "fallback-load-error"/);
  assert.match(gameSource, /holder\.userData\.requestedAssetPath = asset\.runtimePath/);
});

test("world fallbacks preserve readable car, structure, and prop silhouettes", () => {
  assert.match(gameSource, /id\.includes\("car"\) \|\| id\.includes\("bus"\)/);
  assert.match(gameSource, /id\.includes\("building"\) \|\| id\.includes\("outpost"\)/);
  assert.match(gameSource, /id\.includes\("barrel"\) \|\| id\.includes\("trash"\)/);
  assert.match(gameSource, /new THREE\.CylinderGeometry/);
});

test("the first-person spawn stays clear of the origin overpass ramp", () => {
  assert.match(gameSource, /player = unit\(0x55e5ff, 20, -36, activeProfile\?\.avatarType/);
});

test("the menu preview requests a compact textured authored 3D model before the large gameplay mesh", () => {
  const paths = getPreviewCharacterModelPaths("scout");
  assert.equal(paths[0], "./assets/nightfall/aaa/characters/menu/scout-meshy-v1-menu-v1.glb");
  assert.ok(paths[1].endsWith("/characters/3d/scout-operator-v1.glb"));
  assert.ok(paths.includes("./assets/nightfall/aaa/characters/meshy/scout-meshy-v1.glb"));
  assert.match(fs.readFileSync(path.join(repo, "public", "live-character-preview.mjs"), "utf8"), /getPreviewCharacterModelPaths\(id\)/);
});

test("the home profile menu exposes the same live textured survivor preview", () => {
  assert.match(pageSource, /class="profile-avatar-stage"/);
  assert.match(pageSource, /id="profileAvatarCanvas"/);
  assert.match(pageSource, /id="profileAvatarPreviewName"/);
  assert.match(gameSource, /let profileAvatarPreview = null/);
  assert.match(gameSource, /function ensureProfileAvatarPreview\(/);
  assert.match(gameSource, /ensureProfileAvatarPreview\(value\)/);
  assert.match(gameSource, /profileAvatarPreview\.setCharacter\(id\)/);
  assert.match(gameSource, /function showProfileChoice\(\)[\s\S]*updateAvatarCards\(profileAvatar\.value \|\| "scout"\)/);
  assert.match(styleSource, /\.profile-avatar-stage\s*\{/);
  assert.match(styleSource, /\.profile-avatar-preview\s*\{/);
  assert.match(vercelIgnoreSource, /!public\/assets\/nightfall\/aaa\/characters\/menu\//);
});

test("the combat HUD stays out of the home and lobby hero", () => {
  assert.match(styleSource, /body\.menu-active #hud\s*\{\s*display:\s*none;\s*\}/);
});

test("the home survivor preview keeps an idle motion loop while it is visible", () => {
  const previewSource = fs.readFileSync(path.join(repo, "public", "live-character-preview.mjs"), "utf8");
  assert.match(previewSource, /state\.raf = requestAnimationFrame\(render\)/);
  assert.match(previewSource, /sampleSimpleCharacterMotion\(\{ state: "idle", time: now \/ 1000 \}\)/);
  assert.match(previewSource, /state\.yaw \+= \.0025/);
});

test("the hero video owns the home background once playback is confirmed", () => {
  assert.match(styleSource, /body\.hero-video-active \.nightfall-background\s*\{[^}]*opacity:\s*0/);
  assert.match(styleSource, /body\.menu-active \.home-backdrop\.is-ready\s*\{[^}]*opacity:\s*1/);
  assert.match(gameSource, /hero-video-active/);
});

test("large authored media has a configured GCS route with bundled fallback", () => {
  assert.ok(fs.existsSync(path.join(repo, "public", "media-runtime.mjs")));
  assert.ok(fs.existsSync(path.join(repo, "public", "bootstrap.mjs")));
  assert.match(pageSource, /data-media-src="\.\/assets\/nightfall\/backgrounds\/nightfall-loading-loop-v1\.mp4"/);
  assert.match(pageSource, /src="\.\/bootstrap\.mjs"/);
  assert.match(gameSource, /function runtimeAssetPath\(/);
  assert.match(gameSource, /bundledMusic\.src = runtimeAssetPath\(track\.url\)/);
  assert.match(serverSource, /\/api\/media-config/);
  assert.match(serverSource, /GAME_MEDIA_BASE_URL/);
});

test("the live survivor preview is framed higher and larger on narrow phone layouts", () => {
  const previewSource = fs.readFileSync(path.join(repo, "public", "live-character-preview.mjs"), "utf8");
  assert.match(previewSource, /root\.position\.y \+= size\.y \* \.30/);
  assert.match(styleSource, /@media \(max-width: 760px\)[\s\S]*\.live-character-preview\s*\{[^}]*inset:\s*-18% -12% 8%;[^}]*width:\s*124%;[^}]*height:\s*124%;/);
});

test("the gameplay renderer exposes a large ranged spider enemy", () => {
  assert.match(gameSource, /function createSpiderVisual\(/);
  assert.match(gameSource, /enemyType === "spider"/);
  assert.match(gameSource, /spider: 0x/);
  assert.match(gameSource, /spider-ranged/);
  assert.match(gameSource, /group\.scale\.setScalar\(1\.6\)/);
  assert.match(gameSource, /group\.userData\.hitRadius = 1\.6/);
  assert.match(gameSource, /group\.userData\.spiderVisual = true/);
  assert.match(gameSource, /group\.userData\.spiderLegs = spiderLegs/);
  assert.match(gameSource, /group\.userData\.spiderCore = thorax/);
  assert.match(gameSource, /group\.userData\.spiderEyes = spiderEyes/);
  assert.match(gameSource, /actor\.g\.userData\.attackPulseMs = 180/);
  assert.match(gameSource, /projectile\.name = "acid-web-projectile"/);
  assert.match(gameSource, /const attackT = Math\.max\(0, Math\.min\(1, group\.userData\.attackPulseMs \/ 180\)\)/);
  assert.match(gameSource, /leg\.upper\.rotation\.z = leg\.upper\.userData\.restRotation\.z \+ phase/);
  assert.match(gameSource, /enemy\.g\.userData\.hitRadius \|\| 1\.1/);
});

test("weapon firing exposes rendered muzzle and tracer feedback", () => {
  assert.match(gameSource, /function weaponMuzzleOrigin\(actor, direction\)/);
  assert.match(gameSource, /const authoredWeapon = actor\.g\.getObjectByName\?\.\("authored-weapon"\)/);
  assert.match(gameSource, /const bounds = new THREE\.Box3\(\)\.setFromObject\(authoredWeapon\)/);
  assert.match(gameSource, /projectile\.position\.copy\(weaponMuzzleOrigin\(actor, shotDirection\)\)/);
  assert.match(gameSource, /function weaponMuzzleFlash\(actor, direction, color\)/);
  assert.match(gameSource, /flash\.name = "weapon-muzzle-flash"/);
  assert.match(gameSource, /tracer\.name = "weapon-tracer-flash"/);
  assert.match(gameSource, /smoke\.name = "weapon-smoke-puff"/);
  assert.match(gameSource, /weaponMuzzleFlash\(actor, shotDirection, projectileColor\)/);
  assert.match(gameSource, /effects\.push\(\{ mesh: tracer, velocity: direction\.clone\(\)\.multiplyScalar\(10\), life: \.09 \}\)/);
  assert.match(gameSource, /function impactFlash\(position, color = 0xffdf52\)/);
  assert.match(gameSource, /ring\.name = "weapon-impact-flash"/);
  assert.match(gameSource, /impactFlash\(bullet\.m\.position, enemy\.enemyType === "spider" \? 0x9cff69 : 0xffdf52\)/);
});

test("authored combatants receive a visible hit reaction pulse", () => {
  assert.match(gameSource, /enemy\.g\.userData\.hitPulseMs = 180/);
  assert.match(gameSource, /if \(remaining > 0\) target\.g\.userData\.hitPulseMs = 180/);
});

test("the authored weapon presentation state drives the live player mesh", () => {
  assert.match(gameSource, /from "\.\/weapon-presentation\.mjs"/);
  assert.match(gameSource, /weaponPresentationState = triggerWeaponShot\(weaponPresentationState\)\.state/);
  assert.match(gameSource, /weaponPresentationState = beginWeaponReload\(weaponPresentationState\)\.state/);
  assert.match(gameSource, /function updateWeaponPresentation\(dt\)/);
  assert.match(gameSource, /weapon\.userData\.presentationFrame = frame/);
  assert.match(gameSource, /updateWeaponPresentation\(dt\)/);
});

test("the combat camera stays ahead of the survivor head while preserving the existing movement controls", () => {
  assert.match(gameSource, /const cameraTarget = frontView \? player\.g\.position\.clone\(\)\.add\(new THREE\.Vector3\(0, 2\.65, 0\)\)\.addScaledVector\(facing, 1\.45\)/);
  assert.match(gameSource, /player\.g\.visible = !frontView && player\.alive/);
  assert.match(gameSource, /nextMouseYaw\(\{ yaw: viewYaw, movementX: event\.movementX, sensitivity:/);
  assert.match(gameSource, /firstPersonMovementDelta\(\{/);
  assert.doesNotMatch(gameSource, /viewYaw\s*-=\s*event\.movementX/);
  assert.doesNotMatch(gameSource, /keys\.d\s*=\s*0/);
});

test("the prep-phase magic-hand resupply can be moved through authored collision", () => {
  assert.match(gameSource, /function moveResupply\(dt, controller\)/);
  assert.match(gameSource, /moveResupply\(dt, controller\)/);
  assert.match(gameSource, /chest\.group\.position\.copy\(resolved\.position\)/);
});

test("the world renderer adds visible utility poles without adding hidden blockers", () => {
  assert.match(gameSource, /utility-pole/);
  assert.match(gameSource, /utility-cable/);
  assert.doesNotMatch(gameSource, /createWorldFieldBlockers[\s\S]*utility-pole/);
});

test("the world renderer adds visible roadside clutter without adding hidden blockers", () => {
  assert.match(gameSource, /function addRoadsideClutter\(/);
  assert.match(gameSource, /roadside-clutter/);
  assert.match(gameSource, /addRoadsideClutter\(\)/);
  assert.doesNotMatch(gameSource, /createWorldFieldBlockers[\s\S]*roadside-clutter/);
});

test("vehicles and structures expose authored readability details", () => {
  assert.match(gameSource, /const headlights = new THREE\.InstancedMesh/);
  assert.match(gameSource, /headlights\.setMatrixAt/);
  assert.match(gameSource, /function frontPoint|const frontPoint =/);
  assert.match(gameSource, /const windowColor = structure\.damaged/);
  assert.match(gameSource, /emissive: structure\.damaged \? \.08 : \.42/);
});

test("the connected roads render visible markings over the textured terrain", () => {
  assert.match(gameSource, /function addRoadMarkings\(segment\)/);
  assert.match(gameSource, /addRoadMarkings\(road\)/);
  assert.match(gameSource, /0xd8bd63/);
});

test("the authored world-detail set includes a landmark, railway signal, and extra vehicle mesh", () => {
  const required = [
    "assets/nightfall/aaa/world/meshy/water-tower-meshy-v1.glb",
    "assets/nightfall/aaa/world/meshy/props/rail-signal-v1.glb",
    "assets/nightfall/aaa/world/meshy/props/wrecked-pickup-v1.glb",
  ];
  for (const relative of required) {
    assert.ok(fs.existsSync(path.join(repo, "public", relative)), `${relative} is missing from the release`);
  }
});

test("the in-game map transfer controls remain reachable on the PWA", () => {
  assert.doesNotMatch(styleSource, /^\.map-control\s*\{\s*display:\s*none\s*!important;\s*\}$/m);
  assert.match(pageSource, /class="map-control"[^>]*aria-label="Map transfer"/);
  assert.match(gameSource, /document\.querySelectorAll\("\[data-map\]"\)/);
});

test("map transfer closes the paused in-game menu before rebuilding the selected map", () => {
  const transferBlock = gameSource.match(/document\.querySelectorAll\("\[data-map\]"\)[\s\S]*?\n\}\);/)?.[0] || "";
  assert.match(transferBlock, /closeGameMenu\(\)/);
  assert.match(transferBlock, /start\(\)/);
});
