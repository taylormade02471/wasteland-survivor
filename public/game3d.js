import * as THREE from "./vendor/three.module.js";
import { aimPresetForDifficulty, normalizeAimSettings, resolveInputMode, shouldAutoLock, shouldDuckMusic } from "./game-rules.mjs";
import { CONTROL_DIRECTION_LOCK, aimYawFromAxes, firstPersonForwardInput, firstPersonMovementDelta, keyboardMovementAxes, nextMouseYaw } from "./control-direction-lock.mjs";
import { selectGraphicsTier } from "./graphics-config.mjs";
import { canCaptureGameplayPointer, resolveRendererMetrics, resolveTransientInputReset } from "./input-recovery.mjs";
import { applyCanvasPointerHandoff, bindTransientPointerInterrupts } from "./input-recovery-adapter.mjs";
import { createNightfallBackground, setNightfallPresentation, setNightfallScene, setNightfallTier } from "./nightfall-background.mjs";
import { createMenuMediaLifecycle } from "./menu-media-lifecycle.mjs";
import { resolveMenuMedia, resolveMenuPresentation } from "./menu-presentation.mjs";
import {
  applyRequiredControlsTourLock,
  captureControlsTourPreferenceIdentity,
  syncControlsTourPreferencesForIdentity,
} from "./controls-tour-adapter.mjs";
import {
  cancelPendingMatchSelection,
  cancelQueuedControlsTour,
  controlsTourStorageKey,
  createControlsTour,
  createPendingMatchGate,
  mergeSeenControlsFamilies,
  normalizeControlsFamily,
  planOptionalControlsTour,
  queuePendingMatchSelection,
  recordControlsTourControllerSnapshot,
  recordControlsTourSignal,
  releaseQueuedControlsTour,
  resolvePendingMatchSelection,
  shouldOfferControlsMiniTour,
  shouldBlockControlsTourSimulation,
} from "./controls-tour.mjs";
import { activateAbility, createClassProgress, getClassDefinition, getClassStats, normalizeClassProgress } from "./class-rules.mjs";
import { composeWave, scaleEnemy, spawnSchedule, tacticalIntent } from "./enemy-rules.mjs";
import { getWeaponProfile } from "./combat-rules.mjs";
import { kingdomUnlocked as hasKingdom, levelFromXp, unlockedMaps } from "./progression-rules.mjs";
import { storyCampaignView } from "./story-campaign-view.mjs";
import { captureGameplayClip, playRandomReplay } from "./replay-clips.mjs";
import { enemyCurrencyDrop, RISK_PROFILES, rewardPreview, settleMatch } from "./reward-rules.mjs";
import { canAccessChest, createChestPositions, seededRandom } from "./chest-rules.mjs";
import { createExplorationState, evaluateExploration, explorationProgress } from "./exploration-rules.mjs";
import { biomeAt, createConnectedWorldLayout, createTerrainGrid, createWorldScatter, resolveWorldMovement, sampleWorldElevation } from "./world-layout.mjs";
import { getWorldFieldAsset, getWorldFieldPlacements } from "./world-field-assets.mjs";
import { createHudViewModel } from "./hud-view-model.mjs";
import { createQuestState, advanceQuestState, questView } from "./story-quests.mjs";
import { questBeaconFrame, questBeaconProfile } from "./quest-beacon.mjs";
import { sampleCharacterAnimation } from "./character-animation-runtime.mjs";
import { advanceWeaponPresentation, beginWeaponReload, createWeaponPresentationState, sampleWeaponPresentationFrame, triggerWeaponShot } from "./weapon-presentation.mjs";
import { renderQualityProfile } from "./render-quality.mjs";
import { ARMORY_SURFACE_TEXTURES, armoryVisualProfile, buildArmoryRubblePlan } from "./armory-visual-profile.mjs";
import { buildFireVfxProfile, fireVfxFrame } from "./fire-vfx.mjs";
import { currencyPickupFrame, currencyPickupProfile } from "./currency-pickup-vfx.mjs";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { createLiveCharacterPreview, getPreferredCharacterModelPaths, loadFirstAvailableModel } from "./live-character-preview.mjs";
import {
  LOBBY_CONTROL_ORDER,
  createMenuNavigator,
  describeLobbyControl,
  nextLobbySelectIndex,
  resolveLobbyControllerAction,
  resolveMenuKeyAction,
  visibleLobbyControlDescriptors,
} from "./menu-navigation.mjs";
import { reduceClientMatchLifecycle } from "./matchmaking-client.mjs";
import { createLobbyRoomId, normalizeTeamSize, resolveMatchCountdown } from "./matchmaking-rules.mjs";
import {
  beginLocalPinAttempts,
  beginPhoneChallenge,
  buildPhoneLinkRequest,
  createRestoredLocalProfile,
  failPhoneChallenge,
  finishPhoneChallenge,
  maskPhoneNumber,
  mayResendPhoneChallenge,
  mergeVerifiedLocalProfile,
  normalizePhoneNumber,
  recordLocalPinAttempt,
  sanitizeLocalProfile,
} from "./phone-account.mjs";
import { loadPhoneAuthProvider } from "./phone-auth-provider.mjs";
import {
  applyAuthoritativePlayerIdentity,
  backfillProfileIdentities,
  createLobbyProfileView,
  ensureProfileIdentity,
  reduceLobbyConnectivity,
} from "./lobby-profile-view.mjs";

const $ = id => document.getElementById(id);
const task4StorageKey = suffix => ["wastland", "survivor", suffix].join("-");
function runtimeAssetPath(path) {
  return window.__WASTELAND_MEDIA__?.url?.(path) || path;
}
const canvas = $("game");
const renderFocus = new URLSearchParams(window.location.search).get("renderFocus");
canvas.dataset.controlDirectionLock = CONTROL_DIRECTION_LOCK.id;
const aimReticle = $("aimReticle");
const controllerDebug = $("controllerDebug");
const inputRecoveryNotice = $("inputRecoveryNotice");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
const curatedGlbLoader = new GLTFLoader();
const curatedGlbCache = new Map();
const ui = {
  hp: $("hpText"), hpBar: $("hpBar"), shield: $("shieldText"), shieldBar: $("shieldBar"), heat: $("heatText"), heatBar: $("heatBar"),
  ammo: $("ammoText"), ability: $("abilityText"), abilityBar: $("abilityBar"), team: $("teamText"), teamName: $("teamName"), teamHealth: $("teamHealthText"), teamHealthBar: $("teamHealthBar"), objective: $("objectiveText"),
  scrap: $("scrapText"), gold: $("goldText"), silver: $("silverText"), quest: $("questText"), questProgress: $("questProgress"), questProgressFill: $("questProgressFill"), kills: $("killsText"), wave: $("waveText"), level: $("levelText"), stage: $("stageText"), chapter: $("chapterText"), mission: $("missionText"), weapon: $("weaponText"), map: $("mapText"), exploration: $("explorationText"), phase: $("phaseText"), timer: $("timerText"), blue: $("blueScore"), red: $("redScore"),
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
const phoneCodeStep = $("phoneCodeStep");
const profilePhone = $("profilePhone");
const profileAvatar = $("profileAvatar");
const profileName = $("profileName");
const profileBirthDate = $("profileBirthDate");
const ageConfirm = $("ageConfirm");
const parentSetup = $("parentSetup");
const parentPhone = $("parentPhone");
const parentPin = $("parentPin");
const profilePin = $("profilePin");
const returnPin = $("returnPin");
const profileMessage = $("profileMessage");
const returnMessage = $("returnMessage");
const profileSelector = $("profileSelector");
const lobbyPlayer = $("lobbyPlayer");
const storyMapSelect = $("storyMapSelect");
const homeBackdrop = $("homeBackdrop");
const nightfallBackground = $("nightfallBackground");
const menuMediaLifecycle = createMenuMediaLifecycle();
let lobbyAvatarPreview = null;
let profileAvatarPreview = null;
const MAPS = {
  wasteland: { label: "Wasteland", texture: "assets/wasteland-terrain-v2.png", fog: 0x554331, hazard: 0x83ff47 },
  toxic: { label: "Toxic Ponds", texture: "assets/toxic-terrain-v2.png", fog: 0x344a2d, hazard: 0x93ff30 },
  ice: { label: "Icy Mountain", texture: "assets/icy-mountain-terrain-v2.png", fog: 0xc3d9e7, hazard: 0x4dbbff },
  inferno: { label: "Fire Inferno", texture: "assets/fire-inferno-terrain-v2.png", fog: 0x351510, hazard: 0xff5a24 }
};
const QUEST_METRIC_LABELS = Object.freeze({ survivedSeconds: "SURVIVAL", scrap: "SCRAP", kills: "RAIDERS", stage: "STAGE", discoveries: "LANDMARKS" });

function updateAvatarCards(value = profileAvatar.value) {
  document.querySelectorAll(".avatar-choice").forEach(card => {
    const selected = card.dataset.avatar === value;
    card.classList.toggle("selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  });
  const selectedCard = document.querySelector(`.avatar-choice[data-avatar="${value}"]`);
  const selectedName = selectedCard?.querySelector("b")?.textContent || "Dust Scout";
  const selectedImage = selectedCard?.querySelector("img")?.getAttribute("src");
  $("profileAvatarPreviewName").textContent = selectedName;
  if (selectedImage) {
    $("profileAvatarPreviewImage").src = selectedImage;
    $("profileAvatarPreviewImage").alt = `${selectedName} preview`;
  }
  ensureProfileAvatarPreview(value);
}

function prepareAuthoredMaterial(source) {
  const material = source?.clone ? source.clone() : source;
  if (!material) return material;
  if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
  if (material.emissiveMap) material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
  if ("roughness" in material) material.roughness = THREE.MathUtils.clamp(Number(material.roughness) || .72, .28, 1);
  if ("metalness" in material) material.metalness = THREE.MathUtils.clamp(Number(material.metalness) || 0, 0, .86);
  material.needsUpdate = true;
  return material;
}

function cloneAuthoredRoot(scene) {
  const root = scene?.clone ? scene.clone(true) : null;
  root?.traverse?.(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    if (Array.isArray(node.material)) node.material = node.material.map(prepareAuthoredMaterial);
    else node.material = prepareAuthoredMaterial(node.material);
  });
  return root;
}

function installAuthoredAnimationSet(root, asset) {
  const clips = Array.isArray(asset?.animations) ? asset.animations.filter(Boolean) : [];
  if (!root || !clips.length || typeof THREE.AnimationMixer !== "function") return;
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map(clips.map(clip => [String(clip.name || "").toLowerCase(), mixer.clipAction(clip)]));
  root.userData.animationMixer = mixer;
  root.userData.animationActions = actions;
  root.userData.animationState = "";
}

function driveAuthoredAnimation(root, state, dt) {
  const mixer = root?.userData?.animationMixer;
  const actions = root?.userData?.animationActions;
  if (!mixer || !actions) return;
  mixer.update(Math.max(0, Math.min(.1, Number(dt) || 0)));
  const requested = String(state || "idle").toLowerCase();
  const clipName = [requested, requested === "downed" ? "idle" : null, "idle"].find(name => name && actions.has(name));
  if (!clipName || root.userData.animationState === clipName) return;
  const next = actions.get(clipName);
  const previous = actions.get(root.userData.animationState);
  previous?.fadeOut?.(.12);
  next.reset().fadeIn(.12).play();
  root.userData.animationState = clipName;
}

function fitAuthoredWorldRoot(root, maxDimension) {
  const initialBox = new THREE.Box3().setFromObject(root);
  const initialSize = new THREE.Vector3();
  initialBox.getSize(initialSize);
  const largest = Math.max(initialSize.x, initialSize.y, initialSize.z, 1);
  root.scale.setScalar(maxDimension / largest);
  const fittedBox = new THREE.Box3().setFromObject(root);
  root.position.y -= fittedBox.min.y;
  return root;
}

function loadCuratedGlb(paths) {
  return loadFirstAvailableModel({ loader: curatedGlbLoader, paths, cache: curatedGlbCache });
}

const AUTHORED_ENEMY_MODELS = Object.freeze({
  rusher: "./assets/nightfall/aaa/enemies/meshy/mutated-creature-meshy-v1.glb",
  shooter: "./assets/nightfall/aaa/enemies/meshy/shooter-meshy-v1.glb",
  sniper: "./assets/nightfall/aaa/enemies/meshy/marksman-meshy-v1.glb",
  shield: "./assets/nightfall/aaa/enemies/meshy/shield-soldier-meshy-v1.glb",
  heavy: "./assets/nightfall/aaa/enemies/meshy/heavy-gunner-meshy-v1.glb",
  drone: "./assets/nightfall/aaa/enemies/meshy/drone-meshy-v1.glb",
  mutant: "./assets/nightfall/aaa/enemies/meshy/mutant-meshy-v1.glb",
  boss: "./assets/nightfall/aaa/enemies/meshy/boss-commander-meshy-v1.glb",
});

const AUTHORED_WEAPON_MODELS = Object.freeze({
  scout: "./assets/nightfall/aaa/weapons/meshy/scout-meshy-v1.glb",
  cannon: "./assets/nightfall/aaa/weapons/meshy/cannon-meshy-v1.glb",
  inferno: "./assets/nightfall/aaa/weapons/meshy/inferno-meshy-v1.glb",
});

function ensureLobbyAvatarPreview(id) {
  if (!lobbyAvatarPreview) {
    lobbyAvatarPreview = createLiveCharacterPreview({
      canvas: $("lobbyAvatarCanvas"),
      THREE,
      GLTFLoader,
      defaultCharacter: id,
    });
  }
  lobbyAvatarPreview.setCharacter(id);
}

function ensureProfileAvatarPreview(id) {
  if (!profileAvatarPreview) {
    profileAvatarPreview = createLiveCharacterPreview({
      canvas: $("profileAvatarCanvas"),
      THREE,
      GLTFLoader,
      defaultCharacter: id,
    });
  }
  profileAvatarPreview.setCharacter(id);
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
let lobbyNavigator = null;
let menuSection = "home";
let menuOpenedFromPrep = false;
let countdown = 15;
let countdownDeadline = 0;
let graceUntil = 0;
let frontView = true;
let ground, player, ally;
let activeTerrainTexture = null;
let mapVisuals = null;
let armorySurfaceMaps = null;
let activeQuestBeaconId = null;
let chests = [];
let chestSpawnRadius = 70;
let allies = [], enemies = [], bullets = [], hazards = [], flags = [], effects = [];
let cameraShake = 0;
let score = 0, kills = 0, scrap = 0, gold = 0, silver = 0, wave = 1, blue = 0, red = 0, shieldLevel = 0;
let playerLevel = 1, storyStage = 1, missionIndex = 0, kingdomUnlocked = false;
let weaponPresentationState = createWeaponPresentationState("scout");
let questState = createQuestState();
let renderQuality = renderQualityProfile(3);
let riskLevel = localStorage.getItem("wastland-survivor-risk") || "standard";
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
let survivalSeconds = 0;
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
let musicSource = localStorage.getItem("wastland-survivor-music-source") || "bundled";
if (musicSource === "builtin") musicSource = "bundled";
let offlineMode = localStorage.getItem("wastland-survivor-offline") === "true";
let lobbyConnectivity = {
  offlineMode,
  playerServiceReachable: false,
  lobbySocketOpen: false,
};
let youthAccount = false;
let activeProfile = null;
let editingProfile = false;
let phoneProviderPromise = null;
let phoneConfirmation = null;
let phoneChallenge = null;
let pendingPhoneAction = null;
let controlsTourState = null;
let pendingMatchGate = createPendingMatchGate();
let controlsPreferencesPromise = Promise.resolve();
let miniTourFamily = null;
let queuedControlsTour = null;
let guestControlsIdentityActive = false;
const offeredMiniTourFamilies = new Set();
let loadoutControllerIndex = 1;
const localPinAttempts = new Map();
let audioContext = null;
let musicTimer = null;
let musicStep = 0;
let localTracks = [];
let localTrackIndex = 0;
const localMusic = new Audio();
const bundledMusic = new Audio();
bundledMusic.preload = "auto";
bundledMusic.loop = false;
let bundledMusicPhase = null;
let bundledMusicTrack = null;
const BUNDLED_SOUNDTRACK = Object.freeze({
  menu: Object.freeze([
    Object.freeze({ name: "We Walk the Ruins — menu theme", url: "./assets/nightfall/music/we-walk-the-ruins-menu-theme.mp3" }),
    Object.freeze({ name: "The Coat Beside the Door — Phantom", url: "./assets/nightfall/music/the-coat-beside-the-door.mp3" }),
    Object.freeze({ name: "Winter Folded in the Seams — Phantom", url: "./assets/nightfall/music/winter-folded-in-the-seams.mp3" }),
  ]),
  gameplay: Object.freeze([
    Object.freeze({ name: "Perimeter Breach — gameplay ambient", url: "./assets/nightfall/music/wasteland-gameplay-ambient.mp3" }),
    Object.freeze({ name: "Answer Back in Flame — Phantom", url: "./assets/nightfall/music/answer-back-in-flame.mp3" }),
    Object.freeze({ name: "Fire in Our Hands — Phantom", url: "./assets/nightfall/music/fire-in-our-hands.mp3" }),
    Object.freeze({ name: "We Hunt Now — Phantom", url: "./assets/nightfall/music/we-hunt-now.mp3" }),
  ]),
});
let localStream = null;
let voiceSocket = null;
let lobbySocket = null;
let lobbyId = null;
let lobbyRoomName = null;
let lobbyPeers = 0;
let activeMatchPlan = null;
let awaitingRematch = false;
let chestOccupants = 0;
let chestAccessGranted = false;
let lobbyRetryTimer = null;
let voiceMuted = false;
const voicePeers = new Map();
const touch = { mx: 0, mz: 0, ax: 0, az: 0, fire: false };
const touchStickReleases = [];
const keys = {};
const coarsePointer = matchMedia("(pointer: coarse)");
const finePointer = matchMedia("(pointer: fine)");
let mouseInputActive = false;
let inputMode = "mouse";
let viewYaw = 0;
const mouseAimScreen = { x: innerWidth / 2, y: innerHeight / 2 };
let lockedTarget = null;
let graphicsTierOverride = localStorage.getItem(task4StorageKey("graphics-tier")) || "auto";
let pointerResumeRequired = false;
let rendererContextLost = false;
let canvasPointerLocked = false;
let devicePixelRatioQuery = null;
let observedDevicePixelRatio = null;
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
  const previousFamily = normalizeControlsFamily(inputMode);
  inputMode = nextMode;
  mouseInputActive = nextMode === "mouse";
  if (nextMode !== "mouse" && pointerResumeRequired) {
    pointerResumeRequired = false;
    updateInputRecoveryNotice();
  }
  if (nextMode !== "mouse" && document.pointerLockElement === canvas) document.exitPointerLock?.();
  document.body.dataset.inputMode = nextMode;
  $("landscapeHint").classList.toggle("hidden", nextMode !== "touch" || matchMedia("(orientation: landscape)").matches);
  const nextFamily = normalizeControlsFamily(nextMode);
  if (previousFamily !== nextFamily) offerControlsMiniTour(nextFamily);
}

function refreshInputMode() {
  setInputMode(resolveInputMode({ coarsePointer: coarsePointer.matches, mouseInputActive, controllerConnected }));
}

function updateLobbyConnectivity(event) {
  lobbyConnectivity = reduceLobbyConnectivity(lobbyConnectivity, event);
  if (!lobbyScreen.classList.contains("hidden")) renderLobbyProfile(activeProfile?.name || "Offline Guest");
}

function lobbyControlElements() {
  return LOBBY_CONTROL_ORDER.map(id => $(id)).filter(control => control?.hasAttribute("data-lobby-control"));
}

function lobbyControlDescriptors() {
  return visibleLobbyControlDescriptors(lobbyControlElements());
}

function renderLobbyNavigation(focus = false) {
  const current = lobbyNavigator?.current();
  lobbyControlElements().forEach(control => {
    const selected = control.id === current?.id;
    control.classList.toggle("is-selected", selected && current?.input !== "programmatic");
    if (selected) control.setAttribute("aria-current", "true");
    else control.removeAttribute("aria-current");
  });
  applyMenuPresentation("lobby", current?.input === "programmatic" ? null : current?.id);
  if (focus && current?.id) $(current.id)?.focus({ preventScroll: true });
}

function refreshLobbyNavigation(initialId) {
  const previousId = initialId ?? lobbyNavigator?.current().id;
  lobbyNavigator = createMenuNavigator(lobbyControlDescriptors(), previousId);
  renderLobbyNavigation();
}

function moveLobbyFocus(direction, input) {
  if (!lobbyNavigator) refreshLobbyNavigation();
  const state = lobbyNavigator.move(direction, input);
  renderLobbyNavigation(input !== "mouse" && input !== "touch");
  return state;
}

function focusLobbyCommand(id, input) {
  if (!lobbyNavigator) refreshLobbyNavigation(id);
  const state = lobbyNavigator.focus(id, input);
  renderLobbyNavigation(input !== "mouse" && input !== "touch");
  return state;
}

function activateLobbyCommand() {
  const command = lobbyNavigator?.activate();
  if (command?.id) $(command.id)?.click();
}

function bindLobbyNavigation() {
  lobbyControlElements().forEach(control => {
    control.addEventListener("pointerenter", event => {
      if (event.pointerType !== "mouse") return;
      setInputMode("mouse");
      focusLobbyCommand(control.id, "mouse");
    });
    control.addEventListener("pointerdown", event => {
      if (event.pointerType === "touch") setInputMode("touch");
      focusLobbyCommand(control.id, event.pointerType === "touch" ? "touch" : "mouse");
    });
    control.addEventListener("focus", () => {
      focusLobbyCommand(control.id, inputMode);
    });
    control.addEventListener("click", event => {
      if (event.isTrusted && event.detail === 0) {
        setInputMode("keyboard");
        focusLobbyCommand(control.id, "keyboard");
      }
    });
  });
  $("lobbyGameOptions").addEventListener("toggle", () => refreshLobbyNavigation("lobbyGameOptionsSummary"));
}

function changeLobbySelect(select, step) {
  const nextIndex = nextLobbySelectIndex(select?.options, select?.selectedIndex, step);
  if (!select || nextIndex === select.selectedIndex) return;
  select.selectedIndex = nextIndex;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function handleLobbyController() {
  const controller = pollController();
  const active = $(lobbyNavigator?.current().id);
  const action = resolveLobbyControllerAction(controller, describeLobbyControl(active));
  if (action?.type === "move") moveLobbyFocus(action.direction, "controller");
  if (action?.type === "select") changeLobbySelect(active, action.step);
  if (action?.type === "activate") activateLobbyCommand();
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
  silver += Math.max(1, Math.round(discovery.reward.scrap * .6));
  gold += discovery.events.some(event => event.kind === "completion") ? 8 : 2;
  spawnCurrencyPickupBurst(player.g.position, {
    gold: discovery.events.some(event => event.kind === "completion") ? 8 : 2,
    silver: Math.max(1, Math.round(discovery.reward.scrap * .6)),
  });
  updateStoryProgress();
  const completion = discovery.events.find(event => event.kind === "completion");
  const locations = discovery.events.filter(event => event.kind !== "completion").map(event => event.label);
  ui.discoveryTitle.textContent = completion?.label || `Discovered: ${locations.join(" + ")}`;
  ui.discoveryReward.innerHTML = `+${discovery.reward.score} SCORE / +${discovery.reward.scrap} SCRAP / <span class="reward-chip"><img src="assets/nightfall/icons/scrap-silver-v1.svg" alt="" aria-hidden="true">+${Math.max(1, Math.round(discovery.reward.scrap * .6))} SILVER</span>`;
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

function handleDevicePixelRatioChange() {
  observedDevicePixelRatio = null;
  resize();
}

function observeDevicePixelRatio(pixelRatio) {
  if (observedDevicePixelRatio === pixelRatio) return;
  if (devicePixelRatioQuery?.removeEventListener) devicePixelRatioQuery.removeEventListener("change", handleDevicePixelRatioChange);
  else devicePixelRatioQuery?.removeListener?.(handleDevicePixelRatioChange);
  observedDevicePixelRatio = pixelRatio;
  devicePixelRatioQuery = matchMedia(`(resolution: ${pixelRatio}dppx)`);
  if (devicePixelRatioQuery.addEventListener) devicePixelRatioQuery.addEventListener("change", handleDevicePixelRatioChange);
  else devicePixelRatioQuery.addListener?.(handleDevicePixelRatioChange);
}

function resize() {
  const pixelRatio = window.devicePixelRatio || 1;
  const metrics = resolveRendererMetrics({
    width: innerWidth,
    height: innerHeight,
    devicePixelRatio: pixelRatio,
    graphicsTier: effectiveGraphicsTier(),
  });
  if (!rendererContextLost) {
    renderer.setPixelRatio(metrics.pixelRatio);
    renderer.setSize(metrics.width, metrics.height, false);
  }
  camera.aspect = metrics.aspect;
  camera.updateProjectionMatrix();
  observeDevicePixelRatio(pixelRatio);
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

function attachAuthoredCharacter(group, avatarType) {
  loadCuratedGlb(getPreferredCharacterModelPaths(avatarType)).then(asset => {
    if (!group.parent) return;
    const root = cloneAuthoredRoot(asset?.scene);
    if (!root) return;
    installAuthoredAnimationSet(root, asset);
    fitAuthoredWorldRoot(root, 2.35);
    root.rotation.y = Math.PI;
    while (group.children.length) group.remove(group.children[0]);
    group.add(root);
    group.userData.authoredCharacter = avatarType;
    group.userData.animationTime = 0;
    group.userData.animationPreviousPosition = group.position.clone();
    attachAuthoredWeapon(group, activeGun);
  }).catch(() => {});
}

function updateAuthoredCharacterAnimations(dt) {
  const actors = [player, ...allies, ...enemies];
  for (const actor of actors) {
    const group = actor?.g;
    if (!group) continue;
    group.userData.animationTime = (group.userData.animationTime || 0) + dt;
    group.userData.attackPulseMs = Math.max(0, (group.userData.attackPulseMs || 0) - dt * 1000);
    if (group.userData.spiderVisual) {
      const gait = actor.alive ? Math.sin(group.userData.animationTime * 8.5) * .16 : .035;
      group.userData.spiderLegs?.forEach((leg, index) => {
        const phase = index % 2 ? -gait : gait;
        leg.upper.rotation.z = leg.upper.userData.restRotation.z + phase;
        leg.lower.rotation.z = leg.lower.userData.restRotation.z - phase * .72;
      });
      group.position.y = actor.alive ? Math.abs(Math.sin(group.userData.animationTime * 8.5)) * .025 : 0;
      const attackT = Math.max(0, Math.min(1, group.userData.attackPulseMs / 180));
      const pulse = 1 + Math.sin((1 - attackT) * Math.PI) * .12;
      group.userData.spiderCore?.scale.set(1.05 * pulse, .76 / pulse, 1.28 * pulse);
      group.userData.spiderEyes?.forEach(eye => eye.scale.setScalar(1 + attackT * .35));
    }
    if (!group.userData.authoredCharacter && !group.userData.authoredEnemy) continue;
    const previous = group.userData.animationPreviousPosition || group.position.clone();
    const moved = group.position.distanceTo(previous) > .001;
    const state = !actor.alive ? "downed" : actor === player && firing ? "fire" : moved ? "run" : actor === player && adsActive ? "aim" : "idle";
    group.userData.hitPulseMs = Math.max(0, (group.userData.hitPulseMs || 0) - dt * 1000);
    const authoredState = group.userData.authoredEnemy
      ? (!actor.alive || group.userData.hitPulseMs > 0 ? "hit" : actor.cooldown > 0 ? "attack" : moved ? "move" : "idle")
      : state;
    const authoredRoot = group.children.find(child => child.userData?.animationMixer);
    driveAuthoredAnimation(authoredRoot, authoredState, dt);
    const pose = sampleCharacterAnimation({ state, time: group.userData.animationTime, intensity: actor.alive ? 1 : .7 });
    const root = group.children.find(child => child.name?.startsWith("character:")) || group;
    if (group.userData.animationBaseY == null) group.userData.animationBaseY = root.position.y;
    // The textured Meshi release models are intentionally compact single-mesh
    // assets. Give them a visible authored motion fallback until their full
    // skinned anchor hierarchy replaces the compact mobile variant.
    if (!root.getObjectByName?.("torso:chest") && root !== group) {
      root.position.y = group.userData.animationBaseY + Math.sin(group.userData.animationTime * 2.2) * .018;
      root.rotation.z = Math.sin(group.userData.animationTime * 1.4) * .012;
      if (state === "run" || state === "walk") root.rotation.y = Math.sin(group.userData.animationTime * 7) * .035;
    }
    const named = name => root.getObjectByName?.(name) || group.getObjectByName?.(name);
    const apply = (name, transform) => {
      const object = named(name);
      if (!object) return;
      object.rotation.x = transform.rotationX || 0;
      object.rotation.y = transform.rotationY || 0;
      object.rotation.z = transform.rotationZ || 0;
    };
    apply("torso:chest", pose.torso);
    apply("head:helmet", pose.head);
    apply("head:hood", pose.head);
    apply("leftArm:upper", pose.leftArm);
    apply("rightArm:upper", pose.rightArm);
    apply("leftLeg:boot", pose.leftLeg);
    apply("rightLeg:boot", pose.rightLeg);
    apply("weaponAnchor", pose.weapon);
    previous.copy(group.position);
    group.userData.animationPreviousPosition = previous;
  }
}

function updateWeaponPresentation(dt) {
  weaponPresentationState = advanceWeaponPresentation(weaponPresentationState, dt);
  const weapon = player?.g?.getObjectByName?.("authored-weapon");
  if (!weapon) return;
  const frame = sampleWeaponPresentationFrame(weaponPresentationState, {
    aim: adsActive ? 1 : 0,
    viewportWidth: innerWidth,
  });
  weapon.position.z = .56 + frame.pose.kickZ;
  weapon.position.y = 1.05 + frame.pose.liftY;
  weapon.rotation.z = frame.pose.roll;
  weapon.userData.presentationStatus = frame.muzzleFlash.visible ? "firing" : weaponPresentationState.smokeMs > 0 ? "smoking" : weaponPresentationState.reloading ? "reloading" : "ready";
  weapon.userData.presentationFrame = frame;
}

function attachAuthoredWeapon(group, gunName) {
  const assetPath = AUTHORED_WEAPON_MODELS[gunName];
  if (!assetPath) return;
  group.userData.requestedWeapon = gunName;
  group.getObjectByName("authored-weapon")?.removeFromParent();
  loadCuratedGlb([assetPath]).then(asset => {
    if (!group.parent || group.userData.requestedWeapon !== gunName) return;
    const root = cloneAuthoredRoot(asset?.scene);
    if (!root) return;
    group.getObjectByName("authored-weapon")?.removeFromParent();
    fitAuthoredWorldRoot(root, .95);
    root.name = "authored-weapon";
    root.position.set(.42, 1.05, .56);
    root.rotation.y = Math.PI;
    group.add(root);
    group.userData.authoredWeapon = gunName;
  }).catch(() => {});
}

function attachAuthoredEnemy(group, enemyType, assetPath) {
  if (!assetPath) return;
  loadCuratedGlb([assetPath]).then(asset => {
    if (!group.parent) return;
    const root = cloneAuthoredRoot(asset?.scene);
    if (!root) return;
    installAuthoredAnimationSet(root, asset);
    fitAuthoredWorldRoot(root, enemyType === "boss" ? 3.8 : enemyType === "drone" ? 1.9 : 2.5);
    root.rotation.y = Math.PI;
    while (group.children.length) group.remove(group.children[0]);
    group.add(root);
    group.userData.authoredEnemy = enemyType;
  }).catch(() => {});
}

function createSpiderVisual(group) {
  const shell = material(0x314d3f, .08);
  const shellHighlight = material(0x6e9f59, .18);
  const eyeMaterial = material(0xff5d75, 1);
  const fangMaterial = material(0xd9f4c8, .35);
  const spiderLegs = [];
  const spiderEyes = [];
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(.92, 12, 8), shell);
  abdomen.scale.set(1.05, .76, 1.28);
  abdomen.position.set(0, .94, -.28);
  abdomen.castShadow = true;
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(.66, 12, 8), shellHighlight);
  thorax.scale.set(1.05, .76, 1.12);
  thorax.position.set(0, .9, .58);
  thorax.castShadow = true;
  group.add(abdomen, thorax);
  for (const side of [-1, 1]) {
    for (let index = 0; index < 4; index += 1) {
      const angle = (index - 1.5) * .34;
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, 1.05, 6), shell);
      upper.position.set(side * (.72 + Math.cos(angle) * .34), .68 + Math.abs(index - 1.5) * .07, .42 + Math.sin(angle) * .72);
      upper.rotation.set(0, side * angle, side * Math.PI / 2);
      upper.name = `spider-leg:${side}:${index}:upper`;
      upper.userData.restRotation = { x: upper.rotation.x, y: upper.rotation.y, z: upper.rotation.z };
      upper.castShadow = true;
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(.065, .1, .94, 6), shellHighlight);
      lower.position.set(side * (1.18 + Math.cos(angle) * .46), .39, .42 + Math.sin(angle) * 1.15);
      lower.rotation.set(0, side * (angle + .18), side * Math.PI / 2);
      lower.name = `spider-leg:${side}:${index}:lower`;
      lower.userData.restRotation = { x: lower.rotation.x, y: lower.rotation.y, z: lower.rotation.z };
      lower.castShadow = true;
      group.add(upper, lower);
      spiderLegs.push({ upper, lower });
    }
  }
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 6), eyeMaterial);
    eye.position.set(side * .22, 1.08, 1.17);
    group.add(eye);
    spiderEyes.push(eye);
  }
  const fang = new THREE.Mesh(new THREE.ConeGeometry(.1, .38, 6), fangMaterial);
  fang.position.set(-.22, .56, 1.08);
  fang.rotation.x = Math.PI;
  const secondFang = fang.clone();
  secondFang.position.x = .22;
  group.add(fang, secondFang);
  // Enlarge the ranged spider for a clearer combat silhouette and keep its
  // targeting radius aligned with the enlarged visual footprint.
  group.scale.setScalar(1.6);
  group.userData.hitRadius = 1.6;
  group.userData.enemyVisual = "spider-ranged";
  group.userData.attackProfile = { projectile: "acid-web", range: 24 };
  group.userData.spiderVisual = true;
  group.userData.spiderLegs = spiderLegs;
  group.userData.spiderCore = thorax;
  group.userData.spiderEyes = spiderEyes;
}

function unit(color, x, z, avatarType = "scout", useAuthoredModel = false, authoredEnemy = null) {
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
  if (useAuthoredModel) attachAuthoredCharacter(group, avatarType);
  if (authoredEnemy?.type === "spider") {
    while (group.children.length) group.remove(group.children[0]);
    createSpiderVisual(group);
  } else if (authoredEnemy) attachAuthoredEnemy(group, authoredEnemy.type, authoredEnemy.path);
  return { g: group, hp: 100, maxHp: 100, shield: 0, shieldMax: 0, cooldown: 0, alive: true, orbitAngle: Math.random() * Math.PI * 2, orbitDirection: Math.random() > .5 ? 1 : -1 };
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
  const terrain = createTerrainGrid(worldLayout, { segments: renderQuality.terrainSegments });
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
  // Keep the authored image readable in the combat frame.  The biome vertex
  // tint was multiplying the textured surface down to a flat gray wash on
  // some WebGL/mobile paths, hiding the terrain artwork entirely.
  // Keep the authored albedo visible while allowing the field lighting rig to
  // add depth to the terrain instead of rendering it as a flat unlit card.
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: texture,
    // Reuse the authored albedo as a restrained relief source so rubble and
    // terrain grain catch the lighting without requiring a second network
    // request or a platform-specific normal-map asset.
    bumpMap: texture,
    bumpScale: renderQuality.pass >= 5 ? .16 : renderQuality.pass >= 3 ? .12 : .08,
    color: 0xffffff,
    vertexColors: false,
    roughness: .94,
    metalness: .02,
    emissive: 0x080604,
    emissiveIntensity: .08,
    side: THREE.DoubleSide,
  }));
  mesh.receiveShadow = true;
  return mesh;
}

function createProceduralTerrainTexture(path) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  const normalized = String(path || "").toLowerCase();
  const inferno = normalized.includes("inferno");
  const toxic = normalized.includes("toxic");
  const ice = normalized.includes("icy");
  context.fillStyle = inferno ? "#201516" : toxic ? "#18251c" : ice ? "#8aa8b7" : "#3a3029";
  context.fillRect(0, 0, 256, 256);
  const random = seededRandom(`terrain-fallback:${normalized}`);
  for (let index = 0; index < 44; index += 1) {
    const x = random() * 256;
    const y = random() * 256;
    const radius = 5 + random() * 18;
    context.fillStyle = inferno ? (index % 3 ? "#40302b" : "#6f271b") : toxic ? "#2f5536" : ice ? "#d1e3e7" : "#665449";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    if (inferno) {
      context.strokeStyle = "#e34d1f";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(x - radius * .7, y + radius * .2);
      context.lineTo(x + radius * .6, y - radius * .35);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const biomeSkyTextures = new Map();

function createBiomeSkyTexture(mapId = "wasteland") {
  const key = String(mapId || "wasteland");
  if (biomeSkyTextures.has(key)) return biomeSkyTextures.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const palettes = {
    wasteland: ["#0b1017", "#4b3b32", "#c27e4a"],
    toxic: ["#071713", "#1c4937", "#77b75e"],
    ice: ["#102333", "#638fa8", "#d9f2ff"],
    inferno: ["#150b13", "#4d1b1e", "#e35b2d"],
  };
  const [top, middle, horizon] = palettes[key] || palettes.wasteland;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(.58, middle);
  gradient.addColorStop(1, horizon);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const haze = context.createRadialGradient(canvas.width * .5, canvas.height * .72, 4, canvas.width * .5, canvas.height * .72, canvas.width * .48);
  haze.addColorStop(0, "rgba(255,236,180,.30)");
  haze.addColorStop(1, "rgba(255,236,180,0)");
  context.fillStyle = haze;
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (key === "ice") {
    context.strokeStyle = "rgba(220,246,255,.24)";
    context.lineWidth = 2;
    for (let index = 0; index < 14; index += 1) {
      const x = (index + 1) * 34;
      context.beginPath();
      context.moveTo(x, 24 + (index % 3) * 18);
      context.lineTo(x + 16, 72 + (index % 4) * 22);
      context.stroke();
    }
  } else if (key === "inferno") {
    context.fillStyle = "rgba(255,123,49,.18)";
    context.beginPath();
    context.arc(canvas.width * .72, canvas.height * .48, 42, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillStyle = "rgba(255,241,193,.42)";
    context.beginPath();
    context.arc(canvas.width * .74, canvas.height * .44, key === "toxic" ? 24 : 30, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  biomeSkyTextures.set(key, texture);
  return texture;
}

function loadTerrainTexture(path) {
  const fallbackPath = String(path || "").replace(/^https?:\/\/[^/]+\//, "").replace(/^.*?assets\//, "assets/");
  const loader = new THREE.TextureLoader();
  const applyLoadedTexture = loaded => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
    loaded.repeat.set(renderQuality.textureRepeat || 1, renderQuality.textureRepeat || 1);
    loaded.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), renderQuality.textureAnisotropy || 1);
    activeTerrainTexture = loaded;
    if (ground?.material) {
      ground.material.map = loaded;
      ground.material.bumpMap = loaded;
      ground.material.needsUpdate = true;
    }
  };
  const procedural = createProceduralTerrainTexture(path);
  const texture = procedural;
  activeTerrainTexture = texture;
  const bundledPath = fallbackPath || path;
  const loadPath = source => loader.load(source, loaded => applyLoadedTexture(loaded), undefined, () => {
    if (source === bundledPath) activeTerrainTexture = procedural;
  });
  // The bundled authored texture is the deterministic first render. The
  // configured cloud object can replace it later when it is reachable.
  loadPath(bundledPath);
  if (path && path !== bundledPath) loadPath(path);
  return texture;
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

function addTerrainSurfaceDetail(mapId) {
  const palette = {
    inferno: { color: 0xff4a1f, emissive: .7, count: 72, width: 2.2, length: 8.8 },
    toxic: { color: 0x83ff47, emissive: .28, count: 56, width: 1.8, length: 7.2 },
    ice: { color: 0xa8efff, emissive: .18, count: 48, width: 1.8, length: 8.2 },
    wasteland: { color: 0xb88b5c, emissive: .06, count: 42, width: 2.2, length: 7.8 },
  }[mapId] || null;
  if (!palette) return;
  const random = seededRandom(`terrain-surface-detail:${mapId}:${worldLayout.size}`);
  const nearSpawn = [[0, 9], [0, 18], [-9, -14], [5, -18], [13, -8], [-14, -4], [8, 7], [-5, 12], [18, 4], [-19, 8]];
  if (mapId === "inferno") {
    const spawnFissure = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 9),
      new THREE.MeshBasicMaterial({ color: 0xff6a24, transparent: true, opacity: .92, side: THREE.DoubleSide, fog: false }),
    );
    spawnFissure.name = "terrain-detail:inferno:spawn-fissure";
    spawnFissure.rotation.x = -Math.PI / 2;
    spawnFissure.position.set(0, sampleWorldElevation(worldLayout, { x: 0, z: 9 }) + .12, 9);
    world.add(spawnFissure);
  }
  for (let index = 0; index < palette.count; index += 1) {
    const anchor = nearSpawn[index % nearSpawn.length];
    const x = index < nearSpawn.length ? anchor[0] : worldLayout.bounds.min + 12 + random() * (worldLayout.size - 24);
    const z = index < nearSpawn.length ? anchor[1] : worldLayout.bounds.min + 12 + random() * (worldLayout.size - 24);
    const length = palette.length * (.45 + random() * .9);
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(palette.width * (.65 + random()), length),
      new THREE.MeshStandardMaterial({ color: palette.color, emissive: palette.color, emissiveIntensity: palette.emissive, roughness: .8, transparent: true, opacity: .72, side: THREE.DoubleSide }),
    );
    patch.name = `terrain-detail:${mapId}:${index + 1}`;
    patch.rotation.set(-Math.PI / 2, 0, random() * Math.PI * 2);
    patch.position.set(x, sampleWorldElevation(worldLayout, { x, z }) + .085, z);
    patch.receiveShadow = true;
    world.add(patch);
  }
}

function addRoadMarkings(segment) {
  const dx = segment.x2 - segment.x1;
  const dz = segment.z2 - segment.z1;
  const length = Math.hypot(dx, dz);
  if (!length || segment.width < 9) return;
  const angle = Math.atan2(dx, dz);
  const steps = Math.max(1, Math.floor(length / 18));
  const stripeMaterial = material(0xd8bd63, .12);
  const edgeMaterial = material(0x82929a, .08);
  for (let index = 0; index < steps; index += 1) {
    const t = (index + .5) / steps;
    const x = segment.x1 + dx * t;
    const z = segment.z1 + dz * t;
    const elevation = segment.underpassClearance ? 0 : sampleWorldElevation(worldLayout, { x, z });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(.24, .035, Math.min(5.5, length / steps * .58)), stripeMaterial);
    stripe.position.set(x, elevation + .105, z);
    stripe.rotation.y = angle;
    stripe.receiveShadow = true;
    world.add(stripe);
  }
  for (const side of [-1, 1]) {
    const offset = segment.width * .42 * side;
    const x = segment.x1 + (-dz / length) * offset;
    const z = segment.z1 + (dx / length) * offset;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(.12, .028, length), edgeMaterial);
    edge.position.set(x, (segment.underpassClearance ? 0 : sampleWorldElevation(worldLayout, { x, z })) + .095, z);
    edge.rotation.y = angle;
    edge.receiveShadow = true;
    world.add(edge);
  }
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
    const headlights = new THREE.InstancedMesh(boxGeometry(.34, .14, .06), material(0xffe5a0, .85), cars.length * 2);
    const transform = new THREE.Object3D();
    let wheelIndex = 0;
    let headlightIndex = 0;
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
      for (const localX of [-1.1, 1.1]) {
        transform.position.set(
          car.x + localX * Math.cos(car.rotation) - (-2.82) * Math.sin(car.rotation),
          groundY + .64 * crush,
          car.z + localX * Math.sin(car.rotation) + (-2.82) * Math.cos(car.rotation),
        );
        transform.rotation.set(0, car.rotation, 0);
        transform.scale.set(1, crush, 1);
        transform.updateMatrix();
        headlights.setMatrixAt(headlightIndex++, transform.matrix);
      }
    });
    for (const mesh of [body, cabin, wheels, headlights]) {
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mesh.castShadow = effectiveGraphicsTier() === "high";
      world.add(mesh);
    }
  });
}

function addUtilityPoles() {
  const placements = [
    { x: -118, z: -126, rotation: .12 },
    { x: -96, z: -134, rotation: .12 },
    { x: 116, z: 118, rotation: -.28 },
    { x: 138, z: 110, rotation: -.28 },
  ];
  const poleMaterial = material(0x3a4548, .02);
  const cableMaterial = new THREE.LineBasicMaterial({ color: 0x171d20, transparent: true, opacity: .8 });
  placements.forEach((placement, index) => {
    const group = new THREE.Group();
    group.name = `utility-pole:${index + 1}`;
    const groundY = sampleWorldElevation(worldLayout, placement);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.18, .28, 7.2, 8), poleMaterial);
    post.position.y = 3.6;
    post.castShadow = true;
    const crossarm = new THREE.Mesh(new THREE.BoxGeometry(3.5, .16, .18), poleMaterial);
    crossarm.position.y = 6.35;
    crossarm.castShadow = true;
    group.add(post, crossarm);
    for (const x of [-1.25, 0, 1.25]) {
      const insulator = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .34, 6), material(0xc5c9bf, .05));
      insulator.position.set(x, 6.55, 0);
      group.add(insulator);
    }
    const cable = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1.72, 6.52, 0),
        new THREE.Vector3(0, 6.22, .04),
        new THREE.Vector3(1.72, 6.52, 0),
      ]),
      cableMaterial,
    );
    cable.name = "utility-cable";
    group.add(cable);
    group.position.set(placement.x, groundY, placement.z);
    group.rotation.y = placement.rotation;
    world.add(group);
  });
}

function addRoadsideClutter() {
  const placements = [
    { x: -132, z: -38, rotation: .18 },
    { x: 46, z: -110, rotation: -.32 },
    { x: 88, z: 144, rotation: .62 },
    { x: -180, z: 140, rotation: -.12 },
  ];
  const crateMaterial = material(0x6f4d31, .02);
  const braceMaterial = material(0x384044, .03);
  const warningMaterial = material(0xd97935, .12);
  const beaconMaterial = material(0x86f0d4, .6);
  placements.forEach((placement, index) => {
    const group = new THREE.Group();
    group.name = `roadside-clutter:${index + 1}`;
    const groundY = sampleWorldElevation(worldLayout, placement);
    const crate = new THREE.Mesh(boxGeometry(1.1, .9, 1.1), crateMaterial);
    crate.position.set(-.7, .45, .1);
    crate.rotation.y = .18;
    crate.castShadow = true;
    const crateTop = new THREE.Mesh(boxGeometry(.9, .7, .9), crateMaterial);
    crateTop.position.set(.28, .35, -.26);
    crateTop.rotation.y = -.22;
    crateTop.castShadow = true;
    const barrierPostA = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 1.2, 6), braceMaterial);
    barrierPostA.position.set(.8, .6, .4);
    barrierPostA.castShadow = true;
    const barrierPostB = barrierPostA.clone();
    barrierPostB.position.z = -.55;
    const barrier = new THREE.Mesh(boxGeometry(.12, .13, 1.1), warningMaterial);
    barrier.position.set(.8, .98, -.08);
    barrier.rotation.x = Math.PI / 2;
    barrier.castShadow = true;
    const beaconPost = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, 1.8, 6), braceMaterial);
    beaconPost.position.set(-.18, .9, -.72);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), beaconMaterial);
    beacon.position.set(-.18, 1.82, -.72);
    beacon.castShadow = true;
    group.add(crate, crateTop, barrierPostA, barrierPostB, barrier, beaconPost, beacon);
    group.position.set(placement.x, groundY, placement.z);
    group.rotation.y = placement.rotation;
    world.add(group);
  });
}

function addStructure(structure) {
  const groundY = sampleWorldElevation(worldLayout, structure);
  const heading = structure.rotation || 0;
  const frontPoint = (localX, localZ) => ({
    x: structure.x + localX * Math.cos(heading) - localZ * Math.sin(heading),
    z: structure.z + localX * Math.sin(heading) + localZ * Math.cos(heading),
  });
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
  if (structure.kind === "house" || structure.kind === "tower") {
    const windowColor = structure.damaged ? 0x8f5a38 : 0xf1c873;
    const windowCount = structure.kind === "tower" ? 3 : 2;
    for (let index = 0; index < windowCount; index += 1) {
      const localX = (index - (windowCount - 1) / 2) * Math.min(2.8, structure.w * .28);
      const point = frontPoint(localX, structure.d / 2 + .18);
      addBox({
        x: point.x,
        z: point.z,
        w: structure.kind === "tower" ? .7 : .9,
        d: .08,
        h: structure.kind === "tower" ? 1.1 : .85,
        y: groundY + Math.min(structure.h * .62, structure.h - 1.2),
        color: windowColor,
        emissive: structure.damaged ? .08 : .42,
        rotation: heading,
      });
    }
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

function addQuestBeacon(root) {
  const quest = questView(questState);
  const profile = questBeaconProfile({ questId: quest.id, mapKey });
  if (!profile.visible) return null;
  const group = new THREE.Group();
  group.name = `quest-beacon:${profile.questId}`;
  const glow = material(profile.color, .82);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.1, .2, 3.4, 8), glow);
  post.position.y = 1.7;
  const core = new THREE.Mesh(new THREE.SphereGeometry(.42, 14, 10), glow);
  core.position.y = 3.55;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, .08, 8, 28), glow);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .12;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(.28, .72, 6), glow);
  arrow.position.y = 4.35;
  arrow.rotation.x = Math.PI;
  [post, core, ring, arrow].forEach(mesh => { mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); });
  const groundY = sampleWorldElevation(worldLayout, profile);
  group.position.set(profile.x, groundY, profile.z);
  group.userData = { mapAnim: "quest-beacon", profile, core, ring, arrow };
  root.add(group);
  root.userData.questBeacon = group;
  return group;
}

function refreshQuestBeacon() {
  if (!mapVisuals) return;
  const quest = questView(questState);
  const profile = questBeaconProfile({ questId: quest.id, mapKey });
  const existing = mapVisuals.userData.questBeacon;
  if (existing?.userData?.profile?.questId === profile.questId && Boolean(existing.userData.profile.visible) === profile.visible) return;
  if (existing) mapVisuals.remove(existing);
  mapVisuals.userData.questBeacon = null;
  activeQuestBeaconId = profile.visible ? profile.questId : null;
  addQuestBeacon(mapVisuals);
}

function addMapVisuals() {
  const root = new THREE.Group();
  root.name = "map-visuals";
  const beacons = [
    { id: "inferno", x: -92, z: 96, color: 0xff542e },
    { id: "ice", x: -92, z: -96, color: 0x8ee9ff },
    { id: "desert", x: 96, z: 96, color: 0xffd36a },
    { id: "city", x: 96, z: -96, color: 0xb7c4d8 },
  ];
  for (const beacon of beacons) {
    const group = new THREE.Group();
    group.name = `biome-beacon:${beacon.id}`;
    const groundY = sampleWorldElevation(worldLayout, beacon);
    const glow = material(beacon.color, .72);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .25, 4.2, 8), glow);
    post.position.y = 2.1;
    post.castShadow = true;
    const core = new THREE.Mesh(new THREE.SphereGeometry(.34, 12, 8), glow);
    core.position.y = 4.35;
    core.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, .075, 8, 28), glow);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .12;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.42, .55, 6), glow);
    cap.position.y = 4.78;
    cap.rotation.y = Math.PI / 6;
    group.add(post, core, ring, cap);
    group.position.set(beacon.x, groundY, beacon.z);
    group.userData = { beaconId: beacon.id, core, ring, pulse: beacons.indexOf(beacon) * .9 };
    root.add(group);
  }
  addQuestBeacon(root);
  addMountainVisuals(root);
  addInfernoFireVisuals(root);
  addBurnedArmoryVisual(root);
  addBiomeSurfaceRings(root);
  addBiomeWeatherVisuals(root);
  addRenderQualityDetailPoints(root);
  world.add(root);
  mapVisuals = root;
}

function addBiomeSurfaceRings(root) {
  const profiles = {
    toxic: { color: 0x9cff69, positions: [[104, 52], [118, 65], [92, 40]] },
    ice: { color: 0xc8f5ff, positions: [[-76, -202], [-102, -176], [-48, -184]] },
  };
  const profile = profiles[mapKey];
  if (!profile) return;
  const rings = [];
  profile.positions.forEach(([x, z], index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1 + index * .22, .035, 8, 28),
      new THREE.MeshBasicMaterial({ color: profile.color, transparent: true, opacity: .46, depthWrite: false }),
    );
    ring.name = `biome-surface-ring:${mapKey}:${index + 1}`;
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, sampleWorldElevation(worldLayout, { x, z }) + .12, z);
    ring.userData.mapAnim = "surface-ring";
    ring.userData.pulse = index * .8;
    root.add(ring);
    rings.push(ring);
  });
  root.userData.surfaceRings = rings;
}

function addBiomeWeatherVisuals(root) {
  const pass = renderQuality.pass;
  const count = pass >= 5 ? 96 : pass >= 3 ? 48 : 20;
  const random = seededRandom(`weather:${mapKey}:${storyStage}`);
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const span = worldLayout.size * .44;
  const colorByMap = { inferno: 0xff9b42, ice: 0xd7f5ff, desert: 0xf0cf82, city: 0x9daeb2 };
  const sizeByMap = { inferno: .2, ice: .16, desert: .12, city: .14 };
  const weatherKind = { inferno: "embers", ice: "snow", desert: "dust", city: "ash" }[mapKey] || "ash";
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (random() * 2 - 1) * span;
    positions[index * 3 + 1] = 3 + random() * 22;
    positions[index * 3 + 2] = (random() * 2 - 1) * span;
    speeds[index] = .7 + random() * 1.1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: colorByMap[mapKey] || colorByMap.city,
    size: sizeByMap[mapKey] || .14,
    transparent: true,
    opacity: pass >= 5 ? .58 : .38,
    depthWrite: false,
    blending: mapKey === "inferno" ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  points.name = `biome-weather:${weatherKind}`;
  points.userData.mapAnim = "weather";
  root.add(points);
  root.userData.weather = { points, speeds, span, weatherKind, elapsed: 0 };
}

function addRenderQualityDetailPoints(root) {
  const detail = new THREE.Group();
  detail.name = `render-quality-pass-${renderQuality.pass}-detail-points`;
  const glow = material(0xffdf52, .24);
  const pointCount = Math.max(8, Math.round(renderQuality.visualPoints / 2));
  for (let index = 0; index < pointCount; index += 1) {
    const angle = (index / pointCount) * Math.PI * 2;
    const radius = 34 + (index % 5) * 8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const point = new THREE.Mesh(new THREE.SphereGeometry(.09 + renderQuality.pass * .012, 6 + renderQuality.pass, 5 + renderQuality.pass), glow);
    point.position.set(x, sampleWorldElevation(worldLayout, { x, z }) + .2, z);
    point.userData.mapAnim = "detail-point";
    point.userData.pulse = index * .33;
    detail.add(point);
  }
  root.add(detail);
}

function addMountainVisuals(root) {
  const ridge = new THREE.Group();
  ridge.name = "mountain-ridge-visuals";
  const rock = material(0x4b5a65, .025);
  const snow = material(0xcfe7ef, .08);
  [
    { x: -212, z: -202, scale: 1.12, rotation: -.16 },
    { x: -174, z: -218, scale: .88, rotation: .12 },
    { x: -132, z: -206, scale: 1.02, rotation: -.08 },
    { x: -206, z: -158, scale: .76, rotation: .2 },
  ].forEach(peak => {
    const mountain = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(20 * peak.scale, 33 * peak.scale, 6), rock);
    body.position.y = 16.5 * peak.scale;
    body.rotation.y = peak.rotation;
    body.castShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(8.5 * peak.scale, 8.2 * peak.scale, 6), snow);
    cap.position.y = 32.5 * peak.scale;
    cap.rotation.y = peak.rotation + .12;
    cap.castShadow = true;
    mountain.add(body, cap);
    mountain.position.set(peak.x, sampleWorldElevation(worldLayout, peak), peak.z);
    ridge.add(mountain);
  });
  root.add(ridge);
}

function createFlameVisual(color = 0xff5b22, scale = 1, pulse = 0) {
  const flame = new THREE.Group();
  const ember = material(color, .92);
  const core = new THREE.Mesh(new THREE.ConeGeometry(.42 * scale, 1.25 * scale, 7), ember);
  core.position.y = .64 * scale;
  core.castShadow = true;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(.26 * scale, 8, 6), ember);
  halo.position.y = 1.02 * scale;
  flame.add(core, halo);
  flame.userData.mapAnim = "flame";
  flame.userData.pulse = pulse;
  flame.userData.baseScale = scale;
  return flame;
}

function addInfernoFireVisuals(root) {
  const fireline = new THREE.Group();
  fireline.name = "inferno-fireline-visuals";
  const fireVfxProfile = buildFireVfxProfile(renderQuality.pass);
  const fireBase = material(0x7e1f12, .42);
  [
    { x: -198, z: 76, scale: .82 },
    { x: -164, z: 80, scale: 1.08 },
    { x: -126, z: 76, scale: .9 },
    { x: -84, z: 79, scale: 1.18 },
    { x: -48, z: 75, scale: .76 },
  ].forEach((point, index) => {
    const groundY = sampleWorldElevation(worldLayout, point);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.45 * point.scale, 1.8 * point.scale, .16, 16), fireBase);
    base.position.set(point.x, groundY + .08, point.z);
    base.receiveShadow = true;
    const flame = createFlameVisual(index % 2 ? 0xffb72e : 0xff5a24, point.scale, index * .8);
    flame.position.set(point.x, groundY + .12, point.z);
    fireline.add(base, flame);

    const smokePositions = new Float32Array(fireVfxProfile.smokeCount * 3);
    for (let smokeIndex = 0; smokeIndex < fireVfxProfile.smokeCount; smokeIndex += 1) {
      const frame = fireVfxFrame({ profile: fireVfxProfile, elapsed: smokeIndex * .17, index: smokeIndex });
      const offset = smokeIndex * 3;
      smokePositions[offset] = frame.x * point.scale;
      smokePositions[offset + 1] = frame.y;
      smokePositions[offset + 2] = frame.x * .42 * point.scale;
    }
    const smokeGeometry = new THREE.BufferGeometry();
    smokeGeometry.setAttribute("position", new THREE.BufferAttribute(smokePositions, 3));
    const smoke = new THREE.Points(smokeGeometry, new THREE.PointsMaterial({
      color: 0x6f625b,
      size: .52 + renderQuality.pass * .04,
      transparent: true,
      opacity: fireVfxProfile.smokeOpacity,
      depthWrite: false,
    }));
    smoke.name = `fire-smoke-plume:${index + 1}`;
    smoke.userData.mapAnim = "fire-smoke-plume";
    smoke.userData.profile = fireVfxProfile;
    smoke.userData.origin = new THREE.Vector3(point.x, groundY + .6, point.z);
    smoke.userData.scale = point.scale;
    fireline.add(smoke);

    const emberGeometry = new THREE.BufferGeometry();
    const emberPositions = new Float32Array(fireVfxProfile.emberCount * 3);
    for (let emberIndex = 0; emberIndex < fireVfxProfile.emberCount; emberIndex += 1) {
      const offset = emberIndex * 3;
      emberPositions[offset] = ((emberIndex * 17) % 23 - 11) * .045 * point.scale;
      emberPositions[offset + 1] = (emberIndex % 9) * .18;
      emberPositions[offset + 2] = ((emberIndex * 11) % 19 - 9) * .045 * point.scale;
    }
    emberGeometry.setAttribute("position", new THREE.BufferAttribute(emberPositions, 3));
    const embers = new THREE.Points(emberGeometry, new THREE.PointsMaterial({
      color: 0xffb22e,
      size: .16 + renderQuality.pass * .012,
      transparent: true,
      opacity: .65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    embers.name = `fire-ember-field:${index + 1}`;
    embers.userData.mapAnim = "fire-ember-field";
    embers.userData.origin = new THREE.Vector3(point.x, groundY + .15, point.z);
    embers.userData.phase = index * .7;
    fireline.add(embers);

    const heat = new THREE.Mesh(
      new THREE.SphereGeometry(1.4 * point.scale, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xff8b40, transparent: true, opacity: fireVfxProfile.heatOpacity, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    heat.name = `heat-shimmer:${index + 1}`;
    heat.userData.mapAnim = "heat-shimmer";
    heat.userData.origin = new THREE.Vector3(point.x, groundY + .95, point.z);
    heat.userData.phase = index * .9;
    heat.scale.y = .6;
    fireline.add(heat);
  });
  root.add(fireline);
}

function getArmorySurfaceMaps(profile) {
  if (!armorySurfaceMaps) {
    const loader = new THREE.TextureLoader();
    armorySurfaceMaps = {
      baseColor: loader.load(ARMORY_SURFACE_TEXTURES.baseColor),
      bump: loader.load(ARMORY_SURFACE_TEXTURES.bump),
    };
    armorySurfaceMaps.baseColor.colorSpace = THREE.SRGBColorSpace;
  }
  for (const texture of Object.values(armorySurfaceMaps)) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(profile.textureRepeat, profile.textureRepeat);
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), renderQuality.textureAnisotropy);
    texture.needsUpdate = true;
  }
  return armorySurfaceMaps;
}

function addBurnedArmoryVisual(root) {
  const structure = worldLayout.structures.find(item => item.id === "armory-shell");
  if (!structure) return;
  const outpost = new THREE.Group();
  outpost.name = "burned-armory-last-outpost";
  const groundY = sampleWorldElevation(worldLayout, structure);
  const visualProfile = armoryVisualProfile(renderQuality.pass);
  const surfaceMaps = getArmorySurfaceMaps(visualProfile);
  const surfaceMaterial = new THREE.MeshStandardMaterial({
    map: surfaceMaps.baseColor,
    bumpMap: surfaceMaps.bump,
    bumpScale: .13,
    roughness: .9,
    metalness: .38,
    color: 0xb8afa7,
    side: THREE.DoubleSide,
  });
  const wallHeight = structure.h * .84;
  const frontWidth = structure.w * .92;
  const doorWidth = 5.6;
  const doorHeaderHeight = 1.25;
  const frontSideWidth = (frontWidth - doorWidth) / 2;
  const surfacePanels = [
    { name: "front-left", width: frontSideWidth, height: wallHeight, position: [-(doorWidth + frontSideWidth) / 2, wallHeight / 2, structure.d / 2 + .14], rotation: [0, 0, 0] },
    { name: "front-right", width: frontSideWidth, height: wallHeight, position: [(doorWidth + frontSideWidth) / 2, wallHeight / 2, structure.d / 2 + .14], rotation: [0, 0, 0] },
    { name: "door-header", width: doorWidth, height: doorHeaderHeight, position: [0, wallHeight - doorHeaderHeight / 2, structure.d / 2 + .14], rotation: [0, 0, 0] },
    { name: "back", width: structure.w * .92, height: wallHeight, position: [0, wallHeight / 2, -structure.d / 2 - .14], rotation: [0, Math.PI, 0] },
    { name: "left", width: structure.d * .92, height: wallHeight, position: [-structure.w / 2 - .14, wallHeight / 2, 0], rotation: [0, -Math.PI / 2, 0] },
    { name: "right", width: structure.d * .92, height: wallHeight, position: [structure.w / 2 + .14, wallHeight / 2, 0], rotation: [0, Math.PI / 2, 0] },
    { name: "roof", width: structure.w * .9, height: structure.d * .9, position: [0, structure.h + .14, 0], rotation: [-Math.PI / 2, 0, 0] },
  ];
  for (const panel of surfacePanels) {
    const geometry = new THREE.PlaneGeometry(
      panel.width,
      panel.height,
      Math.max(1, visualProfile.pass),
      Math.max(1, Math.ceil(visualProfile.pass / 2)),
    );
    const mesh = new THREE.Mesh(geometry, surfaceMaterial);
    mesh.name = `armory-textured-panel:${panel.name}`;
    mesh.position.set(...panel.position);
    mesh.rotation.set(...panel.rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    outpost.add(mesh);
  }
  const char = material(0x1b1918, .015);
  const rust = material(0x6f3825, .08);
  const warning = material(0xff6a28, .38);
  const doorRecess = new THREE.Mesh(new THREE.BoxGeometry(doorWidth * .88, 3.15, .18), char);
  doorRecess.name = "armory-recessed-entry";
  doorRecess.position.set(0, 1.58, structure.d / 2 + .24);
  const doorFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(.28, 3.45, .34), rust);
  doorFrameLeft.position.set(-doorWidth * .46, 1.72, structure.d / 2 + .38);
  const doorFrameRight = doorFrameLeft.clone();
  doorFrameRight.position.x *= -1;
  const beamA = new THREE.Mesh(new THREE.BoxGeometry(structure.w * .9, .62, .9), char);
  beamA.position.set(0, wallHeight + .55, -structure.d * .22);
  beamA.rotation.z = -.12;
  const beamB = new THREE.Mesh(new THREE.BoxGeometry(structure.w * .74, .52, .82), rust);
  beamB.position.set(0, wallHeight + .18, structure.d * .12);
  beamB.rotation.z = .19;
  const frontGlow = new THREE.Mesh(new THREE.BoxGeometry(doorWidth * .82, .18, .18), warning);
  frontGlow.position.set(0, 3.34, structure.d / 2 + .48);
  const lastOutpostSign = new THREE.Mesh(new THREE.BoxGeometry(8.6, .24, .22), warning);
  lastOutpostSign.position.set(0, structure.h + 2.2, structure.d / 2 + .35);
  lastOutpostSign.rotation.z = -.04;
  [doorRecess, doorFrameLeft, doorFrameRight, beamA, beamB, frontGlow, lastOutpostSign].forEach(mesh => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    outpost.add(mesh);
  });
  for (const x of [-10.5, 10.5]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.4, 2.1), rust);
    crate.position.set(x, .7, structure.d / 2 + 2.1);
    crate.rotation.y = x < 0 ? -.12 : .16;
    crate.castShadow = true;
    outpost.add(crate);
    const flame = createFlameVisual(x < 0 ? 0xff5a24 : 0xffb72e, .78, x < 0 ? .4 : 1.6);
    flame.position.set(x, 1.36, structure.d / 2 + 1.2);
    outpost.add(flame);
  }
  const rubblePlan = buildArmoryRubblePlan(renderQuality.pass);
  const rubbleGeometry = new THREE.DodecahedronGeometry(.42, 0);
  const rubbleMaterial = new THREE.MeshStandardMaterial({ color: 0x302823, roughness: .98, metalness: .14 });
  const rubble = new THREE.InstancedMesh(rubbleGeometry, rubbleMaterial, rubblePlan.length);
  rubble.name = `armory-rubble-pass-${visualProfile.pass}`;
  const transform = new THREE.Object3D();
  rubblePlan.forEach((piece, index) => {
    transform.position.set(piece.x, .22 * piece.scale, piece.z);
    transform.rotation.set(piece.rotationX, piece.rotationY, piece.rotationZ);
    transform.scale.set(piece.scale, piece.scale * .72, piece.scale);
    transform.updateMatrix();
    rubble.setMatrixAt(index, transform.matrix);
  });
  rubble.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  rubble.castShadow = effectiveGraphicsTier() === "high";
  rubble.receiveShadow = true;
  rubble.userData.rubbleTriangles = visualProfile.rubbleTriangles;
  outpost.add(rubble);

  const lightPositions = [
    [-10.5, 2.2, structure.d / 2 + 1.2],
    [10.5, 2.2, structure.d / 2 + 1.2],
    [0, 2.8, structure.d / 2 + .5],
  ];
  lightPositions.slice(0, visualProfile.pointLights).forEach((position, index) => {
    const fireLight = new THREE.PointLight(index % 2 ? 0xffa33a : 0xff5a24, 18, 25, 2);
    fireLight.name = `armory-fire-light:${index + 1}`;
    fireLight.position.set(...position);
    fireLight.userData.mapAnim = "fire-light";
    fireLight.userData.baseIntensity = fireLight.intensity;
    fireLight.userData.pulse = index * 1.3;
    outpost.add(fireLight);
  });
  outpost.userData.visualProfile = visualProfile;
  outpost.userData.surfaceTexture = ARMORY_SURFACE_TEXTURES.baseColor;
  outpost.position.set(structure.x, groundY, structure.z);
  root.add(outpost);
}

function applyRequestedRenderFocus() {
  const armoryFocusRequested = renderFocus === "armory";
  if (!armoryFocusRequested || !player || !worldLayout) return;
  const structure = worldLayout.structures.find(item => item.id === "armory-shell");
  if (!structure) return;
  const focusPosition = {
    x: structure.x,
    z: structure.z + structure.d / 2 + 22,
  };
  player.g.position.set(
    focusPosition.x,
    sampleWorldElevation(worldLayout, focusPosition),
    focusPosition.z,
  );
  viewYaw = Math.PI;
  aim.copy(player.g.position).add(new THREE.Vector3(0, 1.4, -35));
  graceUntil = Number.POSITIVE_INFINITY;
  camera.position.set(focusPosition.x, player.g.position.y + 2.35, focusPosition.z - 1.12);
  camera.lookAt(structure.x, sampleWorldElevation(worldLayout, structure) + structure.h * .55, structure.z);
  document.body.dataset.renderFocus = "armory";
  canvas.dataset.armoryPass = String(renderQuality.pass);
  canvas.dataset.armoryRubbleTriangles = String(armoryVisualProfile(renderQuality.pass).rubbleTriangles);
}

function updateMapVisuals(dt) {
  if (!mapVisuals) return;
  const elapsed = (mapVisuals.userData.elapsed || 0) + dt;
  mapVisuals.userData.elapsed = elapsed;
  const weather = mapVisuals.userData.weather;
  if (weather?.points) {
    const positions = weather.points.geometry.attributes.position.array;
    weather.elapsed += dt;
    for (let index = 0; index < weather.speeds.length; index += 1) {
      const offset = index * 3;
      positions[offset + 1] -= weather.speeds[index] * dt;
      positions[offset] += Math.sin(weather.elapsed * .8 + index) * dt * .08;
      if (positions[offset + 1] < .4) {
        positions[offset + 1] = 18 + (index % 7) * .8;
        positions[offset] = ((positions[offset] + weather.span) % (weather.span * 2)) - weather.span;
      }
    }
    weather.points.geometry.attributes.position.needsUpdate = true;
  }
  mapVisuals.children.forEach((beacon, index) => {
    if (!beacon.userData?.ring || !beacon.userData?.core) return;
    const pulse = .88 + Math.sin(elapsed * 2.2 + (beacon.userData.pulse || index)) * .14;
    beacon.userData.ring.rotation.z += dt * (index % 2 ? -.7 : .7);
    beacon.userData.ring.scale.setScalar(pulse);
    beacon.userData.core.scale.setScalar(.9 + pulse * .16);
  });
  mapVisuals.userData.surfaceRings?.forEach((ring, index) => {
    const pulse = .78 + Math.sin(elapsed * 1.7 + (ring.userData.pulse || index)) * .18;
    ring.scale.set(pulse, pulse, pulse);
    ring.rotation.z += dt * (index % 2 ? -.32 : .32);
    if (ring.material) ring.material.opacity = .28 + pulse * .2;
  });
  mapVisuals.traverse(node => {
    if (node.userData?.mapAnim === "detail-point") {
      const pulse = .72 + Math.sin(elapsed * 2.4 + (node.userData.pulse || 0)) * .22;
      node.scale.setScalar(pulse);
      return;
    }
    if (node.userData?.mapAnim === "quest-beacon") {
      const frame = questBeaconFrame({ profile: node.userData.profile, elapsed });
      node.userData.core.scale.setScalar(frame.scale);
      node.userData.ring.rotation.z = frame.rotation;
      node.userData.ring.scale.setScalar(frame.scale);
      node.userData.core.material.opacity = frame.opacity;
      node.userData.ring.material.opacity = frame.opacity * .72;
      node.userData.arrow.position.y = 4.35 + Math.sin(elapsed * 2.4) * .16;
      return;
    }
    if (node.userData?.mapAnim === "fire-light") {
      node.intensity = node.userData.baseIntensity * (.82 + Math.sin(elapsed * 7.2 + (node.userData.pulse || 0)) * .18);
      return;
    }
    if (node.userData?.mapAnim === "fire-smoke-plume") {
      const { profile, origin } = node.userData;
      const positions = node.geometry.attributes.position.array;
      const scale = node.userData.scale || 1;
      for (let index = 0; index < profile.smokeCount; index += 1) {
        const frame = fireVfxFrame({ profile, elapsed: elapsed + index * .13, index });
        const offset = index * 3;
        positions[offset] = frame.x * scale;
        positions[offset + 1] = frame.y;
        positions[offset + 2] = frame.x * .42 * scale;
      }
      node.position.copy(origin);
      node.material.opacity = profile.smokeOpacity * (.86 + Math.sin(elapsed * 1.2) * .08);
      node.geometry.attributes.position.needsUpdate = true;
      return;
    }
    if (node.userData?.mapAnim === "fire-ember-field") {
      const origin = node.userData.origin;
      node.position.copy(origin);
      node.position.y += Math.sin(elapsed * 2.8 + node.userData.phase) * .06;
      node.rotation.y += dt * .5;
      return;
    }
    if (node.userData?.mapAnim === "heat-shimmer") {
      const origin = node.userData.origin;
      const pulse = .82 + Math.sin(elapsed * 3.4 + node.userData.phase) * .12;
      node.position.set(origin.x + Math.sin(elapsed * .9 + node.userData.phase) * .12, origin.y + pulse * .22, origin.z);
      node.scale.set(pulse, .58 + pulse * .22, pulse);
      node.material.opacity = .06 + pulse * .035;
      return;
    }
    if (node.userData?.mapAnim !== "flame") return;
    const phase = node.userData.pulse || 0;
    const flicker = .92 + Math.sin(elapsed * 7.5 + phase) * .12;
    node.scale.set(flicker, .92 + Math.sin(elapsed * 8.7 + phase) * .16, flicker);
    node.rotation.y += dt * .8;
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
  worldLayout.roads.forEach(road => {
    addRoadSegment(road, road.ramp ? 0x46515a : 0x30383f);
    addRoadMarkings(road);
  });
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
  addUtilityPoles();
  addRoadsideClutter();
  addBiomeGateways();
}

function createWorldFieldFallback(asset) {
  const root = new THREE.Group();
  const isLarge = asset.fit.maxDimension >= 8;
  const add = (geometry, surface, position = [0, 0, 0], rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const width = asset.fit.maxDimension * (isLarge ? .78 : .62);
  const depth = asset.fit.maxDimension * (isLarge ? .48 : .62);
  const height = Math.max(.45, asset.collider.height);
  const id = asset.id.toLowerCase();
  if (id.includes("car") || id.includes("bus") || id.includes("pickup") || id.includes("locomotive")) {
    const body = material(0x58352d, .03);
    add(new THREE.BoxGeometry(width, Math.max(.5, height * .42), depth), body, [0, Math.max(.25, height * .22), 0]);
    add(new THREE.BoxGeometry(width * .62, Math.max(.35, height * .34), depth * .72), material(0x29363a, .04), [0, Math.max(.5, height * .58), -.05]);
    const wheel = new THREE.CylinderGeometry(Math.max(.18, width * .09), Math.max(.18, width * .09), Math.max(.16, depth * .12), 8);
    for (const x of [-width * .32, width * .32]) for (const z of [-depth * .42, depth * .42]) add(wheel, material(0x151718), [x, Math.max(.24, height * .18), z], [Math.PI / 2, 0, 0]);
  } else if (id.includes("building") || id.includes("outpost") || id.includes("tower") || id.includes("dumpster")) {
    add(new THREE.BoxGeometry(width, height * .72, depth), material(0x4a4a43, .02), [0, height * .36, 0]);
    add(new THREE.ConeGeometry(Math.max(width, depth) * .62, Math.max(.35, height * .28), 4), material(0x302823, .02), [0, height * .86, 0], [0, Math.PI / 4, 0]);
  } else if (id.includes("barrel") || id.includes("trash") || id.includes("tire") || id.includes("cone")) {
    add(new THREE.CylinderGeometry(Math.max(.22, width * .34), Math.max(.25, width * .42), height, id.includes("cone") ? 6 : 10), material(id.includes("cone") ? 0xd56b2b : 0x7f4b27, .03), [0, height / 2, 0]);
  } else {
    add(new THREE.BoxGeometry(width, height, depth), material(0x4a4a43, .03), [0, height / 2, 0]);
  }
  return root;
}

function addWorldFieldAssets() {
  for (const placement of getWorldFieldPlacements()) {
    const asset = getWorldFieldAsset(placement.assetId);
    const holder = new THREE.Group();
    holder.name = `field:${placement.id}`;
    holder.position.set(placement.x, sampleWorldElevation(worldLayout, placement), placement.z);
    holder.rotation.y = placement.rotation;
    holder.add(createWorldFieldFallback(asset));
    holder.userData.assetState = "fallback-loading";
    holder.userData.requestedAssetPath = asset.runtimePath;
    world.add(holder);
    loadCuratedGlb([asset.runtimePath]).then(loaded => {
      if (!holder.parent) return;
      const authoredRoot = cloneAuthoredRoot(loaded?.scene);
      if (!authoredRoot) {
        holder.userData.assetState = "fallback-invalid-authored-root";
        return;
      }
      fitAuthoredWorldRoot(authoredRoot, asset.fit.maxDimension);
      while (holder.children.length) holder.remove(holder.children[0]);
      holder.add(authoredRoot);
      holder.userData.authoredAssetPath = asset.runtimePath;
      holder.userData.assetState = "authored";
    }).catch(error => {
      if (!holder.parent) return;
      holder.userData.assetState = "fallback-load-error";
      holder.userData.assetLoadError = String(error?.message || error || "unknown").slice(0, 160);
    });
  }
}

function createWorldFieldBlockers() {
  return getWorldFieldPlacements().flatMap(placement => {
    const asset = getWorldFieldAsset(placement.assetId);
    if (!asset.collider.blocksPlayers) return [];
    const diameter = asset.collider.radius * 2;
    return [{ id: `field:${placement.id}`, x: placement.x, z: placement.z, w: diameter, d: diameter }];
  });
}

function resetMap() {
  world.clear();
  mapVisuals = null;
  const connectedLayout = createConnectedWorldLayout();
  worldLayout = Object.freeze({
    ...connectedLayout,
    blockers: Object.freeze([...connectedLayout.blockers, ...createWorldFieldBlockers()]),
  });
  hazards = [];
  enemies = [];
  bullets = [];
  effects = [];
  flags = [];
  const cfg = MAPS[mapKey];
  scene.background = createBiomeSkyTexture(mapKey);
  const texture = loadTerrainTexture(runtimeAssetPath(cfg.texture));
  renderQuality = renderQualityProfile(effectiveGraphicsTier() === "high" ? 5 : effectiveGraphicsTier() === "medium" ? 3 : 1);
  // Keep the authored terrain readable in first-person combat. The previous
  // density hid the road, elevation, and texture under a single flat wash.
  const fogDensity = renderQuality.pass >= 5 ? .0038 : renderQuality.pass >= 3 ? .0046 : .0054;
  scene.fog = new THREE.FogExp2(cfg.fog, fogDensity);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(renderQuality.textureRepeat, renderQuality.textureRepeat);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), renderQuality.textureAnisotropy);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mapScale = mode === "solo" ? 1 + Math.min(1.5, (storyStage - 1) * .18) : 1;
  const mapSize = worldLayout.size;
  ground = createTerrainMesh(texture);
  world.add(ground);
  addTerrainSurfaceDetail(mapKey);
  addConnectedWorldObjects();
  addWorldFieldAssets();
  addMapVisuals();
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
  // Keep the first-person spawn on the open south approach, not inside the
  // north overpass ramp that crosses the world origin and would fill the
  // opening camera with its gray deck.
  player = unit(0x55e5ff, 20, -36, activeProfile?.avatarType || "scout", true);
  applyWorldMovement(player);
  applyRequestedRenderFocus();
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
  const visualClass = ["heavy", "shield", "boss", "mutant"].includes(type) ? "heavy" : type === "sniper" ? "ranger" : type === "drone" ? "tech" : type === "spider" ? "spider" : "scout";
  const color = ({ rusher: 0xff5b55, shooter: 0xff8b45, sniper: 0xb97aff, shield: 0x4dbbff, heavy: 0xff3d3d, drone: 0x66fcf1, mutant: 0x8cff4d, spider: 0x8cff4d, boss: 0xffcf40 })[type];
  const enemy = unit(
    color,
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
    visualClass,
    false,
    { type, path: AUTHORED_ENEMY_MODELS[type] },
  );
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

function spawnMatchBots(plan = activeMatchPlan) {
  allies.forEach(bot => world.remove(bot.g));
  enemies.forEach(bot => world.remove(bot.g));
  allies = [];
  enemies = [];
  ally = null;
  if (mode !== "teams" || !plan?.slots?.length) return;

  const localSlot = plan.slots.find(slot => slot.playerType === "human" && slot.playerId === lobbyId)
    || plan.slots.find(slot => slot.playerType === "human");
  const localTeam = localSlot?.team || "alpha";
  for (const slot of plan.slots.filter(item => item.playerType === "bot")) {
    if (slot.team === localTeam) {
      allies.push(unit(0x3985ff, 2.5 + allies.length * 2, 1.5, allies.length % 2 ? "tech" : "ranger"));
    } else {
      spawnEnemy(enemies.length, "shooter");
    }
  }
  ally = allies[0] || null;
}

function start() {
  pauseMenuBackdrop();
  blue = red = score = kills = scrap = gold = silver = shieldLevel = 0;
  survivalSeconds = 0;
  questState = createQuestState();
  wave = 1;
  activeGun = "scout";
  weaponPresentationState = createWeaponPresentationState("scout");
  explorationState = createExplorationState();
  discoveryToastUntil = 0;
  ui.discoveryToast.classList.add("hidden");
  ui.over.classList.add("hidden");
  ui.shop.classList.add("hidden");
  Object.values(guns).forEach(gun => { gun.level = 0; });
  loadProgress(activeProfile);
  activeMatchPlan = null;
  resetMap();
  ensureLobbyRoom();
  phase = "loadout";
  timer = 0;
  $("loadoutMode").textContent = mode === "solo" ? "STORY SURVIVAL" : mode === "teams" ? `${botTeamSize}V${botTeamSize}` : `${ctfPlayers}-PLAYER CTF`;
  $("loadoutMap").textContent = MAPS[mapKey].label.toUpperCase();
  $("loadoutRoomModal").classList.remove("hidden");
  document.body.classList.add("loadout-active");
  updateArmory();
}

function beginCountdown(startsAt = Date.now() + 15000) {
  document.body.classList.remove("loadout-active");
  pauseMenuBackdrop();
  const countdownState = resolveMatchCountdown(startsAt);
  phase = "countdown";
  countdown = countdownState.secondsRemaining;
  timer = countdownState.millisecondsRemaining / 1000;
  countdownDeadline = countdownState.startsAt;
  firing = false;
  touch.mx = touch.mz = touch.ax = touch.az = 0;
  touch.fire = false;
  clearKeyboardInput();
  if (countdownState.expired) {
    $("matchCountdown").classList.add("hidden");
    nextCombat();
    return;
  }
  // Keep the home soundtrack alive, then switch to the gameplay playlist as
  // soon as the lobby countdown begins.
  startSceneMusic("gameplay");
  $("matchCountdown").classList.remove("hidden");
  $("countdownNumber").textContent = String(countdownState.secondsRemaining);
  setNightfallScene("countdown");
}

function applyMatchLifecycleMessage(message = {}) {
  const transition = reduceClientMatchLifecycle({ phase, activeMatchPlan, awaitingRematch }, message);
  activeMatchPlan = transition.activeMatchPlan;
  awaitingRematch = transition.awaitingRematch;
  if (transition.action === "ignore") return;
  if (transition.action === "hold-current-view") {
    updateNetworkStatus("Fresh room plan held until loadout.");
    return;
  }
  if (transition.action === "preserve-current-view") {
    updateNetworkStatus("Room roster changed. Current round continues; rematch will wait.");
    return;
  }
  if (transition.action === "wait-for-rematch") {
    const readyPlayers = Number(message.readyPlayers) || 0;
    const humanPlayers = Number(message.humanPlayers) || lobbyPeers + 1;
    updateNetworkStatus(`Rematch ready: ${readyPlayers}/${humanPlayers} players`);
    return;
  }
  if (transition.action === "start-countdown") {
    spawnMatchBots(message);
    updateNetworkStatus(`Match ready: ${message.humanPlayers} human, ${message.botPlayers} bot${message.botPlayers === 1 ? "" : "s"}`);
    $("loadoutRoomModal").classList.add("hidden");
    beginCountdown(message.startsAt);
    return;
  }
  spawnMatchBots(null);
  phase = "loadout";
  timer = 0;
  countdown = 0;
  countdownDeadline = 0;
  firing = false;
  $("matchCountdown").classList.add("hidden");
  $("loadoutRoomModal").classList.remove("hidden");
  const reason = message.reason === "connection-lost" ? "Connection reset" : "Room roster changed";
  updateNetworkStatus(`${reason}: waiting in loadout`);
}

function nextCombat() {
  pauseMenuBackdrop();
  phase = "combat";
  playBundledMusic("gameplay");
  setNightfallScene("game");
  timer = mode === "ctf" ? 300 : 60;
  ui.chest.classList.add("hidden");
  $("chestLocator").classList.add("hidden");
  chestAccessGranted = false;
  chests.forEach(chest => { chest.group.visible = false; });
  player.hp = player.maxHp || 100;
  player.shield = player.shieldMax;
  player.alive = true;
  if (mode === "teams") {
    spawnMatchBots();
    enemySpawnTypes = [];
  } else {
    allies.forEach(bot => { bot.hp = 100; bot.alive = true; bot.g.visible = true; bot.respawn = 0; });
    enemies.forEach(enemy => world.remove(enemy.g));
    enemies = [];
    enemySpawnTypes = mode === "solo"
      ? composeWave({ wave, difficulty: difficultyName(), map: mapKey, playerCount: 1 })
      : Array.from({ length: ctfPlayers / 2 }, () => "shooter");
  }
  spawnQueue = enemySpawnTypes.length;
  spawnTimer = 0;
  if (!replayCaptureActive) {
    replayCaptureActive = true;
    captureGameplayClip(canvas, { durationMs: 12000, metadata: { mode, map: mapKey, wave } })
      .then(saved => {
        if (saved) markMenuReplayRefresh({ recheckVisible: true });
      })
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

function moveResupply(dt, controller) {
  const chest = chests[0];
  if (!chest) return;
  const keyboard = keyboardMovementAxes(keys);
  const mx = controller?.mx || keyboard.strafe;
  const mz = controller?.mz || keyboard.vertical;
  const length = Math.hypot(mx, mz);
  if (!length) return;
  const from = chest.group.position.clone();
  const target = from.clone().add(new THREE.Vector3(mx / length, 0, mz / length).multiplyScalar(8 * dt));
  const resolved = resolveWorldMovement(worldLayout, from, target);
  chest.x = resolved.position.x;
  chest.z = resolved.position.z;
  chest.group.position.copy(resolved.position);
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
    currentScrap: scrap, currentGold: gold, currentSilver: silver, currentXp: totalXp, winStreak: previousRewards.winStreak || 0,
  });
  scrap = reward.nextScrap;
  gold = reward.nextGold;
  silver = reward.nextSilver;
  totalXp = reward.nextXp;
  playerLevel = levelFromXp(totalXp);
  if (activeProfile?.progress) {
    activeProfile.progress.matches = Math.max(0, Number(activeProfile.progress.matches) || 0) + 1;
    activeProfile.progress.deaths = Math.max(0, Number(activeProfile.progress.deaths) || 0) + (title === "Survivor Eliminated" ? 1 : 0);
    activeProfile.progress.wins = Math.max(0, Number(activeProfile.progress.wins) || 0) + (/Wins|Captures/.test(title) ? 1 : 0);
    activeProfile.progress.rewards = { winStreak: reward.winStreak, lifetimeRewards: Math.max(0, Number(previousRewards.lifetimeRewards) || 0) + reward.scrapEarned, goldEarned: reward.goldEarned, silverEarned: reward.silverEarned };
  }
  saveProgress();
  syncPublicPlayer();
  reportMatch(title);
  phase = "over";
  $("finalKills").textContent = kills;
  $("finalScrap").textContent = scrap;
  $("finalGold").textContent = gold;
  $("finalSilver").textContent = silver;
  $("finalScore").textContent = score;
  $("rewardSummary").textContent = `${RISK_PROFILES[reward.risk].label}: +${reward.xpEarned} XP, +${reward.scrapEarned} scrap, +${reward.goldEarned} gold, +${reward.silverEarned} silver${reward.scrapPenalty ? `, -${reward.scrapPenalty} risk penalty` : ""}. Level ${playerLevel}.`;
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

function weaponMuzzleOrigin(actor, direction) {
  const fallback = actor.g.position.clone().add(new THREE.Vector3(0, 1, 0)).addScaledVector(direction, .72);
  const authoredWeapon = actor.g.getObjectByName?.("authored-weapon");
  if (!authoredWeapon) return fallback;
  const bounds = new THREE.Box3().setFromObject(authoredWeapon);
  if (bounds.isEmpty()) return fallback;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  return center.addScaledVector(direction, Math.max(.22, Math.max(size.x, size.z) * .52));
}

function weaponMuzzleFlash(actor, direction, color) {
  const origin = weaponMuzzleOrigin(actor, direction);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(.16, 6, 5),
    material(color, 1),
  );
  flash.name = "weapon-muzzle-flash";
  flash.position.copy(origin).addScaledVector(direction, .22);
  flash.scale.set(.8, .8, 1.8);
  flash.rotation.y = Math.atan2(direction.x, direction.z);
  world.add(flash);
  effects.push({ mesh: flash, velocity: new THREE.Vector3(), life: .12 });

  const tracer = new THREE.Mesh(
    new THREE.CylinderGeometry(.025, .04, .9, 6),
    material(color, .8),
  );
  tracer.name = "weapon-tracer-flash";
  tracer.position.copy(origin).addScaledVector(direction, .62);
  tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  world.add(tracer);
  effects.push({ mesh: tracer, velocity: direction.clone().multiplyScalar(10), life: .09 });

  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(.12, 7, 6),
    new THREE.MeshBasicMaterial({ color: 0x9a9a8b, transparent: true, opacity: .42 }),
  );
  smoke.name = "weapon-smoke-puff";
  smoke.position.copy(origin).addScaledVector(direction, .3);
  smoke.scale.set(.72, .72, .72);
  world.add(smoke);
  effects.push({ mesh: smoke, velocity: direction.clone().multiplyScalar(.65).add(new THREE.Vector3(0, .42, 0)), life: .32 });
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
  if (actor === player && !profile) {
    weaponPresentationState = triggerWeaponShot(weaponPresentationState).state;
  }
  const direction = target.clone().sub(actor.g.position);
  direction.y = 0;
  if (!direction.lengthSq()) return;
  direction.normalize();
  actor.g.rotation.y = Math.atan2(direction.x, direction.z);
  for (let index = 0; index < weapon.shots; index++) {
    const offset = (index - (weapon.shots - 1) / 2) * weapon.spread;
    const shotDirection = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), offset);
    const projectileColor = actor.enemyType === "spider" ? 0x9cff69 : 0xffdf52;
    const projectile = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 8), material(projectileColor, 1));
    if (actor.enemyType === "spider") {
      projectile.name = "acid-web-projectile";
      actor.g.userData.attackPulseMs = 180;
    }
    projectile.position.copy(weaponMuzzleOrigin(actor, shotDirection));
    world.add(projectile);
    projectile.scale.set(1, 1, 2.4);
    if (index === 0) weaponMuzzleFlash(actor, shotDirection, projectileColor);
    bullets.push({ m: projectile, v: shotDirection.multiplyScalar(35), life: 1.1, blue: actor === player || allies.includes(actor), damage: weapon.damage, pierce: weapon.pierce, hits: new Set() });
  }
  burst(actor.g.position.clone().add(new THREE.Vector3(0, 1, .6)), actor === player || allies.includes(actor) ? 0x66fcf1 : 0xff5d75, 4);
  if (actor === player) cameraShake = Math.min(.18, cameraShake + .07);
  if (actor === player) playTone(activeGun === "scout" ? 120 : 90, .04, "square", .035);
}

function reloadWeapon(manual = true) {
  if (Date.now() < reloadUntil || magazines[activeGun] >= magazineSizes[activeGun]) return;
  weaponPresentationState = beginWeaponReload(weaponPresentationState).state;
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

function impactFlash(position, color = 0xffdf52) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(.08, .28, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, side: THREE.DoubleSide }),
  );
  ring.name = "weapon-impact-flash";
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(position);
  ring.position.y += .04;
  world.add(ring);
  effects.push({ mesh: ring, velocity: new THREE.Vector3(), life: .18 });
}

function hitEnemy(enemy, damage) {
  enemy.hp -= damage;
  enemy.g.userData.hitPulseMs = 180;
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
    const currencyDrop = enemyCurrencyDrop({ enemyType: enemy.enemyType, wave });
    gold += currencyDrop.gold;
    silver += currencyDrop.silver;
    spawnCurrencyPickupBurst(enemy.g.position, currencyDrop);
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
  if (remaining > 0) target.g.userData.hitPulseMs = 180;
}

function spawnCurrencyPickupBurst(position, { gold: goldAmount = 0, silver: silverAmount = 0 } = {}) {
  const rewards = [
    { kind: "gold", amount: goldAmount },
    { kind: "silver", amount: silverAmount },
  ].filter(reward => reward.amount > 0);
  rewards.forEach((reward, index) => {
    const profile = currencyPickupProfile(reward.kind);
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(profile.scale, profile.scale, .08, 16),
      new THREE.MeshStandardMaterial({ color: profile.color, emissive: profile.accent, emissiveIntensity: .28, metalness: .82, roughness: .22, transparent: true }),
    );
    coin.name = reward.kind === "gold" ? "currency-pickup:gold" : "currency-pickup:silver";
    coin.position.copy(position).add(new THREE.Vector3((index ? 1 : -1) * .48, .8, .15));
    coin.rotation.z = Math.PI / 2;
    coin.userData.currencyAmount = reward.amount;
    world.add(coin);
    effects.push({
      mesh: coin,
      kind: "currency-pickup",
      profile,
      origin: coin.position.clone(),
      elapsed: 0,
      life: profile.durationMs / 1000,
      index,
    });
  });
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
    return { mx: 0, mz: 0, ax: 0, az: 0, fire: false, ads: false, menuHeld: false, bHeld: false };
  }
  const pressed = pad.buttons.map(button => button.pressed);
  const justPressed = index => pressed[index] && !lastButtons[index];
  lastButtons = pressed;
  const result = {
    mx: deadzone(pad.axes[0] || 0), mz: deadzone(pad.axes[1] || 0), ax: deadzone(pad.axes[2] || 0), az: deadzone(pad.axes[3] || 0),
    fire: (pad.buttons[7]?.value || 0) > .2, ads: (pad.buttons[6]?.value || 0) > .2,
    menuHeld: Boolean(pad.buttons[9]?.pressed), bHeld: Boolean(pad.buttons[1]?.pressed),
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

function neutralControllerInput() {
  return {
    mx: 0, mz: 0, ax: 0, az: 0,
    fire: false, ads: false, menuHeld: false, bHeld: false,
    interact: false, ability: false, reload: false, weapon: false,
    pause: false, switchTarget: false,
    dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false,
  };
}

function handleControlsTourController() {
  const controller = pollController();
  const next = recordControlsTourControllerSnapshot(controlsTourState, {
    leftStick: Math.hypot(controller.mx, controller.mz),
    rightStick: Math.hypot(controller.ax, controller.az),
    rightTrigger: controller.fire ? 1 : 0,
    menu: controller.menuHeld,
    b: controller.bHeld,
  });
  if (next === controlsTourState) return;
  controlsTourState = next;
  renderControlsTour();
  if (controlsTourState.status === "complete") completeControlsTour();
}

function handleSettingsController() {
  const controller = pollController();
  if (controller.pause) { closeSettings(); return; }
  if (controller.interact) $("controlsTourReplayBtn").click();
}

function handleLoadoutController() {
  const controller = pollController();
  const controls = [$("loadoutArmoryBtn"), $("loadoutReadyBtn")];
  if (controller.dpadLeft || controller.dpadUp) loadoutControllerIndex = 0;
  if (controller.dpadRight || controller.dpadDown) loadoutControllerIndex = 1;
  controls[loadoutControllerIndex]?.focus({ preventScroll: true });
  if (controller.interact) controls[loadoutControllerIndex]?.click();
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
  if (shouldBlockControlsTourSimulation({ tour: controlsTourState, phase })) return;
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
  const sampledController = pollController();
  const inputPaused = localGameplayInputPaused();
  const controller = inputPaused ? neutralControllerInput() : sampledController;
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
  if (phase === "combat") {
    survivalSeconds += dt;
    updateStoryProgress();
  }
  if (phase === "prep") {
    chests.forEach(chest => { chest.group.rotation.y += dt; });
    moveResupply(dt, controller);
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
  const keyboardAxes = keyboardMovementAxes(keys);
  let mx = inputPaused || controllerLocked() || menuOpen ? 0 : keyboardAxes.strafe;
  let mz = inputPaused || controllerLocked() || menuOpen ? 0 : keyboardAxes.vertical;
  if (!inputPaused && (touch.mx || touch.mz)) { mx = touch.mx; mz = touch.mz; }
  if (!inputPaused && (controller.mx || controller.mz)) { mx = controller.mx; mz = controller.mz; }
  const length = Math.hypot(mx, mz) || 1;
  const playerFrom = player.g.position.clone();
  if (frontView) {
    const classSpeed = (player.moveSpeedMultiplier || 1) * (activeAbility?.id === "dash" && Date.now() < activeAbility.endsAt ? activeAbility.modifiers.moveSpeedMultiplier : 1);
    const movementDelta = firstPersonMovementDelta({
      yaw: viewYaw,
      strafe: mx,
      forward: firstPersonForwardInput(mz),
      speed: 10 * classSpeed * dt,
    });
    player.g.position.x += movementDelta.x;
    player.g.position.z += movementDelta.z;
  } else {
    const classSpeed = player.moveSpeedMultiplier || 1;
    player.g.position.x += mx / length * 10 * classSpeed * dt;
    player.g.position.z += mz / length * 10 * classSpeed * dt;
  }
  const manualTouchAim = !inputPaused && Math.hypot(touch.ax, touch.az) > .08;
  const manualControllerAim = !inputPaused && Math.hypot(controller.ax, controller.az) > .08;
  if (manualTouchAim) {
    setInputMode("touch");
    aim.copy(player.g.position).add(new THREE.Vector3(touch.ax, 0, touch.az).multiplyScalar(20));
    viewYaw = aimYawFromAxes(touch.ax * CONTROL_DIRECTION_LOCK.touchYawSign, touch.az);
  }
  if (manualControllerAim) {
    aim.copy(player.g.position).add(new THREE.Vector3(controller.ax, 0, controller.az).multiplyScalar(20));
    viewYaw = aimYawFromAxes(controller.ax * CONTROL_DIRECTION_LOCK.controllerYawSign, controller.az);
  }
  const wantsFire = !inputPaused && ((!controllerLocked() && firing) || touch.fire || controller.fire);
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
      if (enemy.alive && !bullet.hits.has(enemy) && bullet.m.position.distanceTo(enemy.g.position) < (enemy.g.userData.hitRadius || 1.1)) {
        bullet.hits.add(enemy);
        impactFlash(bullet.m.position, enemy.enemyType === "spider" ? 0x9cff69 : 0xffdf52);
        hitEnemy(enemy, bullet.damage);
        if (bullet.pierce-- <= 0) bullet.life = 0;
      }
    }
    else if (bullet.m.position.distanceTo(player.g.position) < 1.1) {
      impactFlash(bullet.m.position, 0xff5d75);
      applyDamage(player, bullet.damage);
      bullet.life = 0;
    }
  }
  effects.forEach(effect => {
    effect.life -= dt;
    if (effect.kind === "currency-pickup") {
      effect.elapsed += dt;
      const frame = currencyPickupFrame({ profile: effect.profile, elapsed: effect.elapsed, index: effect.index });
      effect.mesh.position.copy(effect.origin);
      effect.mesh.position.y += frame.y;
      effect.mesh.rotation.y = frame.rotation;
      effect.mesh.material.opacity = frame.opacity;
      effect.mesh.scale.setScalar(effect.profile.scale * (1 + Math.sin(effect.elapsed * 8) * .08));
      return;
    }
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
  player.g.visible = !frontView && player.alive;
  // Keep the aim camera just above and ahead of the survivor so the head never
  // sits between the reticle and the world while running and firing.
  const cameraTarget = frontView ? player.g.position.clone().add(new THREE.Vector3(0, 2.65, 0)).addScaledVector(facing, 1.45) : new THREE.Vector3(player.g.position.x, 26, player.g.position.z + 22);
  camera.position.lerp(cameraTarget, Math.min(1, dt * (frontView ? 12 : 4)));
  cameraShake = Math.max(0, cameraShake - dt * 1.8);
  if (cameraShake) camera.position.add(new THREE.Vector3((Math.random() - .5) * cameraShake, (Math.random() - .5) * cameraShake, (Math.random() - .5) * cameraShake));
  if (frontView) {
    const lookTarget = camera.position.clone().addScaledVector(facing, 30);
    // Keep the authored terrain in the first-person frame instead of looking
    // perfectly level over it, which reduced the map to an edge-on gray wall.
    // Aim materially into the playfield.  A near-level ray left the ground
    // edge-on at the 16:9 desktop viewport, so authored texture/detail never
    // entered the frame even though it was present in the scene.
    lookTarget.y = player.g.position.y - 5.8;
    camera.lookAt(lookTarget);
  }
  else camera.lookAt(player.g.position.x, 0, player.g.position.z);
}

function formatTime(seconds) {
  return `${String(Math.max(0, Math.ceil(seconds) / 60 | 0)).padStart(2, "0")}:${String(Math.max(0, Math.ceil(seconds) % 60)).padStart(2, "0")}`;
}

function renderHud() {
  const weapon = weaponProfile();
  const classDefinition = getClassDefinition(classProgress.classId);
  const classStats = getClassStats(classProgress);
  const teamMembers = [player, ...allies];
  const teamHealth = teamMembers.reduce((total, member) => total + Math.max(0, member?.hp || 0), 0);
  const teamHealthMax = teamMembers.reduce((total, member) => total + Math.max(0, member?.maxHp || 0), 0);
  const campaign = storyCampaignView({ stage: storyStage, missionIndex, kingdomUnlocked });
  const chapter = soldierStory[Math.min(campaign.chapterId - 1, soldierStory.length - 1)];
  const objective = campaign.objective;
  const quest = questView(questState);
  const hud = createHudViewModel({
    health: player.hp,
    maxHealth: player.maxHp,
    armor: player.shield,
    maxArmor: player.shieldMax,
    ammo: { current: magazines[activeGun], reserve: magazineSizes[activeGun] },
    ability: { label: classDefinition.ability.label, readyAt: classProgress.abilityReadyAt, cooldownMs: classDefinition.ability.cooldownMs * classStats.abilityCooldownMultiplier, now: Date.now() },
    mode,
    playerName: activeProfile?.name,
    teamHealth,
    teamHealthMax,
    mission: `Mission: ${objective}`,
    round: wave,
    timer: phase === "loadout" ? "WAITING" : formatTime(timer),
    objective,
    score: { blue: mode === "ctf" ? Math.floor(blue) : blue, red: mode === "ctf" ? Math.floor(red) : red },
  });

  ui.hp.textContent = hud.health.value;
  ui.hpBar.style.setProperty("--hud-fill", `${hud.health.percentage}%`);
  ui.shield.textContent = hud.armor.value;
  ui.shieldBar.style.setProperty("--hud-fill", `${hud.armor.percentage}%`);
  ui.heat.textContent = Math.round(Math.max(0, player.cooldown / weapon.delay) * 100);
  ui.heatBar.style.setProperty("--hud-fill", `${Math.round(Math.max(0, player.cooldown / weapon.delay) * 100)}%`);
  ui.ammo.textContent = hud.ammo.label;
  ui.ability.textContent = `${hud.ability.label} ${hud.ability.statusLabel}`;
  ui.abilityBar.style.setProperty("--hud-fill", `${hud.ability.percentage}%`);
  ui.team.textContent = hud.team.label;
  ui.teamName.textContent = hud.team.playerName;
  ui.teamHealth.textContent = hud.team.healthLabel;
  ui.teamHealthBar.style.setProperty("--hud-fill", `${hud.team.healthPercentage}%`);
  ui.objective.textContent = hud.objective.label;
  ui.scrap.textContent = scrap;
  ui.gold.textContent = gold;
  ui.silver.textContent = silver;
  ui.kills.textContent = kills;
  ui.wave.textContent = wave;
  ui.level.textContent = playerLevel;
  ui.stage.textContent = storyStage;
  ui.chapter.textContent = `Chapter ${campaign.chapterId}: ${campaign.chapterTitle}`;
  ui.mission.textContent = `Mission: ${campaign.missionTitle} · ${hud.mission.label.replace(/^Mission:\s*/i, "")}`;
  const requirementSummary = quest.requirements.length > 1
    ? quest.requirements.map(requirement => `${QUEST_METRIC_LABELS[requirement.metric] || requirement.metric.toUpperCase()} ${Math.min(requirement.target, quest.progress[requirement.metric] || 0)}/${requirement.target}`).join(" · ")
    : `${quest.value}/${quest.target}`;
  ui.quest.textContent = `QUEST ${requirementSummary} · ${quest.objective}`;
  const questPercent = quest.target ? Math.min(100, Math.round(quest.value / quest.target * 100)) : 0;
  ui.questProgress.setAttribute("aria-valuemax", String(quest.target));
  ui.questProgress.setAttribute("aria-valuenow", String(quest.value));
  ui.questProgress.classList.toggle("is-complete", quest.completed);
  ui.questProgressFill.style.setProperty("--hud-fill", `${questPercent}%`);
  ui.weapon.textContent = `${weapon.name} L${weapon.level} ${weapon.shots}x`;
  ui.map.textContent = biomeAt(worldLayout, player.g.position).label.toUpperCase();
  const exploration = explorationProgress(worldLayout, explorationState);
  ui.exploration.textContent = `EXPLORE ${exploration.discovered}/${exploration.total}`;
  ui.phase.textContent = mode === "ctf" ? "CAPTURE" : phase.toUpperCase();
  ui.timer.textContent = hud.timer.label;
  ui.prep.textContent = hud.timer.label;
  ui.blue.textContent = hud.score.blue;
  ui.red.textContent = hud.score.red;
}

function render() {
  const dt = Math.min(clock.getDelta(), .04);
  syncPointerCaptureEligibility();
  startQueuedControlsTourWhenSafe();
  if (controlsTourState?.status === "active") handleControlsTourController();
  else if (!ui.settings.classList.contains("hidden") && controllerConnected) handleSettingsController();
  else if (phase === "loadout" && !$("loadoutRoomModal").classList.contains("hidden") && controllerConnected) handleLoadoutController();
  else if (phase === "menu" && !lobbyScreen.classList.contains("hidden")) handleLobbyController();
  update(dt);
  updateAuthoredCharacterAnimations(dt);
  updateWeaponPresentation(dt);
  updateMapVisuals(dt);
  if (discoveryToastUntil && performance.now() >= discoveryToastUntil) {
    discoveryToastUntil = 0;
    ui.discoveryToast.classList.add("hidden");
  }
  renderHud();
  player.cooldown = Math.max(0, player.cooldown - dt);
  allies.forEach(bot => { bot.cooldown = Math.max(0, bot.cooldown - dt); });
  if (!rendererContextLost) renderer.render(scene, camera);
  updateAimReticle();
  requestAnimationFrame(render);
}

function wakeAudio() {
  if ((!audioEnabled && !musicEnabled) || (!window.AudioContext && !window.webkitAudioContext)) return;
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  const lobbyOrMatchVisible = phase !== "menu" || !lobbyScreen.classList.contains("hidden");
  if (musicEnabled && musicSource === "builtin" && lobbyOrMatchVisible) startBuiltInMusic();
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
  bundledMusic.volume = Math.min(1, effectiveMusicVolume());
}

function currentBundledMusicPhase() {
  return ["countdown", "combat", "prep"].includes(phase) ? "gameplay" : "menu";
}

function startSceneMusic(nextPhase = currentBundledMusicPhase()) {
  if (!musicEnabled) return;
  if (musicSource === "bundled") playBundledMusic(nextPhase);
  else if (musicSource === "local") playLocalTrack();
  else { wakeAudio(); startBuiltInMusic(); }
}

function chooseBundledTrack(nextPhase, { allowCurrent = false } = {}) {
  const playlist = BUNDLED_SOUNDTRACK[nextPhase] || BUNDLED_SOUNDTRACK.menu;
  const choices = allowCurrent || playlist.length < 2
    ? playlist
    : playlist.filter(track => track.url !== bundledMusicTrack?.url);
  return choices[Math.floor(Math.random() * choices.length)];
}

function playBundledMusic(nextPhase = currentBundledMusicPhase(), { chooseNext = false } = {}) {
  if (!musicEnabled || musicSource !== "bundled") return;
  const phaseChanged = bundledMusicPhase !== nextPhase;
  const sourceChanged = phaseChanged || chooseNext || !bundledMusicTrack;
  const track = sourceChanged ? chooseBundledTrack(nextPhase) : bundledMusicTrack;
  if (sourceChanged) {
    bundledMusic.pause();
    bundledMusic.src = runtimeAssetPath(track.url);
    bundledMusicPhase = nextPhase;
    bundledMusicTrack = track;
  }
  updateLocalMusicVolume();
  bundledMusic.play().then(() => {
    ui.musicStatus.textContent = track.name;
    $("playMusicBtn").textContent = "Pause";
  }).catch(() => {
    ui.musicStatus.textContent = `${track.name} — tap Play to begin`;
    $("playMusicBtn").textContent = "Play";
  });
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
  bundledMusic.pause();
  $("playMusicBtn").textContent = "Play";
}

function clearKeyboardInput() {
  Object.keys(keys).forEach(key => delete keys[key]);
  firing = false;
}

function currentControllerButtons() {
  const pad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
  return pad ? Array.from(pad.buttons || [], button => Boolean(button.pressed)) : [];
}

function clearTransientGameplayInput(reason) {
  const recovery = resolveTransientInputReset({
    reason,
    pointerResumeEligible: pointerRecoveryApplies(),
    keys,
    touch,
    controllerButtons: currentControllerButtons(),
  });
  if (!recovery.shouldReset) return recovery;
  const cleared = recovery.state;
  Object.keys(keys).forEach(key => delete keys[key]);
  Object.assign(keys, cleared.keys);
  Object.assign(touch, cleared.touch);
  firing = cleared.firing;
  adsActive = cleared.ads;
  lastButtons = cleared.controllerButtonLatch;
  if (recovery.requiresPointerClick) pointerResumeRequired = true;
  touchStickReleases.forEach(release => release());
  document.querySelectorAll("#touchControls .active").forEach(control => control.classList.remove("active"));
  ["moveStick", "aimStick"].forEach(id => {
    const knob = $(id)?.querySelector("i");
    if (knob) knob.style.transform = "translate(0,0)";
  });
  return recovery;
}

function pointerCaptureDecision({
  pointerType = "mouse",
  deliberateCanvasAction = true,
  pointerLocked = false,
  documentVisible = document.visibilityState === "visible",
  rendererReady = !rendererContextLost,
} = {}) {
  return canCaptureGameplayPointer({
    phase,
    inputMode,
    pointerType,
    deliberateCanvasAction,
    finePointer: finePointer.matches,
    firstPerson: frontView,
    playerAlive: Boolean(player?.alive),
    menuOpen,
    controlsTourActive: controlsTourState?.status === "active",
    controllerOnly,
    pointerLocked,
    documentVisible,
    rendererReady,
  });
}

function pointerRecoveryApplies() {
  return pointerCaptureDecision({
    pointerLocked: false,
    documentVisible: true,
    rendererReady: true,
  });
}

function localGameplayInputPaused() {
  return rendererContextLost || (pointerResumeRequired && inputMode === "mouse");
}

function updateInputRecoveryNotice() {
  const active = rendererContextLost || pointerResumeRequired;
  document.body.classList.toggle("input-recovery-active", active);
  canvas.setAttribute("aria-busy", String(rendererContextLost));
  if (!inputRecoveryNotice) return;
  inputRecoveryNotice.classList.toggle("hidden", !active);
  if (!active) {
    inputRecoveryNotice.removeAttribute("data-recovery-kind");
    return;
  }
  const graphicsRecovery = rendererContextLost;
  inputRecoveryNotice.dataset.recoveryKind = graphicsRecovery ? "graphics" : "pointer";
  $("inputRecoveryTitle").textContent = graphicsRecovery ? "GRAPHICS RECOVERING" : "AIMING PAUSED";
  $("inputRecoveryText").textContent = graphicsRecovery
    ? "Restoring the battlefield view. Local controls are safely released."
    : "Click the battlefield to resume mouse aim.";
}

function interruptLocalInput(reason) {
  const recovery = clearTransientGameplayInput(reason);
  if (!recovery.shouldReset) return;
  if (reason !== "pointer-lock-lost" && document.pointerLockElement === canvas) document.exitPointerLock?.();
  updateInputRecoveryNotice();
}

function syncPointerCaptureEligibility() {
  if (pointerResumeRequired && !pointerRecoveryApplies()) {
    pointerResumeRequired = false;
    updateInputRecoveryNotice();
  }
  if (document.pointerLockElement !== canvas) return;
  const valid = pointerCaptureDecision({
    pointerLocked: false,
    deliberateCanvasAction: true,
  });
  if (!valid) document.exitPointerLock?.();
}

function requestGameplayPointerLock(event) {
  const eligible = pointerCaptureDecision({
    pointerType: event.pointerType,
    deliberateCanvasAction: event.isTrusted && event.button === 0 && event.isPrimary !== false,
    pointerLocked: document.pointerLockElement === canvas,
  });
  if (!eligible || typeof canvas.requestPointerLock !== "function") return false;
  try {
    const request = canvas.requestPointerLock();
    request?.catch?.(() => interruptLocalInput("pointer-lock-lost"));
    return true;
  } catch {
    interruptLocalInput("pointer-lock-lost");
    return false;
  }
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

function phoneEnvironment() {
  return ["localhost", "127.0.0.1", "::1"].includes(location.hostname) ? "development" : "production";
}

function phoneProvider() {
  if (!phoneProviderPromise) phoneProviderPromise = loadPhoneAuthProvider({ environment: phoneEnvironment() });
  return phoneProviderPromise;
}

function hideProfileSteps() {
  profileStep.classList.add("hidden");
  returnStep.classList.add("hidden");
  linkProfileStep.classList.add("hidden");
  phoneCodeStep.classList.add("hidden");
}

async function sendPhoneCode({ kind, phoneNumber, profile, pinDigest: localPinDigest }) {
  const normalized = normalizePhoneNumber(phoneNumber);
  const message = kind === "restore" ? $("linkProfileMessage") : profileMessage;
  if (!normalized) {
    message.textContent = "Enter a valid mobile number.";
    return false;
  }
  message.textContent = "Requesting a secure verification code...";
  try {
    phoneConfirmation?.dispose?.();
    const provider = await phoneProvider();
    phoneConfirmation = await provider.sendCode({ phoneNumber: normalized, recaptchaContainer: "phoneRecaptcha" });
    phoneChallenge = beginPhoneChallenge(normalized);
    pendingPhoneAction = { kind, phoneNumber: normalized, profile, pinDigest: localPinDigest };
    profilePhone.value = "";
    $("linkPhone").value = "";
    $("phoneCode").value = "";
    $("phoneCodeMessage").textContent = "";
    $("phoneCodeHeading").textContent = kind === "restore" ? "Restore Linked Player" : "Verify Mobile Number";
    $("phoneCodeHint").textContent = `A code was sent to ${phoneChallenge.phoneHint}. The number is not shown to other players.`;
    hideProfileSteps();
    phoneCodeStep.classList.remove("hidden");
    $("phoneCode").focus();
    updatePhoneResendControl();
    return true;
  } catch (error) {
    phoneProviderPromise = null;
    message.textContent = error?.message || "Verified phone sign-in is unavailable. Offline play still works.";
    return false;
  }
}

function updatePhoneResendControl() {
  const button = $("resendPhoneCodeBtn");
  if (!phoneChallenge || !pendingPhoneAction) {
    button.disabled = true;
    button.textContent = "Resend code";
    return;
  }
  const remaining = Math.max(0, Math.ceil((phoneChallenge.resendAt - Date.now()) / 1000));
  const allowed = mayResendPhoneChallenge(phoneChallenge);
  button.disabled = !allowed;
  button.textContent = allowed ? "Resend code" : `Resend code in ${remaining}s`;
}

async function confirmPhoneCode() {
  const code = $("phoneCode").value.trim();
  const message = $("phoneCodeMessage");
  if (!/^\d{6}$/.test(code) || !pendingPhoneAction || !phoneConfirmation) {
    message.textContent = "Enter the six-digit verification code.";
    return;
  }
  message.textContent = "Confirming verified account...";
  try {
    const idToken = await phoneConfirmation.confirm(code);
    phoneChallenge = finishPhoneChallenge(phoneChallenge);
    const action = pendingPhoneAction;
    const requestBody = action.kind === "create"
      ? buildPhoneLinkRequest({ idToken, profile: action.profile })
      : { idToken, deviceProfileId: action.profile.profileId };
    const response = await fetch("/api/account/phone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(action.profile.backendSession ? { Authorization: `Bearer ${action.profile.backendSession}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The verified account could not be linked");
    const restored = createRestoredLocalProfile({
      player: payload.player,
      pinDigest: action.pinDigest,
      phoneHint: payload.phoneHint,
      session: payload.session,
      deviceCredential: payload.deviceCredential,
      profileId: action.profile.profileId,
    });
    const profile = mergeVerifiedLocalProfile({ draft: action.profile, restored, deviceId: deviceId() });
    saveProfile(profile);
    guestControlsIdentityActive = false;
    activeProfile = profile;
    loadProgress(profile);
    offlineMode = false;
    localStorage.setItem("wastland-survivor-offline", "false");
    updateLobbyConnectivity({ type: "player-service-success" });
    phoneConfirmation.dispose?.();
    phoneConfirmation = null;
    pendingPhoneAction = null;
    phoneChallenge = null;
    $("phoneCode").value = "";
    openLobby(profile.name);
  } catch (error) {
    if (phoneChallenge?.status === "code-sent") phoneChallenge = failPhoneChallenge(phoneChallenge);
    message.textContent = phoneChallenge?.status === "locked"
      ? "Too many attempts. Start a new phone verification."
      : error?.message || "The verification code was not accepted.";
  }
}

async function resendPhoneCode() {
  if (!pendingPhoneAction || !mayResendPhoneChallenge(phoneChallenge)) return;
  const action = pendingPhoneAction;
  await sendPhoneCode(action);
}

function cancelPhoneVerification() {
  const previous = pendingPhoneAction?.kind;
  phoneConfirmation?.dispose?.();
  phoneConfirmation = null;
  phoneChallenge = null;
  pendingPhoneAction = null;
  hideProfileSteps();
  (previous === "restore" ? linkProfileStep : profileStep).classList.remove("hidden");
}

async function syncPublicPlayer() {
  if (!activeProfile || activeProfile.youthAccount || offlineMode) {
    updateLobbyConnectivity(offlineMode
      ? { type: "offline-changed", offlineMode: true }
      : { type: "player-service-failure" });
    return false;
  }
  const profile = activeProfile;
  Object.assign(profile, ensureProfileIdentity(profile));
  try {
    const response = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceProfileId: profile.profileId,
        deviceCredential: profile.backendDeviceCredential || "",
        playerTag: profile.playerTag,
        displayName: profile.name,
        avatarType: profile.avatarType,
        level: profile.progress?.playerLevel || 1,
        online: true,
        stats: {
          kills: profile.progress?.kills || 0,
          matches: profile.progress?.matches || 0,
          wins: profile.progress?.wins || 0,
          deaths: profile.progress?.deaths || 0,
        },
        progress: profile.progress || {},
      }),
    });
    if (!response.ok) {
      updateLobbyConnectivity({ type: "player-service-failure" });
      return false;
    }
    const { player: publicPlayer, session, deviceCredential } = await response.json();
    Object.assign(profile, applyAuthoritativePlayerIdentity(profile, publicPlayer));
    if (deviceCredential) profile.backendDeviceCredential = deviceCredential;
    profile.backendSession = session;
    saveProfile(profile);
    updateLobbyConnectivity({ type: "player-service-success" });
    return true;
  } catch {
    // Local play remains available when the optional backend is offline.
    updateLobbyConnectivity({ type: "player-service-failure" });
    return false;
  }
}

function controlsTourIdentityInput() {
  return { profile: guestControlsIdentityActive ? null : activeProfile, guest: guestControlsIdentityActive };
}

function storedControlsTourFamilies(storageKey) {
  try {
    return mergeSeenControlsFamilies(JSON.parse(localStorage.getItem(storageKey) || "[]"));
  } catch {
    return [];
  }
}

function localControlsTourFamilies(identityInput = controlsTourIdentityInput()) {
  return storedControlsTourFamilies(controlsTourStorageKey(identityInput));
}

function controlsTourSeenFamilies(identityInput = controlsTourIdentityInput()) {
  return mergeSeenControlsFamilies(
    localControlsTourFamilies(identityInput),
    identityInput.guest ? [] : identityInput.profile?.controlsTourSeenFamilies,
  );
}

function controlsTourFamiliesForCapturedIdentity(capture) {
  return mergeSeenControlsFamilies(
    storedControlsTourFamilies(capture.storageKey),
    capture.guest ? [] : capture.profileRef?.controlsTourSeenFamilies,
  );
}

function saveControlsTourFamiliesForIdentity(capture, families) {
  const seenFamilies = mergeSeenControlsFamilies(families);
  localStorage.setItem(capture.storageKey, JSON.stringify(seenFamilies));
  if (capture.profileRef && !capture.guest) {
    capture.profileRef.controlsTourSeenFamilies = seenFamilies;
    saveProfile(capture.profileRef);
  }
  return seenFamilies;
}

function saveControlsTourFamilies(families) {
  const capture = captureControlsTourPreferenceIdentity(controlsTourIdentityInput());
  return saveControlsTourFamiliesForIdentity(capture, families);
}

async function syncControlsTourPreferences() {
  const identityInput = controlsTourIdentityInput();
  const localFamilies = controlsTourSeenFamilies(identityInput);
  if (identityInput.guest || !identityInput.profile?.backendSession || offlineMode || identityInput.profile.youthAccount) return localFamilies;
  try {
    const result = await syncControlsTourPreferencesForIdentity({
      identityInput,
      getCurrentIdentityInput: controlsTourIdentityInput,
      localFamilies,
      requestFamilies: async capture => {
        const response = await fetch("/api/account/preferences", {
          headers: { Authorization: `Bearer ${capture.backendSession}` },
        });
        if (!response.ok) throw new Error("Private controls preferences were unavailable");
        const payload = await response.json();
        return payload.preferences?.controlsTourSeenFamilies;
      },
      readCurrentFamilies: controlsTourFamiliesForCapturedIdentity,
      applyFamilies: ({ capture, families }) => saveControlsTourFamiliesForIdentity(capture, families),
    });
    return result.families;
  } catch {
    return localFamilies;
  }
}

function persistControlsTourCompletion(families) {
  const seenFamilies = saveControlsTourFamilies(families);
  if (guestControlsIdentityActive || !activeProfile?.backendSession || offlineMode || activeProfile.youthAccount) return Promise.resolve(seenFamilies);
  return fetch("/api/account/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeProfile.backendSession}` },
    body: JSON.stringify({ controlsTourSeenFamilies: seenFamilies }),
  }).then(response => {
    if (!response.ok) throw new Error("Private controls preference was not saved");
    return seenFamilies;
  }).catch(() => seenFamilies);
}

function controlsFamilyLabel(family) {
  return ({ "keyboard-mouse": "Keyboard and mouse", touch: "Touch controls", controller: "Xbox-style controller" })[family] || "Keyboard and mouse";
}

function renderControlsTour() {
  if (!controlsTourState) return;
  $("controlsTourFamily").textContent = controlsFamilyLabel(controlsTourState.family);
  $("controlsTourProgress").textContent = `${Math.min(controlsTourState.stepIndex + 1, controlsTourState.steps.length)} / ${controlsTourState.steps.length}`;
  $("controlsTourSteps").replaceChildren(...controlsTourState.steps.map((step, index) => {
    const item = document.createElement("li");
    item.className = index < controlsTourState.stepIndex ? "complete" : index === controlsTourState.stepIndex ? "current" : "";
    if (index < controlsTourState.stepIndex) item.setAttribute("aria-label", `${step.title} complete`);
    const title = document.createElement("span");
    title.textContent = step.title;
    const control = document.createElement("b");
    control.textContent = index < controlsTourState.stepIndex ? "Complete" : step.control;
    item.append(title, control);
    return item;
  }));
  const current = controlsTourState.steps[controlsTourState.stepIndex];
  $("controlsTourInstruction").textContent = current?.instruction || "Controls check complete.";
  $("closeControlsTourBtn").classList.toggle("hidden", controlsTourState.mode === "required");
}

function setRequiredControlsTourLock(locked) {
  applyRequiredControlsTourLock({
    required: locked,
    bodyClassList: document.body.classList,
    backgroundTargets: [lobbyScreen, $("gameMenu")],
  });
}

function resetMiniTourOfferControls() {
  $("startControlsMiniTourBtn").disabled = false;
  $("startControlsMiniTourBtn").textContent = "Practice";
  $("dismissControlsMiniTourBtn").setAttribute("aria-label", "Dismiss controls practice");
}

function queueControlsTourPractice(queued) {
  queuedControlsTour = queued;
  miniTourFamily = null;
  $("controlsMiniTourText").textContent = `${controlsFamilyLabel(queued.family)} practice queued for the next safe break. Live play continues.`;
  $("startControlsMiniTourBtn").disabled = true;
  $("startControlsMiniTourBtn").textContent = "Queued";
  $("dismissControlsMiniTourBtn").setAttribute("aria-label", "Cancel queued controls practice");
  $("controlsMiniTourOffer").classList.remove("hidden");
}

function requestOptionalControlsTour({ family = inputMode, mode: tourMode = "mini" } = {}) {
  const decision = planOptionalControlsTour({ family, mode: tourMode, phase });
  if (decision.action === "queue") {
    queueControlsTourPractice(decision.queued);
    return;
  }
  startControlsTour({ family: decision.queued.family, mode: decision.queued.mode });
}

function startQueuedControlsTourWhenSafe() {
  const decision = releaseQueuedControlsTour({ queued: queuedControlsTour, phase, tourActive: Boolean(controlsTourState) });
  if (decision.action !== "start") return;
  queuedControlsTour = null;
  resetMiniTourOfferControls();
  $("controlsMiniTourOffer").classList.add("hidden");
  startControlsTour({ family: decision.family, mode: decision.mode });
}

function startControlsTour({ family = inputMode, mode: tourMode = "required" } = {}) {
  controlsTourState = createControlsTour({ family, seenFamilies: controlsTourSeenFamilies(), mode: tourMode });
  miniTourFamily = null;
  queuedControlsTour = null;
  resetMiniTourOfferControls();
  $("controlsMiniTourOffer").classList.add("hidden");
  ui.settings.classList.add("hidden");
  $("controlsTourModal").classList.remove("hidden");
  document.body.classList.remove("menu-active");
  document.body.classList.add("controls-tour-active");
  setRequiredControlsTourLock(tourMode === "required");
  firing = false;
  touch.fire = false;
  clearKeyboardInput();
  renderControlsTour();
}

function closeControlsTour() {
  if (controlsTourState?.mode === "required") return;
  controlsTourState = null;
  $("controlsTourModal").classList.add("hidden");
  document.body.classList.remove("controls-tour-active");
  setRequiredControlsTourLock(false);
  restoreVisibleMenuSection();
}

function completeControlsTour() {
  const completed = controlsTourState;
  if (!completed || completed.status !== "complete") return;
  controlsTourState = null;
  $("controlsTourModal").classList.add("hidden");
  document.body.classList.remove("controls-tour-active");
  setRequiredControlsTourLock(false);
  persistControlsTourCompletion(completed.seenFamilies);
  if (completed.mode === "required") continuePendingMatchStart();
  else restoreVisibleMenuSection();
}

function handleControlsTourSignal(signal) {
  if (!controlsTourState || controlsTourState.status !== "active") return false;
  const next = recordControlsTourSignal(controlsTourState, signal);
  if (next !== controlsTourState) {
    controlsTourState = next;
    renderControlsTour();
    if (controlsTourState.status === "complete") completeControlsTour();
  }
  return true;
}

function offerControlsMiniTour(family) {
  const matchActive = phase === "countdown" || phase === "combat" || phase === "prep";
  if (offeredMiniTourFamilies.has(family) || !shouldOfferControlsMiniTour({
    family,
    seenFamilies: controlsTourSeenFamilies(),
    matchActive,
    tourActive: Boolean(controlsTourState),
  })) return;
  offeredMiniTourFamilies.add(family);
  miniTourFamily = family;
  resetMiniTourOfferControls();
  $("controlsMiniTourText").textContent = `${controlsFamilyLabel(family)} detected. Practice now or keep playing.`;
  $("controlsMiniTourOffer").classList.remove("hidden");
}

function continuePendingMatchStart() {
  const resolution = resolvePendingMatchSelection(pendingMatchGate, {
    family: inputMode,
    seenFamilies: controlsTourSeenFamilies(),
  });
  pendingMatchGate = resolution.gate;
  if (resolution.action === "tour") {
    startControlsTour({ family: resolution.family, mode: "required" });
    return;
  }
  if (resolution.action === "start") queueMicrotask(resolution.selection);
  else restoreVisibleMenuSection();
}

async function requestMatchStart(startMatch) {
  await controlsPreferencesPromise.catch(() => []);
  if (controlsTourState?.mode === "required" || pendingMatchGate.pending) return;
  if (phase !== "menu" && phase !== "loadout") {
    startMatch();
    return;
  }
  pendingMatchGate = queuePendingMatchSelection(pendingMatchGate, startMatch);
  continuePendingMatchStart();
}

async function claimDeviceLink() {
  const message = $("linkProfileMessage");
  const phoneNumber = $("linkPhone").value;
  const pin = $("linkLocalPin").value.trim();
  if (!normalizePhoneNumber(phoneNumber) || !validPin(pin)) {
    message.textContent = "Enter the linked mobile number and a new four-digit PIN.";
    return;
  }
  const digest = await pinDigest(pin);
  const profile = { profileId: crypto.randomUUID(), youthAccount: false };
  if (await sendPhoneCode({ kind: "restore", phoneNumber, profile, pinDigest: digest })) $("linkLocalPin").value = "";
}

function showDeviceLinkStep() {
  hideProfileSteps();
  linkProfileStep.classList.remove("hidden");
  $("linkProfileMessage").textContent = "";
}

async function reportMatch(title) {
  if (!activeProfile?.backendPlayerId || offlineMode) return;
  try {
    const response = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeProfile.backendSession || ""}` },
      body: JSON.stringify({
        room: lobbyRoom(), mode, map: mapKey, status: "complete",
        players: [activeProfile.backendPlayerId], score: { score: Math.floor(score), blue: Math.floor(blue), red: Math.floor(red), result: title },
      }),
    });
    updateLobbyConnectivity({ type: response.ok ? "player-service-success" : "player-service-failure" });
  } catch {
    // Match reporting is retriable and never blocks the local result screen.
    updateLobbyConnectivity({ type: "player-service-failure" });
  }
}

function openLobby(contact) {
  lobbyConnectivity = reduceLobbyConnectivity(lobbyConnectivity, { type: "offline-changed", offlineMode });
  welcomeScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
  $("teamSizeChoices").classList.add("hidden");
  $("ctfPlayerChoices").classList.add("hidden");
  $("teamLobbyBtn").setAttribute("aria-expanded", "false");
  $("ctf6LobbyBtn").setAttribute("aria-expanded", "false");
  $("lobbyGameOptions").open = false;
  renderLobbyProfile(contact);
  refreshLobbyNavigation();
  setMenuSection("lobby");
  updateNetworkStatus();
  refreshLobbyAvailability();
  $("riskLevel").value = riskLevel;
  updateRiskPreview();
  syncPublicPlayer();
  controlsPreferencesPromise = syncControlsTourPreferences();
  initializeMenuBackdrop().then(updateMenuReplayStatus);
  startSceneMusic("menu");
}

function renderLobbyProfile(fallbackName = "Offline Guest") {
  const hasProgress = Boolean(activeProfile?.progress);
  const view = createLobbyProfileView({
    activeProfile: activeProfile || { name: fallbackName, avatarType: "scout" },
    progress: hasProgress ? { ...activeProfile.progress, totalXp, shieldLevel } : { totalXp: 0, shieldLevel: 0 },
    classProgress: hasProgress ? classProgress : { classId: avatarClass(activeProfile?.avatarType || "scout") },
    activeWeapon: hasProgress ? activeGun : "scout",
    weaponLevel: hasProgress ? guns[activeGun]?.level : 0,
    shieldLevel: hasProgress ? shieldLevel : 0,
    connectivity: { ...lobbyConnectivity, offlineMode },
  });

  lobbyPlayer.textContent = `${view.avatar.name} // ${view.classLabel}`;
  $("lobbyProfileName").textContent = view.displayName;
  $("lobbyPlayerTag").textContent = view.playerTag;
  $("lobbyLevel").textContent = view.level;
  $("lobbyXpText").textContent = view.xp.label;
  $("lobbyXpBar").style.width = `${view.xp.percentage}%`;
  $("lobbyClass").textContent = view.classLabel;
  $("lobbySkill").textContent = view.skillLabel;
  $("lobbyAbility").textContent = view.abilityLabel;
  $("lobbyWeapon").textContent = `${view.weapon.label} L${view.weapon.level}`;
  $("lobbyShield").textContent = view.shield.label;
  $("lobbyOnlineState").textContent = view.network.label;
  $("lobbyOnlineState").dataset.online = String(view.network.online);
  $("lobbyAvatarImage").src = view.avatar.image;
  $("lobbyAvatarImage").alt = view.avatar.name;
  ensureLobbyAvatarPreview(activeProfile?.avatarType || "scout");
  $("lobbyAvatarButton").setAttribute("aria-label", `Open ${view.displayName} loadout`);
  $("lobbyProfileReadout").setAttribute("aria-label", `Open ${view.displayName} profile and loadout`);
  $("verifiedPhoneStatus").textContent = activeProfile?.phoneHint
    ? `Linked privately to ${activeProfile.phoneHint}. Use that number to restore this Player Tag on another device.`
    : activeProfile?.youthAccount
      ? "Parent controls are stored only on this device."
      : "Verify a mobile number to restore this Player Tag on another device.";
  $("openPhoneAccountBtn").disabled = Boolean(activeProfile?.youthAccount);
}

function openConnections() {
  setMenuSection("friends");
  ui.settings.classList.remove("hidden");
  $("networkStatus").scrollIntoView?.({ block: "center" });
  $("offlineToggle").focus({ preventScroll: true });
}

function restoreVisibleMenuSection() {
  if (!lobbyScreen.classList.contains("hidden")) setMenuSection("lobby");
  else if (!welcomeScreen.classList.contains("hidden")) setMenuSection(editingProfile ? "survivor" : "home");
}

function openSettings() {
  setMenuSection("settings");
  ui.settings.classList.remove("hidden");
  if (inputMode === "controller") $("controlsTourReplayBtn").focus({ preventScroll: true });
}

function closeSettings() {
  ui.settings.classList.add("hidden");
  restoreVisibleMenuSection();
}

async function refreshLobbyAvailability() {
  const onlineButton = $("onlineSurvivalBtn");
  const multiplayerButton = $("teamLobbyBtn");
  onlineButton.classList.add("hidden");
  multiplayerButton.classList.remove("hidden");
  multiplayerButton.disabled = offlineMode || !activeProfile;
  refreshLobbyNavigation();
}

function editActiveProfile() {
  if (!activeProfile) return;
  editingProfile = true;
  lobbyScreen.classList.add("hidden");
  welcomeScreen.classList.remove("hidden");
  setMenuSection("survivor");
  profileStep.classList.remove("hidden");
  returnStep.classList.add("hidden");
  linkProfileStep.classList.add("hidden");
  phoneCodeStep.classList.add("hidden");
  profileName.value = activeProfile.name || "";
  profileBirthDate.value = activeProfile.birthDate || "";
  profilePhone.value = "";
  profileAvatar.value = activeProfile.avatarType || "scout";
  updateAvatarCards();
  ageConfirm.checked = true;
  profilePin.value = "";
  profilePhone.closest("label").classList.add("hidden");
  profilePin.closest("label").classList.add("hidden");
  parentPhone.closest("label").classList.toggle("hidden", Boolean(activeProfile.youthAccount));
  parentSetup.classList.toggle("hidden", !activeProfile.youthAccount);
  parentPin.value = "";
  $("enterWastlandBtn").textContent = "Save Profile";
  $("guestOfflineBtn").classList.add("hidden");
  profileMessage.textContent = "Update your name or avatar, then save.";
}

function savedProfiles() {
  let profiles = [];
  let legacy = null;
  try {
    const stored = JSON.parse(localStorage.getItem("wastland-survivor-profiles") || "[]");
    profiles = Array.isArray(stored) ? stored : [];
  } catch {
    profiles = [];
  }
  try {
    legacy = JSON.parse(localStorage.getItem("wastland-survivor-profile") || "null");
  } catch {
    legacy = null;
  }
  const source = profiles.length ? profiles : legacy ? [legacy] : [];
  const sanitizedSource = source.map(sanitizeLocalProfile);
  const privacyChanged = JSON.stringify(source) !== JSON.stringify(sanitizedSource);
  const backfill = backfillProfileIdentities(sanitizedSource, () => crypto.randomUUID());
  if (privacyChanged || backfill.changed || (!profiles.length && backfill.profiles.length)) {
    localStorage.setItem("wastland-survivor-profiles", JSON.stringify(backfill.profiles));
    const currentId = typeof legacy?.profileId === "string" ? legacy.profileId : "";
    const current = backfill.profiles.find(profile => profile.profileId === currentId) || backfill.profiles.at(-1);
    if (current) localStorage.setItem("wastland-survivor-profile", JSON.stringify(current));
  }
  return backfill.profiles;
}

function saveProfile(profile = activeProfile) {
  if (!profile) return;
  const stableProfile = ensureProfileIdentity(sanitizeLocalProfile(profile), () => crypto.randomUUID());
  Object.assign(profile, stableProfile);
  const profiles = savedProfiles().filter(item => item.profileId !== stableProfile.profileId);
  profiles.push(stableProfile);
  localStorage.setItem("wastland-survivor-profiles", JSON.stringify(profiles));
  localStorage.setItem("wastland-survivor-profile", JSON.stringify(stableProfile));
}

function saveProgress() {
  if (!activeProfile || activeProfile.youthAccount) return;
  activeProfile.progress = { wave, score, kills, scrap, gold, silver, survivalSeconds, questState, shieldLevel, playerLevel, totalXp, storyStage, missionIndex, kingdomUnlocked, completedMissions: Array.isArray(activeProfile.progress?.completedMissions) ? activeProfile.progress.completedMissions : [], classProgress, unlockedMaps: unlockedMaps(playerLevel), timelineAdvantages: timelineAdvantages.slice(0, Math.min(timelineAdvantages.length, storyStage)), guns: Object.fromEntries(Object.entries(guns).map(([key, gun]) => [key, gun.level])), rewards: activeProfile.progress?.rewards || { winStreak: 0, lifetimeRewards: 0 } };
  saveProfile();
}

function loadProgress(profile) {
  const progress = profile?.progress;
  if (!progress) return;
  wave = Math.max(1, Number(progress.wave) || 1);
  score = Math.max(0, Number(progress.score) || 0);
  kills = Math.max(0, Number(progress.kills) || 0);
  scrap = Math.max(0, Number(progress.scrap) || 0);
  gold = Math.max(0, Number(progress.gold) || 0);
  silver = Math.max(0, Number(progress.silver) || 0);
  survivalSeconds = Math.max(0, Number(progress.survivalSeconds) || 0);
  questState = createQuestState(progress.questState);
  shieldLevel = Math.max(0, Number(progress.shieldLevel) || 0);
  playerLevel = Math.max(1, Number(progress.playerLevel) || 1);
  totalXp = Math.max(0, Number(progress.totalXp) || (Number(progress.kills) || 0) * 100 + (Number(progress.score) || 0));
  storyStage = Math.max(1, Number(progress.storyStage) || 1);
  missionIndex = Math.max(0, Math.min(1, Number(progress.missionIndex) || 0));
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
    if (scrap >= 60 || kills >= 10 || storyStage >= 3) missionIndex = 1;
  }
  const discoveryCount = worldLayout && player ? explorationProgress(worldLayout, explorationState).discovered : 0;
  const questResult = advanceQuestState(questState, {
    survivedSeconds: Math.floor(survivalSeconds),
    scrap,
    kills,
    stage: storyStage,
    discoveries: discoveryCount,
  });
  questState = questResult.state;
  refreshQuestBeacon();
  if (questResult.completed) {
    gold += questResult.reward.gold;
    silver += questResult.reward.silver;
    totalXp += questResult.reward.xp;
    playerLevel = Math.max(1, levelFromXp(totalXp));
    // A completed field quest is also a completed authored campaign mission.
    // Keep the chapter timeline and the quest tracker on the same durable
    // progression path instead of advancing only the transient HUD text.
    const completedMissionId = questResult.quest.missionId;
    if (completedMissionId && activeProfile) {
      activeProfile.progress = activeProfile.progress || {};
      const priorMissions = Array.isArray(activeProfile.progress.completedMissions)
        ? activeProfile.progress.completedMissions
        : [];
      activeProfile.progress.completedMissions = [...new Set([...priorMissions, completedMissionId])];
      missionIndex = Math.min(1, missionIndex + 1);
    }
    ui.discoveryTitle.textContent = `QUEST COMPLETE: ${questResult.quest.title}`;
    ui.discoveryReward.innerHTML = `+${questResult.reward.xp} XP / <span class="reward-chip"><img src="assets/nightfall/icons/scrap-gold-v1.svg" alt="" aria-hidden="true">+${questResult.reward.gold} GOLD</span> / <span class="reward-chip"><img src="assets/nightfall/icons/scrap-silver-v1.svg" alt="" aria-hidden="true">+${questResult.reward.silver} SILVER</span>`;
    ui.discoveryToast.classList.remove("hidden");
    discoveryToastUntil = performance.now() + 4200;
    document.dispatchEvent(new CustomEvent("wasteland:quest-complete", { detail: { quest: questResult.quest, reward: questResult.reward } }));
  }
}

function avatarLabel(type) { return ({ scout: "Dust Scout", ranger: "Ranger", heavy: "Heavy", tech: "Tech Runner", medic: "Field Medic", warden: "Warden" })[type] || "Dust Scout"; }

function openDashboard() {
  const profile = activeProfile || { name: "Offline Guest", avatarType: "scout", progress: {} };
  const progress = profile.progress || {};
  $("dashboardName").textContent = profile.name || "Survivor";
  $("dashboardAvatar").textContent = avatarLabel(profile.avatarType);
  $("dashboardKingdom").textContent = progress.kingdomUnlocked ? "Kingdom Unlocked" : "Frontier Camp";
  $("dashboardLevel").textContent = progress.playerLevel || 1;
  $("dashboardXp").textContent = `${progress.totalXp || 0} XP`;
  $("dashboardStage").textContent = progress.storyStage || 1;
  $("dashboardScrap").textContent = progress.scrap || 0;
  $("dashboardGold").textContent = progress.gold || 0;
  $("dashboardSilver").textContent = progress.silver || 0;
  const campaign = storyCampaignView({ stage: progress.storyStage || 1, missionIndex: progress.missionIndex || 0, kingdomUnlocked: Boolean(progress.kingdomUnlocked) });
  $("dashboardMission").textContent = `${campaign.missionTitle}: ${campaign.objective}`;
  $("dashboardLoadout").innerHTML = Object.entries(guns).map(([key, gun]) => `<div><b>${gun.label}</b><small>Level ${progress.guns?.[key] || 0}/${gun.max === Infinity ? "∞" : gun.max}</small></div>`).join("") + `<div><b>Scrap Shield</b><small>Level ${progress.shieldLevel || 0}/10</small></div>`;
  $("dashboardTactics").innerHTML = ["Aim Stabilizer", "Quick Recovery", "Scavenger Pack", "Flag Runner"].map((name, index) => `<div><b>${name}</b><small>${(progress.storyStage || 1) > index ? "Unlocked" : "Stage " + (index + 1)}</small></div>`).join("");
  setMenuSection("survivor");
  $("dashboardModal").classList.remove("hidden");
}

async function enterProfile() {
  const name = profileName.value.trim();
  const birthDate = profileBirthDate.value;
  const age = ageFromBirthDate(birthDate);
  const phoneNumber = profilePhone.value;
  const pin = profilePin.value.trim();
  const parentPhoneNumber = parentPhone.value;
  const parentLocalPin = parentPin.value.trim();
  if (!name) {
    profileMessage.textContent = "Enter a player name.";
    return;
  }
  if (age === null) {
    profileMessage.textContent = "This birth date could not be verified. Parent controls will stay available until it is verified.";
    parentSetup.classList.remove("hidden");
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
  if (editingProfile && activeProfile) {
    if (activeProfile.youthAccount) {
      if (!validPin(parentLocalPin) || await pinDigest(parentLocalPin) !== activeProfile.parentPinDigest) {
        profileMessage.textContent = "Enter the parent PIN to edit this youth profile.";
        parentSetup.classList.remove("hidden");
        return;
      }
    }
    activeProfile.name = name;
    activeProfile.avatarType = profileAvatar.value;
    saveProfile();
    editingProfile = false;
    $("enterWastlandBtn").textContent = "Enter Wasteland";
    $("guestOfflineBtn").classList.remove("hidden");
    profilePin.value = "";
    profilePhone.closest("label").classList.remove("hidden");
    profilePin.closest("label").classList.remove("hidden");
    parentPhone.closest("label").classList.remove("hidden");
    parentPin.value = "";
    parentSetup.classList.add("hidden");
    profileMessage.textContent = "Profile saved.";
    openLobby(name);
    return;
  }
  if (youthAccount && (!normalizePhoneNumber(parentPhoneNumber) || !validPin(parentLocalPin))) {
    profileMessage.textContent = "A parent mobile number and separate four-digit parent PIN are required for players under 14.";
    parentSetup.classList.remove("hidden");
    return;
  }
  if (!youthAccount && !normalizePhoneNumber(phoneNumber)) {
    profileMessage.textContent = "Enter a valid mobile number for secure account recovery.";
    return;
  }
  const digest = await pinDigest(pin);
  const parentPinDigest = youthAccount ? await pinDigest(parentLocalPin) : "";
  const profile = sanitizeLocalProfile({
    profileId: crypto.randomUUID(),
    name,
    birthDate,
    age,
    avatarType: profileAvatar.value,
    parentPhoneHint: youthAccount ? maskPhoneNumber(parentPhoneNumber) : "",
    parentPinDigest,
    youthAccount,
    pinDigest: digest,
    deviceId: deviceId(),
    ageVerifiedAt: new Date().toISOString(),
    progress: null,
  });
  profilePin.value = "";
  parentPin.value = "";
  parentPhone.value = "";
  if (youthAccount) {
    saveProfile(profile);
    guestControlsIdentityActive = false;
    activeProfile = profile;
    offlineMode = true;
    localStorage.setItem("wastland-survivor-offline", "true");
    openLobby(name);
    return;
  }
  await sendPhoneCode({ kind: "create", phoneNumber, profile, pinDigest: digest });
}

function returnProfile() {
  const profiles = savedProfiles();
  const saved = profiles.find(profile => profile.profileId === profileSelector.value) || profiles[0];
  const pin = returnPin.value.trim();
  if (!saved || !validPin(pin)) {
    returnMessage.textContent = "Enter the four-digit PIN for this profile.";
    return;
  }
  const previousAttempts = localPinAttempts.get(saved.profileId) || beginLocalPinAttempts(saved.profileId);
  if (previousAttempts.lockedUntil > Date.now()) {
    returnMessage.textContent = `Too many attempts. Try again in ${Math.ceil((previousAttempts.lockedUntil - Date.now()) / 1000)} seconds.`;
    return;
  }
  pinDigest(pin).then(digest => {
    const matched = digest === saved.pinDigest;
    const nextAttempts = recordLocalPinAttempt(previousAttempts, matched);
    localPinAttempts.set(saved.profileId, nextAttempts);
    if (!matched) {
      returnMessage.textContent = nextAttempts.lockedUntil ? "Too many attempts. This local profile is locked for 30 seconds." : "That PIN did not match this profile.";
      return;
    }
    returnPin.value = "";
    guestControlsIdentityActive = false;
    activeProfile = saved;
    loadProgress(saved);
    youthAccount = Boolean(saved.youthAccount);
    if (youthAccount) {
      offlineMode = true;
      localStorage.setItem("wastland-survivor-offline", "true");
    }
    openLobby(saved.name || "Survivor");
  });
}

function showProfileChoice() {
  const profiles = savedProfiles();
  updateAvatarCards(profileAvatar.value || "scout");
  profileMessage.textContent = "";
  returnMessage.textContent = "";
  profileSelector.replaceChildren(...profiles.map(profile => new Option(`${profile.name} · ${profile.birthDate || profile.phoneHint || "local profile"}`, profile.profileId)));
  linkProfileStep.classList.add("hidden");
  phoneCodeStep.classList.add("hidden");
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
  profilePhone.closest("label").classList.remove("hidden");
  profilePin.closest("label").classList.remove("hidden");
  parentPhone.closest("label").classList.remove("hidden");
  parentSetup.classList.add("hidden");
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
  pendingMatchGate = cancelPendingMatchSelection(pendingMatchGate);
  stopMusic();
  lobbyScreen.classList.add("hidden");
  welcomeScreen.classList.remove("hidden");
  setMenuSection("home");
  showProfileChoice();
}

function enterGuestOffline() {
  offlineMode = true;
  youthAccount = false;
  guestControlsIdentityActive = true;
  localStorage.setItem("wastland-survivor-offline", "true");
  const guestName = "Offline Guest";
  openLobby(guestName);
}

function bindTouchStick(id, prefix) {
  const element = $(id);
  const knob = element.querySelector("i");
  let pointerId = null;
  const release = event => {
    if (event && pointerId !== null && event.pointerId !== pointerId) return;
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
    handleControlsTourSignal({ source: "touch-stick", control: prefix === "m" ? "move" : "aim", magnitude: cap / 38 });
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
  element.addEventListener("lostpointercapture", release);
  element.addEventListener("pointerleave", event => {
    if (!element.hasPointerCapture?.(event.pointerId)) release(event);
  });
  touchStickReleases.push(release);
  return element;
}

function setVoiceStatus(status) { ui.voiceStatus.textContent = status; }

function updateVoiceButtons() {
  const joined = Boolean(localStream);
  ui.joinVoice.classList.toggle("hidden", joined);
  ui.muteVoice.classList.toggle("hidden", !joined);
  ui.leaveVoice.classList.toggle("hidden", !joined);
  ui.muteVoice.textContent = voiceMuted ? "Unmute" : "Mute";
}

function voiceRoom() {
  return createLobbyRoomId({ map: mapKey, mode, teamSize: botTeamSize, ctfPlayers });
}

function lobbyRoom() {
  return createLobbyRoomId({ map: mapKey, mode, teamSize: botTeamSize, ctfPlayers });
}

function closeLobbyRoom() {
  if (lobbySocket) {
    lobbySocket.onclose = null;
    lobbySocket.close();
    lobbySocket = null;
  }
  updateLobbyConnectivity({ type: "lobby-socket-closed" });
  lobbyId = null;
  lobbyRoomName = null;
  lobbyPeers = 0;
}

function ensureLobbyRoom() {
  const roomName = lobbyRoom();
  if (awaitingRematch && lobbyRoomName === roomName
    && (lobbySocket?.readyState === WebSocket.OPEN || lobbySocket?.readyState === WebSocket.CONNECTING)) {
    updateNetworkStatus("Rematch room open: waiting for Ready");
    return;
  }
  closeLobbyRoom();
  if (offlineMode || mode === "solo") {
    updateNetworkStatus();
    return;
  }
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  lobbyRoomName = roomName;
  lobbySocket = new WebSocket(`${protocol}://${location.host}/signal`);
  lobbySocket.onopen = () => {
    updateLobbyConnectivity({ type: "lobby-socket-open" });
    lobbySocket.send(JSON.stringify({ type: "join", room: roomName }));
  };
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
      } else if (["match-ready", "match-reset", "match-waiting"].includes(message.type)) {
        applyMatchLifecycleMessage(message);
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
  lobbySocket.onerror = () => {
    updateLobbyConnectivity({ type: "lobby-socket-closed" });
    updateNetworkStatus("Lobby connection issue");
  };
  lobbySocket.onclose = () => {
    updateLobbyConnectivity({ type: "lobby-socket-closed" });
    lobbySocket = null;
    lobbyId = null;
    lobbyRoomName = null;
    if (mode === "teams") applyMatchLifecycleMessage({ type: "match-reset", reason: "connection-lost" });
    else updateNetworkStatus();
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
  activeMatchPlan = null;
  awaitingRematch = false;
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
  menuOpenedFromPrep = phase === "prep";
  menuOpen = true;
  const liveMatch = mode === "teams" || mode === "ctf";
  phase = liveMatch ? "combat" : "paused";
  graceUntil = 0;
  $("gameMenu").classList.remove("hidden");
  $("graceStatus").classList.add("hidden");
  $("menuMatchStatus").textContent = liveMatch ? "LIVE MATCH CONTINUES" : "MATCH PAUSED";
  $("openShopBtn").disabled = !menuOpenedFromPrep;
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
  pendingMatchGate = cancelPendingMatchSelection(pendingMatchGate);
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
  markMenuReplayRefresh();
  setMenuSection("lobby");
  openLobby(activeProfile?.name || "Offline Guest");
}

function reducedMotionEnabled() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyMenuPresentation(section = menuSection, focusedCommand = null) {
  const presentation = resolveMenuPresentation({
    section,
    focusedCommand,
    tier: effectiveGraphicsTier(),
    reducedMotion: reducedMotionEnabled(),
  });
  menuSection = presentation.section;
  document.body.dataset.menuSection = presentation.section;
  document.body.dataset.menuTier = presentation.tier;
  document.body.dataset.reducedMotion = String(presentation.reducedMotion);
  document.body.style.setProperty("--command-buoyancy", `${presentation.surface.buoyancyPx}px`);
  document.body.style.setProperty("--command-loop-duration", `${presentation.surface.loopDurationMs}ms`);
  document.body.style.setProperty("--command-ripple-opacity", String(presentation.surface.rippleOpacity));
  document.body.style.setProperty("--command-vapor-opacity", String(presentation.surface.vaporOpacity));
  document.body.style.setProperty("--command-vapor-duration", `${presentation.surface.vaporDriftDurationMs}ms`);
  document.body.style.setProperty("--command-disturbance", String(presentation.surface.localDisturbance));
  document.body.style.setProperty("--command-focus-forward", `${presentation.focus.selectedForwardPx}px`);
  document.body.style.setProperty("--command-focus-light", String(presentation.focus.selectedIllumination));
  setNightfallPresentation(presentation);
  return presentation;
}

function setMenuSection(section) {
  const currentCommand = lobbyNavigator?.current();
  const focused = section === "lobby" && currentCommand?.input !== "programmatic"
    ? currentCommand?.id || null
    : null;
  const presentation = applyMenuPresentation(section, focused);
  const menuActive = document.body.classList.contains("menu-active");
  setNightfallScene(menuActive ? "menu" : "game");
  const replayRefreshPending = menuMediaLifecycle.replayRefreshPending();
  if (menuActive && !replayRefreshPending && homeBackdrop.dataset.mediaKind && homeBackdrop.dataset.mediaKind !== "fallback") {
    homeBackdrop.play().catch(() => retainNightfallFallback("autoplay-failed"));
  }
  return presentation;
}

function retainNightfallFallback(reason = "unavailable") {
  document.body.classList.remove("hero-video-active");
  nightfallBackground.classList.add("nightfall-media-hold");
  homeBackdrop.classList.remove("is-ready");
  homeBackdrop.pause();
  homeBackdrop.dataset.mediaKind = "fallback";
  homeBackdrop.dataset.mediaReason = reason;
  return "fallback";
}

function holdNightfallFallback(reason = "loading") {
  nightfallBackground.classList.add("nightfall-media-hold");
  homeBackdrop.classList.remove("is-ready");
  homeBackdrop.pause();
  homeBackdrop.dataset.mediaReason = reason;
}

function revealMenuBackdrop(kind) {
  const homeVideoRequested = !welcomeScreen.classList.contains("hidden");
  const policy = resolveMenuMedia({
    tier: effectiveGraphicsTier(),
    reducedMotion: reducedMotionEnabled(),
    heroVideo: homeVideoRequested,
    saveData: Boolean(navigator.connection?.saveData),
    playbackState: "playing",
  });
  if (policy.kind === "fallback" && !homeVideoRequested) return retainNightfallFallback("capability-policy");
  document.body.classList.toggle("hero-video-active", homeVideoRequested);
  homeBackdrop.dataset.mediaKind = kind;
  delete homeBackdrop.dataset.mediaReason;
  delete homeBackdrop.dataset.mediaCandidate;
  homeBackdrop.classList.add("is-ready");
  nightfallBackground.classList.remove("nightfall-media-hold");
  return kind;
}

async function resumeMenuBackdrop(kind) {
  homeBackdrop.dataset.mediaCandidate = kind;
  try {
    await homeBackdrop.play();
    return revealMenuBackdrop(kind);
  } catch {
    return null;
  }
}

function resumeHomeBackdropFromGesture() {
  if (welcomeScreen.classList.contains("hidden") || !homeBackdrop.paused) return;
  homeBackdrop.dataset.mediaCandidate = "bundled";
  homeBackdrop.play()
    .then(() => revealMenuBackdrop("bundled"))
    .catch(() => {});
}

function resumeBundledMusicFromGesture() {
  const homeScreenVisible = phase === "menu" && lobbyScreen.classList.contains("hidden");
  if (!musicEnabled || homeScreenVisible || !["menu", "countdown", "combat", "prep"].includes(phase)) return;
  if (musicSource === "bundled" && bundledMusic.paused) playBundledMusic(currentBundledMusicPhase());
  else if (musicSource === "local" && localMusic.paused) playLocalTrack();
  else if (musicSource === "builtin") { wakeAudio(); startBuiltInMusic(); }
}

async function tryMenuBackdrop(kind, configure) {
  homeBackdrop.classList.remove("is-ready");
  homeBackdrop.dataset.mediaCandidate = kind;
  try {
    if (configure) configure();
    await homeBackdrop.play();
    return revealMenuBackdrop(kind);
  } catch {
    homeBackdrop.classList.remove("is-ready");
    return null;
  }
}

function markMenuReplayRefresh({ recheckVisible = false } = {}) {
  menuMediaLifecycle.markReplayRefresh();
  if (recheckVisible && document.body.classList.contains("menu-active")) {
    return initializeMenuBackdrop().then(updateMenuReplayStatus);
  }
  return Promise.resolve(null);
}

async function initializeMenuBackdrop({ force = false } = {}) {
  const homeVideoRequested = !welcomeScreen.classList.contains("hidden");
  const policy = resolveMenuMedia({
    tier: effectiveGraphicsTier(),
    reducedMotion: reducedMotionEnabled(),
    heroVideo: homeVideoRequested,
    saveData: Boolean(navigator.connection?.saveData),
    playbackState: "loading",
  });
  if (policy.kind === "fallback") return retainNightfallFallback("capability-policy");
  const result = await menuMediaLifecycle.selectOnEntry({
    force,
  }, {
    currentKind: () => homeBackdrop.dataset.mediaKind,
    isVisible: () => document.body.classList.contains("menu-active"),
    showFallback: reason => holdNightfallFallback(reason),
    resumeCurrent: kind => resumeMenuBackdrop(kind),
    playReplay: async () => {
      homeBackdrop.dataset.mediaCandidate = "replay";
      const playing = await playRandomReplay(homeBackdrop);
      return playing ? Boolean(revealMenuBackdrop("replay")) : false;
    },
    playLegacyReplay: async () => {
      const legacyReplay = localStorage.getItem("wastland-survivor-last-replay");
      if (!legacyReplay) return false;
      return Boolean(await tryMenuBackdrop("replay", () => { homeBackdrop.src = legacyReplay; }));
    },
    playBundled: async () => {
      const bundledPolicy = resolveMenuMedia({
        tier: effectiveGraphicsTier(),
        heroVideo: homeVideoRequested,
        replayFailed: true,
        playbackState: "loading",
      });
      if (bundledPolicy.kind !== "bundled") return false;
      return Boolean(await tryMenuBackdrop("bundled", () => {
        homeBackdrop.removeAttribute("src");
        homeBackdrop.load();
      }));
    },
  });
  return result.kind === "fallback"
    ? retainNightfallFallback("autoplay-or-decode-failed")
    : result.kind;
}

function updateMenuReplayStatus(kind) {
  $("replayStatus").textContent = kind === "replay"
    ? "Playing a recent match clip saved on this device."
    : kind === "bundled"
      ? "Cinematic water-walk loop active. Recent match clips take priority when available."
      : "Nightfall fallback active for this device or motion preference.";
  return kind;
}

function pauseMenuBackdrop() {
  document.body.classList.remove("hero-video-active");
  nightfallBackground.classList.remove("nightfall-media-hold");
  homeBackdrop.pause();
}

async function initializeNightfallBackground() {
  let manifest = null;
  try {
    const response = await fetch("./assets/nightfall/manifest.json", { cache: "no-store" });
    if (response.ok) manifest = await response.json();
  } catch {
    // CSS fallback keeps the menu readable when optional artwork is unavailable.
  }
  const presentation = resolveMenuPresentation({
    section: menuSection,
    tier: effectiveGraphicsTier(),
    reducedMotion: reducedMotionEnabled(),
  });
  createNightfallBackground(nightfallBackground, {
    manifest,
    reducedMotion: reducedMotionEnabled(),
    tier: effectiveGraphicsTier(),
    scene: phase === "countdown" ? "countdown" : phase === "menu" ? "menu" : "game",
    presentation,
  });
  applyMenuPresentation(menuSection);
}

function effectiveGraphicsTier() {
  return selectGraphicsTier({
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    reducedMotion: reducedMotionEnabled(),
    savedTier: graphicsTierOverride === "auto" ? undefined : graphicsTierOverride,
  });
}

function applyGraphicsTier() {
  const tier = effectiveGraphicsTier();
  setNightfallTier(tier);
  applyMenuPresentation(menuSection, lobbyNavigator?.current().id || null);
  if (document.body.classList.contains("menu-active")) initializeMenuBackdrop({ force: true });
  else pauseMenuBackdrop();
  applyRendererTier(tier);
}

function applyRendererTier(tier = effectiveGraphicsTier()) {
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
  weaponPresentationState = createWeaponPresentationState(gunName);
  if (player?.g?.userData?.authoredCharacter) attachAuthoredWeapon(player.g, gunName);
  updateArmory();
}

addEventListener("resize", resize);
addEventListener("blur", () => interruptLocalInput("window-blur"));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") interruptLocalInput("document-hidden");
});
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    canvasPointerLocked = true;
    pointerResumeRequired = false;
    updateInputRecoveryNotice();
    return;
  }
  if (!canvasPointerLocked) return;
  canvasPointerLocked = false;
  interruptLocalInput("pointer-lock-lost");
});
document.addEventListener("pointerlockerror", () => interruptLocalInput("pointer-lock-lost"));
canvas.addEventListener("pointerleave", () => {
  if (document.pointerLockElement !== canvas) interruptLocalInput("canvas-exit");
});
canvas.addEventListener("lostpointercapture", () => interruptLocalInput("pointer-capture-lost"));
canvas.addEventListener("pointercancel", () => interruptLocalInput("pointer-capture-lost"));
canvas.addEventListener("webglcontextlost", event => {
  event.preventDefault();
  rendererContextLost = true;
  interruptLocalInput("webgl-context-lost");
});
canvas.addEventListener("webglcontextrestored", () => {
  rendererContextLost = false;
  clearTransientGameplayInput("webgl-context-lost");
  applyRendererTier();
  updateInputRecoveryNotice();
});
addEventListener("gamepadconnected", () => updateControllerState(true));
addEventListener("gamepaddisconnected", () => updateControllerState(false));
addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  if (controlsTourState?.status === "active") {
    setInputMode("keyboard");
    handleControlsTourSignal({ source: "keyboard", kind: "down", key: event.key });
    event.preventDefault();
    return;
  }
  if (event.key === "Escape") {
    if (!ui.settings.classList.contains("hidden")) { closeSettings(); return; }
    if (!$("dashboardModal").classList.contains("hidden")) { $("dashboardModal").classList.add("hidden"); restoreVisibleMenuSection(); return; }
    if (!ui.shop.classList.contains("hidden")) { ui.shop.classList.add("hidden"); restoreVisibleMenuSection(); return; }
  }
  if (controllerLocked() || phase === "countdown") return;
  if (!lobbyScreen.classList.contains("hidden")) {
    const activeElement = document.activeElement;
    const navigationFocused = Boolean(activeElement?.matches?.("[data-lobby-control]"));
    const selectFocused = activeElement?.tagName === "SELECT";
    const nativeControlFocused = Boolean(activeElement !== document.body
      && activeElement !== document.documentElement
      && activeElement?.matches('a[href], button, input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])'));
    const action = resolveMenuKeyAction(event.key, { navigationFocused, nativeControlFocused, selectFocused });

    if (action) {
      event.preventDefault();
      setInputMode("keyboard");
      if (navigationFocused) {
        focusLobbyCommand(activeElement.id, "keyboard");
      }
      if (action.type === "move") moveLobbyFocus(action.direction, "keyboard");
      if (action.type === "activate") activateLobbyCommand();
      return;
    }

    if (nativeControlFocused || key === "tab") return;
  }
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
  if (key === "escape") { menuOpen ? closeGameMenu() : openGameMenu(); return; }
  if (localGameplayInputPaused()) return;
  if (key === "r") reloadWeapon(true);
  if (key === "q") cycleWeapon(1);
  if (key === "e") interact();
  if (key === "f") triggerAbility();
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
  if (controlsTourState?.status === "active") {
    if (event.pointerType === "mouse") setInputMode("mouse");
    handleControlsTourSignal({ source: "pointer", kind: "move", movementX: event.movementX, movementY: event.movementY });
    return;
  }
  mouseAimScreen.x = THREE.MathUtils.clamp(event.clientX, 0, innerWidth);
  mouseAimScreen.y = THREE.MathUtils.clamp(event.clientY, 0, innerHeight);
  if (event.pointerType === "mouse") {
    setInputMode("mouse");
    if (localGameplayInputPaused()) return;
    if (frontView && phase === "combat" && !menuOpen) {
      // A rightward screen-space mouse movement turns the camera right. The
      // camera-space sign is locked in control-direction-lock.mjs; keep this
      // path separate from camera-relative WASD movement.
      viewYaw = nextMouseYaw({ yaw: viewYaw, movementX: event.movementX, sensitivity: adsActive ? aimSettings.adsSensitivity : aimSettings.sensitivity });
      aim.copy(player.g.position).add(new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw)).multiplyScalar(35));
    }
  }
  pointer.set(mouseAimScreen.x / innerWidth * 2 - 1, -(mouseAimScreen.y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(ground)[0];
  if (hit) aim.copy(hit.point);
});
canvas.addEventListener("pointerdown", event => {
  if (controllerLocked() || phase === "countdown") return;
  const pointerHandoff = applyCanvasPointerHandoff(event, {
    inputMode,
    pointerResumeRequired,
    setInputMode,
  });
  if (controlsTourState?.status === "active") {
    handleControlsTourSignal({ source: "pointer", kind: "down", button: event.button });
    return;
  }
  if (pointerHandoff.consumesCanvasAction) {
    wakeAudio();
    return;
  }
  const resumingPointer = pointerResumeRequired && event.pointerType === "mouse";
  if (resumingPointer) {
    pointerResumeRequired = false;
    updateInputRecoveryNotice();
  }
  wakeAudio();
  if (resumingPointer || localGameplayInputPaused()) return;
  if (phase !== "combat" || menuOpen || event.button !== 0 || event.isPrimary === false) return;
  firing = true;
});
addEventListener("pointerup", () => { firing = false; });

const moveStick = bindTouchStick("moveStick", "m");
const aimStick = bindTouchStick("aimStick", "a");

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
  return button;
}

const touchFireButton = bindHoldButton("touchFireBtn", active => {
  if (active && handleControlsTourSignal({ source: "touch-button", control: "fire" })) return;
  touch.fire = active;
});
const touchAdsButton = bindHoldButton("touchAdsBtn", active => { adsActive = active; });
bindTransientPointerInterrupts({
  targets: [moveStick, aimStick, touchFireButton, touchAdsButton],
  interrupt: interruptLocalInput,
});
$("touchReloadBtn").onclick = () => { setInputMode("touch"); reloadWeapon(true); };
$("touchWeaponBtn").onclick = () => { setInputMode("touch"); cycleWeapon(1); };
$("touchInteractBtn").onclick = () => { setInputMode("touch"); interact(); };
$("touchAbilityBtn").onclick = () => { setInputMode("touch"); if (!handleControlsTourSignal({ source: "touch-button", control: "ability" })) triggerAbility(); };
$("touchPauseBtn").onclick = () => { setInputMode("touch"); if (!handleControlsTourSignal({ source: "touch-button", control: "pause" })) menuOpen ? closeGameMenu() : openGameMenu(); };
$("soloMode").onclick = () => requestMatchStart(() => { document.body.classList.remove("menu-active"); mode = "solo"; $("soloMode").classList.add("active"); $("teamMode").classList.remove("active"); $("ctfMode").classList.remove("active"); $("ctfPlayerControl").classList.add("hidden"); lobbyChanged(); start(); });
$("teamMode").onclick = () => requestMatchStart(() => { document.body.classList.remove("menu-active"); mode = "teams"; $("teamMode").classList.add("active"); $("soloMode").classList.remove("active"); $("ctfMode").classList.remove("active"); $("ctfPlayerControl").classList.add("hidden"); lobbyChanged(); start(); });
$("ctfMode").onclick = () => requestMatchStart(() => { document.body.classList.remove("menu-active"); mode = "ctf"; $("ctfMode").classList.add("active"); $("soloMode").classList.remove("active"); $("teamMode").classList.remove("active"); $("ctfPlayerControl").classList.remove("hidden"); lobbyChanged(); start(); });
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
    closeGameMenu();
    lobbyChanged();
    start();
  };
});
$("openShopBtn").onclick = () => {
  if (menuOpenedFromPrep) {
    phase = "prep";
    closeGameMenu();
    interact();
  }
};
$("openChestBtn").onclick = interact;
$("closeShopBtn").onclick = () => {
  ui.shop.classList.add("hidden");
  restoreVisibleMenuSection();
  if (chestAccessGranted && lobbySocket?.readyState === WebSocket.OPEN) lobbySocket.send(JSON.stringify({ type: "chest-leave" }));
  chestAccessGranted = false;
};
$("loadoutArmoryBtn").onclick = () => { setMenuSection("armory"); ui.shop.classList.remove("hidden"); };
$("loadoutReadyBtn").onclick = () => {
  ui.shop.classList.add("hidden");
  if (mode === "teams" && !offlineMode) {
    if (lobbySocket?.readyState === WebSocket.OPEN) {
      updateNetworkStatus(awaitingRematch ? "Ready. Waiting for every player..." : "Starting match and filling open seats...");
      lobbySocket.send(JSON.stringify({ type: "start-match" }));
    } else {
      updateNetworkStatus("Waiting for the multiplayer room...");
    }
    return;
  }
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
$("settingsBtn").onclick = openSettings;
$("lobbySettingsBtn").onclick = openSettings;
$("lobbyConnectionsBtn").onclick = openConnections;
$("menuSettingsBtn").onclick = openSettings;
$("closeSettingsBtn").onclick = closeSettings;
$("controlsTourReplayBtn").onclick = () => requestOptionalControlsTour({ family: inputMode, mode: "replay" });
$("closeControlsTourBtn").onclick = closeControlsTour;
$("startControlsMiniTourBtn").onclick = () => requestOptionalControlsTour({ family: miniTourFamily || inputMode, mode: "mini" });
$("dismissControlsMiniTourBtn").onclick = () => {
  miniTourFamily = null;
  queuedControlsTour = cancelQueuedControlsTour(queuedControlsTour);
  resetMiniTourOfferControls();
  $("controlsMiniTourOffer").classList.add("hidden");
};
$("menuToggle").onclick = () => menuOpen ? closeGameMenu() : openGameMenu();
$("resumeGameBtn").onclick = closeGameMenu;
$("frontViewBtn").onclick = () => { frontView = !frontView; $("frontViewBtn").textContent = frontView ? "Arena View" : "First Person"; };
$("exitGameBtn").onclick = exitToLobby;
$("mobileMenuSelect").onchange = event => {
  if (event.target.value === "resume") closeGameMenu();
  if (event.target.value === "settings") openSettings();
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
  else if (musicSource === "bundled") playBundledMusic();
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
  else if (musicSource === "bundled" && musicEnabled) playBundledMusic();
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
  } else if (musicSource === "bundled") {
    if (bundledMusic.paused) playBundledMusic();
    else { bundledMusic.pause(); $("playMusicBtn").textContent = "Play"; }
  } else if (localMusic.paused) playLocalTrack();
  else { localMusic.pause(); $("playMusicBtn").textContent = "Play"; }
};
$('previousTrackBtn').onclick = () => musicSource === "bundled" ? playBundledMusic(currentBundledMusicPhase(), { chooseNext: true }) : playLocalTrack(localTrackIndex - 1);
$("nextTrackBtn").onclick = () => musicSource === "bundled" ? playBundledMusic(currentBundledMusicPhase(), { chooseNext: true }) : playLocalTrack(localTrackIndex + 1);
$("shuffleMusicBtn").onclick = () => musicSource === "bundled" ? playBundledMusic(currentBundledMusicPhase(), { chooseNext: true }) : playLocalTrack(Math.floor(Math.random() * Math.max(1, localTracks.length)));
localMusic.onended = () => playLocalTrack(localTrackIndex + 1);
bundledMusic.onended = () => playBundledMusic(currentBundledMusicPhase(), { chooseNext: true });
ui.joinVoice.onclick = joinVoice;
ui.leaveVoice.onclick = () => closeVoice("Mic is off");
ui.muteVoice.onclick = () => { voiceMuted = !voiceMuted; localStream?.getAudioTracks().forEach(track => { track.enabled = !voiceMuted; }); updateVoiceButtons(); setVoiceStatus(voiceMuted ? "Voice muted" : "Voice connected"); };
ui.offline.onchange = () => {
  offlineMode = ui.offline.checked;
  localStorage.setItem("wastland-survivor-offline", String(offlineMode));
  updateLobbyConnectivity({ type: "offline-changed", offlineMode });
  updateNetworkStatus();
  if (offlineMode) closeLobbyRoom();
  else {
    syncPublicPlayer();
    ensureLobbyRoom();
  }
};
$("enterWastlandBtn").onclick = enterProfile;
$("guestOfflineBtn").onclick = enterGuestOffline;
$("showLinkProfileBtn").onclick = showDeviceLinkStep;
$("showLinkProfileNewBtn").onclick = showDeviceLinkStep;
$("linkProfileBackBtn").onclick = initializeProfileScreen;
$("claimLinkBtn").onclick = claimDeviceLink;
$("phoneCodeBackBtn").onclick = cancelPhoneVerification;
$("confirmPhoneCodeBtn").onclick = confirmPhoneCode;
$("resendPhoneCodeBtn").onclick = resendPhoneCode;
$("openPhoneAccountBtn").onclick = () => {
  $("verifiedPhoneStatus").textContent = activeProfile?.phoneHint
    ? `Linked privately to ${activeProfile.phoneHint}. On another device, choose Restore Linked Player.`
    : "Return to the profile screen and choose Restore Linked Player after verification.";
};
document.querySelectorAll(".avatar-choice").forEach(card => card.onclick = () => {
  profileAvatar.value = card.dataset.avatar;
  updateAvatarCards(card.dataset.avatar);
});
profileAvatar.onchange = () => updateAvatarCards();
profileBirthDate.addEventListener("input", () => {
  const age = ageFromBirthDate(profileBirthDate.value);
  parentSetup.classList.toggle("hidden", !(age > 0 && age < 14));
});
[profilePin, returnPin, parentPin, $("linkLocalPin")].forEach(input => {
  ["copy", "cut", "paste", "contextmenu"].forEach(eventName => input.addEventListener(eventName, event => event.preventDefault()));
});
setInterval(() => {
  if (!phoneChallenge) return;
  updatePhoneResendControl();
  if (phoneChallenge.status === "code-sent" && Date.now() > phoneChallenge.expiresAt) {
    phoneChallenge = failPhoneChallenge(phoneChallenge, phoneChallenge.expiresAt + 1);
    $("phoneCodeMessage").textContent = "This code expired. Go back and request a new one.";
  }
}, 1000);
$("returnWastlandBtn").onclick = returnProfile;
$("storyGuestBtn").onclick = () => {
  offlineMode = true;
  guestControlsIdentityActive = !activeProfile;
  localStorage.setItem("wastland-survivor-offline", "true");
  openLobby(activeProfile?.name || "Offline Story Player");
};
$("newProfileBtn").onclick = () => {
  localStorage.removeItem("wastland-survivor-profile");
  showProfileChoice();
};
$("signOutProfileBtn").onclick = leaveLobby;
$("editProfileBtn").onclick = editActiveProfile;
$("dashboardBtn").onclick = openDashboard;
$("lobbyAvatarButton").onclick = openDashboard;
$("lobbyProfileReadout").onclick = openDashboard;
$("closeDashboardBtn").onclick = () => { $("dashboardModal").classList.add("hidden"); restoreVisibleMenuSection(); };
$("lobbyBackBtn").onclick = () => {
  stopMusic();
  lobbyScreen.classList.add("hidden");
  welcomeScreen.classList.remove("hidden");
  setMenuSection("home");
  initializeProfileScreen();
};
$("profileBackBtn").onclick = () => {
  if (editingProfile) {
    editingProfile = false;
    welcomeScreen.classList.add("hidden");
    lobbyScreen.classList.remove("hidden");
    setMenuSection("lobby");
    return;
  }
  initializeProfileScreen();
};
$("dashboardEditBtn").onclick = () => { $("dashboardModal").classList.add("hidden"); editActiveProfile(); };
$("dashboardStoreBtn").onclick = () => { $("dashboardModal").classList.add("hidden"); if (phase === "prep") { setMenuSection("armory"); ui.shop.classList.remove("hidden"); } else openDashboard(); };
$("survivalLobbyBtn").onclick = () => { lobbyScreen.classList.add("hidden"); $("soloMode").click(); };
$("teamLobbyBtn").onclick = () => {
  const choices = $("teamSizeChoices");
  const expanded = choices.classList.toggle("hidden") === false;
  $("ctfPlayerChoices").classList.add("hidden");
  $("ctf6LobbyBtn").setAttribute("aria-expanded", "false");
  $("teamLobbyBtn").setAttribute("aria-expanded", String(expanded));
  refreshLobbyNavigation(expanded ? "teamSize2Btn" : "teamLobbyBtn");
  if (expanded) renderLobbyNavigation(true);
};
document.querySelectorAll("[data-team-size]").forEach(button => {
  button.onclick = () => {
    botTeamSize = normalizeTeamSize(button.dataset.teamSize);
    $("botTeamSize").value = String(botTeamSize);
    lobbyScreen.classList.add("hidden");
    $("teamMode").click();
  };
});
$("onlineSurvivalBtn").onclick = () => $("teamLobbyBtn").click();
$("botTeamSize").onchange = event => {
  botTeamSize = normalizeTeamSize(event.target.value);
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
  const choices = $("ctfPlayerChoices");
  const expanded = choices.classList.toggle("hidden") === false;
  $("teamSizeChoices").classList.add("hidden");
  $("teamLobbyBtn").setAttribute("aria-expanded", "false");
  $("ctf6LobbyBtn").setAttribute("aria-expanded", String(expanded));
  refreshLobbyNavigation(expanded ? "ctf4PlayersLobbyBtn" : "ctf6LobbyBtn");
  if (expanded) renderLobbyNavigation(true);
};
document.querySelectorAll("[data-lobby-ctf-players]").forEach(button => {
  button.onclick = () => {
    ctfPlayers = Number(button.dataset.lobbyCtfPlayers) === 6 ? 6 : 4;
    document.querySelectorAll("[data-ctf-players]").forEach(item => item.classList.toggle("active", Number(item.dataset.ctfPlayers) === ctfPlayers));
    lobbyScreen.classList.add("hidden");
    $("ctfMode").click();
  };
});

bindLobbyNavigation();

homeBackdrop.addEventListener("playing", () => {
  revealMenuBackdrop(homeBackdrop.dataset.mediaCandidate || homeBackdrop.dataset.mediaKind || "bundled");
});
homeBackdrop.addEventListener("error", () => retainNightfallFallback("decode-failed"));
homeBackdrop.addEventListener("stalled", () => retainNightfallFallback("stalled"));
document.addEventListener("pointerdown", resumeHomeBackdropFromGesture, { passive: true });
document.addEventListener("keydown", resumeHomeBackdropFromGesture);
document.addEventListener("pointerdown", resumeBundledMusicFromGesture, { passive: true });
document.addEventListener("keydown", resumeBundledMusicFromGesture);
matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => {
  applyMenuPresentation(menuSection, lobbyNavigator?.current().id || null);
  if (document.body.classList.contains("menu-active")) initializeMenuBackdrop({ force: true });
  else pauseMenuBackdrop();
});

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
showProfileChoice();
initializeNightfallBackground().then(() => {
  setMenuSection("home");
  initializeMenuBackdrop();
});
render();
