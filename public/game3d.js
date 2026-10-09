import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { aimPresetForDifficulty, normalizeAimSettings, resolveInputMode, shouldAutoLock, shouldDuckMusic } from "./game-rules.mjs";
import { selectGraphicsTier } from "./graphics-config.mjs";
import { createNightfallBackground, setNightfallScene, setNightfallTier } from "./nightfall-background.mjs";
import { activateAbility, createClassProgress, getClassDefinition, getClassStats, normalizeClassProgress } from "./class-rules.mjs";
import { composeWave, scaleEnemy, spawnSchedule, tacticalIntent } from "./enemy-rules.mjs";
import { getWeaponProfile } from "./combat-rules.mjs";
import { kingdomUnlocked as hasKingdom, levelFromXp, unlockedMaps } from "./progression-rules.mjs";
import { captureGameplayClip, playRandomReplay } from "./replay-clips.mjs";
import { RISK_PROFILES, rewardPreview, settleMatch } from "./reward-rules.mjs";
import { canAccessChest, createChestPositions, seededRandom } from "./chest-rules.mjs";
import { createExplorationState, evaluateExploration, explorationProgress } from "./exploration-rules.mjs";
import { biomeAt, createConnectedWorldLayout, createTerrainGrid, createWorldScatter, resolveWorldMovement, sampleWorldElevation } from "./world-layout.mjs";

const $ = id => document.getElementById(id);
const task4StorageKey = suffix => ["wastland", "survivor", suffix].join("-");
const canvas = $("game");
const aimReticle = $("aimReticle");
const controllerDebug = $("controllerDebug");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 3));
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, .1, 620);
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const ui = {
  hp: $("hpText"), hpBar: $("hpBar"), shield: $("shieldText"), shieldBar: $("shieldBar"), heat: $("heatText"), heatBar: $("heatBar"),
  scrap: $("scrapText"), kills: $("killsText"), wave: $("waveText"), level: $("levelText"), stage: $("stageText"), chapter: $("chapterText"), mission: $("missionText"), weapon: $("weaponText"), map: $("mapText"), exploration: $("explorationText"), phase: $("phaseText"), timer: $("timerText"), blue: $("blueScore"), red: $("redScore"),
  chest: $("chestPrompt"), prep: $("prepTimer"), shop: $("shopModal"), over: $("gameOverModal"), settings: $("settingsModal"),
  discoveryToast: $("discoveryToast"), discoveryTitle: $("discoveryTitle"), discoveryReward: $("discoveryReward"),
  controllerStatus: $("controllerStatus"), controllerOnly: $("controllerOnlyToggle"), soundToggle: $("soundToggle"), volume: $("volumeSlider"), musicToggle: $("musicToggle"), musicVolume: $("musicVolumeSlider"), musicSource: $("musicSource"), musicStatus: $("musicStatus"),
  voiceStatus: $("voiceStatus"), joinVoice: $("joinVoiceBtn"), muteVoice: $("muteVoiceBtn"), leaveVoice: $("leaveVoiceBtn"), offline: $("offlineToggle"), networkStatus: $("networkStatus"),
  aimPreset: $("aimPreset"), aimSensitivity: $("aimSensitivity"), adsSensitivity: $("adsSensitivity"), aimAssistStrength: $("aimAssistStrength"), graphicsTier: $("graphicsTier")
};
const welcomeScreen = $("welcomeScreen");
const lobbyScreen = $("lobbyScreen");
const profileStep = $("profileStep");
const returnStep = $("returnStep");
const linkProfileStep = $("linkProfileStep");
const profileContact = $("profileContact");
const profileAvatar = $("profileAvatar");
const profileName = $("profileName");
const profileBirthDate = $("profileBirthDate");
const ageConfirm = $("ageConfirm");
const parentSetup = $("parentSetup");
const parentContact = $("parentContact");
const mathStep = $("mathStep");
const mathQuestion = $("mathQuestion");
const mathAnswer = $("mathAnswer");
const mathTimer = $("mathTimer");
const mathMessage = $("mathMessage");
const profilePin = $("profilePin");
const returnPin = $("returnPin");
const profileMessage = $("profileMessage");
const returnMessage = $("returnMessage");
const profileSelector = $("profileSelector");
const lobbyPlayer = $("lobbyPlayer");
const storyMapSelect = $("storyMapSelect");
const homeBackdrop = $("homeBackdrop");
const nightfallBackground = $("nightfallBackground");
const MAPS = {
  wasteland: { label: "Wasteland", texture: "assets/wasteland-ground-v1.png", fog: 0x554331, hazard: 0x83ff47 },
  toxic: { label: "Toxic Ponds", texture: "assets/wasteland-ground-v1.png", fog: 0x344a2d, hazard: 0x93ff30 },
  ice: { label: "Icy Mountain", texture: "assets/icy-mountain-ground-v1.png", fog: 0xc3d9e7, hazard: 0x4dbbff },
  inferno: { label: "Fire Inferno", texture: "assets/fire-inferno-ground-v1.png", fog: 0x351510, hazard: 0xff5a24 }
};

function updateAvatarCards(value = profileAvatar.value) {
  document.querySelectorAll(".avatar-choice").forEach(card => {
    const selected = card.dataset.avatar === value;
    card.classList.toggle("selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  });
}
const guns = {
  scout: { label: "Scout", level: 0, max: Infinity, price: 12 },
  cannon: { label: "Cannon", level: 0, max: 100, price: 28 },
  inferno: { label: "Inferno", level: 0, max: 50, price: 42 }
};
let mapKey = "wasteland";
let mode = "solo";
let phase = "combat";
let timer = 60;
let menuOpen = false;
let countdown = 15;
let countdownDeadline = 0;
let graceUntil = 0;
let frontView = true;
let ground, player, ally;
let chests = [];
let chestSpawnRadius = 70;
let allies = [], enemies = [], bullets = [], hazards = [], flags = [], effects = [];
let cameraShake = 0;
let score = 0, kills = 0, scrap = 0, wave = 1, blue = 0, red = 0, shieldLevel = 0;
let playerLevel = 1, storyStage = 1, missionIndex = 0, kingdomUnlocked = false;
let riskLevel = localStorage.getItem("wastland-survivor-risk") || "standard";
const storyMissions = ["Survive the cycle", "Collect 60 scrap", "Defeat 10 raiders", "Reach stage 3", "Defend the frontier"];
const timelineAdvantages = ["Field Scavenger", "Reinforced Plating", "Rapid Reload", "Kingdom Vanguard"];
const soldierStory = [
  { title: "First Watch", text: "You are the last soldier on the Wasteland Survivor perimeter. Hold the line until dawn." },
  { title: "Broken Relay", text: "A ruined relay is broadcasting from beyond the old boundary. Push farther and recover it." },
  { title: "Toxic Crossing", text: "The raiders have poisoned the next route. Adapt to the hazards and keep moving." },
  { title: "Mountain Front", text: "The signal climbs into the ice. Your patrol map expands with every secured route." },
  { title: "Kingdom Rising", text: "The frontier is large enough to defend. Establish your Kingdom and keep the survivors moving." }
];
let activeGun = "scout";
let ctfPlayers = 4;
let botTeamSize = 2;
let difficultyRatio = .22;
let spawnQueue = 0;
let spawnTimer = 0;
let enemySpawnTypes = [];
let classProgress = createClassProgress();
let activeAbility = null;
let totalXp = 0;
const avatarClass = type => ({ medic: "tech", warden: "heavy" })[type] || type;
let replayCaptureActive = false;
let firing = false;
let adsActive = false;
let aim = new THREE.Vector3(0, 0, 1);
let lastButtons = [];
let controllerConnected = false;
let controllerOnly = localStorage.getItem("wastland-survivor-controller-only") === "true";
let audioEnabled = localStorage.getItem("wastland-survivor-audio") !== "off";
let audioVolume = Number(localStorage.getItem("wastland-survivor-volume") || 55);
let musicEnabled = localStorage.getItem("wastland-survivor-music") !== "off";
let musicVolume = Number(localStorage.getItem("wastland-survivor-music-volume") || 36);
let musicSource = localStorage.getItem("wastland-survivor-music-source") || "builtin";
let offlineMode = localStorage.getItem("wastland-survivor-offline") === "true";
let youthAccount = false;
let pendingProfile = null;
let activeProfile = null;
let editingProfile = false;
let mathExpected = 0;
let mathDeadline = 0;
let audioContext = null;
let musicTimer = null;
let musicStep = 0;
let localTracks = [];
let localTrackIndex = 0;
const localMusic = new Audio();
let localStream = null;
let voiceSocket = null;
let lobbySocket = null;
let lobbyId = null;
let lobbyPeers = 0;
let chestOccupants = 0;
let chestAccessGranted = false;
let lobbyRetryTimer = null;
let voiceMuted = false;
const voicePeers = new Map();
const touch = { mx: 0, mz: 0, ax: 0, az: 0, fire: false };
const keys = {};
const coarsePointer = matchMedia("(pointer: coarse)");
let mouseInputActive = false;
let inputMode = "mouse";
let viewYaw = 0;
const mouseAimScreen = { x: innerWidth / 2, y: innerHeight / 2 };
let lockedTarget = null;
let graphicsTierOverride = localStorage.getItem(task4StorageKey("graphics-tier")) || "auto";
let aimSettings = normalizeAimSettings({
  sensitivity: localStorage.getItem(task4StorageKey("aim-sensitivity")) || 1,
  adsSensitivity: localStorage.getItem(task4StorageKey("ads-sensitivity")) || 0.75,
  assistStrength: localStorage.getItem(task4StorageKey("assist-strength")) || 0.65,
  preset: localStorage.getItem(task4StorageKey("aim-preset")) || aimPresetForDifficulty(difficultyRatio),
});
const magazineSizes = { scout: 30, cannon: 12, inferno: 8 };
const magazines = { ...magazineSizes };
let reloadUntil = 0;
let worldLayout = createConnectedWorldLayout();
let explorationState = createExplorationState();
let discoveryToastUntil = 0;

function setInputMode(nextMode) {
  inputMode = nextMode;
  mouseInputActive = nextMode === "mouse";
  document.body.dataset.inputMode = nextMode;
  $("landscapeHint").classList.toggle("hidden", nextMode !== "touch" || matchMedia("(orientation: landscape)").matches);
}

function refreshInputMode() {
  setInputMode(resolveInputMode({ coarsePointer: coarsePointer.matches, mouseInputActive, controllerConnected }));
}

function persistAimSettings() {
  aimSettings = normalizeAimSettings({ sensitivity: ui.aimSensitivity.value, adsSensitivity: ui.adsSensitivity.value, assistStrength: ui.aimAssistStrength.value, preset: ui.aimPreset.value });
  localStorage.setItem(task4StorageKey("aim-sensitivity"), String(aimSettings.sensitivity));
  localStorage.setItem(task4StorageKey("ads-sensitivity"), String(aimSettings.adsSensitivity));
  localStorage.setItem(task4StorageKey("assist-strength"), String(aimSettings.assistStrength));
  localStorage.setItem(task4StorageKey("aim-preset"), aimSettings.preset);
  $("aimSensitivityValue").textContent = aimSettings.sensitivity.toFixed(2);
  $("adsSensitivityValue").textContent = aimSettings.adsSensitivity.toFixed(2);
  $("aimAssistStrengthValue").textContent = `${Math.round(aimSettings.assistStrength * 100)}%`;
}

function applyWorldMovement(actor, from = { x: 0, y: 0, z: 0 }) {
  const resolved = resolveWorldMovement(worldLayout, from, actor.g.position);
  actor.g.position.set(resolved.position.x, resolved.position.y, resolved.position.z);
  return resolved;
}

function applyExplorationDiscovery() {
  const discovery = evaluateExploration({ layout: worldLayout, state: explorationState, position: player.g.position });
  if (!discovery.events.length) return;
  explorationState = discovery.state;
  score += discovery.reward.score;
  scrap += discovery.reward.scrap;
  updateStoryProgress();
  const completion = discovery.events.find(event => event.kind === "completion");
  const locations = discovery.events.filter(event => event.kind !== "completion").map(event => event.label);
  ui.discoveryTitle.textContent = completion?.label || `Discovered: ${locations.join(" + ")}`;
  ui.discoveryReward.textContent = `+${discovery.reward.score} SCORE / +${discovery.reward.scrap} SCRAP`;
  ui.discoveryToast.classList.remove("hidden");
  discoveryToastUntil = performance.now() + 3200;
  const progress = explorationProgress(worldLayout, explorationState);
  document.dispatchEvent(new CustomEvent("wasteland:discovery", {
    detail: { events: discovery.events, reward: discovery.reward, progress },
  }));
  playTone(completion ? 760 : 620, .08, "triangle", .035);
}

scene.add(new THREE.HemisphereLight(0xaed8ff, 0x1a110c, 2));
scene.add(new THREE.AmbientLight(0xc8d0c6, .65));
const sun = new THREE.DirectionalLight(0xffefd1, 3);
sun.position.set(18, 28, 12);
sun.castShadow = true;
scene.add(sun);
const world = new THREE.Group();
scene.add(world);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}

function updateAimReticle() {
  if (!aimReticle || !player || phase === "menu" || phase === "over") return;
  if (frontView && inputMode === "mouse") {
    aimReticle.style.left = `${THREE.MathUtils.clamp(mouseAimScreen.x, 20, innerWidth - 20)}px`;
    aimReticle.style.top = `${THREE.MathUtils.clamp(mouseAimScreen.y, 20, innerHeight - 20)}px`;
    return;
  }
  const screenAim = aim.clone();
  screenAim.y = .8;
  screenAim.project(camera);
  const x = (screenAim.x * .5 + .5) * innerWidth;
  const y = (-screenAim.y * .5 + .5) * innerHeight;
  aimReticle.style.left = `${Math.max(20, Math.min(innerWidth - 20, x))}px`;
  aimReticle.style.top = `${Math.max(20, Math.min(innerHeight - 20, y))}px`;
}

const materialCache = new Map();
const boxGeometryCache = new Map();

function material(color, emissive = 0) {
  const key = `${color}:${emissive}`;
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .16, emissive: color, emissiveIntensity: emissive }));
  }
  return materialCache.get(key);
}

function boxGeometry(w, h, d) {
  const key = `${w}:${h}:${d}`;
  if (!boxGeometryCache.has(key)) boxGeometryCache.set(key, new THREE.BoxGeometry(w, h, d));
  return boxGeometryCache.get(key);
}

function unit(color, x, z, avatarType = "scout") {
  const group = new THREE.Group();
  const bodyGeometry = avatarType === "heavy" ? new THREE.CapsuleGeometry(.72, 1.05, 6, 12) : new THREE.CapsuleGeometry(.55, 1.1, 5, 10);
  const body = new THREE.Mesh(bodyGeometry, material(color, .08));
  body.castShadow = true;
  body.position.y = 1;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.75, .18, .18), material(0xcafcff, .9));
  visor.position.set(0, 1.28, .52);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(.22, .18, 1.05), material(0x252b31));
  gun.position.set(.38, 1.05, .58);
  group.add(body, visor, gun);
  if (avatarType === "ranger") {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(.62, .55, 6), material(0x1c3948));
    hood.position.y = 1.78;
    group.add(hood);
  } else if (avatarType === "heavy") {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(.7, .8, .28), material(0x515b68));
    pack.position.set(0, 1.05, -.48);
    group.add(pack);
  } else if (avatarType === "tech") {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .65, 8), material(0xffdf52, .7));
    antenna.position.set(0, 1.82, 0);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 8), material(0xff5d75, .9));
    beacon.position.set(0, 2.15, 0);
    group.add(antenna, beacon);
  }
  group.position.set(x, 0, z);
  world.add(group);
  return { g: group, hp: 100, shield: 0, shieldMax: 0, cooldown: 0, alive: true, orbitAngle: Math.random() * Math.PI * 2, orbitDirection: Math.random() > .5 ? 1 : -1 };
}

function addBox({ x, z, w, d, h = 2, color = 0x444444, emissive = 0, y = null, rotation = 0 }) {
  const mesh = new THREE.Mesh(boxGeometry(w, h, d), material(color, emissive));
  mesh.position.set(x, y ?? sampleWorldElevation(worldLayout, { x, z }) + h / 2, z);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
  return mesh;
}

function createTerrainMesh(texture) {
  const tier = effectiveGraphicsTier();
  const terrain = createTerrainGrid(worldLayout, { segments: tier === "low" ? 40 : tier === "medium" ? 56 : 72 });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(terrain.positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(terrain.uvs, 2));
  geometry.setIndex(terrain.indices);
  const biomeColors = new Map(worldLayout.biomes.map(zone => [zone.id, new THREE.Color(zone.ground).lerp(new THREE.Color(0xffffff), .34)]));
  const colors = [];
  for (let index = 0; index < terrain.positions.length; index += 3) {
    const color = biomeColors.get(biomeAt(worldLayout, { x: terrain.positions[index], z: terrain.positions[index + 2] }).id);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, vertexColors: true, roughness: 1, metalness: 0 }));
  mesh.receiveShadow = true;
  return mesh;
}

function addPlane({ x, z, w, d, color, y = .04, rotation = 0, emissive = 0 }) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material(color, emissive));
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotation;
  mesh.position.set(x, y + sampleWorldElevation(worldLayout, { x, z }), z);
  mesh.receiveShadow = true;
  world.add(mesh);
  return mesh;
}

function addRoadSegment(segment, color = 0x24272b) {
  const dx = segment.x2 - segment.x1;
  const dz = segment.z2 - segment.z1;
  const length = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(length / 8));
  const sideX = -dz / length * segment.width / 2;
  const sideZ = dx / length * segment.width / 2;
  const positions = [];
  const indices = [];
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const x = segment.x1 + dx * t;
    const z = segment.z1 + dz * t;
    const elevation = segment.underpassClearance ? 0 : sampleWorldElevation(worldLayout, { x, z });
    positions.push(x + sideX, elevation + .065, z + sideZ, x - sideX, elevation + .065, z - sideZ);
  }
  for (let step = 0; step < steps; step++) {
    const left = step * 2;
    indices.push(left, left + 2, left + 1, left + 1, left + 2, left + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.receiveShadow = true;
  world.add(mesh);
}

function addRampMesh(ramp) {
  if (ramp.kind !== "overpass") return;
  const x0 = ramp.x - ramp.w / 2;
  const x1 = ramp.x + ramp.w / 2;
  const z0 = ramp.z - ramp.d / 2;
  const z1 = ramp.z + ramp.d / 2;
  const h00 = ramp.axis === "x" ? ramp.from : ramp.from;
  const h10 = ramp.axis === "x" ? ramp.to : ramp.from;
  const h11 = ramp.axis === "x" ? ramp.to : ramp.to;
  const h01 = ramp.axis === "x" ? ramp.from : ramp.to;
  const positions = [
    x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1,
    x0, h00, z0, x1, h10, z0, x1, h11, z1, x0, h01, z1,
  ];
  const indices = [
    4, 5, 6, 4, 6, 7,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5,
    3, 7, 6, 3, 6, 2,
    0, 1, 5, 0, 5, 4,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material(0x454b50));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
}

function addInstancedRocks(placements) {
  const mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), material(0x49372b), placements.length);
  const transform = new THREE.Object3D();
  placements.forEach((placement, index) => {
    transform.position.set(placement.x, sampleWorldElevation(worldLayout, placement) + placement.scale * .52, placement.z);
    transform.rotation.set(placement.rotation * .17, placement.rotation, placement.rotation * .08);
    transform.scale.set(placement.scale, placement.scale * .72, placement.scale * .9);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.castShadow = effectiveGraphicsTier() === "high";
  mesh.receiveShadow = true;
  world.add(mesh);
}

function addBurnedForest() {
  const forest = worldLayout.landmarks.find(item => item.id === "burned-forest");
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.34, .52, 1, 6), material(0x1d1714, .04), forest.count);
  const transform = new THREE.Object3D();
  for (let index = 0; index < forest.count; index++) {
    const x = forest.x - forest.w / 2 + 5 + (index % 9) * 9 + Math.sin(index) * 2;
    const z = forest.z - forest.d / 2 + 6 + Math.floor(index / 9) * 18 + Math.cos(index * 1.7) * 4;
    const height = 5 + index % 3;
    transform.position.set(x, sampleWorldElevation(worldLayout, { x, z }) + height / 2, z);
    transform.rotation.set(0, index * .71, Math.sin(index) * .18);
    transform.scale.set(1, height, 1);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  }
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.castShadow = effectiveGraphicsTier() !== "low";
  world.add(mesh);
}

function addDestroyedCars() {
  const wheelGeometry = new THREE.CylinderGeometry(.48, .48, .38, 8);
  const groups = new Map();
  worldLayout.cars.forEach(car => groups.set(car.color, [...(groups.get(car.color) || []), car]));
  groups.forEach((cars, color) => {
    const body = new THREE.InstancedMesh(boxGeometry(3.8, .9, 7.2), material(color, .04), cars.length);
    const cabin = new THREE.InstancedMesh(boxGeometry(3.05, .86, 3.5), material(0x29363a, .08), cars.length);
    const wheels = new THREE.InstancedMesh(wheelGeometry, material(0x151718), cars.length * 4);
    const transform = new THREE.Object3D();
    let wheelIndex = 0;
    cars.forEach((car, index) => {
      const groundY = sampleWorldElevation(worldLayout, car);
      const crush = car.crushed ? .5 : 1;
      transform.position.set(car.x, groundY + .45 * crush, car.z);
      transform.rotation.set((index % 3 - 1) * .06, car.rotation, (index % 2 ? 1 : -1) * .04);
      transform.scale.set(1, crush, 1);
      transform.updateMatrix();
      body.setMatrixAt(index, transform.matrix);

      const cabinOffset = -.4;
      transform.position.set(car.x + Math.sin(car.rotation) * cabinOffset, groundY + .92 * crush, car.z + Math.cos(car.rotation) * cabinOffset);
      transform.scale.set(1, crush, 1);
      transform.updateMatrix();
      cabin.setMatrixAt(index, transform.matrix);

      for (const localX of [-1.72, 1.72]) {
        for (const localZ of [-2.25, 2.25]) {
          transform.position.set(
            car.x + localX * Math.cos(car.rotation) + localZ * Math.sin(car.rotation),
            groundY + .34 * crush,
            car.z - localX * Math.sin(car.rotation) + localZ * Math.cos(car.rotation),
          );
          transform.rotation.set(0, car.rotation, Math.PI / 2);
          transform.scale.set(1, crush, 1);
          transform.updateMatrix();
          wheels.setMatrixAt(wheelIndex++, transform.matrix);
        }
      }
    });
    for (const mesh of [body, cabin, wheels]) {
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mesh.castShadow = effectiveGraphicsTier() === "high";
      world.add(mesh);
    }
  });
}

function addStructure(structure) {
  const groundY = sampleWorldElevation(worldLayout, structure);
  let mesh;
  if (structure.kind === "pentagon") {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(structure.w * .43, structure.w * .47, structure.h, 5), material(structure.color, .035));
    mesh.position.set(structure.x, groundY + structure.h / 2, structure.z);
    mesh.rotation.y = structure.rotation || 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    world.add(mesh);
  } else {
    mesh = addBox({ ...structure, emissive: structure.kind === "house" ? .1 : .055 });
  }
  if (structure.kind === "house") {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(structure.w * .72, 2.8, 4), material(structure.damaged ? 0x392d26 : 0x554035, .025));
    roof.position.set(structure.x, groundY + structure.h + 1.2, structure.z);
    roof.rotation.set(structure.damaged ? .13 : 0, Math.PI / 4 + (structure.rotation || 0), structure.damaged ? -.08 : 0);
    roof.castShadow = true;
    world.add(roof);
    addBox({ x: structure.x, z: structure.z + structure.d / 2 + .08, w: 2.2, d: .3, h: 2.5, color: 0x241b16, y: groundY + 1.25, rotation: structure.rotation || 0 });
  } else if (structure.kind === "tower") {
    addBox({
      x: structure.x,
      z: structure.z + structure.d / 2 + .08,
      w: structure.w * .56,
      d: .24,
      h: structure.h * .48,
      color: 0x6b93a0,
      emissive: .12,
      y: groundY + structure.h * .58,
    });
  }
  if (structure.damaged) {
    addBox({
      x: structure.x + structure.w * .24,
      z: structure.z + structure.d * .22,
      w: Math.max(3, structure.w * .28),
      d: Math.max(3, structure.d * .24),
      h: .7,
      color: 0x252525,
      rotation: (structure.rotation || 0) + .35,
    });
  }
  return mesh;
}

function addBiomeGateways() {
  const gateways = [
    { x: -18, z: 32, color: 0xff4d28 },
    { x: -18, z: -32, color: 0x8ee9ff },
    { x: 18, z: 32, color: 0xffcf63 },
    { x: 18, z: -32, color: 0xd5d9de },
  ];
  gateways.forEach(gateway => {
    for (const offset of [-5, 5]) {
      const x = gateway.x + offset;
      const y = sampleWorldElevation(worldLayout, { x, z: gateway.z });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.36, .52, 6, 8), material(gateway.color, .45));
      post.position.set(x, y + 3, gateway.z);
      post.castShadow = true;
      world.add(post);
    }
  });
}

function addLandmarkAccents() {
  for (const offsetX of [-18, 18]) {
    for (const offsetZ of [-15, 15]) addBox({ x: -202 + offsetX, z: 18 + offsetZ, w: 6, d: 6, h: 13, color: 0x55504a });
  }
  for (let index = 0; index < 6; index++) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(.55, .68, 5.2, 8), material(0xb7b1a8));
    column.position.set(152 + index * 5.5, sampleWorldElevation(worldLayout, { x: 152 + index * 5.5, z: -18 }) + 2.6, -18);
    column.rotation.z = index === 4 ? .18 : 0;
    column.castShadow = true;
    world.add(column);
  }
  for (let index = 0; index < 5; index++) {
    addBox({ x: -98 + index * 5.4, z: 176 + (index % 2) * 4, w: 3.2, d: 3.2, h: 2.2, color: 0x332b25, rotation: index * .18 });
    addBox({ x: 99 + index * 6, z: -178, w: 1.1, d: 10, h: 4.5, color: 0x3d342c, rotation: index % 2 ? .16 : -.12 });
  }
}

function addConnectedWorldObjects() {
  const border = worldLayout.size;
  const half = worldLayout.size / 2;
  addBox({ x: 0, z: -half, w: border, d: 2, h: 3.2, color: 0x25282b });
  addBox({ x: 0, z: half, w: border, d: 2, h: 3.2, color: 0x25282b });
  addBox({ x: -half, z: 0, w: 2, d: border, h: 3.2, color: 0x25282b });
  addBox({ x: half, z: 0, w: 2, d: border, h: 3.2, color: 0x25282b });
  worldLayout.roads.forEach(road => addRoadSegment(road, road.ramp ? 0x384047 : 0x222529));
  worldLayout.ramps.forEach(addRampMesh);
  worldLayout.bridges.forEach(bridge => {
    addBox({ ...bridge, h: .8, color: 0x5d5a53, y: bridge.height - .35 });
    if (bridge.w >= bridge.d) {
      addBox({ x: bridge.x, z: bridge.z - bridge.d / 2 + .7, w: bridge.w, d: 1.2, h: 1.2, color: 0x3d4246, y: bridge.height + .55 });
      addBox({ x: bridge.x, z: bridge.z + bridge.d / 2 - .7, w: bridge.w, d: 1.2, h: 1.2, color: 0x3d4246, y: bridge.height + .55 });
    } else {
      addBox({ x: bridge.x - bridge.w / 2 + .7, z: bridge.z, w: 1.2, d: bridge.d, h: 1.2, color: 0x3d4246, y: bridge.height + .55 });
      addBox({ x: bridge.x + bridge.w / 2 - .7, z: bridge.z, w: 1.2, d: bridge.d, h: 1.2, color: 0x3d4246, y: bridge.height + .55 });
    }
  });
  worldLayout.tunnels.forEach(tunnel => {
    addBox({ x: tunnel.x, z: tunnel.z - tunnel.d / 2, w: tunnel.w, d: 2, h: tunnel.clearance + 2, color: 0x5f7482 });
    addBox({ x: tunnel.x, z: tunnel.z + tunnel.d / 2, w: tunnel.w, d: 2, h: tunnel.clearance + 2, color: 0x5f7482 });
    addBox({ x: tunnel.x, z: tunnel.z, w: tunnel.w, d: tunnel.d + 2, h: 2, color: 0x465966, y: tunnel.clearance + 1 });
  });
  const lava = worldLayout.detail.find(item => item.id === "inferno-lava-river");
  const ravine = worldLayout.detail.find(item => item.id === "ice-ravine");
  addPlane({ ...lava, color: 0x7e1f12, emissive: .35, rotation: -.18, y: .08 });
  addPlane({ ...ravine, color: 0x69c8e8, emissive: .12, rotation: .2, y: .07 });
  addBurnedForest();
  worldLayout.structures.forEach(addStructure);
  addLandmarkAccents();
  addDestroyedCars();
  addBiomeGateways();
}

function resetMap() {
  world.clear();
  worldLayout = createConnectedWorldLayout();
  hazards = [];
  enemies = [];
  bullets = [];
  effects = [];
  flags = [];
  const cfg = MAPS[mapKey];
  scene.fog = new THREE.FogExp2(cfg.fog, .009);
  scene.background = new THREE.Color(cfg.fog);
  const texture = new THREE.TextureLoader().load(cfg.texture);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = THREE.SRGBColorSpace;
  const mapScale = mode === "solo" ? 1 + Math.min(1.5, (storyStage - 1) * .18) : 1;
  const mapSize = worldLayout.size;
  ground = createTerrainMesh(texture);
  world.add(ground);
  addConnectedWorldObjects();
  addInstancedRocks(createWorldScatter(worldLayout, { seed: `${mapKey}:${mode}:${storyStage}:rocks`, count: Math.round(72 * mapScale) }));
  const hazardCount = 4 + Math.floor(storyStage / 2);
  const hazardPlacements = createWorldScatter(worldLayout, { seed: `${mapKey}:${mode}:${storyStage}:hazards`, count: hazardCount });
  for (const placement of hazardPlacements) {
    const position = new THREE.Vector3(placement.x, .05, placement.z);
    position.y = sampleWorldElevation(worldLayout, position) + .05;
    const hazard = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.8, .12, 30), material(cfg.hazard, .7));
    hazard.position.copy(position);
    world.add(hazard);
    hazards.push(position);
  }
  chestSpawnRadius = mapSize * .42;
  chests = Array.from({ length: 1 }, (_, index) => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(boxGeometry(1.7, 1.1, 1.2), material(0x9d6b1f, .16));
    box.position.y = .7;
    const glow = new THREE.Mesh(boxGeometry(1.35, .18, 1), material(0xffdf52, 1));
    glow.position.y = 1.28;
    group.add(box, glow);
    group.visible = false;
    world.add(group);
    return { id: `chest-${index + 1}`, group, x: 0, z: 0 };
  });
  player = unit(0x55e5ff, 0, 0, activeProfile?.avatarType || "scout");
  applyWorldMovement(player);
  classProgress = normalizeClassProgress({ ...classProgress, classId: avatarClass(activeProfile?.avatarType || "scout") });
  const classStats = getClassStats(classProgress);
  player.hp = classStats.maxHealth;
  player.maxHp = classStats.maxHealth;
  player.moveSpeedMultiplier = classStats.moveSpeedMultiplier;
  player.spreadMultiplier = classStats.spreadMultiplier;
  player.scrapMultiplier = classStats.scrapMultiplier;
  player.shieldMax = classStats.maxShield + shieldLevel * 30;
  player.shield = player.shieldMax;
  allies = [];
  const botCount = mode === "solo" ? 0 : mode === "ctf" ? ctfPlayers / 2 - 1 : botTeamSize - 1;
  for (let index = 0; index < botCount; index++) {
    const bot = unit(0x3985ff, 2.5 + index * 2, 1.5, index % 2 ? "tech" : "ranger");
    applyWorldMovement(bot);
    allies.push(bot);
  }
  ally = allies[0] || null;
  if (mode === "ctf") createCtfFlags();
}

function createCtfFlags() {
  const positions = [];
  while (positions.length < 3) {
    const position = new THREE.Vector3((Math.random() - .5) * 180, 0, (Math.random() - .5) * 180);
    position.y = sampleWorldElevation(worldLayout, position);
    if (positions.every(other => other.distanceTo(position) > 20)) positions.push(position);
  }
  positions.forEach((position, index) => {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 3.8, 8), material(0xe9e6d7, .1));
    pole.position.y = 1.9;
    const banner = new THREE.Mesh(new THREE.BoxGeometry(1.25, .78, .08), material(0xffdf52, .5));
    banner.position.set(.55, 3.05, 0);
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.5, 4.7, 32), new THREE.MeshBasicMaterial({ color: 0xffdf52, transparent: true, opacity: .72, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .08;
    group.add(pole, banner, ring);
    group.position.copy(position);
    world.add(group);
    flags.push({ group, position, index, target: position.clone(), moveTimer: 14 + Math.random() * 10 });
  });
}

function difficultyName() {
  if (difficultyRatio <= .1) return "easy";
  if (difficultyRatio <= .22) return "medium";
  if (difficultyRatio <= .35) return "expert";
  return "insane";
}

function spawnEnemy(index = enemies.length, requestedType = null) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 46 + Math.random() * 92;
  const type = requestedType || enemySpawnTypes.shift() || "rusher";
  const visualClass = ["heavy", "shield", "boss", "mutant"].includes(type) ? "heavy" : type === "sniper" ? "ranger" : type === "drone" ? "tech" : "scout";
  const color = ({ rusher: 0xff5b55, shooter: 0xff8b45, sniper: 0xb97aff, shield: 0x4dbbff, heavy: 0xff3d3d, drone: 0x66fcf1, mutant: 0x8cff4d, boss: 0xffcf40 })[type];
  const enemy = unit(color, Math.cos(angle) * radius, Math.sin(angle) * radius, visualClass);
  applyWorldMovement(enemy);
  const scaled = scaleEnemy(type, { wave, difficulty: difficultyName(), playerSkill: playerLevel });
  enemy.enemyType = type;
  enemy.maxHp = scaled.health;
  enemy.hp = scaled.health;
  enemy.damage = scaled.damage;
  enemy.range = scaled.range;
  enemy.speed = scaled.speed;
  enemy.orbitRadius = radius;
  enemy.cooldown = index % 2 === 0 ? 25 + index * 12.5 : 37.5 + index * 6;
  enemy.botIndex = enemies.length;
  enemies.push(enemy);
}

function start() {
  blue = red = score = kills = scrap = shieldLevel = 0;
  wave = 1;
  activeGun = "scout";
  explorationState = createExplorationState();
  discoveryToastUntil = 0;
  ui.discoveryToast.classList.add("hidden");
  ui.over.classList.add("hidden");
  ui.shop.classList.add("hidden");
  Object.values(guns).forEach(gun => { gun.level = 0; });
  loadProgress(activeProfile);
  resetMap();
  ensureLobbyRoom();
  phase = "loadout";
  timer = 0;
  ui.phase.textContent = "LOADOUT";
  ui.timer.textContent = "WAITING";
  $("loadoutMode").textContent = mode === "solo" ? "STORY SURVIVAL" : mode === "teams" ? `${botTeamSize}V${botTeamSize}` : `${ctfPlayers}-PLAYER CTF`;
  $("loadoutMap").textContent = MAPS[mapKey].label.toUpperCase();
  $("loadoutRoomModal").classList.remove("hidden");
  document.body.classList.add("loadout-active");
  updateArmory();
}

function beginCountdown() {
  document.body.classList.remove("loadout-active");
  phase = "countdown";
  countdown = 15;
  timer = 15;
  countdownDeadline = Date.now() + 15000;
  firing = false;
  touch.mx = touch.mz = touch.ax = touch.az = 0;
  touch.fire = false;
  clearKeyboardInput();
  $("matchCountdown").classList.remove("hidden");
  $("countdownNumber").textContent = "15";
  setNightfallScene("countdown");
}

function nextCombat() {
  phase = "combat";
  setNightfallScene("game");
  timer = mode === "ctf" ? 300 : 60;
  ui.chest.classList.add("hidden");
  $("chestLocator").classList.add("hidden");
  chestAccessGranted = false;
  chests.forEach(chest => { chest.group.visible = false; });
  player.hp = player.maxHp || 100;
  player.shield = player.shieldMax;
  player.alive = true;
  allies.forEach(bot => { bot.hp = 100; bot.alive = true; bot.g.visible = true; bot.respawn = 0; });
  enemies.forEach(enemy => world.remove(enemy.g));
  enemies = [];
  enemySpawnTypes = mode === "solo"
    ? composeWave({ wave, difficulty: difficultyName(), map: mapKey, playerCount: 1 })
    : Array.from({ length: mode === "teams" ? botTeamSize + wave - 1 : ctfPlayers / 2 }, () => "shooter");
  spawnQueue = enemySpawnTypes.length;
  spawnTimer = 0;
  if (!replayCaptureActive) {
    replayCaptureActive = true;
    captureGameplayClip(canvas, { durationMs: 12000, metadata: { mode, map: mapKey, wave } })
      .finally(() => { replayCaptureActive = false; });
  }
}

function prep() {
  saveProgress();
  phase = "prep";
  timer = 60;
  const positions = createChestPositions({ mapRadius: chestSpawnRadius, random: seededRandom(`${mapKey}:${mode}:${wave}`) });
  chests.forEach((chest, index) => {
    const resolved = resolveWorldMovement(worldLayout, { x: 0, y: 0, z: 0 }, positions[index]);
    chest.x = resolved.position.x;
    chest.z = resolved.position.z;
    chest.group.position.set(resolved.position.x, resolved.position.y, resolved.position.z);
    chest.group.visible = true;
  });
  ui.chest.classList.add("hidden");
  $("chestLocator").classList.remove("hidden");
  chestOccupants = 0;
  chestAccessGranted = false;
  $("chestOccupancy").textContent = "Access slots: 0/2";
  enemies.forEach(enemy => world.remove(enemy.g));
  enemies = [];
  updateArmory();
  playTone(480, .1, "sine", .05);
}

function finishRound(winner) {
  if (mode === "solo") {
    if (winner === "red") gameOver("Survivor Eliminated");
    else {
      wave++;
      prep();
    }
    return;
  }
  winner === "blue" ? blue++ : red++;
  if (blue === 2 || red === 2) gameOver(`${blue > red ? "Blue" : "Red"} Team Wins`);
  else prep();
}

function gameOver(title) {
  const outcome = title === "Survivor Eliminated" ? "loss" : (/Draw/i.test(title) ? "draw" : "win");
  const previousRewards = activeProfile?.progress?.rewards || {};
  const reward = settleMatch({
    outcome, risk: riskLevel, difficulty: difficultyName(), kills, wave, score,
    currentScrap: scrap, currentXp: totalXp, winStreak: previousRewards.winStreak || 0,
  });
  scrap = reward.nextScrap;
  totalXp = reward.nextXp;
  playerLevel = levelFromXp(totalXp);
  if (activeProfile?.progress) {
    activeProfile.progress.matches = Math.max(0, Number(activeProfile.progress.matches) || 0) + 1;
    activeProfile.progress.deaths = Math.max(0, Number(activeProfile.progress.deaths) || 0) + (title === "Survivor Eliminated" ? 1 : 0);
    activeProfile.progress.wins = Math.max(0, Number(activeProfile.progress.wins) || 0) + (/Wins|Captures/.test(title) ? 1 : 0);
    activeProfile.progress.rewards = { winStreak: reward.winStreak, lifetimeRewards: Math.max(0, Number(previousRewards.lifetimeRewards) || 0) + reward.scrapEarned };
  }
  saveProgress();
  syncPublicPlayer();
  reportMatch(title);
  phase = "over";
  $("finalKills").textContent = kills;
  $("finalScrap").textContent = scrap;
  $("finalScore").textContent = score;
  $("rewardSummary").textContent = `${RISK_PROFILES[reward.risk].label}: +${reward.xpEarned} XP, +${reward.scrapEarned} scrap${reward.scrapPenalty ? `, -${reward.scrapPenalty} risk penalty` : ""}. Level ${playerLevel}.`;
  ui.over.querySelector(".danger").textContent = title;
  ui.over.classList.remove("hidden");
  localStorage.setItem("wastland-survivor-best", String(Math.max(Number(localStorage.getItem("wastland-survivor-best") || 0), score)));
  playTone(100, .38, "sawtooth", .08);
}

function barrelCount(gun, level) {
  if (gun === "cannon") return level >= 100 ? 4 : level >= 75 ? 3 : level >= 50 ? 2 : 1;
  if (gun === "inferno") return level >= 50 ? 4 : level >= 38 ? 3 : level >= 25 ? 2 : 1;
  return 1;
}

function weaponProfile() {
  const profile = getWeaponProfile(activeGun, guns[activeGun].level);
  return {
    name: profile.name, level: profile.level, damage: profile.damage,
    delay: profile.fireDelayMs / 1000, shots: profile.projectiles,
    pierce: profile.penetration,
    spread: THREE.MathUtils.degToRad(profile.spreadDegrees)
      * (player?.spreadMultiplier || 1)
      * (activeAbility?.id === "focus" && Date.now() < activeAbility.endsAt ? activeAbility.modifiers.spreadMultiplier : 1),
    recoil: profile.recoil,
  };
}

function fire(actor, target, profile = null) {
  if (actor.cooldown > 0) return;
  if (actor === player && !profile) {
    if (Date.now() < reloadUntil) return;
    if (magazines[activeGun] <= 0) {
      reloadWeapon(false);
      return;
    }
    magazines[activeGun]--;
  }
  const weapon = profile || weaponProfile();
  actor.cooldown = weapon.delay;
  const direction = target.clone().sub(actor.g.position);
  direction.y = 0;
  if (!direction.lengthSq()) return;
  direction.normalize();
  actor.g.rotation.y = Math.atan2(direction.x, direction.z);
  for (let index = 0; index < weapon.shots; index++) {
    const offset = (index - (weapon.shots - 1) / 2) * weapon.spread;
    const shotDirection = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), offset);
    const projectile = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 8), material(0xffdf52, 1));
    projectile.position.copy(actor.g.position).add(new THREE.Vector3(0, 1, .2));
    world.add(projectile);
    projectile.scale.set(1, 1, 2.4);
    bullets.push({ m: projectile, v: shotDirection.multiplyScalar(35), life: 1.1, blue: actor === player || allies.includes(actor), damage: weapon.damage, pierce: weapon.pierce, hits: new Set() });
  }
  burst(actor.g.position.clone().add(new THREE.Vector3(0, 1, .6)), actor === player || allies.includes(actor) ? 0x66fcf1 : 0xff5d75, 4);
  if (actor === player) cameraShake = Math.min(.18, cameraShake + .07);
  if (actor === player) playTone(activeGun === "scout" ? 120 : 90, .04, "square", .035);
}

function reloadWeapon(manual = true) {
  if (Date.now() < reloadUntil || magazines[activeGun] >= magazineSizes[activeGun]) return;
  reloadUntil = Date.now() + (manual ? 900 : 1100);
  setTimeout(() => {
    magazines[activeGun] = magazineSizes[activeGun];
    playTone(420, .05, "triangle", .025);
  }, manual ? 900 : 1100);
}

function cycleWeapon(direction = 1) {
  const available = Object.keys(guns).filter(gun => gunUnlocked(gun) || gun === activeGun);
  const index = available.indexOf(activeGun);
  equip(available[(index + direction + available.length) % available.length]);
}

function interact() {
  if (phase !== "prep") return;
  if (!canAccessChest(player.g.position, chests)) return;
  if (offlineMode || mode === "solo" || lobbySocket?.readyState !== WebSocket.OPEN) {
    chestAccessGranted = true;
    ui.shop.classList.remove("hidden");
    return;
  }
  lobbySocket.send(JSON.stringify({ type: "chest-enter" }));
}

function triggerAbility() {
  if (!player?.alive || phase !== "combat") return;
  const result = activateAbility(classProgress, Date.now());
  if (!result.activated) return;
  classProgress = result.progress;
  activeAbility = result.effect;
  if (result.effect.id === "repair-pulse") {
    player.shield = Math.min(player.shieldMax, player.shield + result.effect.modifiers.selfShieldRestore);
    allies.forEach(bot => { bot.shield = Math.min(bot.shieldMax || 0, (bot.shield || 0) + result.effect.modifiers.allyShieldRestore); });
  }
  if (result.effect.id === "dash") {
    const direction = new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw));
    const from = player.g.position.clone();
    player.g.position.addScaledVector(direction, 8);
    applyWorldMovement(player, from);
  }
  document.dispatchEvent(new CustomEvent("wasteland:ability", { detail: { inputMode } }));
  playTone(520, .05, "sine", .025);
}

function burst(position, color, count = 7) {
  for (let index = 0; index < count; index++) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(.045 + Math.random() * .05, 5, 5), material(color, .8));
    spark.position.copy(position);
    world.add(spark);
    effects.push({ mesh: spark, velocity: new THREE.Vector3((Math.random() - .5) * 5, Math.random() * 3, (Math.random() - .5) * 5), life: .28 + Math.random() * .22 });
  }
}

function hitEnemy(enemy, damage) {
  enemy.hp -= damage;
  burst(enemy.g.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffdf52, 5);
  if (enemy.hp <= 0) {
    enemy.alive = false;
    if (mode === "ctf") {
      enemy.respawn = 4;
      enemy.g.visible = false;
    } else world.remove(enemy.g);
    kills++;
    score += 100;
    scrap += Math.round(12 * (player.scrapMultiplier || 1));
    totalXp += enemy.enemyType === "boss" ? 1000 : Math.round((enemy.maxHp || 100) / 2);
    updateStoryProgress();
    playTone(260, .06, "triangle", .04);
  }
}

function applyDamage(target, amount) {
  if (target === player && Date.now() < graceUntil) return;
  if (target === player && activeAbility?.id === "shield-brace" && Date.now() < activeAbility.endsAt) {
    amount *= activeAbility.modifiers.incomingDamageMultiplier;
  }
  let remaining = amount;
  if (target === player && target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }
  target.hp -= remaining;
}

function deadzone(value) { return Math.abs(value) < .18 ? 0 : value; }

function updateControllerState(connected) {
  if (connected === controllerConnected) return;
  controllerConnected = connected;
  ui.controllerOnly.disabled = !connected;
  ui.controllerStatus.textContent = connected ? "Controller connected" : "No controller connected";
  if (!connected) {
    firing = false;
    lastButtons = [];
  }
  refreshInputMode();
}

function controllerLocked() { return controllerOnly && controllerConnected; }

function pollController() {
  const pad = [...navigator.getGamepads()].find(Boolean);
  updateControllerState(Boolean(pad));
  const debug = new URLSearchParams(location.search).has("debug");
  if (!pad) {
    if (debug) { controllerDebug.classList.remove("hidden"); $("debugPadName").textContent = "No controller detected"; }
    return { mx: 0, mz: 0, ax: 0, az: 0, fire: false, ads: false };
  }
  const pressed = pad.buttons.map(button => button.pressed);
  const justPressed = index => pressed[index] && !lastButtons[index];
  lastButtons = pressed;
  const result = {
    mx: deadzone(pad.axes[0] || 0), mz: deadzone(pad.axes[1] || 0), ax: deadzone(pad.axes[2] || 0), az: deadzone(pad.axes[3] || 0),
    fire: (pad.buttons[7]?.value || 0) > .2, ads: (pad.buttons[6]?.value || 0) > .2,
    interact: justPressed(0), ability: justPressed(1), reload: justPressed(2), weapon: justPressed(3), pause: justPressed(9), switchTarget: justPressed(11),
    dpadUp: justPressed(12), dpadDown: justPressed(13), dpadLeft: justPressed(14), dpadRight: justPressed(15),
  };
  if (Math.hypot(result.mx, result.mz, result.ax, result.az) > .08 || result.fire || result.ads || pressed.some(Boolean)) setInputMode("controller");
  if (debug) {
    controllerDebug.classList.remove("hidden");
    $("debugPadName").textContent = pad.id || "Xbox controller";
    $("debugAxes").textContent = `LX ${result.mx.toFixed(2)} · LY ${result.mz.toFixed(2)} · RX ${result.ax.toFixed(2)} · RY ${result.az.toFixed(2)}`;
    $("debugButtons").textContent = `Buttons: ${pressed.map((down, index) => down ? index : null).filter(index => index !== null).join(", ") || "none"}`;
    $("debugAction").textContent = result.fire ? "Action: FIRE" : result.ads ? "Action: ADS" : result.pause ? "Action: PAUSE" : result.reload ? "Action: RELOAD" : result.weapon ? "Action: WEAPON" : result.ability ? "Action: ABILITY" : result.interact ? "Action: INTERACT" : "Action: movement / aim";
  }
  return result;
}

function nearest(unit, candidates) {
  return candidates.filter(candidate => candidate.alive).sort((left, right) => left.g.position.distanceToSquared(unit.g.position) - right.g.position.distanceToSquared(unit.g.position))[0];
}

function switchLockedTarget() {
  const living = enemies.filter(enemy => enemy.alive).sort((left, right) => left.g.position.distanceToSquared(player.g.position) - right.g.position.distanceToSquared(player.g.position));
  if (!living.length) { lockedTarget = null; return; }
  lockedTarget = living[(living.indexOf(lockedTarget) + 1) % living.length];
}

function nearestFlag(unit) {
  return flags.slice().sort((left, right) => left.position.distanceToSquared(unit.g.position) - right.position.distanceToSquared(unit.g.position))[0];
}

function moveBot(bot, destination, speed, dt) {
  const direction = destination.clone().sub(bot.g.position);
  direction.y = 0;
  if (direction.length() > 1.4) {
    const from = bot.g.position.clone();
    bot.g.position.addScaledVector(direction.normalize(), speed * dt);
    applyWorldMovement(bot, from);
    bot.g.rotation.y = Math.atan2(direction.x, direction.z);
  }
  return direction.length();
}

function updateCtfBots(dt) {
  const blueTeam = [player, ...allies].filter(unit => unit.alive);
  for (const bot of allies) {
    if (!bot.alive) continue;
    const enemy = nearest(bot, enemies);
    const flag = nearestFlag(bot);
    const closeEnemy = enemy && enemy.g.position.distanceTo(bot.g.position) < 13;
    moveBot(bot, closeEnemy ? enemy.g.position : flag.position, 4, dt);
    if (closeEnemy) fire(bot, enemy.g.position, { damage: 32, delay: .42, shots: 1, pierce: 0, spread: 0 });
  }
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const rival = nearest(enemy, blueTeam);
    const flag = nearestFlag(enemy);
    const closeRival = rival && rival.g.position.distanceTo(enemy.g.position) < 13;
    const distance = moveBot(enemy, closeRival ? rival.g.position : flag.position, 4.2, dt);
    if (closeRival && distance < 1.6) applyDamage(rival, 16 * dt);
  }
}

function updateSoloEnemies(dt) {
  const pressure = Math.min(2.8, 1 + difficultyRatio * (wave - 1));
  const fireDelay = Math.max(2.5, 25 / pressure);
  const orbitSpeed = .42 * pressure;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const toPlayer = player.g.position.clone().sub(enemy.g.position);
    toPlayer.y = 0;
    const distance = toPlayer.length() || 1;
    const intent = tacticalIntent(enemy.enemyType || "shooter", {
      distance,
      healthRatio: enemy.hp / (enemy.maxHp || enemy.hp || 1),
      hasLineOfSight: true,
      allyCount: enemies.filter(other => other.alive && other !== enemy && other.g.position.distanceTo(enemy.g.position) < 12).length,
    });
    const radial = toPlayer.clone().normalize();
    const tangent = new THREE.Vector3(-radial.z, 0, radial.x).multiplyScalar(enemy.orbitDirection);
    const desiredDistance = intent === "retreat" ? Math.max(18, enemy.range * .7) : intent === "hold" ? Math.max(8, enemy.range * .65) : Math.max(3, Math.min(14, enemy.range * .55));
    const desired = player.g.position.clone()
      .add(radial.multiplyScalar(intent === "retreat" ? -desiredDistance : desiredDistance))
      .add(tangent.multiplyScalar(intent === "flank" ? 13 : 6));
    const movement = desired.sub(enemy.g.position);
    movement.y = 0;
    if (movement.length() > .5) {
      const from = enemy.g.position.clone();
      enemy.g.position.addScaledVector(movement.normalize(), enemy.speed * dt);
      applyWorldMovement(enemy, from);
    }
    const aimAt = player.g.position.clone().add(new THREE.Vector3(0, 0, 0));
    enemy.g.rotation.y = Math.atan2(aimAt.x - enemy.g.position.x, aimAt.z - enemy.g.position.z);
    enemy.orbitAngle += orbitSpeed * dt * enemy.orbitDirection;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    if (enemy.cooldown <= 0 && distance < (enemy.range || 34)) {
      fire(enemy, player.g.position, { damage: enemy.damage || (8 + wave * 2) * pressure, delay: fireDelay, shots: enemy.enemyType === "boss" ? 3 : pressure > 2 ? 2 : 1, pierce: enemy.enemyType === "sniper" ? 1 : 0, spread: enemy.enemyType === "sniper" ? .01 : .06 });
      enemy.cooldown = fireDelay + (enemy.botIndex % 2 ? fireDelay * .5 : 0);
    }
    if (distance < Math.max(1.5, enemy.range <= 4 ? enemy.range : 1.5)) applyDamage(player, (enemy.damage || 18 + wave * 2) * dt);
  }
}

function scheduleRespawn(unit) {
  if (unit.alive && unit.hp <= 0) {
    unit.alive = false;
    unit.respawn = 4;
    unit.g.visible = false;
  }
}

function updateCtfRespawns(dt) {
  [player, ...allies, ...enemies].forEach(unit => {
    if (unit.alive) return;
    unit.respawn = Math.max(0, (unit.respawn || 0) - dt);
    if (unit.respawn > 0) return;
    const angle = Math.random() * Math.PI * 2;
    unit.g.position.set(Math.cos(angle) * 24, 0, Math.sin(angle) * 24);
    unit.hp = 100;
    unit.shield = unit === player ? unit.shieldMax : 0;
    unit.alive = true;
    unit.g.visible = true;
  });
}

function updateFlags(dt) {
  const blueTeam = [player, ...allies].filter(unit => unit.alive);
  const redTeam = enemies.filter(unit => unit.alive);
  flags.forEach(flag => {
    flag.group.rotation.y += dt * .6;
    flag.moveTimer -= dt;
    if (flag.moveTimer <= 0 || flag.position.distanceTo(flag.target) < .8) {
      flag.target = new THREE.Vector3((Math.random() - .5) * 220, 0, (Math.random() - .5) * 220);
      flag.target.y = sampleWorldElevation(worldLayout, flag.target);
      flag.moveTimer = 18 + Math.random() * 14;
    }
    flag.position.lerp(flag.target, Math.min(1, dt * .22));
    flag.group.position.copy(flag.position);
    const blueHere = blueTeam.filter(unit => unit.g.position.distanceTo(flag.position) < 5.2);
    const redHere = redTeam.filter(unit => unit.g.position.distanceTo(flag.position) < 5.2);
    if (blueHere.length + redHere.length !== 1) return;
    if (blueHere.length) {
      blue += dt;
      if (blueHere[0] === player) score += dt * 10;
    } else red += dt;
  });
}

function finishCtf() {
  const bluePoints = Math.floor(blue);
  const redPoints = Math.floor(red);
  const result = bluePoints === redPoints ? "Capture Match Draw" : `${bluePoints > redPoints ? "Blue" : "Red"} Team Captures The Map`;
  gameOver(result);
}

function update(dt) {
  if (phase === "over" || phase === "menu") return;
  if (phase === "countdown") {
    timer = Math.max(0, (countdownDeadline - Date.now()) / 1000);
    const next = Math.max(0, Math.ceil(timer));
    $("countdownNumber").textContent = String(next);
    if (timer <= 0) {
      $("matchCountdown").classList.add("hidden");
      nextCombat();
    }
    return;
  }
  if (phase === "loadout") return;
  const controller = pollController();
  if (controller.pause) menuOpen ? closeGameMenu() : openGameMenu();
  if (phase === "paused" && mode === "solo") return;
  if (controller.interact) interact();
  if (controller.reload) reloadWeapon(true);
  if (controller.weapon) cycleWeapon(1);
  if (controller.ability) triggerAbility();
  if (controller.switchTarget) switchLockedTarget();
  if (controller.dpadLeft || controller.dpadDown) cycleWeapon(-1);
  if (controller.dpadRight || controller.dpadUp) cycleWeapon(1);
  adsActive = controller.ads || adsActive && inputMode === "touch";
  timer -= dt;
  if (phase === "prep") {
    chests.forEach(chest => { chest.group.rotation.y += dt; });
    const closeEnough = canAccessChest(player.g.position, chests);
    ui.chest.classList.toggle("hidden", !closeEnough);
    const chest = chests[0];
    const dx = chest.x - player.g.position.x;
    const dz = chest.z - player.g.position.z;
    const angle = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
    const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(angle / 45) % 8];
    $("chestDirection").textContent = `${compass} · ${Math.round(Math.hypot(dx, dz))}m`;
    if (timer <= 0) {
      wave++;
      nextCombat();
    }
    return;
  }
  if (timer <= 0) {
    if (mode === "ctf") finishCtf();
    else prep();
    return;
  }
  if (spawnQueue > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const spawned = enemies.length;
      spawnEnemy(spawned);
      spawnQueue--;
      const schedule = spawnSchedule({ enemyCount: 2, wave, difficulty: difficultyName() });
      spawnTimer = schedule[1] || Math.max(.75, 4 - wave * .1);
    }
  }
  let mx = controllerLocked() || menuOpen ? 0 : (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  let mz = controllerLocked() || menuOpen ? 0 : (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  if (touch.mx || touch.mz) { mx = touch.mx; mz = touch.mz; }
  if (controller.mx || controller.mz) { mx = controller.mx; mz = controller.mz; }
  const length = Math.hypot(mx, mz) || 1;
  const playerFrom = player.g.position.clone();
  if (frontView) {
    const forward = new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw));
    const right = new THREE.Vector3(Math.cos(viewYaw), 0, -Math.sin(viewYaw));
    const classSpeed = (player.moveSpeedMultiplier || 1) * (activeAbility?.id === "dash" && Date.now() < activeAbility.endsAt ? activeAbility.modifiers.moveSpeedMultiplier : 1);
    player.g.position.addScaledVector(right, mx / length * 10 * classSpeed * dt);
    player.g.position.addScaledVector(forward, -mz / length * 10 * classSpeed * dt);
  } else {
    const classSpeed = player.moveSpeedMultiplier || 1;
    player.g.position.x += mx / length * 10 * classSpeed * dt;
    player.g.position.z += mz / length * 10 * classSpeed * dt;
  }
  const manualTouchAim = Math.hypot(touch.ax, touch.az) > .08;
  const manualControllerAim = Math.hypot(controller.ax, controller.az) > .08;
  if (manualTouchAim) {
    setInputMode("touch");
    aim.copy(player.g.position).add(new THREE.Vector3(touch.ax, 0, touch.az).multiplyScalar(20));
    viewYaw = Math.atan2(touch.ax, touch.az);
  }
  if (manualControllerAim) {
    aim.copy(player.g.position).add(new THREE.Vector3(controller.ax, 0, controller.az).multiplyScalar(20));
    viewYaw = Math.atan2(controller.ax, controller.az);
  }
  const wantsFire = ((!controllerLocked() && firing) || touch.fire || controller.fire);
  if (shouldAutoLock({ coarsePointer: coarsePointer.matches, difficultyRatio, preset: aimSettings.preset, manualAim: manualTouchAim || manualControllerAim, mouseInputActive, controllerInputActive: inputMode === "controller" && manualControllerAim }) && wantsFire) {
    const target = lockedTarget?.alive ? lockedTarget : nearest(player, enemies);
    if (target) {
      lockedTarget = target;
      aim.lerp(target.g.position, Math.min(1, dt * 8));
      viewYaw = Math.atan2(aim.x - player.g.position.x, aim.z - player.g.position.z);
    }
  } else if (aimSettings.preset === "assist" && (manualTouchAim || manualControllerAim || mouseInputActive)) {
    const target = nearest(player, enemies);
    if (target) {
      const targetYaw = Math.atan2(target.g.position.x - player.g.position.x, target.g.position.z - player.g.position.z);
      const delta = Math.atan2(Math.sin(targetYaw - viewYaw), Math.cos(targetYaw - viewYaw));
      if (Math.abs(delta) < .32) viewYaw += delta * aimSettings.assistStrength * dt * 2.2;
    }
  } else if (frontView && mouseInputActive && !manualControllerAim && document.pointerLockElement === canvas) {
    aim.copy(player.g.position).add(new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw)).multiplyScalar(35));
  }
  const lookDirection = aim.clone().sub(player.g.position);
  lookDirection.y = 0;
  if (lookDirection.lengthSq() > .01) player.g.rotation.y = Math.atan2(lookDirection.x, lookDirection.z);
  applyWorldMovement(player, playerFrom);
  applyExplorationDiscovery();
  for (const hazard of hazards) if (player.g.position.distanceTo(hazard) < 4) applyDamage(player, 10 * dt);
  if (!menuOpen && wantsFire) fire(player, aim);
    if (mode === "ctf") updateCtfBots(dt);
  else {
    updateSoloEnemies(dt);
    for (const enemy of enemies) if (enemy.alive) for (const bot of allies) if (bot.alive) fire(bot, enemy.g.position, { damage: 30, delay: .38, shots: 1, pierce: 0, spread: 0 });
  }
  for (const bullet of bullets) {
    bullet.m.position.addScaledVector(bullet.v, dt);
    bullet.life -= dt;
    if (bullet.blue) for (const enemy of enemies) {
      if (enemy.alive && !bullet.hits.has(enemy) && bullet.m.position.distanceTo(enemy.g.position) < 1.1) {
        bullet.hits.add(enemy);
        hitEnemy(enemy, bullet.damage);
        if (bullet.pierce-- <= 0) bullet.life = 0;
      }
    }
    else if (bullet.m.position.distanceTo(player.g.position) < 1.1) {
      applyDamage(player, bullet.damage);
      bullet.life = 0;
    }
  }
  effects.forEach(effect => {
    effect.life -= dt;
    effect.mesh.position.addScaledVector(effect.velocity, dt);
    effect.velocity.y -= 7 * dt;
    effect.mesh.scale.multiplyScalar(.94);
  });
  effects = effects.filter(effect => {
    if (effect.life <= 0) { world.remove(effect.mesh); return false; }
    return true;
  });
  bullets = bullets.filter(bullet => {
    if (bullet.life <= 0) {
      world.remove(bullet.m);
      return false;
    }
    return true;
  });
  if (mode === "ctf") {
    updateFlags(dt);
    [player, ...allies].forEach(scheduleRespawn);
    updateCtfRespawns(dt);
  } else {
    enemies = enemies.filter(enemy => enemy.alive);
    if (!player.alive || player.hp <= 0) {
      player.alive = false;
      finishRound("red");
    } else if (!enemies.length && spawnQueue === 0) finishRound("blue");
  }
  const facing = new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw));
  const cameraTarget = frontView ? player.g.position.clone().add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(facing, .72) : new THREE.Vector3(player.g.position.x, 26, player.g.position.z + 22);
  camera.position.lerp(cameraTarget, Math.min(1, dt * (frontView ? 12 : 4)));
  cameraShake = Math.max(0, cameraShake - dt * 1.8);
  if (cameraShake) camera.position.add(new THREE.Vector3((Math.random() - .5) * cameraShake, (Math.random() - .5) * cameraShake, (Math.random() - .5) * cameraShake));
  if (frontView) camera.lookAt(camera.position.clone().addScaledVector(facing, 30));
  else camera.lookAt(player.g.position.x, 0, player.g.position.z);
}

function formatTime(seconds) {
  return `${String(Math.max(0, Math.ceil(seconds) / 60 | 0)).padStart(2, "0")}:${String(Math.max(0, Math.ceil(seconds) % 60)).padStart(2, "0")}`;
}

function render() {
  const dt = Math.min(clock.getDelta(), .04);
  update(dt);
  if (discoveryToastUntil && performance.now() >= discoveryToastUntil) {
    discoveryToastUntil = 0;
    ui.discoveryToast.classList.add("hidden");
  }
  const weapon = weaponProfile();
  ui.hp.textContent = Math.max(0, Math.ceil(player.hp));
  ui.hpBar.style.width = `${Math.max(0, player.hp)}%`;
  ui.shield.textContent = Math.ceil(player.shield);
  ui.shieldBar.style.width = `${player.shieldMax ? player.shield / player.shieldMax * 100 : 0}%`;
  ui.heat.textContent = Date.now() < reloadUntil ? "REL" : magazines[activeGun];
  ui.heatBar.style.width = `${magazines[activeGun] / magazineSizes[activeGun] * 100}%`;
  ui.scrap.textContent = scrap;
  ui.kills.textContent = kills;
  ui.wave.textContent = wave;
  ui.level.textContent = playerLevel;
  ui.stage.textContent = storyStage;
  ui.chapter.textContent = `Chapter ${Math.min(storyStage, soldierStory.length)}: ${soldierStory[Math.min(storyStage - 1, soldierStory.length - 1)].title}`;
  ui.mission.textContent = `Mission: ${kingdomUnlocked ? soldierStory[4].text : storyMissions[missionIndex]}`;
  ui.weapon.textContent = `${weapon.name} L${weapon.level} ${weapon.shots}x`;
  ui.map.textContent = biomeAt(worldLayout, player.g.position).label.toUpperCase();
  const exploration = explorationProgress(worldLayout, explorationState);
  ui.exploration.textContent = `EXPLORE ${exploration.discovered}/${exploration.total}`;
  ui.phase.textContent = mode === "ctf" ? "CAPTURE" : phase.toUpperCase();
  ui.timer.textContent = phase === "loadout" ? "WAITING" : formatTime(timer);
  ui.prep.textContent = ui.timer.textContent;
  ui.blue.textContent = mode === "ctf" ? Math.floor(blue) : blue;
  ui.red.textContent = mode === "ctf" ? Math.floor(red) : red;
  player.cooldown = Math.max(0, player.cooldown - dt);
  allies.forEach(bot => { bot.cooldown = Math.max(0, bot.cooldown - dt); });
  renderer.render(scene, camera);
  updateAimReticle();
  requestAnimationFrame(render);
}

function wakeAudio() {
  if ((!audioEnabled && !musicEnabled) || (!window.AudioContext && !window.webkitAudioContext)) return;
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  if (musicEnabled && musicSource === "builtin") startBuiltInMusic();
}

function playTone(frequency, duration, type, gainValue) {
  if (!audioEnabled) return;
  wakeAudio();
  if (!audioContext || audioContext.state !== "running") return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const volume = Math.max(.0001, gainValue * (audioVolume / 100));
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + .01);
  gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + .02);
}

function effectiveMusicVolume() {
  return musicVolume / 100 * (shouldDuckMusic({ voiceActive: Boolean(localStream), voiceMuted }) ? .28 : 1);
}

function playMusicTone(frequency, duration = .32) {
  if (!musicEnabled || musicSource !== "builtin" || !audioContext || audioContext.state !== "running") return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = musicStep % 8 === 0 ? "sawtooth" : "triangle";
  oscillator.frequency.value = frequency;
  const level = Math.max(.0001, .026 * effectiveMusicVolume());
  gain.gain.setValueAtTime(.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(level, audioContext.currentTime + .025);
  gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + .03);
}

function startBuiltInMusic() {
  if (musicTimer || !musicEnabled || musicSource !== "builtin") return;
  const notes = [55, 82.41, 65.41, 98, 55, 110, 73.42, 82.41];
  musicTimer = setInterval(() => {
    playMusicTone(notes[musicStep % notes.length]);
    musicStep++;
  }, 430);
  ui.musicStatus.textContent = "Built-in wasteland soundtrack";
}

function stopBuiltInMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

function updateLocalMusicVolume() {
  localMusic.volume = Math.min(1, effectiveMusicVolume());
}

function playLocalTrack(index = localTrackIndex) {
  if (!localTracks.length || !musicEnabled || musicSource !== "local") return;
  localTrackIndex = (index + localTracks.length) % localTracks.length;
  localMusic.src = localTracks[localTrackIndex].url;
  updateLocalMusicVolume();
  localMusic.play().catch(() => {});
  ui.musicStatus.textContent = localTracks[localTrackIndex].name;
  $("playMusicBtn").textContent = "Pause";
}

function stopMusic() {
  stopBuiltInMusic();
  localMusic.pause();
  $("playMusicBtn").textContent = "Play";
}

function clearKeyboardInput() {
  Object.keys(keys).forEach(key => delete keys[key]);
  firing = false;
}

function deviceId() {
  let id = localStorage.getItem("wastland-survivor-device-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("wastland-survivor-device-id", id);
  }
  return id;
}

async function pinDigest(pin) {
  const data = new TextEncoder().encode(`${deviceId()}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

function validPin(pin) { return /^\d{4}$/.test(pin); }

function ageFromBirthDate(value) {
  const birthday = new Date(`${value}T00:00:00`);
  if (!value || Number.isNaN(birthday.getTime()) || birthday > new Date()) return null;
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const beforeBirthday = today.getMonth() < birthday.getMonth() || (today.getMonth() === birthday.getMonth() && today.getDate() < birthday.getDate());
  if (beforeBirthday) age--;
  return age >= 0 && age <= 120 ? age : null;
}

function beginMathCheck(profile) {
  pendingProfile = profile;
  mathExpected = Math.floor(Math.random() * 40) + 10 + Math.floor(Math.random() * 20);
  const first = Math.floor(Math.random() * 20) + 10;
  const second = mathExpected - first;
  mathQuestion.textContent = `${first} + ${second} = ?`;
  mathAnswer.value = "";
  mathMessage.textContent = "";
  mathDeadline = Date.now() + 120000;
  profileStep.classList.add("hidden");
  returnStep.classList.add("hidden");
  mathStep.classList.remove("hidden");
  mathAnswer.focus();
}

function finishMathCheck() {
  if (!pendingProfile) return;
  if (Date.now() > mathDeadline) {
    mathMessage.textContent = "Time expired. The setup has been restarted.";
    pendingProfile = null;
    mathStep.classList.add("hidden");
    profileStep.classList.remove("hidden");
    return;
  }
  if (Number(mathAnswer.value.trim()) !== mathExpected) {
    mathMessage.textContent = "That answer is not correct.";
    return;
  }
  const profile = pendingProfile;
  pendingProfile = null;
  saveProfile(profile);
  activeProfile = profile;
  if (profile.youthAccount) {
    offlineMode = true;
    localStorage.setItem("wastland-survivor-offline", "true");
  }
  mathStep.classList.add("hidden");
  openLobby(profile.name);
}

async function syncPublicPlayer() {
  if (!activeProfile || activeProfile.youthAccount || offlineMode) return false;
  try {
    const response = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceProfileId: activeProfile.profileId,
        deviceCredential: activeProfile.backendDeviceCredential || "",
        displayName: activeProfile.name,
        avatarType: activeProfile.avatarType,
        level: activeProfile.progress?.playerLevel || 1,
        online: true,
        stats: {
          kills: activeProfile.progress?.kills || 0,
          matches: activeProfile.progress?.matches || 0,
          wins: activeProfile.progress?.wins || 0,
          deaths: activeProfile.progress?.deaths || 0,
        },
        progress: activeProfile.progress || {},
      }),
    });
    if (!response.ok) return false;
    const { player: publicPlayer, session, deviceCredential } = await response.json();
    activeProfile.backendPlayerId = publicPlayer.id;
    activeProfile.playerTag = publicPlayer.playerTag;
    if (deviceCredential) activeProfile.backendDeviceCredential = deviceCredential;
    activeProfile.backendSession = session;
    saveProfile();
    lobbyPlayer.textContent = `Profile: ${activeProfile.name} · ${publicPlayer.playerTag}`;
    return true;
  } catch {
    // Local play remains available when the optional backend is offline.
    return false;
  }
}

async function createDeviceLink() {
  const result = $("deviceLinkResult");
  result.textContent = "Creating secure link code...";
  if (!activeProfile || activeProfile.youthAccount || offlineMode) {
    result.textContent = "Device linking requires an adult online profile.";
    return;
  }
  if (!activeProfile.backendSession && !(await syncPublicPlayer())) {
    result.textContent = "The player service is unavailable. Try again when online.";
    return;
  }
  let response = await fetch("/api/link/create", { method: "POST", headers: { Authorization: `Bearer ${activeProfile.backendSession || ""}` } });
  if (response.status === 401 && await syncPublicPlayer()) {
    response = await fetch("/api/link/create", { method: "POST", headers: { Authorization: `Bearer ${activeProfile.backendSession || ""}` } });
  }
  if (!response.ok) {
    result.textContent = "A link code could not be created right now.";
    return;
  }
  const link = await response.json();
  result.textContent = `${link.playerTag}  ·  ${link.code}  ·  expires in 5 minutes`;
}

async function claimDeviceLink() {
  const message = $("linkProfileMessage");
  const playerTag = $("linkPlayerTag").value.trim().toUpperCase();
  const code = $("linkCode").value.trim();
  const pin = $("linkLocalPin").value.trim();
  if (!playerTag || !/^\d{6}$/.test(code) || !validPin(pin)) {
    message.textContent = "Enter the Player Tag, six-digit code, and a new four-digit PIN.";
    return;
  }
  message.textContent = "Linking player...";
  try {
    const response = await fetch("/api/link/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerTag, code }) });
    const payload = await response.json();
    if (!response.ok) {
      message.textContent = payload.error || "The link code is invalid or expired.";
      return;
    }
    const digest = await pinDigest(pin);
    const profile = {
      profileId: crypto.randomUUID(), name: payload.player.displayName, birthDate: "", age: null, contact: "",
      avatarType: payload.player.avatarType || "scout", parentContact: "", youthAccount: false,
      pinDigest: digest, deviceId: deviceId(), ageVerifiedAt: null, linkedAccount: true,
      progress: payload.player.progress || null, backendPlayerId: payload.player.id, playerTag: payload.player.playerTag,
      backendDeviceCredential: payload.deviceCredential, backendSession: payload.session,
    };
    saveProfile(profile);
    activeProfile = profile;
    loadProgress(profile);
    offlineMode = false;
    localStorage.setItem("wastland-survivor-offline", "false");
    $("linkCode").value = "";
    $("linkLocalPin").value = "";
    openLobby(profile.name);
  } catch {
    message.textContent = "The player service is unavailable. Your local profiles were not changed.";
  }
}

function showDeviceLinkStep() {
  profileStep.classList.add("hidden");
  returnStep.classList.add("hidden");
  mathStep.classList.add("hidden");
  linkProfileStep.classList.remove("hidden");
  $("linkProfileMessage").textContent = "";
}

async function reportMatch(title) {
  if (!activeProfile?.backendPlayerId || offlineMode) return;
  try {
    await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeProfile.backendSession || ""}` },
      body: JSON.stringify({
        room: lobbyRoom(), mode, map: mapKey, status: "complete",
        players: [activeProfile.backendPlayerId], score: { score: Math.floor(score), blue: Math.floor(blue), red: Math.floor(red), result: title },
      }),
    });
  } catch {
    // Match reporting is retriable and never blocks the local result screen.
  }
}

function openLobby(contact) {
  welcomeScreen.classList.add("hidden");
  lobbyPlayer.textContent = `Profile: ${contact}`;
  lobbyScreen.classList.remove("hidden");
  setNightfallScene("menu");
  updateNetworkStatus();
  refreshLobbyAvailability();
  $("riskLevel").value = riskLevel;
  updateRiskPreview();
  syncPublicPlayer();
  playRandomReplay(homeBackdrop).then(playing => {
    $("replayStatus").textContent = playing
      ? "Playing a recent match clip saved on this device."
      : "Cinematic backdrop active. Your recent match clips will rotate here automatically.";
  });
}

async function refreshLobbyAvailability() {
  const onlineButton = $("onlineSurvivalBtn");
  const computerButton = $("teamLobbyBtn");
  if (offlineMode || !activeProfile) {
    onlineButton.classList.add("hidden");
    computerButton.classList.remove("hidden");
    return;
  }
  try {
    const response = await fetch(`/room-status?room=${encodeURIComponent(`${mapKey}-teams`)}`, { cache: "no-store" });
    const status = await response.json();
    const playersWaiting = Number(status.players) > 0;
    onlineButton.classList.toggle("hidden", !playersWaiting);
    computerButton.classList.toggle("hidden", playersWaiting);
  } catch {
    onlineButton.classList.add("hidden");
    computerButton.classList.remove("hidden");
  }
}

function editActiveProfile() {
  if (!activeProfile) return;
  editingProfile = true;
  lobbyScreen.classList.add("hidden");
  welcomeScreen.classList.remove("hidden");
  setNightfallScene("menu");
  profileStep.classList.remove("hidden");
  returnStep.classList.add("hidden");
  mathStep.classList.add("hidden");
  profileName.value = activeProfile.name || "";
  profileBirthDate.value = activeProfile.birthDate || "";
  profileContact.value = activeProfile.contact || "";
  profileAvatar.value = activeProfile.avatarType || "scout";
  updateAvatarCards();
  ageConfirm.checked = true;
  profilePin.value = "0000";
  $("enterWastlandBtn").textContent = "Save Profile";
  $("guestOfflineBtn").classList.add("hidden");
  profileMessage.textContent = "Update your name or avatar, then save.";
}

function savedProfiles() {
  const profiles = JSON.parse(localStorage.getItem("wastland-survivor-profiles") || "[]");
  if (profiles.length) return profiles;
  const legacy = JSON.parse(localStorage.getItem("wastland-survivor-profile") || "null");
  return legacy ? [legacy] : [];
}

function saveProfile(profile = activeProfile) {
  if (!profile) return;
  const profiles = savedProfiles().filter(item => item.profileId !== profile.profileId);
  profiles.push(profile);
  localStorage.setItem("wastland-survivor-profiles", JSON.stringify(profiles));
  localStorage.setItem("wastland-survivor-profile", JSON.stringify(profile));
}

function saveProgress() {
  if (!activeProfile || activeProfile.youthAccount) return;
  activeProfile.progress = { wave, score, kills, scrap, shieldLevel, playerLevel, totalXp, storyStage, missionIndex, kingdomUnlocked, classProgress, unlockedMaps: unlockedMaps(playerLevel), timelineAdvantages: timelineAdvantages.slice(0, Math.min(timelineAdvantages.length, storyStage)), guns: Object.fromEntries(Object.entries(guns).map(([key, gun]) => [key, gun.level])), rewards: activeProfile.progress?.rewards || { winStreak: 0, lifetimeRewards: 0 } };
  saveProfile();
}

function loadProgress(profile) {
  const progress = profile?.progress;
  if (!progress) return;
  wave = Math.max(1, Number(progress.wave) || 1);
  score = Math.max(0, Number(progress.score) || 0);
  kills = Math.max(0, Number(progress.kills) || 0);
  scrap = Math.max(0, Number(progress.scrap) || 0);
  shieldLevel = Math.max(0, Number(progress.shieldLevel) || 0);
  playerLevel = Math.max(1, Number(progress.playerLevel) || 1);
  totalXp = Math.max(0, Number(progress.totalXp) || (Number(progress.kills) || 0) * 100 + (Number(progress.score) || 0));
  storyStage = Math.max(1, Number(progress.storyStage) || 1);
  missionIndex = Math.max(0, Math.min(storyMissions.length - 1, Number(progress.missionIndex) || 0));
  kingdomUnlocked = Boolean(progress.kingdomUnlocked);
  classProgress = normalizeClassProgress(progress.classProgress || { classId: profile?.avatarType || "scout" });
  Object.entries(progress.guns || {}).forEach(([key, level]) => { if (guns[key]) guns[key].level = Math.min(guns[key].max, Math.max(0, Number(level) || 0)); });
}

function updateStoryProgress() {
  if (mode !== "solo") return;
  totalXp = Math.max(totalXp, kills * 100 + score);
  playerLevel = Math.max(1, levelFromXp(totalXp));
  storyStage = Math.max(1, Math.floor((wave - 1) / 5) + 1);
  kingdomUnlocked = hasKingdom(playerLevel);
  if (!kingdomUnlocked) {
    if (scrap >= 60) missionIndex = Math.max(missionIndex, 1);
    if (kills >= 10) missionIndex = Math.max(missionIndex, 2);
    if (storyStage >= 3) missionIndex = Math.max(missionIndex, 3);
  }
}

function avatarLabel(type) { return ({ scout: "Dust Scout", ranger: "Ranger", heavy: "Heavy", tech: "Tech Runner", medic: "Field Medic", warden: "Warden" })[type] || "Dust Scout"; }

function openDashboard() {
  if (!activeProfile) return;
  const progress = activeProfile.progress || {};
  $("dashboardName").textContent = activeProfile.name || "Survivor";
  $("dashboardAvatar").textContent = avatarLabel(activeProfile.avatarType);
  $("dashboardKingdom").textContent = progress.kingdomUnlocked ? "Kingdom Unlocked" : "Frontier Camp";
  $("dashboardLevel").textContent = progress.playerLevel || 1;
  $("dashboardXp").textContent = `${progress.totalXp || 0} XP`;
  $("dashboardStage").textContent = progress.storyStage || 1;
  $("dashboardScrap").textContent = progress.scrap || 0;
  $("dashboardMission").textContent = progress.kingdomUnlocked ? "Kingdom unlocked. Continue the frontier timeline." : storyMissions[progress.missionIndex || 0];
  $("dashboardLoadout").innerHTML = Object.entries(guns).map(([key, gun]) => `<div><b>${gun.label}</b><small>Level ${progress.guns?.[key] || 0}/${gun.max === Infinity ? "∞" : gun.max}</small></div>`).join("") + `<div><b>Scrap Shield</b><small>Level ${progress.shieldLevel || 0}/10</small></div>`;
  $("dashboardTactics").innerHTML = ["Aim Stabilizer", "Quick Recovery", "Scavenger Pack", "Flag Runner"].map((name, index) => `<div><b>${name}</b><small>${(progress.storyStage || 1) > index ? "Unlocked" : "Stage " + (index + 1)}</small></div>`).join("");
  $("dashboardModal").classList.remove("hidden");
}

function enterProfile() {
  const name = profileName.value.trim();
  const birthDate = profileBirthDate.value;
  const age = ageFromBirthDate(birthDate);
  const contact = profileContact.value.trim();
  const pin = profilePin.value.trim();
  const parent = parentContact.value.trim();
  if (!name) {
    profileMessage.textContent = "Enter a player name.";
    return;
  }
  if (age === null) {
    profileMessage.textContent = "This birth date could not be verified. Parent controls will stay available until it is verified.";
    parentSetup.classList.remove("hidden");
    return;
  }
  if (!contact) {
    profileMessage.textContent = "Enter an email or phone number.";
    return;
  }
  if (!editingProfile && !validPin(pin)) {
    profileMessage.textContent = "PIN must be exactly four numbers.";
    return;
  }
  if (!ageConfirm.checked) {
    profileMessage.textContent = "Confirm the age information before entering.";
    return;
  }
  youthAccount = age < 14;
  if (youthAccount && !parent) {
    profileMessage.textContent = "A parent email or phone is required for players under 14.";
    parentSetup.classList.remove("hidden");
    return;
  }
  if (editingProfile && activeProfile) {
    activeProfile.name = name;
    activeProfile.avatarType = profileAvatar.value;
    saveProfile();
    editingProfile = false;
    $("enterWastlandBtn").textContent = "Enter Wasteland";
    $("guestOfflineBtn").classList.remove("hidden");
    profilePin.value = "";
    profileMessage.textContent = "Profile saved.";
    openLobby(name);
    return;
  }
  pinDigest(pin).then(digest => {
    const profile = { profileId: crypto.randomUUID(), name, birthDate, age, contact, avatarType: profileAvatar.value, parentContact: youthAccount ? parent : "", youthAccount, pinDigest: digest, deviceId: deviceId(), ageVerifiedAt: new Date().toISOString(), progress: null };
    profilePin.value = "";
    if (age >= 18) beginMathCheck(profile);
    else {
      saveProfile(profile);
      activeProfile = profile;
      if (youthAccount) {
        offlineMode = true;
        localStorage.setItem("wastland-survivor-offline", "true");
      }
      openLobby(name);
    }
  });
}

function returnProfile() {
  const profiles = savedProfiles();
  const saved = profiles.find(profile => profile.profileId === profileSelector.value) || profiles[0];
  const pin = returnPin.value.trim();
  if (!saved || !validPin(pin)) {
    returnMessage.textContent = "Enter the four-digit PIN for this profile.";
    return;
  }
  pinDigest(pin).then(digest => {
    if (digest !== saved.pinDigest) {
      returnMessage.textContent = "That PIN did not match this profile.";
      return;
    }
    returnPin.value = "";
    activeProfile = saved;
    loadProgress(saved);
    youthAccount = Boolean(saved.youthAccount);
    if (youthAccount) {
      offlineMode = true;
      localStorage.setItem("wastland-survivor-offline", "true");
    }
    openLobby(saved.name || saved.contact);
  });
}

function showProfileChoice() {
  const profiles = savedProfiles();
  const saved = profiles[0];
  profileMessage.textContent = "";
  returnMessage.textContent = "";
  profileSelector.replaceChildren(...profiles.map(profile => new Option(`${profile.name} · ${profile.birthDate}`, profile.profileId || profile.contact)));
  linkProfileStep.classList.add("hidden");
  mathStep.classList.add("hidden");
  if (profiles.length) {
    profileStep.classList.add("hidden");
    returnStep.classList.remove("hidden");
    $("returningPlayer").textContent = `Saved players on this device: ${profiles.length}`;
  } else {
    profileStep.classList.remove("hidden");
    returnStep.classList.add("hidden");
  }
}

function initializeProfileScreen() {
  editingProfile = false;
  $("enterWastlandBtn").textContent = "Enter Wasteland";
  $("guestOfflineBtn").classList.remove("hidden");
  showProfileChoice();
}

function updateRiskPreview() {
  const preview = rewardPreview({ risk: riskLevel, difficulty: difficultyName(), winStreak: activeProfile?.progress?.rewards?.winStreak || 0 });
  const profile = RISK_PROFILES[preview.risk];
  $("riskPreview").textContent = `${profile.label}: ${preview.rewardMultiplier.toFixed(2)}x rewards · ${Math.round(profile.defeatScrapRate * 100)}% carried scrap lost on defeat · streak bonus up to 1.50x.`;
}

function leaveLobby() {
  lobbyScreen.classList.add("hidden");
  welcomeScreen.classList.remove("hidden");
  setNightfallScene("menu");
  showProfileChoice();
}

function loadReplayBackdrop() {
  const replay = localStorage.getItem("wastland-survivor-last-replay");
  if (!replay) return;
  homeBackdrop.src = replay;
  homeBackdrop.play().catch(() => {});
}

function enterGuestOffline() {
  offlineMode = true;
  youthAccount = false;
  localStorage.setItem("wastland-survivor-offline", "true");
  const guestName = "Offline Guest";
  openLobby(guestName);
}

function bindTouchStick(id, prefix) {
  const element = $(id);
  const knob = element.querySelector("i");
  let pointerId = null;
  const release = () => {
    pointerId = null;
    touch[`${prefix}x`] = touch[`${prefix}z`] = 0;
    knob.style.transform = "translate(0,0)";
  };
  const move = event => {
    if (event.pointerId !== pointerId) return;
    const rect = element.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy) || 1;
    const cap = Math.min(38, distance);
    const x = dx / distance * cap;
    const y = dy / distance * cap;
    knob.style.transform = `translate(${x}px,${y}px)`;
    touch[`${prefix}x`] = x / 38;
    touch[`${prefix}z`] = y / 38;
  };
  element.addEventListener("pointerdown", event => {
    if (phase === "countdown") return;
    setInputMode("touch");
    pointerId = event.pointerId;
    element.setPointerCapture(pointerId);
    wakeAudio();
    move(event);
  });
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
}

function setVoiceStatus(status) { ui.voiceStatus.textContent = status; }

function updateVoiceButtons() {
  const joined = Boolean(localStream);
  ui.joinVoice.classList.toggle("hidden", joined);
  ui.muteVoice.classList.toggle("hidden", !joined);
  ui.leaveVoice.classList.toggle("hidden", !joined);
  ui.muteVoice.textContent = voiceMuted ? "Unmute" : "Mute";
}

function voiceRoom() { return mode === "ctf" ? `${mapKey}-ctf-${ctfPlayers}` : `${mapKey}-${mode}`; }

function lobbyRoom() {
  return mode === "ctf" ? `${mapKey}-ctf-${ctfPlayers}` : `${mapKey}-teams`;
}

function closeLobbyRoom() {
  if (lobbySocket) {
    lobbySocket.onclose = null;
    lobbySocket.close();
    lobbySocket = null;
  }
  lobbyId = null;
  lobbyPeers = 0;
}

function ensureLobbyRoom() {
  closeLobbyRoom();
  if (offlineMode || mode === "solo") {
    updateNetworkStatus();
    return;
  }
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  lobbySocket = new WebSocket(`${protocol}://${location.host}/signal`);
  lobbySocket.onopen = () => lobbySocket.send(JSON.stringify({ type: "join", room: lobbyRoom() }));
  lobbySocket.onmessage = event => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "welcome") {
        lobbyId = message.id;
        lobbyPeers = message.peers.length;
        updateNetworkStatus(`Room open: ${lobbyPeers + 1}/${message.capacity}`);
      } else if (message.type === "peer-joined") {
        lobbyPeers++;
        updateNetworkStatus(`Room open: ${lobbyPeers + 1}/${message.capacity || 4}`);
      } else if (message.type === "peer-left") {
        lobbyPeers = Math.max(0, lobbyPeers - 1);
        updateNetworkStatus(`Room open: ${lobbyPeers + 1}/${message.capacity || 4}`);
      } else if (message.type === "match-ready") {
        updateNetworkStatus(`Room ready: ${message.capacity} players`);
      } else if (message.type === "room-full") {
        updateNetworkStatus("Room full: waiting for the next room");
      } else if (message.type === "chest-access") {
        chestAccessGranted = Boolean(message.granted);
        chestOccupants = message.occupants;
        $("chestOccupancy").textContent = message.granted ? `Access slots: ${message.occupants}/${message.capacity}` : `Chest occupied: ${message.occupants}/${message.capacity}`;
        if (message.granted) ui.shop.classList.remove("hidden");
      } else if (message.type === "chest-status") {
        chestOccupants = message.occupants;
        $("chestOccupancy").textContent = `Access slots: ${message.occupants}/${message.capacity}`;
      }
    } catch { updateNetworkStatus("Lobby connection issue"); }
  };
  lobbySocket.onerror = () => updateNetworkStatus("Lobby connection issue");
  lobbySocket.onclose = () => {
    lobbySocket = null;
    lobbyId = null;
    updateNetworkStatus();
    if (!offlineMode && mode !== "solo") {
      clearTimeout(lobbyRetryTimer);
      lobbyRetryTimer = setTimeout(ensureLobbyRoom, 1800);
    }
  };
}

function sendVoice(message) {
  if (voiceSocket?.readyState === WebSocket.OPEN) voiceSocket.send(JSON.stringify(message));
}

function closePeer(peerId) {
  const peer = voicePeers.get(peerId);
  if (!peer) return;
  peer.connection.onconnectionstatechange = null;
  peer.connection.close();
  peer.audio.remove();
  voicePeers.delete(peerId);
}

function closeVoice(status) {
  [...voicePeers.keys()].forEach(closePeer);
  if (voiceSocket) {
    const socket = voiceSocket;
    voiceSocket = null;
    socket.onclose = null;
    socket.close();
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  voiceMuted = false;
  setVoiceStatus(status);
  updateVoiceButtons();
}

async function createPeer(peerId, initiator) {
  if (voicePeers.has(peerId)) return voicePeers.get(peerId);
  const connection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  const audio = new Audio();
  audio.autoplay = true;
  $("remoteAudio").append(audio);
  const peer = { connection, audio, pendingCandidates: [] };
  voicePeers.set(peerId, peer);
  localStream?.getTracks().forEach(track => connection.addTrack(track, localStream));
  connection.onicecandidate = event => {
    if (event.candidate) sendVoice({ type: "signal", to: peerId, data: { candidate: event.candidate } });
  };
  connection.ontrack = event => {
    audio.srcObject = event.streams[0];
    audio.play().catch(() => {});
  };
  connection.onconnectionstatechange = () => {
    if (["failed", "closed"].includes(connection.connectionState)) closePeer(peerId);
  };
  if (initiator) {
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    sendVoice({ type: "signal", to: peerId, data: { description: connection.localDescription } });
  }
  return peer;
}

async function receiveVoiceSignal(message) {
  const data = message.data || {};
  const peer = await createPeer(message.from, false);
  if (data.description) {
    await peer.connection.setRemoteDescription(data.description);
    for (const candidate of peer.pendingCandidates.splice(0)) await peer.connection.addIceCandidate(candidate);
    if (data.description.type === "offer") {
      const answer = await peer.connection.createAnswer();
      await peer.connection.setLocalDescription(answer);
      sendVoice({ type: "signal", to: message.from, data: { description: peer.connection.localDescription } });
    }
  }
  if (data.candidate) {
    if (peer.connection.remoteDescription) await peer.connection.addIceCandidate(data.candidate);
    else peer.pendingCandidates.push(data.candidate);
  }
}

async function joinVoice() {
  if (youthAccount) {
    setVoiceStatus("Parent controls keep voice off for this profile");
    return;
  }
  if (offlineMode) {
    setVoiceStatus("Offline mode is on");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setVoiceStatus("Microphone is unavailable in this browser");
    return;
  }
  try {
    setVoiceStatus("Requesting microphone");
    localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    updateVoiceButtons();
    setVoiceStatus("Connecting to voice lobby");
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    voiceSocket = new WebSocket(`${protocol}://${location.host}/signal`);
    voiceSocket.onopen = () => sendVoice({ type: "join", room: voiceRoom() });
    voiceSocket.onmessage = async event => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "welcome") {
          setVoiceStatus(`Voice connected: ${message.peers.length + 1}/${message.capacity || 4}`);
          for (const peerId of message.peers) await createPeer(peerId, true);
        } else if (message.type === "signal") await receiveVoiceSignal(message);
        else if (message.type === "peer-left") closePeer(message.id);
        else if (message.type === "room-full") closeVoice("Voice lobby is full");
        else if (message.type === "match-ready") setVoiceStatus("Voice connected: lobby ready");
      } catch {
        setVoiceStatus("Voice connection issue");
      }
    };
    voiceSocket.onerror = () => setVoiceStatus("Voice connection issue");
    voiceSocket.onclose = () => closeVoice("Voice lobby closed");
  } catch (error) {
    closeVoice(error?.name === "NotAllowedError" ? "Microphone permission was not granted" : "Could not start microphone");
  }
}

function lobbyChanged() {
  if (localStream) closeVoice("Voice left: lobby changed");
}

function updateNetworkStatus(roomLabel = "") {
  ui.offline.checked = offlineMode;
  ui.networkStatus.textContent = offlineMode ? "Offline play only. Lobby and voice are blocked." : roomLabel || (mode === "solo" ? "Online lobby available" : "Opening game room...");
  if (offlineMode && localStream) closeVoice("Offline mode is on");
}

function pauseGraceSeconds() {
  if (difficultyRatio <= .10) return 5;
  if (difficultyRatio <= .22) return 3;
  if (difficultyRatio <= .35) return 1;
  return 0;
}

function openGameMenu() {
  if (phase === "menu" || phase === "countdown" || phase === "over") return;
  menuOpen = true;
  const liveMatch = mode === "teams" || mode === "ctf";
  phase = liveMatch ? "combat" : "paused";
  graceUntil = 0;
  $("gameMenu").classList.remove("hidden");
  $("graceStatus").classList.add("hidden");
  $("menuMatchStatus").textContent = liveMatch ? "LIVE MATCH CONTINUES" : "MATCH PAUSED";
}

function closeGameMenu() {
  menuOpen = false;
  $("gameMenu").classList.add("hidden");
  if (phase === "paused") phase = "combat";
  const seconds = mode === "teams" || mode === "ctf" ? pauseGraceSeconds() : 0;
  graceUntil = seconds ? Date.now() + seconds * 1000 : 0;
  $("graceStatus").classList.toggle("hidden", !seconds);
  if (seconds) {
    $("graceStatus").innerHTML = `Control reconnecting: <b>${seconds}</b>`;
    setTimeout(() => $("graceStatus").classList.add("hidden"), seconds * 1000);
  }
}

function exitToLobby() {
  saveProgress();
  closeLobbyRoom();
  menuOpen = false;
  phase = "menu";
  firing = false;
  touch.mx = touch.mz = touch.ax = touch.az = 0;
  touch.fire = false;
  clearKeyboardInput();
  $("gameMenu").classList.add("hidden");
  $("loadoutRoomModal").classList.add("hidden");
  $("chestLocator").classList.add("hidden");
  $("matchCountdown").classList.add("hidden");
  ui.shop.classList.add("hidden");
  ui.settings.classList.add("hidden");
  ui.over.classList.add("hidden");
  document.body.classList.remove("loadout-active");
  document.body.classList.add("menu-active");
  setNightfallScene("menu");
  openLobby(activeProfile?.name || "Offline Guest");
}

async function initializeNightfallBackground() {
  let manifest = null;
  try {
    const response = await fetch("./assets/nightfall/manifest.json", { cache: "no-store" });
    if (response.ok) manifest = await response.json();
  } catch {
    // CSS fallback keeps the menu readable when optional artwork is unavailable.
  }
  createNightfallBackground(nightfallBackground, {
    manifest,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    tier: effectiveGraphicsTier(),
    scene: phase === "countdown" ? "countdown" : phase === "menu" ? "menu" : "game",
  });
}

function effectiveGraphicsTier() {
  return selectGraphicsTier({
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    savedTier: graphicsTierOverride === "auto" ? undefined : graphicsTierOverride,
  });
}

function applyGraphicsTier() {
  const tier = effectiveGraphicsTier();
  setNightfallTier(tier);
  renderer.setPixelRatio(Math.min(devicePixelRatio, tier === "low" ? 1 : tier === "medium" ? 1.75 : 3));
  renderer.shadowMap.enabled = tier !== "low";
  renderer.shadowMap.autoUpdate = tier === "high";
  resize();
}

const gunUnlocks = { scout: 3, cannon: 6, inferno: 9 };

function gunUnlocked(gunName) {
  return kills >= gunUnlocks[gunName];
}

function upgrade(gunName) {
  const gun = guns[gunName];
  const price = gun.price + Math.floor(gun.level / 10) * (gunName === "scout" ? 2 : 5);
  if (!["prep", "loadout"].includes(phase) || !gunUnlocked(gunName) || scrap < price || gun.level >= gun.max) return;
  scrap -= price;
  gun.level++;
  updateArmory();
  playTone(610, .06, "sine", .04);
}

function upgradeShield() {
  const price = 24 + shieldLevel * 8;
  if (!["prep", "loadout"].includes(phase) || scrap < price || shieldLevel >= 10) return;
  scrap -= price;
  shieldLevel++;
  player.shieldMax = shieldLevel * 30;
  player.shield = player.shieldMax;
  updateArmory();
  playTone(610, .06, "sine", .04);
}

function weaponPrice(gunName) {
  const gun = guns[gunName];
  return gun.price + Math.floor(gun.level / 10) * (gunName === "scout" ? 2 : 5);
}

function updateArmory() {
  $("scoutLevel").textContent = `L${guns.scout.level}`;
  $("cannonLevel").textContent = `L${guns.cannon.level}/100`;
  $("infernoLevel").textContent = `L${guns.inferno.level}/50`;
  $("shieldLevel").textContent = `L${shieldLevel}/10`;
  [["scout", "upgradeScoutBtn"], ["cannon", "upgradeCannonBtn"], ["inferno", "upgradeInfernoBtn"]].forEach(([gun, id]) => {
    const button = $(id);
    const locked = !gunUnlocked(gun);
    button.disabled = locked || guns[gun].level >= guns[gun].max;
    button.textContent = locked ? `${gunUnlocks[gun]} kills` : guns[gun].level >= guns[gun].max ? "Maxed" : `${weaponPrice(gun)} scrap`;
  });
  $("upgradeShieldBtn").textContent = shieldLevel >= 10 ? "Maxed" : `${24 + shieldLevel * 8} scrap`;
  [["scout", "equipScoutBtn"], ["cannon", "equipCannonBtn"], ["inferno", "equipInfernoBtn"]].forEach(([gun, id]) => {
    const button = $(id);
    const locked = !gunUnlocked(gun) && activeGun !== gun;
    button.disabled = locked;
    button.textContent = locked ? `${gunUnlocks[gun]} kills` : activeGun === gun ? "Equipped" : "Equip";
  });
}

function equip(gunName) {
  if (!gunUnlocked(gunName) && activeGun !== gunName) return;
  activeGun = gunName;
  updateArmory();
}

addEventListener("resize", resize);
addEventListener("gamepadconnected", () => updateControllerState(true));
addEventListener("gamepaddisconnected", () => updateControllerState(false));
addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (!ui.settings.classList.contains("hidden")) { ui.settings.classList.add("hidden"); return; }
    if (!$("dashboardModal").classList.contains("hidden")) { $("dashboardModal").classList.add("hidden"); return; }
    if (!ui.shop.classList.contains("hidden")) { ui.shop.classList.add("hidden"); return; }
  }
  if (controllerLocked() || phase === "countdown") return;
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
  if (key === "escape") { menuOpen ? closeGameMenu() : openGameMenu(); return; }
  if (key === "r") reloadWeapon(true);
  if (key === "q") cycleWeapon(1);
  if (key === "e") interact();
  if (key === "tab") { event.preventDefault(); switchLockedTarget(); }
  keys[key] = true;
  if (key === "arrowleft") keys.a = true;
  if (key === "arrowright") keys.d = true;
  if (key === "arrowup") keys.w = true;
  if (key === "arrowdown") keys.s = true;
  wakeAudio();
});
addEventListener("keyup", event => {
  if (controllerLocked()) return;
  const key = event.key.toLowerCase();
  keys[key] = false;
  if (key === "arrowleft") keys.a = false;
  if (key === "arrowright") keys.d = false;
  if (key === "arrowup") keys.w = false;
  if (key === "arrowdown") keys.s = false;
});
canvas.addEventListener("pointermove", event => {
  if (controllerLocked()) return;
  mouseAimScreen.x = THREE.MathUtils.clamp(event.clientX, 0, innerWidth);
  mouseAimScreen.y = THREE.MathUtils.clamp(event.clientY, 0, innerHeight);
  if (event.pointerType === "mouse") {
    setInputMode("mouse");
    if (frontView && phase === "combat" && !menuOpen) {
      viewYaw -= event.movementX * .0016 * (adsActive ? aimSettings.adsSensitivity : aimSettings.sensitivity);
    }
  }
  pointer.set(mouseAimScreen.x / innerWidth * 2 - 1, -(mouseAimScreen.y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(ground)[0];
  if (hit) aim.copy(hit.point);
});
canvas.addEventListener("pointerdown", () => {
  if (controllerLocked() || phase === "countdown") return;
  firing = true;
  wakeAudio();
});
addEventListener("pointerup", () => { firing = false; });

bindTouchStick("moveStick", "m");
bindTouchStick("aimStick", "a");

function bindHoldButton(id, onChange) {
  const button = $(id);
  const change = active => event => {
    event.preventDefault();
    setInputMode("touch");
    button.classList.toggle("active", active);
    onChange(active);
  };
  button.addEventListener("pointerdown", change(true));
  button.addEventListener("pointerup", change(false));
  button.addEventListener("pointercancel", change(false));
  button.addEventListener("pointerleave", change(false));
}

bindHoldButton("touchFireBtn", active => { touch.fire = active; });
bindHoldButton("touchAdsBtn", active => { adsActive = active; });
$("touchReloadBtn").onclick = () => { setInputMode("touch"); reloadWeapon(true); };
$("touchWeaponBtn").onclick = () => { setInputMode("touch"); cycleWeapon(1); };
$("touchInteractBtn").onclick = () => { setInputMode("touch"); interact(); };
$("touchAbilityBtn").onclick = () => { setInputMode("touch"); triggerAbility(); };
$("touchPauseBtn").onclick = () => { setInputMode("touch"); menuOpen ? closeGameMenu() : openGameMenu(); };
$("soloMode").onclick = () => { document.body.classList.remove("menu-active"); mode = "solo"; $("soloMode").classList.add("active"); $("teamMode").classList.remove("active"); $("ctfMode").classList.remove("active"); $("ctfPlayerControl").classList.add("hidden"); lobbyChanged(); start(); };
$("teamMode").onclick = () => { document.body.classList.remove("menu-active"); mode = "teams"; $("teamMode").classList.add("active"); $("soloMode").classList.remove("active"); $("ctfMode").classList.remove("active"); $("ctfPlayerControl").classList.add("hidden"); lobbyChanged(); start(); };
$("ctfMode").onclick = () => { document.body.classList.remove("menu-active"); mode = "ctf"; $("ctfMode").classList.add("active"); $("soloMode").classList.remove("active"); $("teamMode").classList.remove("active"); $("ctfPlayerControl").classList.remove("hidden"); lobbyChanged(); start(); };
document.querySelectorAll("[data-ctf-players]").forEach(button => {
  button.onclick = () => {
    ctfPlayers = Number(button.dataset.ctfPlayers);
    document.querySelectorAll("[data-ctf-players]").forEach(item => item.classList.toggle("active", item === button));
    if (mode === "ctf") {
      lobbyChanged();
      start();
    }
  };
});
document.querySelectorAll("[data-map]").forEach(button => {
  button.onclick = () => {
    mapKey = button.dataset.map;
    document.querySelectorAll("[data-map]").forEach(item => item.classList.toggle("active", item === button));
    lobbyChanged();
    start();
  };
});
$("openShopBtn").onclick = () => { if (phase === "prep") interact(); };
$("openChestBtn").onclick = interact;
$("closeShopBtn").onclick = () => {
  ui.shop.classList.add("hidden");
  if (chestAccessGranted && lobbySocket?.readyState === WebSocket.OPEN) lobbySocket.send(JSON.stringify({ type: "chest-leave" }));
  chestAccessGranted = false;
};
$("loadoutArmoryBtn").onclick = () => ui.shop.classList.remove("hidden");
$("loadoutReadyBtn").onclick = () => {
  ui.shop.classList.add("hidden");
  $("loadoutRoomModal").classList.add("hidden");
  beginCountdown();
};
$("equipScoutBtn").onclick = () => equip("scout");
$("equipCannonBtn").onclick = () => equip("cannon");
$("equipInfernoBtn").onclick = () => equip("inferno");
$("upgradeScoutBtn").onclick = () => upgrade("scout");
$("upgradeCannonBtn").onclick = () => upgrade("cannon");
$("upgradeInfernoBtn").onclick = () => upgrade("inferno");
$("upgradeShieldBtn").onclick = upgradeShield;
$("restartBtn").onclick = () => { ui.over.classList.add("hidden"); start(); };
$("settingsBtn").onclick = () => ui.settings.classList.remove("hidden");
$("lobbySettingsBtn").onclick = () => ui.settings.classList.remove("hidden");
$("closeSettingsBtn").onclick = () => ui.settings.classList.add("hidden");
$("menuToggle").onclick = () => menuOpen ? closeGameMenu() : openGameMenu();
$("resumeGameBtn").onclick = closeGameMenu;
$("frontViewBtn").onclick = () => { frontView = !frontView; $("frontViewBtn").textContent = frontView ? "Arena View" : "First Person"; };
$("menuSettingsBtn").onclick = () => { ui.settings.classList.remove("hidden"); };
$("exitGameBtn").onclick = exitToLobby;
$("mobileMenuSelect").onchange = event => {
  if (event.target.value === "resume") closeGameMenu();
  if (event.target.value === "settings") ui.settings.classList.remove("hidden");
  if (event.target.value === "front") { frontView = true; closeGameMenu(); }
  if (event.target.value === "lobby") exitToLobby();
  event.target.value = "resume";
};
ui.controllerOnly.checked = controllerOnly;
ui.controllerOnly.onchange = () => { controllerOnly = ui.controllerOnly.checked; localStorage.setItem("wastland-survivor-controller-only", String(controllerOnly)); clearKeyboardInput(); };
ui.aimPreset.value = aimSettings.preset;
ui.aimSensitivity.value = String(aimSettings.sensitivity);
ui.adsSensitivity.value = String(aimSettings.adsSensitivity);
ui.aimAssistStrength.value = String(aimSettings.assistStrength);
[ui.aimPreset, ui.aimSensitivity, ui.adsSensitivity, ui.aimAssistStrength].forEach(control => control.addEventListener("input", persistAimSettings));
persistAimSettings();
ui.graphicsTier.value = ["low", "medium", "high"].includes(graphicsTierOverride) ? graphicsTierOverride : "auto";
ui.graphicsTier.onchange = () => {
  graphicsTierOverride = ui.graphicsTier.value;
  if (graphicsTierOverride === "auto") localStorage.removeItem(task4StorageKey("graphics-tier"));
  else localStorage.setItem(task4StorageKey("graphics-tier"), graphicsTierOverride);
  applyGraphicsTier();
};
ui.soundToggle.checked = audioEnabled;
ui.soundToggle.onchange = () => { audioEnabled = ui.soundToggle.checked; localStorage.setItem("wastland-survivor-audio", audioEnabled ? "on" : "off"); wakeAudio(); };
ui.volume.value = String(audioVolume);
ui.volume.oninput = () => { audioVolume = Number(ui.volume.value); localStorage.setItem("wastland-survivor-volume", String(audioVolume)); wakeAudio(); playTone(340, .04, "sine", .03); };
ui.musicToggle.checked = musicEnabled;
ui.musicVolume.value = String(musicVolume);
ui.musicSource.value = musicSource;
$("localTrackPicker").classList.toggle("hidden", musicSource !== "local");
ui.musicToggle.onchange = () => {
  musicEnabled = ui.musicToggle.checked;
  localStorage.setItem("wastland-survivor-music", musicEnabled ? "on" : "off");
  if (!musicEnabled) stopMusic();
  else if (musicSource === "local") playLocalTrack();
  else { wakeAudio(); startBuiltInMusic(); }
};
ui.musicVolume.oninput = () => {
  musicVolume = Number(ui.musicVolume.value);
  localStorage.setItem("wastland-survivor-music-volume", String(musicVolume));
  updateLocalMusicVolume();
};
ui.musicSource.onchange = () => {
  musicSource = ui.musicSource.value;
  localStorage.setItem("wastland-survivor-music-source", musicSource);
  stopMusic();
  $("localTrackPicker").classList.toggle("hidden", musicSource !== "local");
  if (musicSource === "builtin" && musicEnabled) { wakeAudio(); startBuiltInMusic(); }
  else if (musicSource === "local") ui.musicStatus.textContent = localTracks.length ? localTracks[localTrackIndex].name : "Choose downloaded tracks from this device";
};
$("localTrackInput").onchange = event => {
  localTracks.forEach(track => URL.revokeObjectURL(track.url));
  localTracks = [...event.target.files].map(file => ({ name: file.name, url: URL.createObjectURL(file) }));
  localTrackIndex = 0;
  if (localTracks.length) playLocalTrack(0);
};
$("playMusicBtn").onclick = () => {
  wakeAudio();
  if (musicSource === "builtin") {
    if (musicTimer) { stopBuiltInMusic(); $("playMusicBtn").textContent = "Play"; }
    else { startBuiltInMusic(); $("playMusicBtn").textContent = "Pause"; }
  } else if (localMusic.paused) playLocalTrack();
  else { localMusic.pause(); $("playMusicBtn").textContent = "Play"; }
};
$("previousTrackBtn").onclick = () => playLocalTrack(localTrackIndex - 1);
$("nextTrackBtn").onclick = () => playLocalTrack(localTrackIndex + 1);
$("shuffleMusicBtn").onclick = () => playLocalTrack(Math.floor(Math.random() * Math.max(1, localTracks.length)));
localMusic.onended = () => playLocalTrack(localTrackIndex + 1);
ui.joinVoice.onclick = joinVoice;
ui.leaveVoice.onclick = () => closeVoice("Mic is off");
ui.muteVoice.onclick = () => { voiceMuted = !voiceMuted; localStream?.getAudioTracks().forEach(track => { track.enabled = !voiceMuted; }); updateVoiceButtons(); setVoiceStatus(voiceMuted ? "Voice muted" : "Voice connected"); };
ui.offline.onchange = () => {
  offlineMode = ui.offline.checked;
  localStorage.setItem("wastland-survivor-offline", String(offlineMode));
  updateNetworkStatus();
  if (offlineMode) closeLobbyRoom();
  else ensureLobbyRoom();
};
$("enterWastlandBtn").onclick = enterProfile;
$("guestOfflineBtn").onclick = enterGuestOffline;
$("showLinkProfileBtn").onclick = showDeviceLinkStep;
$("showLinkProfileNewBtn").onclick = showDeviceLinkStep;
$("linkProfileBackBtn").onclick = initializeProfileScreen;
$("claimLinkBtn").onclick = claimDeviceLink;
$("createDeviceLinkBtn").onclick = createDeviceLink;
document.querySelectorAll(".avatar-choice").forEach(card => card.onclick = () => {
  profileAvatar.value = card.dataset.avatar;
  updateAvatarCards(card.dataset.avatar);
});
profileAvatar.onchange = () => updateAvatarCards();
profileBirthDate.addEventListener("input", () => {
  const age = ageFromBirthDate(profileBirthDate.value);
  parentSetup.classList.toggle("hidden", !(age > 0 && age < 14));
});
$("verifyMathBtn").onclick = finishMathCheck;
[profilePin, returnPin, mathAnswer].forEach(input => {
  ["copy", "cut", "paste", "contextmenu"].forEach(eventName => input.addEventListener(eventName, event => event.preventDefault()));
});
setInterval(() => {
  if (!pendingProfile) return;
  const remaining = Math.max(0, mathDeadline - Date.now());
  mathTimer.textContent = `${String(Math.ceil(remaining / 60000)).padStart(2, "0")}:${String(Math.ceil(remaining / 1000) % 60).padStart(2, "0")}`;
  if (!remaining) finishMathCheck();
}, 250);
$("returnWastlandBtn").onclick = returnProfile;
$("storyGuestBtn").onclick = () => { offlineMode = true; localStorage.setItem("wastland-survivor-offline", "true"); openLobby(activeProfile?.name || "Offline Story Player"); };
$("newProfileBtn").onclick = () => {
  localStorage.removeItem("wastland-survivor-profile");
  showProfileChoice();
};
$("signOutProfileBtn").onclick = leaveLobby;
$("editProfileBtn").onclick = editActiveProfile;
$("dashboardBtn").onclick = openDashboard;
$("closeDashboardBtn").onclick = () => $("dashboardModal").classList.add("hidden");
$("lobbyBackBtn").onclick = () => {
  lobbyScreen.classList.add("hidden");
  welcomeScreen.classList.remove("hidden");
  initializeProfileScreen();
};
$("profileBackBtn").onclick = () => {
  if (editingProfile) {
    editingProfile = false;
    welcomeScreen.classList.add("hidden");
    lobbyScreen.classList.remove("hidden");
    return;
  }
  initializeProfileScreen();
};
$("dashboardEditBtn").onclick = () => { $("dashboardModal").classList.add("hidden"); editActiveProfile(); };
$("dashboardStoreBtn").onclick = () => { $("dashboardModal").classList.add("hidden"); if (phase === "prep") ui.shop.classList.remove("hidden"); else openDashboard(); };
$("survivalLobbyBtn").onclick = () => { lobbyScreen.classList.add("hidden"); $("soloMode").click(); };
$("teamLobbyBtn").onclick = () => { lobbyScreen.classList.add("hidden"); $("teamMode").click(); };
$("onlineSurvivalBtn").onclick = () => { lobbyScreen.classList.add("hidden"); $("teamMode").click(); };
$("botTeamSize").onchange = event => {
  botTeamSize = Number(event.target.value);
};
$("botDifficulty").onchange = event => {
  difficultyRatio = Number(event.target.value);
  aimSettings = normalizeAimSettings({ ...aimSettings, preset: aimPresetForDifficulty(difficultyRatio) });
  ui.aimPreset.value = aimSettings.preset;
  persistAimSettings();
  updateRiskPreview();
};
$("riskLevel").onchange = event => {
  riskLevel = event.target.value;
  localStorage.setItem("wastland-survivor-risk", riskLevel);
  updateRiskPreview();
};
storyMapSelect.onchange = event => {
  mapKey = event.target.value;
};
$("ctf6LobbyBtn").onclick = () => {
  lobbyScreen.classList.add("hidden");
  $("ctfMode").click();
  $("ctfPlayerControl").querySelector('[data-ctf-players="6"]').click();
};

resize();
updateControllerState([...navigator.getGamepads()].some(Boolean));
refreshInputMode();
updateVoiceButtons();
updateNetworkStatus();
start();
phase = "menu";
$("loadoutRoomModal").classList.add("hidden");
document.body.classList.add("menu-active");
$("matchCountdown").classList.add("hidden");
loadReplayBackdrop();
showProfileChoice();
initializeNightfallBackground();
playRandomReplay(homeBackdrop);
render();
