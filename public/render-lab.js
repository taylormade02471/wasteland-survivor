import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js?v=2";
import { CHARACTER_ARCHETYPE_IDS, createCharacterModel, createPoseController, getCharacterArchetype, measureCharacterModelBudget } from "./character-models.mjs";
import { loadCharacterAsset } from "./character-asset-loader.mjs?v=2";
import { WEAPON_IDS, createWeaponModel, createWeaponPoseController, getWeaponDefinition } from "./weapon-models.mjs";
import { ENVIRONMENT_MODEL_IDS, SUPPLY_STATION_IDS, createEnvironmentModel, createSupplyStationModel, createUpgradeChestModel, getEnvironmentDefinition, getSupplyStationDefinition } from "./environment-models.mjs";
import { ENEMY_MODEL_IDS, createEnemyModel, getEnemyModelDefinition } from "./enemy-models.mjs";
import { TACTICAL_MODEL_IDS, createTacticalModel, getTacticalModelDefinition } from "./tactical-models.mjs";

const $ = (id) => document.getElementById(id);
const canvas = $("renderStage");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071217);
scene.fog = new THREE.Fog(0x071217, 8, 34);
const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
const gltfLoader = new GLTFLoader();
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const stageRoot = new THREE.Group();
const assetRoot = new THREE.Group();
const referenceRoot = new THREE.Group();
const characterRenderRoot = new THREE.Group();
const water = new THREE.Mesh(new THREE.CircleGeometry(22, 64), new THREE.MeshStandardMaterial({ color: 0x173d42, roughness: .25, metalness: .32, transparent: true, opacity: .86 }));
const shore = new THREE.Mesh(new THREE.CircleGeometry(17, 48), new THREE.MeshStandardMaterial({ color: 0x433a2b, roughness: .92, metalness: .05 }));
const grid = new THREE.GridHelper(30, 30, 0x2d6864, 0x173b3b);
const keyLight = new THREE.DirectionalLight(0xffdfad, 3.1);
const rimLight = new THREE.DirectionalLight(0x73d7d1, 2.1);
const fillLight = new THREE.HemisphereLight(0xa4d4ce, 0x10171a, 1.35);
const emberLight = new THREE.PointLight(0xff7540, 7, 10);
let active = null;
let activeKind = "character";
let activeId = "scout";
let autoRotate = true;
let yaw = .55;
let pitch = .12;
let distance = 5.6;
let pointer = null;
let lastTime = performance.now();
let referenceTexture = null;
let characterRenderTexture = null;
let loadedCharacterRoot = null;
let loadedCharacterMixer = null;
let characterLoadToken = 0;
let characterViewMode = "render";
let authoredAnimationClock = 0;
const authoredBasePosition = new THREE.Vector3();
const authoredBaseRotation = new THREE.Euler();

const referenceFor = {
  character: {
    scout: { src: "./assets/nightfall/characters/renders/scout-v2-isolated.png", label: "Dust Scout isolated 3D render" },
    ranger: { src: "./assets/nightfall/characters/renders/ranger-v2-isolated-clean.png", label: "Ranger isolated 3D render" },
    heavy: { src: "./assets/nightfall/characters/renders/heavy-v2-isolated.png", label: "Heavy isolated 3D render" },
    tech: { src: "./assets/nightfall/characters/renders/tech-runner-v2-isolated.png", label: "Tech Runner isolated 3D render" },
    medic: { src: "./assets/nightfall/characters/renders/field-medic-v2-isolated.png", label: "Field Medic isolated 3D render" },
    warden: { src: "./assets/nightfall/characters/renders/warden-v2-isolated.png", label: "Warden isolated 3D render" },
  },
  weapon: { default: { src: "./assets/nightfall/backgrounds/nightfall-first-person-water-v2.png", label: "First-person weapon and water reference" } },
  environment: { default: { src: "./assets/nightfall/backgrounds/nightfall-lobby-squad-v1.png", label: "Wasteland environment reference" } },
  supply: { default: { src: "./assets/nightfall/backgrounds/nightfall-lobby-squad-v1.png", label: "Supply placement reference" } },
  chest: { default: { src: "./assets/nightfall/backgrounds/nightfall-lobby-squad-v1.png", label: "Shared chest placement reference" } },
  enemy: { default: { src: "./assets/nightfall/enemies/radioactive-enemy-roster-v1.png", label: "Radioactive enemy concept roster" } },
  tactical: { default: { src: "./assets/nightfall/backgrounds/nightfall-lobby-squad-v1.png", label: "Tactical equipment reference" } },
};

const catalogs = {
  character: CHARACTER_ARCHETYPE_IDS.map((id) => ({ id, label: getCharacterArchetype(id).displayName })),
  weapon: WEAPON_IDS.map((id) => ({ id, label: getWeaponDefinition(id).displayName })),
  environment: ENVIRONMENT_MODEL_IDS.map((id) => ({ id, label: getEnvironmentDefinition(id).displayName })),
  supply: SUPPLY_STATION_IDS.map((id) => ({ id, label: getSupplyStationDefinition(id).displayName })),
  chest: [{ id: "upgrade-chest", label: "Shared Upgrade Chest" }],
  enemy: ENEMY_MODEL_IDS.map((id) => ({ id, label: getEnemyModelDefinition(id).displayName })),
  tactical: TACTICAL_MODEL_IDS.map((id) => ({ id, label: getTacticalModelDefinition(id).displayName })),
};

scene.add(stageRoot);
stageRoot.add(water, shore, grid, referenceRoot, characterRenderRoot, assetRoot);
water.rotation.x = -Math.PI / 2;
water.position.y = -.06;
shore.rotation.x = -Math.PI / 2;
shore.position.y = -.015;
grid.position.y = .01;
grid.material.transparent = true;
grid.material.opacity = .22;
keyLight.position.set(5, 9, 5);
rimLight.position.set(-6, 4, -5);
emberLight.position.set(2.8, 1.2, 1.5);
scene.add(keyLight, rimLight, fillLight, emberLight);

function fit() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function cameraFrame() {
  const target = new THREE.Vector3(0, activeKind === "character" ? 2.03 : 1.05, 0);
  camera.position.set(Math.sin(yaw) * distance, target.y + Math.sin(pitch) * distance * .62, Math.cos(yaw) * distance);
  camera.lookAt(target);
  if (activeKind === "character" && characterRenderRoot.visible) characterRenderRoot.quaternion.copy(camera.quaternion);
  referenceRoot.lookAt(camera.position);
}

function disposeObject(root) {
  root?.traverse?.((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose?.());
    else node.material?.dispose?.();
  });
}

function clearReference() {
  while (referenceRoot.children.length) {
    const child = referenceRoot.children.pop();
    disposeObject(child);
  }
  referenceTexture?.dispose?.();
  referenceTexture = null;
}

function clearCharacterRender() {
  characterLoadToken += 1;
  while (characterRenderRoot.children.length) {
    const child = characterRenderRoot.children.pop();
    disposeObject(child);
  }
  loadedCharacterRoot = null;
  loadedCharacterMixer = null;
  authoredAnimationClock = 0;
  authoredBasePosition.set(0, 0, 0);
  authoredBaseRotation.set(0, 0, 0);
  characterRenderTexture?.dispose?.();
  characterRenderTexture = null;
}

function applyCharacterView() {
  const isCharacter = activeKind === "character";
  const hasIsolatedRender = Boolean(loadedCharacterRoot) || characterRenderRoot.children.length > 0;
  const showingRig = isCharacter && characterViewMode === "rig";
  characterRenderRoot.visible = isCharacter && !showingRig && hasIsolatedRender;
  if (active?.root) active.root.visible = !isCharacter || showingRig || !hasIsolatedRender;
  $("characterView").disabled = !isCharacter;
  $("characterView").textContent = showingRig ? "Show authored 3D mesh" : loadedCharacterRoot ? "Show procedural rig" : "Show live rig";
  $("characterView").setAttribute("aria-pressed", String(showingRig));
  $("stageMode").textContent = isCharacter ? (showingRig ? "LIVE RIG" : loadedCharacterRoot ? "AUTHORED 3D" : "ISOLATED RENDER") : "LIVE PREVIEW";
}

function getReference(kind, id) {
  if (kind === "enemy") {
    const definition = getEnemyModelDefinition(id);
    return { src: definition.referenceImage, label: `${definition.displayName} concept reference` };
  }
  const family = referenceFor[kind] || referenceFor.environment;
  return family[id] || family.default || { src: "./assets/nightfall/backgrounds/nightfall-lobby-squad-v1.png", label: "Nightfall visual reference" };
}

function setReference(kind, id) {
  clearReference();
  const reference = getReference(kind, id);
  if (kind === "character") {
    referenceRoot.visible = false;
    $("referenceDescription").textContent = "Character-only isolated 3D render · no environment background · live rig available for animation";
    return;
  }
  referenceRoot.visible = true;
  if (active?.root) active.root.userData.referenceImage = reference.src;
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x172e31, roughness: .82, metalness: .16 });
  const boardMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .96, side: THREE.DoubleSide });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.28, 1.52, .06), frameMaterial);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.12, 1.36), boardMaterial);
  board.position.z = .04;
  referenceRoot.position.set(-2.18, 1.22, -.35);
  referenceRoot.add(frame, board);
  $("referenceDescription").textContent = "Art reference: " + reference.label;
  const loader = new THREE.TextureLoader();
  loader.load(reference.src, (texture) => {
    referenceTexture = texture;
    texture.colorSpace = THREE.SRGBColorSpace;
    board.material.map = texture;
    board.material.needsUpdate = true;
  }, undefined, () => {
    $("referenceDescription").textContent = "Art reference unavailable: " + reference.label;
  });
}

function setCharacterRender(kind, id) {
  clearCharacterRender();
  const isCharacter = kind === "character";
  if (!isCharacter) {
    applyCharacterView();
    return;
  }

  const reference = getReference(kind, id);
  const archetype = getCharacterArchetype(id);
  const modelAsset = archetype.modelAsset;
  const token = characterLoadToken;
  $("referenceDescription").textContent = `Loading authored GLB mesh ${modelAsset} · preparing studio lighting and bounds`;
  loadCharacterAsset({ archetype, loader: gltfLoader, fallbackFactory: () => null, scale: 1, groundY: 0 }).then((result) => {
    if (token !== characterLoadToken) {
      if (result.scene) disposeObject(result.scene);
      return;
    }
    if (result.ok && result.scene) {
      loadedCharacterRoot = result.scene;
      const rawBounds = new THREE.Box3().setFromObject(loadedCharacterRoot);
      const rawSize = rawBounds.getSize(new THREE.Vector3());
      loadedCharacterRoot.scale.multiplyScalar(3.55 / Math.max(.01, rawSize.y));
      const fittedBounds = new THREE.Box3().setFromObject(loadedCharacterRoot);
      const fittedCenter = fittedBounds.getCenter(new THREE.Vector3());
      loadedCharacterRoot.position.x -= fittedCenter.x;
      loadedCharacterRoot.position.y -= fittedBounds.min.y;
      loadedCharacterRoot.position.z -= fittedCenter.z;
      authoredBasePosition.copy(loadedCharacterRoot.position);
      authoredBaseRotation.copy(loadedCharacterRoot.rotation);
      authoredAnimationClock = 0;
      if (result.animations.length) {
        loadedCharacterMixer = new THREE.AnimationMixer(loadedCharacterRoot);
        loadedCharacterMixer.clipAction(result.animations[0]).play();
      }
      characterRenderRoot.add(loadedCharacterRoot);
      if (active) {
        active.budget = measureCharacterModelBudget(loadedCharacterRoot);
        active.metadata = { ...active.metadata, silhouetteTag: `${active.metadata.silhouetteTag} · Authored GLB` };
      }
      $("referenceDescription").textContent = result.animations.length
        ? "Authored 3D mesh loaded · animation clip available · no concept-art backdrop"
        : "Authored 3D mesh loaded · studio lighting · no concept-art backdrop";
      applyCharacterView();
      updateStats();
      return;
    }

    $("referenceDescription").textContent = `Authored GLB unavailable (${result.reason}); using isolated render fallback for ${reference.label}`;
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(reference.src, (texture) => {
      if (token !== characterLoadToken) {
        texture.dispose();
        return;
      }
    characterRenderTexture = texture;
    texture.colorSpace = THREE.SRGBColorSpace;
    const aspect = texture.image?.width && texture.image?.height ? texture.image.width / texture.image.height : .67;
    const height = 4.1;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(height * aspect, height),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .02, depthWrite: false, side: THREE.DoubleSide })
    );
    plane.position.set(0, 2.03, .08);
    characterRenderRoot.add(plane);
    applyCharacterView();
    }, undefined, () => {
      $("referenceDescription").textContent = "Isolated render unavailable; showing the live procedural rig for " + reference.label;
      applyCharacterView();
    });
  });
}

function clearAsset() {
  while (assetRoot.children.length) {
    const child = assetRoot.children.pop();
    disposeObject(child);
  }
  active = null;
}

function createAsset(kind, id) {
  if (kind === "character") {
    const model = createCharacterModel(THREE, id);
    return { root: model.root, controller: createPoseController(model), metadata: model.metadata, budget: model.budget, declaredBudget: model.declaredBudget, referenceImage: model.metadata.referenceImage, animation: "wade" };
  }
  if (kind === "weapon") {
    const model = createWeaponModel(THREE, id);
    return { root: model.root, controller: createWeaponPoseController(model), metadata: model.metadata, budget: model.budget, declaredBudget: model.budget, animation: "idle" };
  }
  if (kind === "environment") {
    const model = createEnvironmentModel(THREE, id, { seed: "render-lab" });
    return { root: model.root, metadata: model.metadata, budget: model.budget, declaredBudget: model.budget, animation: "idle" };
  }
  if (kind === "supply") {
    const model = createSupplyStationModel(THREE, id, { seed: "render-lab" });
    return { root: model.root, metadata: model.metadata, budget: model.budget, declaredBudget: model.budget, animation: "idle" };
  }
  if (kind === "enemy") {
    const model = createEnemyModel(THREE, id);
    return { root: model.root, controller: createPoseController(model.controllerModel || model), metadata: model.metadata, budget: model.budget, declaredBudget: model.declaredBudget, referenceImage: model.metadata.referenceImage, animation: "idle" };
  }
  if (kind === "tactical") {
    const model = createTacticalModel(THREE, id);
    return { root: model.root, metadata: model.metadata, budget: model.budget, declaredBudget: model.declaredBudget, animation: "idle" };
  }
  const model = createUpgradeChestModel(THREE, { seed: "render-lab" });
  return { root: model.root, metadata: model.metadata, budget: model.budget, declaredBudget: model.budget, animation: "idle" };
}

function updateStats() {
  const budget = active?.budget || { meshes: 0, materials: 0, triangles: 0 };
  const declared = active?.declaredBudget || {};
  $("meshStats").textContent = `${budget.meshes || 0} meshes`;
  $("materialStats").textContent = String(budget.materials || declared.materials || 0);
  $("triangleStats").textContent = Number(budget.triangles || declared.triangles || 0).toLocaleString();
  $("budgetStats").textContent = declared.triangles ? `${declared.triangles.toLocaleString()} tri` : "tracked";
  $("assetName").textContent = active?.metadata?.displayName || "Asset";
  $("assetDescription").textContent = active?.metadata?.silhouetteTag || "Procedural game mesh";
}

function setAsset(kind, id = catalogs[kind][0].id) {
  activeKind = kind;
  activeId = id;
  clearAsset();
  try {
    active = createAsset(kind, id);
    assetRoot.add(active.root);
    setReference(kind, id);
    setCharacterRender(kind, id);
    const characterStudio = kind === "character";
    scene.background = new THREE.Color(characterStudio ? 0x11191b : 0x071217);
    water.visible = !characterStudio;
    shore.visible = !characterStudio;
    grid.visible = !characterStudio;
    const scale = characterStudio ? 1.42 : kind === "weapon" ? 1.6 : 1.25;
    active.root.scale.multiplyScalar(scale);
    distance = characterStudio ? 6.25 : 5.6;
    if (kind === "weapon") active.root.rotation.y = -.4;
    applyCharacterView();
    $("stageError").classList.add("hidden");
    updateStats();
  } catch (error) {
    $("stageError").textContent = `Could not build ${id}: ${error.message}`;
    $("stageError").classList.remove("hidden");
  }
}

function populateAssetSelect() {
  const select = $("assetSelect");
  select.replaceChildren(...catalogs[activeKind].map((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    return option;
  }));
  select.value = activeId;
}

function animateAuthoredCharacter(seconds) {
  if (!loadedCharacterRoot || activeKind !== "character" || characterViewMode === "rig") return;
  authoredAnimationClock += seconds;
  const state = $("animationSelect")?.value || "idle";
  const t = authoredAnimationClock;
  const gait = state === "run" ? 8.4 : state === "walk" || state === "wade" ? 5.1 : 2.1;
  const stride = Math.sin(t * gait);
  const bounce = Math.abs(Math.sin(t * gait * .5));

  // Authored mesh motion keeps static GLBs readable while skinned clips are added later.
  loadedCharacterRoot.position.copy(authoredBasePosition);
  loadedCharacterRoot.rotation.copy(authoredBaseRotation);
  if (state === "idle") {
    loadedCharacterRoot.position.y += Math.sin(t * 2.1) * .018;
    loadedCharacterRoot.rotation.z += Math.sin(t * 1.15) * .008;
  } else if (state === "wade" || state === "walk" || state === "run") {
    loadedCharacterRoot.position.y += bounce * (state === "run" ? .08 : .045);
    loadedCharacterRoot.rotation.z += stride * (state === "run" ? .026 : .018);
    loadedCharacterRoot.rotation.y += Math.sin(t * gait * .5) * .025;
  } else if (state === "aim") {
    loadedCharacterRoot.rotation.x -= .045;
    loadedCharacterRoot.rotation.z += Math.sin(t * 2.2) * .006;
  } else if (state === "fire") {
    loadedCharacterRoot.position.z += Math.max(0, Math.sin(t * 18)) * .035;
    loadedCharacterRoot.rotation.x -= .085;
  } else if (state === "reload") {
    loadedCharacterRoot.rotation.z += Math.sin(t * 3.2) * .045;
    loadedCharacterRoot.rotation.y += Math.sin(t * 1.6) * .035;
  } else if (state === "downed") {
    loadedCharacterRoot.position.y -= .44;
    loadedCharacterRoot.rotation.z -= 1.12;
  }
}

function animateAsset(seconds) {
  animateAuthoredCharacter(seconds);
  loadedCharacterMixer?.update(seconds);
  if (!active?.controller) return;
  if (activeKind === "character") {
    const state = $("animationSelect").value;
    active.controller.update(seconds, { state, speed: state === "run" ? .9 : state === "walk" || state === "wade" ? .5 : 0, waterDepth: state === "wade" ? .42 : 0, aim: state === "aim" ? 1 : 0, fire: state === "fire" ? Math.min(1, seconds * 7) : 0, downed: state === "downed" });
  } else {
    const state = $("animationSelect").value;
    active.controller.update(seconds, { state, aim: state === "aim" ? 1 : 0, fire: state === "fire" ? .8 : 0, reload: state === "reload" ? (Math.sin(performance.now() / 800) + 1) / 2 : 0, heat: state === "fire" ? .8 : 0 });
  }
}

function frame(now) {
  const seconds = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  if (autoRotate && !pointer) yaw += seconds * .22;
  water.material.opacity = .78 + Math.sin(now / 1100) * .06;
  emberLight.intensity = 6.2 + Math.sin(now / 360) * 1.4;
  animateAsset(seconds);
  cameraFrame();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

$("assetFamily").addEventListener("change", (event) => {
  activeKind = event.target.value;
  activeId = catalogs[activeKind][0].id;
  populateAssetSelect();
  $("animationSelect").value = activeKind === "character" ? "wade" : "idle";
  setAsset(activeKind, activeId);
});
$("assetSelect").addEventListener("change", (event) => setAsset(activeKind, event.target.value));
$("animationSelect").addEventListener("change", () => { active?.controller?.reset?.(); });
$("autoRotate").addEventListener("click", () => { autoRotate = !autoRotate; $("autoRotate").classList.toggle("is-active", autoRotate); $("autoRotate").setAttribute("aria-pressed", String(autoRotate)); });
$("resetCamera").addEventListener("click", () => { yaw = .55; pitch = .12; distance = 5.6; });
$("characterView").addEventListener("click", () => {
  if (activeKind !== "character") return;
  characterViewMode = characterViewMode === "render" ? "rig" : "render";
  applyCharacterView();
});
$("backToGame").addEventListener("click", () => { location.href = "./index.html"; });

canvas.addEventListener("pointerdown", (event) => { pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener("pointermove", (event) => {
  if (!pointer || pointer.id !== event.pointerId) return;
  yaw -= (event.clientX - pointer.x) * .008;
  pitch = Math.max(-.72, Math.min(.72, pitch + (event.clientY - pointer.y) * .006));
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});
canvas.addEventListener("pointerup", () => { pointer = null; });
canvas.addEventListener("pointercancel", () => { pointer = null; });
canvas.addEventListener("wheel", (event) => { event.preventDefault(); distance = Math.max(2.4, Math.min(12, distance + event.deltaY * .004)); }, { passive: false });
window.addEventListener("resize", fit);

populateAssetSelect();
setAsset("character", "scout");
fit();
cameraFrame();
requestAnimationFrame(frame);
