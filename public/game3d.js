import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { aimPresetForDifficulty, normalizeAimSettings, resolveInputMode, shouldAutoLock, shouldDuckMusic } from "./game-rules.mjs";
import { selectGraphicsTier } from "./graphics-config.mjs";
import { shouldProcessRenderFrame } from "./graphics-lod-rules.mjs";
import { canCaptureGameplayPointer, resolveRendererMetrics, resolveTransientInputReset } from "./input-recovery.mjs";
import { applyCanvasPointerHandoff, bindTransientPointerInterrupts } from "./input-recovery-adapter.mjs";
import { advanceControllerLook, cameraDirectionFromView, chooseGamepad, sampleGamepad } from "./controller-rules.mjs";
import { advanceVirtualMouseLook, centerVirtualMouseLook, mouseLookRates, virtualMouseLookFromPoint } from "./mouse-look-rules.mjs";
import { createNightfallBackground, setNightfallPresentation, setNightfallScene, setNightfallTier } from "./nightfall-background.mjs";
import { createMenuMediaLifecycle } from "./menu-media-lifecycle.mjs";
import { resolveMenuMedia, resolveMenuPresentation } from "./menu-presentation.mjs";
import {
  applyRequiredControlsTourLock,
  captureControlsTourPreferenceIdentity,
  syncControlsTourPreferencesForIdentity,
} from "./controls-tour-adapter.mjs";
import {
  acknowledgeControlsTour,
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
import { resolveShieldUpgrade } from "./armory-rules.mjs";
import { composeWave, enemyCombatProfile, predictAimPoint, scaleEnemy, spawnSchedule, tacticalIntent } from "./enemy-rules.mjs";
import { getWeaponProfile } from "./combat-rules.mjs";
import { kingdomUnlocked as hasKingdom, levelFromXp, unlockedMaps } from "./progression-rules.mjs";
import {
  buildStorySnapshot,
  canSaveAndExitStory,
  deriveStoryCampaignState,
  mergeStorySnapshot,
  validateStorySnapshot,
} from "./story-session-rules.mjs";
import { captureGameplayClip, playRandomReplay } from "./replay-clips.mjs";
import { RISK_PROFILES, rewardPreview, settleMatch } from "./reward-rules.mjs";
import { canAccessChest, createChestPositions, seededRandom } from "./chest-rules.mjs";
import { createExplorationState, evaluateExploration, explorationProgress } from "./exploration-rules.mjs";
import { biomeAt, createConnectedWorldLayout, createTerrainGrid, createWorldScatter, resolveWorldMovement, sampleWorldElevation } from "./world-layout.mjs";
import { createHudViewModel } from "./hud-view-model.mjs";
import { createWeaponModel, createWeaponPoseController } from "./weapon-models.mjs";
import { CHARACTER_ARCHETYPE_IDS, createCharacterModel, createPoseController } from "./character-models.mjs";
import { createEnemyModel } from "./enemy-models.mjs";
import { createEnvironmentModel, sampleArenaPlacements } from "./environment-models.mjs";
import { normalizeTouchStick, resolveAndroidSingleStick, shouldAutoFireFromTouch } from "./touch-control-rules.mjs";
import { decideAndroidTouchAutoFire } from "./mobile-auto-fire-rules.mjs";
import { gameOverActionModel, nextGameOverActionIndex } from "./game-over-rules.mjs";
import {
  WEAPON_PRESENTATION_PROFILES,
  advanceWeaponPresentation,
  beginWeaponReload,
  createWeaponPresentationState,
  triggerWeaponShot,
} from "./weapon-presentation.mjs";
import {
  LOBBY_CONTROL_ORDER,
  createMenuNavigator,
  describeLobbyControl,
  nextLobbySelectIndex,
  resolveLobbyControllerAction,
  resolveMenuStickNavigation,
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
// The static preview uses 8100 while the local account and room service uses 8080.
const serviceOrigin = location.hostname === "localhost" && location.port === "8100" ? "http://localhost:8080" : "";
const serviceUrl = path => `${serviceOrigin}${path}`;
const task4StorageKey = suffix => ["wastland", "survivor", suffix].join("-");
const storySnapshotKey = (profile = activeProfile) => task4StorageKey(`story-session-${profile?.profileId || "offline-guest"}`);
const canvas = $("game");
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
const heldWeapon = new THREE.Group();
const heldWeaponFlash = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffdf72, transparent: true, opacity: 0 }));
const heldWeaponSmoke = [];
const heldWeaponShells = [];
let heldWeaponRecoil = 0;
let heldWeaponBob = 0;
let heldWeaponModel = null;
let heldWeaponPoseController = null;
let heldWeaponPresentation = createWeaponPresentationState("scout");
let reloadStartedAt = 0;
let reloadDurationMs = 0;
const heldWeaponModelIds = { scout: "compact-smg", cannon: "riot-shotgun", inferno: "coil-carbine" };

function createHeldWeapon(gunName = "scout") {
  while (heldWeapon.children.length) heldWeapon.remove(heldWeapon.children[0]);
  const presentation = WEAPON_PRESENTATION_PROFILES[gunName] || WEAPON_PRESENTATION_PROFILES.scout;
  heldWeaponModel = createWeaponModel(THREE, presentation.modelId || heldWeaponModelIds[gunName] || "compact-smg");
  heldWeaponPoseController = createWeaponPoseController(heldWeaponModel);
  heldWeaponPresentation = createWeaponPresentationState(gunName);
  heldWeaponFlash.position.set(.28, -.2, -1.58);
  heldWeaponFlash.scale.set(.8, .8, 1.7);
  heldWeapon.add(heldWeaponModel.root, heldWeaponFlash);
  heldWeapon.position.set(.02, -.18, -.72);
  heldWeapon.visible = false;
}
createHeldWeapon("scout");
camera.add(heldWeapon);
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const ui = {
  hp: $("hpText"), hpBar: $("hpBar"), shield: $("shieldText"), shieldBar: $("shieldBar"), heat: $("heatText"), heatBar: $("heatBar"),
  ammo: $("ammoText"), ability: $("abilityText"), abilityBar: $("abilityBar"), team: $("teamText"), teamName: $("teamName"), teamHealth: $("teamHealthText"), teamHealthBar: $("teamHealthBar"), objective: $("objectiveText"),
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
const phoneCodeStep = $("phoneCodeStep");
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
const bundledMusic = $("bundledMusic");
const nightfallBackground = $("nightfallBackground");
const isAndroidApp = /WastelandSurvivorAndroid\//.test(navigator.userAgent);
document.body.classList.toggle("android-app", isAndroidApp);
const menuMediaLifecycle = createMenuMediaLifecycle();
const MAPS = {
  wasteland: { label: "Wasteland", texture: "assets/wasteland-ground-v1.png", fog: 0x554331, hazard: 0x83ff47 },
  toxic: { label: "Toxic Ponds", texture: "assets/wasteland-ground-v1.png", fog: 0x344a2d, hazard: 0x93ff30 },
  ice: { label: "Icy Mountain", texture: "assets/icy-mountain-ground-v1.png", fog: 0xc3d9e7, hazard: 0x4dbbff },
  inferno: { label: "Fire Inferno", texture: "assets/fire-inferno-ground-v1.png", fog: 0x351510, hazard: 0xff5a24 }
};
const ARENA_PRESET_BY_MAP = Object.freeze({ wasteland: "wasteland", toxic: "toxic-pond", ice: "icy-mountain", inferno: "fiery-inferno" });

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
let lobbyNavigator = null;
let menuSection = "home";
let menuOpenedFromPrep = false;
let countdown = 15;
let countdownDeadline = 0;
let graceUntil = 0;
let frontView = true;
let ground, player, ally;
let chests = [];
let chestSpawnRadius = 70;
let allies = [], enemies = [], bullets = [], hazards = [], flags = [], effects = [];
let mapBlockers = [];
let mapBoundaryRects = [];
let activeMapBounds = { radius: 90, width: 180, depth: 180 };
const observedPlayerVelocity = new THREE.Vector3();
const previousPlayerPosition = new THREE.Vector3();
let cameraShake = 0;
let score = 0, kills = 0, scrap = 0, wave = 1, blue = 0, red = 0, shieldLevel = 0;
let playerLevel = 1, storyStage = 1, missionIndex = 0, kingdomUnlocked = false;
let storyCheckpoint = null;
let pendingStoryResume = null;
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
const survivorArchetype = (value, fallbackIndex = 0) => CHARACTER_ARCHETYPE_IDS.includes(value)
  ? value
  : CHARACTER_ARCHETYPE_IDS[((fallbackIndex % CHARACTER_ARCHETYPE_IDS.length) + CHARACTER_ARCHETYPE_IDS.length) % CHARACTER_ARCHETYPE_IDS.length];
function slotSurvivorArchetype(slot, fallbackIndex = 0) {
  return survivorArchetype(slot?.archetypeId || slot?.avatarType || slot?.classId, fallbackIndex);
}
function enemySurvivorArchetype(type, index = 0) {
  return ({
    rusher: "scout",
    shooter: "ranger",
    sniper: "ranger",
    shield: "warden",
    heavy: "heavy",
    drone: "tech",
    mutant: "medic",
    boss: "warden",
  })[type] || survivorArchetype(null, index + 2);
}
let replayCaptureActive = false;
let firing = false;
let adsActive = false;
let aim = new THREE.Vector3(0, 0, 1);
let lastButtons = [];
let controllerConnected = false;
let activeGamepadIndex = null;
let viewPitch = 0;
let controllerOnly = localStorage.getItem("wastland-survivor-controller-only") === "true";
let audioEnabled = localStorage.getItem("wastland-survivor-audio") !== "off";
let audioVolume = Number(localStorage.getItem("wastland-survivor-volume") || 55);
let musicEnabled = localStorage.getItem("wastland-survivor-music") !== "off";
let musicVolume = Number(localStorage.getItem("wastland-survivor-music-volume") || 36);
let musicSource = localStorage.getItem("wastland-survivor-music-source") || "builtin";
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
let lobbyStickDirection = null;
let loadoutStickDirection = null;
let shopControllerIndex = 0;
let shopStickDirection = null;
let gameOverControllerIndex = 0;
let gameOverStickDirection = null;
const localPinAttempts = new Map();
let audioContext = null;
let localTracks = [];
let localTrackIndex = 0;
const localMusic = new Audio();
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
const touch = { mx: 0, mz: 0, ax: 0, az: 0, fire: false, aiming: false };
const touchStickReleases = [];
const keys = {};
const coarsePointer = matchMedia("(pointer: coarse)");
const finePointer = matchMedia("(pointer: fine)");
let mouseInputActive = false;
let inputMode = "mouse";
let viewYaw = 0;
const mouseAimScreen = { x: innerWidth / 2, y: innerHeight / 2 };
let lockedTarget = null;
let virtualMouseLook = centerVirtualMouseLook();
let graphicsTierOverride = localStorage.getItem(task4StorageKey("graphics-tier")) || "auto";
let termsAcceptedUntil = 0;
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
let mobileHeat = 0;
let mobileOverheatedUntil = 0;
const mobilePhoneSession = () => inputMode === "touch" && coarsePointer.matches && (isAndroidApp || document.fullscreenElement || innerWidth <= 700);
const mobileHeatPerShot = { scout: 13, cannon: 22, inferno: 18 };
let reloadUntil = 0;
let worldLayout = createConnectedWorldLayout();
let explorationState = createExplorationState();
let discoveryToastUntil = 0;

function setInputMode(nextMode) {
  const previousFamily = normalizeControlsFamily(inputMode);
  inputMode = nextMode;
  mouseInputActive = nextMode === "mouse";
  if (nextMode !== "mouse") virtualMouseLook = centerVirtualMouseLook();
  if (nextMode !== "mouse" && pointerResumeRequired) {
    pointerResumeRequired = false;
    updateInputRecoveryNotice();
  }
  if (nextMode !== "mouse" && document.pointerLockElement === canvas) document.exitPointerLock?.();
  document.body.dataset.inputMode = nextMode;
  $("touchControls")?.setAttribute("aria-hidden", String(nextMode !== "touch"));
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
  if (controller.ability) { $("lobbyBackBtn").click(); return; }
  const stick = resolveMenuStickNavigation({ x: controller.mx, y: controller.mz }, lobbyStickDirection);
  lobbyStickDirection = stick.heldDirection;
  const navigationController = { ...controller };
  if (stick.direction) navigationController[`dpad${stick.direction[0].toUpperCase()}${stick.direction.slice(1)}`] = true;
  const active = $(lobbyNavigator?.current().id);
  const action = resolveLobbyControllerAction(navigationController, describeLobbyControl(active));
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

function unit(color, x, z, avatarType = "scout", enemyType = null) {
  const group = new THREE.Group();
  const archetypeId = survivorArchetype(avatarType);
  const model = enemyType ? createEnemyModel(THREE, enemyType) : createCharacterModel(THREE, archetypeId);
  model.root.rotation.y = Math.PI;
  model.root.scale.multiplyScalar(1.12);
  if (!enemyType) model.root.traverse(node => {
    if (!node.material?.color || !color) return;
    node.material.color.lerp(new THREE.Color(color), .12);
  });
  group.add(model.root);
  group.position.set(x, 0, z);
  world.add(group);
  return { g: group, hp: 100, maxHp: 100, shield: 0,
    shieldMax: 0,
    cooldown: 0,
    alive: true,
    orbitAngle: Math.random() * Math.PI * 2,
    orbitDirection: Math.random() > .5 ? 1 : -1,
    archetypeId,
    visualModel: model,
    visualController: createPoseController(model.controllerModel || model),
    visualSpeed: 0,
    visualFire: 0,
    visualLastPosition: new THREE.Vector3(x, 0, z),
  };
}

function reviveUnitVisual(unit) {
  if (!unit) return;
  unit.visualController?.resetTerminalState?.();
  unit.visualLastPosition = unit.g?.position?.clone?.() || unit.visualLastPosition;
  unit.visualFire = 0;
  unit.visualSpeed = 0;
}

function updateUnitVisual(actor, dt) {
  if (!actor?.visualController || !actor?.g) return;
  const position = actor.g.position;
  const distance = position.distanceTo(actor.visualLastPosition || position);
  actor.visualLastPosition = position.clone();
  actor.visualSpeed = Math.min(1, distance / Math.max(dt, .001) / 6);
  actor.visualFire = Math.max(0, (actor.visualFire || 0) - dt * 6);
  const state = !actor.alive || actor.hp <= 0
    ? "downed"
    : actor.visualFire > .05
      ? "fire"
      : actor.visualSpeed > .72
        ? "run"
        : actor.visualSpeed > .08
          ? "walk"
          : "idle";
  actor.visualController.update(dt, {
    state,
    speed: actor.visualSpeed,
    aim: state === "fire" ? .9 : .15,
    fire: actor.visualFire,
    downed: state === "downed",
  });
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

function boundaryMaterial(feature) {
  const colors = {
    scrap: 0x5c5446,
    concrete: 0x6a6964,
    dust: 0x705838,
    industrial: 0x3f5652,
    toxic: 0x68ff42,
    ice: 0xbfefff,
    stone: 0x77818a,
    basalt: 0x201c1a,
    burned: 0x3b2a22,
    lava: 0xff5c24,
  };
  const emissive = feature.kind === "river" && (feature.palette === "toxic" || feature.palette === "lava") ? .55 : feature.kind === "river" ? .18 : .04;
  return material(colors[feature.palette] || 0x5c5446, emissive);
}

function createBoundaryFeature(feature) {
  const group = new THREE.Group();
  group.name = `boundary:${feature.type}`;
  group.position.set(feature.x, 0, feature.z);
  group.rotation.y = feature.rotation || 0;

  if (feature.kind === "river") {
    const river = new THREE.Mesh(new THREE.BoxGeometry(feature.width, feature.height, feature.depth), boundaryMaterial(feature));
    river.position.y = Math.max(.04, feature.height * .5);
    river.receiveShadow = true;
    group.add(river);
    const lipMaterial = material(feature.palette === "lava" ? 0x331711 : feature.palette === "toxic" ? 0x243a22 : 0x39464d, .08);
    for (const side of [-1, 1]) {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(.32, .42, feature.depth), lipMaterial);
      lip.position.set(side * feature.width * .5, .24, 0);
      lip.castShadow = true;
      group.add(lip);
    }
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(feature.width, feature.height, feature.depth), boundaryMaterial(feature));
    body.position.y = feature.height * .5;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    if (feature.kind === "building") {
      const cutout = new THREE.Mesh(new THREE.BoxGeometry(feature.width * .34, feature.height * .34, feature.depth + .08), material(0x111719, .12));
      cutout.position.set(feature.width * .18, feature.height * .55, 0);
      group.add(cutout);
    }
  }
  world.add(group);
  return group;
}

function createArenaObstacles(arena) {
  for (const obstacle of arena.obstacles) {
    const model = createEnvironmentModel(THREE, obstacle.type, { seed: obstacle.id });
    model.root.position.set(obstacle.x, 0, obstacle.z);
    model.root.rotation.y += obstacle.variant?.yaw || 0;
    world.add(model.root);
  }
  for (const feature of arena.boundaries) createBoundaryFeature(feature);
}

function pointInsideRotatedRect(position, rect, padding = .72) {
  const angle = -(rect.rotation || 0);
  const dx = position.x - rect.x;
  const dz = position.z - rect.z;
  const localX = dx * Math.cos(angle) - dz * Math.sin(angle);
  const localZ = dx * Math.sin(angle) + dz * Math.cos(angle);
  return Math.abs(localX) < rect.width * .5 + padding && Math.abs(localZ) < rect.depth * .5 + padding;
}

function resolvePlayerMapCollision(previousPosition) {
  const position = player.g.position;
  const halfWidth = activeMapBounds.width * .5 - 4;
  const halfDepth = activeMapBounds.depth * .5 - 4;
  position.x = THREE.MathUtils.clamp(position.x, -halfWidth, halfWidth);
  position.z = THREE.MathUtils.clamp(position.z, -halfDepth, halfDepth);
  if (mapBoundaryRects.some(rect => rect.blocksPlayers && pointInsideRotatedRect(position, rect))) {
    position.copy(previousPosition);
    return;
  }
  for (const blocker of mapBlockers) {
    const dx = position.x - blocker.x;
    const dz = position.z - blocker.z;
    const distance = Math.hypot(dx, dz);
    const minDistance = blocker.radius + .78;
    if (distance > 0 && distance < minDistance) {
      position.x = blocker.x + dx / distance * minDistance;
      position.z = blocker.z + dz / distance * minDistance;
    }
  }
}

function resetMap() {
  world.clear();
  worldLayout = createConnectedWorldLayout();
  hazards = [];
  enemies = [];
  bullets = [];
  effects = [];
  flags = [];
  mapBlockers = [];
  mapBoundaryRects = [];
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
  activeMapBounds = { radius: mapSize * .5, width: mapSize, depth: mapSize };
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
  observedPlayerVelocity.set(0, 0, 0);
  previousPlayerPosition.copy(player.g.position);
  allies = [];
  const botCount = mode === "solo" ? 0 : mode === "ctf" ? ctfPlayers / 2 - 1 : botTeamSize - 1;
  for (let index = 0; index < botCount; index++) {
    const bot = unit(0x3985ff, 2.5 + index * 2, 1.5, survivorArchetype(null, index + 1));
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

function spawnEnemy(index = enemies.length, requestedType = null, requestedArchetype = null) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 46 + Math.random() * 92;
  const type = requestedType || enemySpawnTypes.shift() || "rusher";
  const visualClass = survivorArchetype(requestedArchetype, CHARACTER_ARCHETYPE_IDS.indexOf(enemySurvivorArchetype(type, index)));
  const color = ({ rusher: 0xff5b55, shooter: 0xff8b45, sniper: 0xb97aff, shield: 0x4dbbff, heavy: 0xff3d3d, drone: 0x66fcf1, mutant: 0x8cff4d, boss: 0xffcf40 })[type];
  const enemy = unit(color, Math.cos(angle) * radius, Math.sin(angle) * radius, visualClass, type);
  applyWorldMovement(enemy);
  const scaled = scaleEnemy(type, { wave, difficulty: difficultyName(), playerSkill: playerLevel });
  enemy.enemyType = type;
  enemy.maxHp = scaled.health;
  enemy.hp = scaled.health;
  enemy.damage = scaled.damage;
  enemy.range = scaled.range;
  enemy.speed = scaled.speed;
  enemy.orbitRadius = radius;
  enemy.botIndex = enemies.length;
  enemy.combat = enemyCombatProfile(type, { wave, difficulty: difficultyName(), botIndex: enemy.botIndex });
  enemy.cooldown = enemy.combat.initialDelay;
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
      allies.push(unit(0x3985ff, 2.5 + allies.length * 2, 1.5, slotSurvivorArchetype(slot, allies.length + 1)));
    } else {
      spawnEnemy(enemies.length, "shooter", slotSurvivorArchetype(slot, enemies.length + 3));
    }
  }
  ally = allies[0] || null;
}

function start() {
  pauseMenuBackdrop();
  blue = red = score = kills = scrap = shieldLevel = 0;
  mobileHeat = 0;
  mobileOverheatedUntil = 0;
  wave = 1;
  activeGun = "scout";
  explorationState = createExplorationState();
  discoveryToastUntil = 0;
  ui.discoveryToast.classList.add("hidden");
  ui.over.classList.add("hidden");
  ui.shop.classList.add("hidden");
  Object.values(guns).forEach(gun => { gun.level = 0; });
  loadProgress(activeProfile);
  if (mode === "solo") {
    if (pendingStoryResume?.ok) applyStoryResume(pendingStoryResume);
    else applyStoryCampaignProgression();
    pendingStoryResume = null;
  }
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
  touch.fire = touch.aiming = false;
  clearKeyboardInput();
  if (countdownState.expired) {
    $("matchCountdown").classList.add("hidden");
    nextCombat();
    return;
  }
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
  if (mode === "solo") storyCheckpoint = createStoryCheckpoint();
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
  const actions = gameOverActionModel(mode);
  $("restartBtn").textContent = actions.restartLabel;
  $("endMatchBtn").textContent = actions.exitLabel;
  gameOverControllerIndex = 0;
  gameOverStickDirection = null;
  ui.over.classList.remove("hidden");
  $("restartBtn").focus({ preventScroll: true });
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
    if (mobilePhoneSession()) {
      if (Date.now() < mobileOverheatedUntil) return;
      if (mobileHeat >= 100) {
        mobileOverheatedUntil = Date.now() + 3000;
        return;
      }
      mobileHeat = Math.min(100, mobileHeat + (mobileHeatPerShot[activeGun] || 15));
    } else {
    if (Date.now() < reloadUntil) return;
    if (magazines[activeGun] <= 0) {
      reloadWeapon(false);
      return;
    }
    magazines[activeGun]--;
    }
  }
  const weapon = profile || weaponProfile();
  actor.cooldown = weapon.delay;
  const direction = target.clone().sub(actor.g.position);
  direction.y = 0;
  if (!direction.lengthSq()) return;
  direction.normalize();
  actor.g.rotation.y = Math.atan2(direction.x, direction.z);
  if (actor === player) {
    const shotPresentation = triggerWeaponShot(heldWeaponPresentation);
    heldWeaponPresentation = shotPresentation.state;
    if (shotPresentation.cue.type === "shot") ejectHeldWeaponShell();
  }
  actor.visualFire = 1;
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
  if (actor === player) {
    heldWeaponRecoil = Math.min(.18, heldWeaponRecoil + .095);
    heldWeaponFlash.material.opacity = 1;
    heldWeaponFlash.scale.set(1.15, 1.15, 2.4);
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 6), new THREE.MeshBasicMaterial({ color: 0x9ba9a2, transparent: true, opacity: .42 }));
    smoke.position.copy(heldWeaponFlash.position);
    heldWeapon.add(smoke);
    heldWeaponSmoke.push({ mesh: smoke, life: .24 });
  }
  if (actor === player) playTone(activeGun === "scout" ? 120 : 90, .04, "square", .035);
}

function reloadWeapon(manual = true) {
  if (Date.now() < reloadUntil || magazines[activeGun] >= magazineSizes[activeGun]) return;
  const reloadGun = activeGun;
  const duration = manual ? 900 : 1100;
  reloadStartedAt = Date.now();
  reloadDurationMs = duration;
  reloadUntil = reloadStartedAt + duration;
  heldWeaponPresentation = beginWeaponReload(heldWeaponPresentation).state;
  setTimeout(() => {
    magazines[reloadGun] = magazineSizes[reloadGun];
    playTone(420, .05, "triangle", .025);
  }, duration);
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

function ejectHeldWeaponShell() {
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(.018, .024, .095, 8), material(0xc8873e, .06));
  shell.position.copy(heldWeaponFlash.position).add(new THREE.Vector3(-.08, .02, .02));
  shell.rotation.z = Math.PI / 2;
  heldWeapon.add(shell);
  heldWeaponShells.push({
    mesh: shell,
    life: .82,
    velocity: new THREE.Vector3(.34, .42, .18),
    spin: 9,
  });
}

function hitEnemy(enemy, damage) {
  enemy.hp -= damage;
  burst(enemy.g.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffdf52, WEAPON_PRESENTATION_PROFILES[activeGun]?.impactSparkCount || 5);
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
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }
  target.hp -= remaining;
}

function updateControllerState(connected) {
  if (connected === controllerConnected) return;
  controllerConnected = connected;
  ui.controllerOnly.disabled = !connected;
  ui.controllerStatus.textContent = connected ? "Controller connected - move a stick to take control" : "No controller connected";
  if (!connected) {
    firing = false;
    lastButtons = [];
    activeGamepadIndex = null;
  }
  refreshInputMode();
}

function controllerLocked() { return controllerOnly && controllerConnected; }

function pollController() {
  const pad = chooseGamepad(navigator.getGamepads?.() || [], activeGamepadIndex);
  updateControllerState(Boolean(pad));
  const debug = new URLSearchParams(location.search).has("debug");
  if (!pad) {
    lastButtons = [];
    if (debug) {
      controllerDebug.classList.remove("hidden");
      $("debugPadName").textContent = "No controller detected - press an Xbox button";
      $("debugAxes").textContent = "LX 0.00 · LY 0.00 · RX 0.00 · RY 0.00";
      $("debugButtons").textContent = "Buttons: none";
      $("debugAction").textContent = "Action: waiting for browser connection";
    }
    return { mx: 0, mz: 0, ax: 0, az: 0, fire: false, ads: false, menuHeld: false, bHeld: false };
  }
  const sample = sampleGamepad(pad, lastButtons);
  lastButtons = sample.buttonLatch;
  if (sample.active) {
    activeGamepadIndex = sample.index;
    setInputMode("controller");
    ui.controllerStatus.textContent = `Controller active: ${sample.id}`;
  }
  const result = {
    mx: sample.move.x, mz: sample.move.y, ax: sample.look.x, az: sample.look.y,
    fire: sample.fire, ads: sample.ads,
    menuHeld: sample.menuHeld, bHeld: sample.bHeld,
    interact: sample.interact, ability: sample.ability, reload: sample.reload, weapon: sample.weapon,
    pause: sample.pause, switchTarget: sample.switchTarget,
    dpadUp: sample.dpadUp, dpadDown: sample.dpadDown, dpadLeft: sample.dpadLeft, dpadRight: sample.dpadRight,
  };
  if (debug) {
    controllerDebug.classList.remove("hidden");
    $("debugPadName").textContent = `${sample.id} · ${sample.mapping || "browser mapping"}`;
    $("debugAxes").textContent = `LX ${result.mx.toFixed(2)} · LY ${result.mz.toFixed(2)} · RX ${result.ax.toFixed(2)} · RY ${result.az.toFixed(2)}`;
    $("debugButtons").textContent = `Buttons: ${sample.buttonLatch.map((down, index) => down ? index : null).filter(index => index !== null).join(", ") || "none"}`;
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
  const stick = resolveMenuStickNavigation({ x: controller.mx, y: controller.mz }, loadoutStickDirection);
  loadoutStickDirection = stick.heldDirection;
  if (controller.dpadLeft || controller.dpadUp || stick.direction === "left" || stick.direction === "up") loadoutControllerIndex = 0;
  if (controller.dpadRight || controller.dpadDown || stick.direction === "right" || stick.direction === "down") loadoutControllerIndex = 1;
  controls[loadoutControllerIndex]?.focus({ preventScroll: true });
  if (controller.interact) controls[loadoutControllerIndex]?.click();
}

function handleShopController() {
  const controller = pollController();
  if (controller.ability || controller.pause) { $("closeShopBtn").click(); return; }
  const controls = [
    "equipScoutBtn", "upgradeScoutBtn", "equipCannonBtn", "upgradeCannonBtn",
    "equipInfernoBtn", "upgradeInfernoBtn", "upgradeShieldBtn", "closeShopBtn",
  ].map($).filter(control => control && !control.disabled);
  if (!controls.length) return;
  const stick = resolveMenuStickNavigation({ x: controller.mx, y: controller.mz }, shopStickDirection);
  shopStickDirection = stick.heldDirection;
  const previous = controller.dpadLeft || controller.dpadUp || stick.direction === "left" || stick.direction === "up";
  const next = controller.dpadRight || controller.dpadDown || stick.direction === "right" || stick.direction === "down";
  if (previous) shopControllerIndex = (shopControllerIndex - 1 + controls.length) % controls.length;
  if (next) shopControllerIndex = (shopControllerIndex + 1) % controls.length;
  shopControllerIndex = Math.min(shopControllerIndex, controls.length - 1);
  document.querySelectorAll("#shopModal .is-controller-selected").forEach(control => control.classList.remove("is-controller-selected"));
  controls[shopControllerIndex].classList.add("is-controller-selected");
  controls[shopControllerIndex].focus({ preventScroll: true });
  if (controller.interact) controls[shopControllerIndex].click();
}

function nearest(unit, candidates) {
  return candidates.filter(candidate => candidate.alive).sort((left, right) => left.g.position.distanceToSquared(unit.g.position) - right.g.position.distanceToSquared(unit.g.position))[0];
}

function gameOverActionButtons() {
  return [$("restartBtn"), $("endMatchBtn")].filter(control => control && !control.classList.contains("hidden"));
}

function handleGameOverController() {
  const controller = pollController();
  const controls = gameOverActionButtons();
  if (!controls.length) return;
  if (controller.ability) {
    $("endMatchBtn").click();
    return;
  }
  const stick = resolveMenuStickNavigation({ x: controller.mx, y: controller.mz }, gameOverStickDirection);
  gameOverStickDirection = stick.heldDirection;
  const previous = controller.dpadLeft || controller.dpadUp || stick.direction === "left" || stick.direction === "up";
  const next = controller.dpadRight || controller.dpadDown || stick.direction === "right" || stick.direction === "down";
  if (previous || next) gameOverControllerIndex = nextGameOverActionIndex(gameOverControllerIndex, next ? 1 : -1, controls.length);
  controls[gameOverControllerIndex]?.focus({ preventScroll: true });
  if (controller.interact) controls[gameOverControllerIndex]?.click();
}

function touchTargetInCrosshair() {
  if (!player || !enemies.length) return null;
  const view = cameraDirectionFromView({ yaw: viewYaw, pitch: viewPitch });
  const origin = player.g.position.clone().add(new THREE.Vector3(0, 1.55, 0));
  const direction = new THREE.Vector3(view.x, view.y, view.z).normalize();
  return enemies
    .filter(enemy => enemy.alive)
    .map(enemy => {
      const targetPoint = enemy.g.position.clone().add(new THREE.Vector3(0, 1.05, 0));
      const delta = targetPoint.sub(origin);
      const distance = delta.length() || 1;
      const angle = Math.acos(THREE.MathUtils.clamp(direction.dot(delta.normalize()), -1, 1));
      return { enemy, angle, distance };
    })
    .filter(candidate => candidate.angle <= .48)
    .sort((left, right) => left.angle - right.angle || left.distance - right.distance)[0]?.enemy || null;
}

function androidTouchTarget(preferredTarget = null, maxDistance = 36) {
  if (!player) return null;
  const inRange = enemy => enemy?.alive && enemy.g.position.distanceTo(player.g.position) <= maxDistance;
  if (inRange(preferredTarget)) return preferredTarget;
  if (inRange(lockedTarget)) return lockedTarget;
  return enemies
    .filter(inRange)
    .sort((left, right) => left.g.position.distanceToSquared(player.g.position) - right.g.position.distanceToSquared(player.g.position))[0] || null;
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
    if (!rival) continue;
    const flag = nearestFlag(enemy);
    const closeRival = rival && rival.g.position.distanceTo(enemy.g.position) < 13;
    const distance = moveBot(enemy, closeRival ? rival.g.position : flag.position, 4.2, dt);
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    const combat = enemy.combat || enemyCombatProfile(enemy.enemyType || "shooter", { wave, difficulty: difficultyName(), botIndex: enemy.botIndex });
    if (enemy.cooldown <= 0 && distance < combat.engagementRange) {
      const velocity = rival === player ? observedPlayerVelocity : new THREE.Vector3();
      const target = predictAimPoint({ target: rival.g.position, velocity, distance, accuracy: combat.accuracy });
      fire(enemy, new THREE.Vector3(target.x, target.y, target.z), { damage: enemy.damage || 10, delay: combat.fireInterval, shots: 1, pierce: 0, spread: combat.spreadRadians });
      enemy.cooldown = combat.fireInterval;
    }
    if (closeRival && distance < 1.6) applyDamage(rival, 16 * dt);
  }
}

function updateSoloEnemies(dt) {
  const pressure = Math.min(2.8, 1 + difficultyRatio * (wave - 1));
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
    const combat = enemy.combat || enemyCombatProfile(enemy.enemyType || "shooter", { wave, difficulty: difficultyName(), botIndex: enemy.botIndex });
    const predicted = predictAimPoint({ target: player.g.position, velocity: observedPlayerVelocity, distance, accuracy: combat.accuracy });
    const aimAt = new THREE.Vector3(predicted.x, predicted.y, predicted.z);
    enemy.g.rotation.y = Math.atan2(aimAt.x - enemy.g.position.x, aimAt.z - enemy.g.position.z);
    enemy.orbitAngle += orbitSpeed * dt * enemy.orbitDirection;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    if (enemy.cooldown <= 0 && distance < combat.engagementRange) {
      fire(enemy, aimAt, { damage: enemy.damage || (8 + wave * 2) * pressure, delay: combat.fireInterval, shots: enemy.enemyType === "boss" ? 3 : pressure > 2 ? 2 : 1, pierce: enemy.enemyType === "sniper" ? 1 : 0, spread: combat.spreadRadians });
      enemy.cooldown = combat.fireInterval;
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
    reviveUnitVisual(unit);
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
  if (mobileHeat > 0) mobileHeat = Math.max(0, mobileHeat - dt * (Date.now() < mobileOverheatedUntil ? 22 : 10));
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
  const measuredPlayerVelocity = player.g.position.clone().sub(previousPlayerPosition).divideScalar(Math.max(dt, .001));
  if (measuredPlayerVelocity.lengthSq() > 900) measuredPlayerVelocity.set(0, 0, 0);
  observedPlayerVelocity.lerp(measuredPlayerVelocity, Math.min(1, dt * 6));
  previousPlayerPosition.copy(player.g.position);
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
  const prepActive = phase === "prep";
  if (prepActive) {
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
      return;
    }
  } else if (timer <= 0) {
    if (mode === "ctf") finishCtf();
    else prep();
    return;
  }
  if (!prepActive && spawnQueue > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const spawned = enemies.length;
      spawnEnemy(spawned);
      spawnQueue--;
      const schedule = spawnSchedule({ enemyCount: 2, wave, difficulty: difficultyName() });
      spawnTimer = schedule[1] || Math.max(.75, 4 - wave * .1);
    }
  }
  // Controller-only mode disables keyboard and mouse events, not controller movement.
  let mx = inputPaused || menuOpen ? 0 : (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  let mz = inputPaused || menuOpen ? 0 : (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  if (!inputPaused && (touch.mx || touch.mz)) { mx = touch.mx; mz = touch.mz; }
  if (!inputPaused && (controller.mx || controller.mz)) { mx = controller.mx; mz = controller.mz; }
  if (phase === "dialogue") {
    mx = 0;
    mz = 0;
    firing = false;
    touch.fire = false;
  }
  const androidSingleStick = isAndroidApp && inputMode === "touch" && !inputPaused && !menuOpen
    ? resolveAndroidSingleStick({
      x: touch.mx,
      y: touch.mz,
      maxTurnRate: 2.4 * (adsActive ? aimSettings.adsSensitivity : aimSettings.sensitivity),
    })
    : null;
  if (androidSingleStick) {
    viewYaw += androidSingleStick.turnRate * dt;
    viewPitch = androidSingleStick.pitch;
    mz = -androidSingleStick.forward;
    mx = 0;
    const direction = cameraDirectionFromView({ yaw: viewYaw, pitch: viewPitch });
    aim.copy(player.g.position).add(new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(35));
  }
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
  resolvePlayerMapCollision(beforeMove);
  const manualTouchAim = !inputPaused && Math.hypot(touch.ax, touch.az) > .08;
  const manualControllerAim = !inputPaused && Math.hypot(controller.ax, controller.az) > .08;
  if (manualTouchAim) {
    setInputMode("touch");
    aim.copy(player.g.position).add(new THREE.Vector3(touch.ax, 0, touch.az).multiplyScalar(20));
    viewYaw = Math.atan2(touch.ax, touch.az);
  }
  if (manualControllerAim) {
    const nextView = advanceControllerLook(
      { yaw: viewYaw, pitch: viewPitch },
      { x: controller.ax, y: controller.az },
      dt,
      { sensitivity: 2.5 * (adsActive ? aimSettings.adsSensitivity : aimSettings.sensitivity), maxPitch: .75 },
    );
    viewYaw = nextView.yaw;
    viewPitch = nextView.pitch;
    const direction = cameraDirectionFromView({ yaw: viewYaw, pitch: viewPitch });
    aim.copy(player.g.position).add(new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(35));
  }
  const virtualMouseActive = frontView && inputMode === "mouse" && !menuOpen
    && ["combat", "prep"].includes(phase) && !rendererContextLost && document.visibilityState === "visible";
  if (virtualMouseActive) {
    const rates = mouseLookRates(virtualMouseLook, {
      maxYawRate: 3.2 * (adsActive ? aimSettings.adsSensitivity : aimSettings.sensitivity),
      maxPitchRate: 2.4 * (adsActive ? aimSettings.adsSensitivity : aimSettings.sensitivity),
    });
    viewYaw += rates.yawRate * dt;
    viewPitch = THREE.MathUtils.clamp(viewPitch + rates.pitchRate * dt, -.75, .75);
    const direction = cameraDirectionFromView({ yaw: viewYaw, pitch: viewPitch });
    aim.copy(player.g.position).add(new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(35));
  }
  const touchCrosshairTarget = inputMode === "touch" && touch.aiming ? touchTargetInCrosshair() : null;
  const mobileTouchAutoFire = inputMode === "touch" && coarsePointer.matches && (isAndroidApp || document.fullscreenElement || innerWidth <= 700);
  const androidAutoTarget = mobileTouchAutoFire
    ? androidTouchTarget(touchCrosshairTarget)
    : null;
  const androidAutoFire = decideAndroidTouchAutoFire({
    isAndroidApp,
    mobileTouch: mobileTouchAutoFire,
    inputMode,
    phase,
    target: androidAutoTarget,
    menuOpen,
    inputPaused,
    manualFire: touch.fire,
  });
  const touchAutoFire = inputMode === "touch" && shouldAutoFireFromTouch({
    aiming: touch.aiming,
    targetInCrosshair: Boolean(touchCrosshairTarget),
    manualFire: touch.fire,
  });
  const wantsFire = !inputPaused && ((!controllerLocked() && firing) || touchAutoFire || androidAutoFire.firingRequested || controller.fire);
  if ((isAndroidApp || shouldAutoLock({ coarsePointer: coarsePointer.matches, difficultyRatio, preset: aimSettings.preset, manualAim: manualTouchAim || manualControllerAim, mouseInputActive, controllerInputActive: inputMode === "controller" && manualControllerAim })) && wantsFire) {
    const target = androidAutoFire.targetMayBeAcquired
      ? androidAutoTarget
      : touchAutoFire && !touch.fire
        ? touchCrosshairTarget
        : lockedTarget?.alive ? lockedTarget : nearest(player, enemies);
    if (target) {
      lockedTarget = target;
      aim.lerp(target.g.position, Math.min(1, dt * 8));
      viewYaw = Math.atan2(aim.x - player.g.position.x, aim.z - player.g.position.z);
      const horizontalDistance = Math.max(.001, Math.hypot(aim.x - player.g.position.x, aim.z - player.g.position.z));
      const targetPitch = THREE.MathUtils.clamp(Math.atan2((aim.y + 1.05) - (player.g.position.y + 1.55), horizontalDistance), -.75, .75);
      const pitchStep = Math.max(.1, 2.1 * dt);
      viewPitch += THREE.MathUtils.clamp(targetPitch - viewPitch, -pitchStep, pitchStep);
    }
  } else if (aimSettings.preset === "assist" && (manualTouchAim || manualControllerAim || mouseInputActive)) {
    const target = nearest(player, enemies);
    if (target) {
      const targetYaw = Math.atan2(target.g.position.x - player.g.position.x, target.g.position.z - player.g.position.z);
      const delta = Math.atan2(Math.sin(targetYaw - viewYaw), Math.cos(targetYaw - viewYaw));
      if (Math.abs(delta) < .32) viewYaw += delta * aimSettings.assistStrength * dt * 2.2;
    }
  } else if (frontView && mouseInputActive && !manualControllerAim) {
    const direction = cameraDirectionFromView({ yaw: viewYaw, pitch: viewPitch });
    aim.copy(player.g.position).add(new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(35));
  }
  const lookDirection = aim.clone().sub(player.g.position);
  lookDirection.y = 0;
  if (lookDirection.lengthSq() > .01) player.g.rotation.y = Math.atan2(lookDirection.x, lookDirection.z);
  applyWorldMovement(player, playerFrom);
  applyExplorationDiscovery();
  if (!prepActive) {
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
      else for (const target of [player, ...allies]) {
        if (target.alive && bullet.m.position.distanceTo(target.g.position) < 1.1) {
          applyDamage(target, bullet.damage);
          bullet.life = 0;
          break;
        }
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
  }
  [player, ...allies, ...enemies].forEach(actor => updateUnitVisual(actor, dt));
  const facing = new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw));
  const view = cameraDirectionFromView({ yaw: viewYaw, pitch: viewPitch });
  const viewDirection = new THREE.Vector3(view.x, view.y, view.z);
  const cameraTarget = frontView ? player.g.position.clone().add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(facing, .72) : new THREE.Vector3(player.g.position.x, 26, player.g.position.z + 22);
  camera.position.lerp(cameraTarget, Math.min(1, dt * (frontView ? 12 : 4)));
  cameraShake = Math.max(0, cameraShake - dt * 1.8);
  if (cameraShake) camera.position.add(new THREE.Vector3((Math.random() - .5) * cameraShake, (Math.random() - .5) * cameraShake, (Math.random() - .5) * cameraShake));
  if (frontView) camera.lookAt(camera.position.clone().addScaledVector(viewDirection, 30));
  else camera.lookAt(player.g.position.x, 0, player.g.position.z);
  heldWeapon.visible = Boolean(frontView && ["countdown", "combat", "prep"].includes(phase) && !menuOpen && player?.alive);
  heldWeaponRecoil = Math.max(0, heldWeaponRecoil - dt * 1.9);
  heldWeaponBob += dt * (1.5 + Math.min(3, observedPlayerVelocity.length() * .16));
  const moving = Math.min(1, observedPlayerVelocity.length() / 8);
  heldWeapon.position.x = Math.sin(heldWeaponBob * 1.7) * .012 * moving;
  heldWeapon.position.y = Math.cos(heldWeaponBob * 2.1) * .009 * moving - heldWeaponRecoil * .18;
  heldWeapon.rotation.x = heldWeaponRecoil * 1.4;
  heldWeaponPresentation = advanceWeaponPresentation(heldWeaponPresentation, dt);
  const reloadProgress = heldWeaponPresentation.reloading
    ? heldWeaponPresentation.reloadProgress
    : reloadDurationMs > 0 && Date.now() < reloadUntil
      ? Math.min(1, (Date.now() - reloadStartedAt) / reloadDurationMs)
      : heldWeaponPresentation.reloadProgress;
  heldWeaponPoseController?.update(dt, {
    state: heldWeaponPresentation.reloading ? "reload" : heldWeaponPresentation.recoil > .02 ? "fire" : "idle",
    fire: Math.min(1, heldWeaponPresentation.recoil / .42),
    reload: reloadProgress,
    heat: 0,
    aim: frontView ? 0 : 1,
  });
  heldWeaponFlash.material.opacity = Math.max(0, heldWeaponFlash.material.opacity - dt * 12);
  heldWeaponFlash.scale.lerp(new THREE.Vector3(.8, .8, 1.7), Math.min(1, dt * 18));
  for (let index = heldWeaponSmoke.length - 1; index >= 0; index -= 1) {
    const puff = heldWeaponSmoke[index];
    puff.life -= dt;
    puff.mesh.position.z -= dt * .35;
    puff.mesh.scale.addScalar(dt * 1.4);
    puff.mesh.material.opacity = Math.max(0, puff.life * 1.8);
    if (puff.life <= 0) { heldWeapon.remove(puff.mesh); puff.mesh.material.dispose(); heldWeaponSmoke.splice(index, 1); }
  }
  for (let index = heldWeaponShells.length - 1; index >= 0; index -= 1) {
    const shell = heldWeaponShells[index];
    shell.life -= dt;
    shell.velocity.y -= dt * .9;
    shell.mesh.position.addScaledVector(shell.velocity, dt);
    shell.mesh.rotation.x += shell.spin * dt;
    shell.mesh.rotation.y += shell.spin * .7 * dt;
    shell.mesh.material.opacity = Math.max(0, Math.min(1, shell.life * 2));
    if (shell.life <= 0) {
      heldWeapon.remove(shell.mesh);
      shell.mesh.material.dispose();
      shell.mesh.geometry.dispose();
      heldWeaponShells.splice(index, 1);
    }
  }
}

function formatTime(seconds) {
  return `${String(Math.max(0, Math.ceil(seconds) / 60 | 0)).padStart(2, "0")}:${String(Math.max(0, Math.ceil(seconds) % 60)).padStart(2, "0")}`;
}

function renderHud() {
  document.body.dataset.phase = phase;
  updateMobileContextAction();
  const weapon = weaponProfile();
  const classDefinition = getClassDefinition(classProgress.classId);
  const classStats = getClassStats(classProgress);
  const teamMembers = [player, ...allies];
  const teamHealth = teamMembers.reduce((total, member) => total + Math.max(0, member?.hp || 0), 0);
  const teamHealthMax = teamMembers.reduce((total, member) => total + Math.max(0, member?.maxHp || 0), 0);
  const chapter = soldierStory[Math.min(storyStage - 1, soldierStory.length - 1)];
  const objective = kingdomUnlocked ? soldierStory[4].text : storyMissions[missionIndex];
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
  const displayedHeat = mobilePhoneSession() ? mobileHeat : Math.max(0, player.cooldown / weapon.delay) * 100;
  ui.heat.textContent = Math.round(displayedHeat);
  ui.heatBar.style.setProperty("--hud-fill", `${Math.round(displayedHeat)}%`);
  ui.ammo.textContent = mobilePhoneSession() ? (Date.now() < mobileOverheatedUntil ? "COOLING" : "AUTO") : hud.ammo.label;
  ui.ability.textContent = `${hud.ability.label} ${hud.ability.statusLabel}`;
  ui.abilityBar.style.setProperty("--hud-fill", `${hud.ability.percentage}%`);
  ui.team.textContent = hud.team.label;
  ui.teamName.textContent = hud.team.playerName;
  ui.teamHealth.textContent = hud.team.healthLabel;
  ui.teamHealthBar.style.setProperty("--hud-fill", `${hud.team.healthPercentage}%`);
  ui.objective.textContent = hud.objective.label;
  ui.scrap.textContent = scrap;
  ui.kills.textContent = kills;
  ui.wave.textContent = wave;
  ui.level.textContent = playerLevel;
  ui.stage.textContent = storyStage;
  ui.chapter.textContent = `Chapter ${Math.min(storyStage, soldierStory.length)}: ${chapter.title}`;
  ui.mission.textContent = hud.mission.label;
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

let lastProcessedRenderFrameAt = 0;

function render(now = performance.now()) {
  if (!shouldProcessRenderFrame({
    phase,
    now,
    lastFrameAt: lastProcessedRenderFrameAt,
    documentHidden: document.visibilityState === "hidden",
  })) {
    requestAnimationFrame(render);
    return;
  }
  lastProcessedRenderFrameAt = now;
  const dt = Math.min(clock.getDelta(), .04);
  syncPointerCaptureEligibility();
  startQueuedControlsTourWhenSafe();
  if (controlsTourState?.status === "active") handleControlsTourController();
  else if (!ui.shop.classList.contains("hidden") && controllerConnected) handleShopController();
  else if (!ui.settings.classList.contains("hidden") && controllerConnected) handleSettingsController();
  else if (phase === "over" && !ui.over.classList.contains("hidden") && controllerConnected) handleGameOverController();
  else if (phase === "loadout" && !$("loadoutRoomModal").classList.contains("hidden") && controllerConnected) handleLoadoutController();
  else if (phase === "menu" && !lobbyScreen.classList.contains("hidden")) handleLobbyController();
  update(dt);
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
  if (!audioEnabled && !musicEnabled) return;
  if ((window.AudioContext || window.webkitAudioContext) && !audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext?.state === "suspended") audioContext.resume().catch(() => {});
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

function startBuiltInMusic() {
  if (!musicEnabled || musicSource !== "builtin" || !bundledMusic || !bundledMusic.paused) return;
  bundledMusic.volume = Math.min(1, effectiveMusicVolume());
  bundledMusic.play().then(() => {
    ui.musicStatus.textContent = "Nightfall ambient soundtrack";
    $("playMusicBtn").textContent = "Pause";
  }).catch(() => {
    ui.musicStatus.textContent = "Tap Play to start the soundtrack";
  });
}

function stopBuiltInMusic() {
  bundledMusic?.pause();
}

function updateLocalMusicVolume() {
  localMusic.volume = Math.min(1, effectiveMusicVolume());
  if (bundledMusic) bundledMusic.volume = Math.min(1, effectiveMusicVolume());
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

function suspendAudioForLifecycle() {
  stopMusic();
  if (audioContext?.state === "running") audioContext.suspend().catch(() => {});
}

addEventListener("wasteland:app-paused", suspendAudioForLifecycle);
addEventListener("wasteland:app-resumed", () => {
  if (musicEnabled) wakeAudio();
});

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
  touch.aiming = false;
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
    : inputMode === "touch"
      ? "Touch the battlefield to resume play."
      : controllerConnected
        ? "Press a controller button to resume play."
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
  const mouseActivation = event?.pointerType === "mouse" || (event?.type === "click" && Number(event?.detail) > 0);
  if (mouseActivation && !controllerOnly) setInputMode("mouse");
  const pointerType = event?.pointerType || (mouseActivation ? "mouse" : "");
  const eligible = pointerCaptureDecision({
    pointerType,
    deliberateCanvasAction: Boolean(event?.isTrusted) && (event?.button ?? 0) === 0 && event?.isPrimary !== false,
    pointerLocked: document.pointerLockElement === canvas,
  });
  if (!eligible || typeof canvas.requestPointerLock !== "function") return false;
  virtualMouseLook = centerVirtualMouseLook();
  try {
    const request = canvas.requestPointerLock();
    request?.catch?.(() => interruptLocalInput("pointer-lock-unavailable"));
    return true;
  } catch {
    interruptLocalInput("pointer-lock-unavailable");
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

function focusProfileRequirement(field, message) {
  profileMessage.textContent = message;
  field?.focus?.({ preventScroll: true });
  field?.scrollIntoView?.({ behavior: "smooth", block: "center" });
}

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
  if (!phoneProviderPromise) phoneProviderPromise = loadPhoneAuthProvider({
    environment: phoneEnvironment(),
    fetchImpl: path => fetch(serviceUrl(path)),
  });
  return phoneProviderPromise;
}

function hideProfileSteps() {
  profileStep.classList.add("hidden");
  returnStep.classList.add("hidden");
  linkProfileStep?.classList.add("hidden");
  phoneCodeStep?.classList.add("hidden");
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
    if ($("linkPhone")) $("linkPhone").value = "";
    if ($("phoneCode")) $("phoneCode").value = "";
    if ($("phoneCodeMessage")) $("phoneCodeMessage").textContent = "";
    if ($("phoneCodeHeading")) $("phoneCodeHeading").textContent = kind === "restore" ? "Restore Linked Player" : "Verify Mobile Number";
    if ($("phoneCodeHint")) $("phoneCodeHint").textContent = `A code was sent to ${phoneChallenge.phoneHint}. The number is not shown to other players.`;
    hideProfileSteps();
    phoneCodeStep?.classList.remove("hidden");
    $("phoneCode")?.focus();
    updatePhoneResendControl();
    return true;
  } catch (error) {
    phoneProviderPromise = null;
    message.textContent = error?.message || "Phone verification is not configured for this deployment. Offline play still works.";
    return false;
  }
}

function updatePhoneResendControl() {
  const button = $("resendPhoneCodeBtn");
  if (!button) return;
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
    const response = await fetch(serviceUrl("/api/account/phone"), {
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
  (previous === "restore" ? linkProfileStep : profileStep)?.classList.remove("hidden");
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
    const response = await fetch(serviceUrl("/api/players"), {
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
        const response = await fetch(serviceUrl("/api/account/preferences"), {
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
  return fetch(serviceUrl("/api/account/preferences"), {
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
  const informational = controlsTourState.mode === "required";
  $("controlsTourFamily").textContent = controlsFamilyLabel(controlsTourState.family);
  $("controlsTourProgress").textContent = informational
    ? "QUICK GUIDE"
    : `${Math.min(controlsTourState.stepIndex + 1, controlsTourState.steps.length)} / ${controlsTourState.steps.length}`;
  $("controlsTourSteps").replaceChildren(...controlsTourState.steps.map((step, index) => {
    const item = document.createElement("li");
    item.className = informational ? "" : index < controlsTourState.stepIndex ? "complete" : index === controlsTourState.stepIndex ? "current" : "";
    if (index < controlsTourState.stepIndex) item.setAttribute("aria-label", `${step.title} complete`);
    const title = document.createElement("span");
    title.textContent = step.title;
    const control = document.createElement("b");
    control.textContent = index < controlsTourState.stepIndex ? "Complete" : step.control;
    item.append(title, control);
    return item;
  }));
  const current = controlsTourState.steps[controlsTourState.stepIndex];
  $("controlsTourInstruction").textContent = informational
    ? "These controls match this device. Continue when you are ready."
    : current?.instruction || "Controls check complete.";
  $("closeControlsTourBtn").textContent = informational ? "Continue" : "Close Practice";
  $("closeControlsTourBtn").classList.remove("hidden");
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
  touch.fire = touch.aiming = false;
  clearKeyboardInput();
  renderControlsTour();
  queueMicrotask(() => $("closeControlsTourBtn").focus({ preventScroll: true }));
}

function closeControlsTour() {
  if (controlsTourState?.mode === "required") {
    controlsTourState = acknowledgeControlsTour(controlsTourState);
    completeControlsTour();
    return;
  }
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
  linkProfileStep?.classList.remove("hidden");
  if ($("linkProfileMessage")) $("linkProfileMessage").textContent = "";
}

async function reportMatch(title) {
  if (!activeProfile?.backendPlayerId || offlineMode) return;
  try {
    const response = await fetch(serviceUrl("/api/matches"), {
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
  document.body.classList.add("lobby-active");
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
  $("lobbyAvatarButton").setAttribute("aria-label", `Open ${view.displayName} loadout`);
  $("lobbyProfileReadout").setAttribute("aria-label", `Open ${view.displayName} profile and loadout`);
  $("verifiedPhoneStatus").textContent = "Your profile, birthday confirmation, and four-digit PIN are stored locally on this device.";
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
  linkProfileStep?.classList.add("hidden");
  phoneCodeStep?.classList.add("hidden");
  profileName.value = activeProfile.name || "";
  profileBirthDate.value = activeProfile.birthDate || "";
  profileAvatar.value = activeProfile.avatarType || "scout";
  updateAvatarCards();
  ageConfirm.checked = true;
  profilePin.value = "";
  profilePin.closest("label").classList.add("hidden");
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
  activeProfile.progress = { ...(activeProfile.progress || {}), wave, score, kills, scrap, shieldLevel, playerLevel, totalXp, storyStage, missionIndex, kingdomUnlocked, classProgress, storyCheckpoint, unlockedMaps: unlockedMaps(playerLevel), timelineAdvantages: timelineAdvantages.slice(0, Math.min(timelineAdvantages.length, storyStage)), guns: Object.fromEntries(Object.entries(guns).map(([key, gun]) => [key, gun.level])), rewards: activeProfile.progress?.rewards || { winStreak: 0, lifetimeRewards: 0 } };
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
  storyCheckpoint = progress.storyCheckpoint && typeof progress.storyCheckpoint === "object" ? progress.storyCheckpoint : null;
  classProgress = normalizeClassProgress(progress.classProgress || { classId: profile?.avatarType || "scout" });
  Object.entries(progress.guns || {}).forEach(([key, level]) => { if (guns[key]) guns[key].level = Math.min(guns[key].max, Math.max(0, Number(level) || 0)); });
}

function storyMissionId() {
  const chapter = Math.min(4, Math.max(1, storyStage));
  return `c${chapter}-m${missionIndex % 2 + 1}`;
}

function createStoryCheckpoint() {
  return {
    id: `chapter-${Math.min(4, Math.max(1, storyStage))}-stage-${storyStage}`,
    chapter: Math.min(4, Math.max(1, storyStage)),
    mission: storyMissionId(),
    map: mapKey,
    wave: Math.max(1, wave),
    stage: Math.max(1, storyStage),
  };
}

function storyRuntimeProgress() {
  return {
    profileId: activeProfile?.profileId || "offline-guest",
    chapter: Math.min(4, Math.max(1, storyStage)),
    mission: storyMissionId(),
    map: mapKey,
    wave,
    stage: storyStage,
    level: playerLevel,
    xp: totalXp,
    scrap,
    kills,
    classId: classProgress.classId,
    avatarId: activeProfile?.avatarType || classProgress.classId,
    unlockedMaps: unlockedMaps(playerLevel),
    weaponLevels: Object.fromEntries(Object.entries(guns).map(([key, gun]) => [key, gun.level])),
    inventory: activeProfile?.progress?.inventory || {},
    shieldUpgrades: { level: shieldLevel },
    tacticalUpgrades: activeProfile?.progress?.tacticalUpgrades || {},
    kingdom: activeProfile?.progress?.kingdom || { unlocked: kingdomUnlocked, level: kingdomUnlocked ? 1 : 0 },
    difficulty: difficultyName(),
    checkpoint: storyCheckpoint || createStoryCheckpoint(),
  };
}

function applyStoryCampaignProgression(progress = storyRuntimeProgress(), { preserveMap = false } = {}) {
  const campaign = deriveStoryCampaignState({ level: progress.level, stage: progress.stage });
  mapKey = preserveMap && campaign.availableMaps.includes(progress.map) ? progress.map : campaign.recommendedMap;
  difficultyRatio = campaign.difficultyRatio;
  storyMapSelect.value = mapKey;
  $("botDifficulty").value = String(difficultyRatio);
  return campaign;
}

function applyStoryResume(result) {
  const progress = result.progress;
  wave = Math.max(1, progress.wave);
  storyStage = Math.max(1, progress.stage);
  playerLevel = Math.max(1, progress.level);
  totalXp = Math.max(0, progress.xp);
  scrap = Math.max(0, progress.scrap);
  kills = Math.max(0, progress.kills);
  shieldLevel = Math.max(0, progress.shieldUpgrades.level || 0);
  kingdomUnlocked = Boolean(progress.kingdom.unlocked);
  Object.entries(progress.weaponLevels).forEach(([key, level]) => {
    if (guns[key]) guns[key].level = Math.min(guns[key].max, Math.max(0, Number(level) || 0));
  });
  storyCheckpoint = { ...result.resume };
  applyStoryCampaignProgression({ ...progress, map: result.resume.map }, { preserveMap: true });
}

function restoreStorySession() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(storySnapshotKey()) || "null"); }
  catch { stored = null; }
  const validation = validateStorySnapshot(stored);
  if (!validation.ok) {
    pendingStoryResume = null;
    return null;
  }
  pendingStoryResume = mergeStorySnapshot(storyRuntimeProgress(), validation.snapshot);
  return pendingStoryResume;
}

function saveStoryAndExit(reason) {
  const state = reason === "death-exit" ? "dead" : "paused";
  if (!canSaveAndExitStory({ mode: mode === "solo" ? "story" : mode, state }).available) return false;
  if (reason === "death-exit" && !storyCheckpoint) storyCheckpoint = createStoryCheckpoint();
  saveProgress();
  const snapshot = buildStorySnapshot(storyRuntimeProgress(), { reason });
  localStorage.setItem(storySnapshotKey(), JSON.stringify(snapshot));
  if (snapshot.returnIntent.screen === "main-lobby" && snapshot.returnIntent.multiplayerSelectable) exitToLobby();
  return true;
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
  const profile = activeProfile || { name: "Offline Guest", avatarType: "scout", progress: {} };
  const progress = profile.progress || {};
  $("dashboardName").textContent = profile.name || "Survivor";
  $("dashboardAvatar").textContent = avatarLabel(profile.avatarType);
  $("dashboardKingdom").textContent = progress.kingdomUnlocked ? "Kingdom Unlocked" : "Frontier Camp";
  $("dashboardLevel").textContent = progress.playerLevel || 1;
  $("dashboardXp").textContent = `${progress.totalXp || 0} XP`;
  $("dashboardStage").textContent = progress.storyStage || 1;
  $("dashboardScrap").textContent = progress.scrap || 0;
  $("dashboardMission").textContent = progress.kingdomUnlocked ? "Kingdom unlocked. Continue the frontier timeline." : storyMissions[progress.missionIndex || 0];
  $("dashboardLoadout").innerHTML = Object.entries(guns).map(([key, gun]) => `<div><b>${gun.label}</b><small>Level ${progress.guns?.[key] || 0}/${gun.max === Infinity ? "∞" : gun.max}</small></div>`).join("") + `<div><b>Scrap Shield</b><small>Level ${progress.shieldLevel || 0}/10</small></div>`;
  $("dashboardTactics").innerHTML = ["Aim Stabilizer", "Quick Recovery", "Scavenger Pack", "Flag Runner"].map((name, index) => `<div><b>${name}</b><small>${(progress.storyStage || 1) > index ? "Unlocked" : "Stage " + (index + 1)}</small></div>`).join("");
  setMenuSection("survivor");
  $("dashboardModal").classList.remove("hidden");
}

async function enterProfile() {
  const name = profileName.value.trim();
  const birthDate = profileBirthDate.value;
  const age = ageFromBirthDate(birthDate);
  const pin = profilePin.value.trim();
  const parentLocalPin = parentPin.value.trim();
  if (!name) {
    focusProfileRequirement(profileName, "Enter a player name.");
    return;
  }
  if (age === null) {
    focusProfileRequirement(profileBirthDate, "This birth date could not be verified. Parent controls will stay available until it is verified.");
    parentSetup.classList.remove("hidden");
    return;
  }
  if (!editingProfile && !validPin(pin)) {
    focusProfileRequirement(profilePin, "PIN must be exactly four numbers.");
    return;
  }
  if (!ageConfirm.checked) {
    focusProfileRequirement(ageConfirm, "Confirm the age information before entering.");
    return;
  }
  if (Date.now() >= termsAcceptedUntil) {
    $("termsConfirm").checked = false;
    $("termsModal").classList.remove("hidden");
    $("termsConfirm").focus();
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
    profilePin.closest("label").classList.remove("hidden");
    parentPin.value = "";
    parentSetup.classList.add("hidden");
    profileMessage.textContent = "Profile saved.";
    openLobby(name);
    return;
  }
  if (youthAccount && !validPin(parentLocalPin)) {
    profileMessage.textContent = "A separate four-digit parent PIN is required for players under 14.";
    parentSetup.classList.remove("hidden");
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
    parentPhoneHint: "",
    parentPinDigest,
    youthAccount,
    pinDigest: digest,
    deviceId: deviceId(),
    ageVerifiedAt: new Date().toISOString(),
    progress: null,
  });
  profilePin.value = "";
  parentPin.value = "";
  saveProfile(profile);
  guestControlsIdentityActive = false;
  activeProfile = profile;
  // Online is the normal path for a new profile; Offline mode remains an explicit setting.
  offlineMode = false;
  localStorage.setItem("wastland-survivor-offline", "false");
  profileMessage.textContent = "Local profile created.";
  openLobby(name);
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
  profileMessage.textContent = "";
  returnMessage.textContent = "";
  profileSelector.replaceChildren(...profiles.map(profile => new Option(`${profile.name} · ${profile.birthDate || "local profile"}`, profile.profileId)));
  linkProfileStep?.classList.add("hidden");
  phoneCodeStep?.classList.add("hidden");
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
  profilePin.closest("label").classList.remove("hidden");
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
  lobbyScreen.classList.add("hidden");
  welcomeScreen.classList.remove("hidden");
  document.body.classList.remove("lobby-active");
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
    if (prefix === "a") touch.aiming = false;
    knob.style.transform = "translate(0,0)";
  };
  const move = event => {
    if (event.pointerId !== pointerId) return;
    const rect = element.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy) || 1;
    const knobRadius = (knob.offsetWidth || 38) / 2;
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2 - knobRadius - 2);
    const normalized = normalizeTouchStick({ dx, dy, radius });
    knob.style.transform = `translate(${normalized.x * radius}px,${normalized.z * radius}px)`;
    touch[`${prefix}x`] = normalized.x;
    touch[`${prefix}z`] = normalized.z;
    handleControlsTourSignal({ source: "touch-stick", control: prefix === "m" ? "move" : "aim", magnitude: normalized.magnitude });
  };
  element.addEventListener("pointerdown", event => {
    if (phase === "countdown") return;
    setInputMode("touch");
    pointerId = event.pointerId;
    if (prefix === "a") touch.aiming = true;
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
  const socketOrigin = serviceOrigin ? serviceOrigin.replace(/^http/, "ws") : `${protocol}://${location.host}`;
  lobbyRoomName = roomName;
  lobbySocket = new WebSocket(`${socketOrigin}/signal`);
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
    const socketOrigin = serviceOrigin ? serviceOrigin.replace(/^http/, "ws") : `${protocol}://${location.host}`;
    voiceSocket = new WebSocket(`${socketOrigin}/signal`);
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
  $("saveExitStoryBtn").classList.toggle("hidden", !canSaveAndExitStory({ mode: mode === "solo" ? "story" : mode, state: phase }).available);
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
  touch.fire = touch.aiming = false;
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
  const policy = resolveMenuMedia({
    tier: effectiveGraphicsTier(),
    reducedMotion: reducedMotionEnabled(),
    saveData: Boolean(navigator.connection?.saveData),
    playbackState: "playing",
  });
  if (policy.kind === "fallback") return retainNightfallFallback("capability-policy");
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
  const policy = resolveMenuMedia({
    tier: effectiveGraphicsTier(),
    reducedMotion: reducedMotionEnabled(),
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
      const bundledPolicy = resolveMenuMedia({ tier: effectiveGraphicsTier(), replayFailed: true, playbackState: "loading" });
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

async function resumeDesktopMenuBackdrop() {
  if (!document.body.classList.contains("menu-active") || document.visibilityState !== "visible" || reducedMotionEnabled()) return;
  if (!homeBackdrop.paused && homeBackdrop.dataset.mediaKind !== "fallback") return;
  if (homeBackdrop.dataset.mediaKind === "fallback") return initializeMenuBackdrop({ force: true });
  try {
    await homeBackdrop.play();
    revealMenuBackdrop(homeBackdrop.dataset.mediaKind || homeBackdrop.dataset.mediaCandidate || "bundled");
  } catch {
    await initializeMenuBackdrop({ force: true });
  }
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
  const result = resolveShieldUpgrade({
    phase,
    scrap,
    shieldLevel,
    baseArmor: getClassStats(classProgress).maxShield,
  });
  $("armoryStatus").textContent = result.message;
  if (!result.applied) {
    playTone(150, .08, "square", .025);
    return;
  }
  scrap = result.nextScrap;
  shieldLevel = result.nextLevel;
  player.shieldMax = result.shieldMax;
  player.shield = result.shieldMax;
  updateArmory();
  saveProgress();
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
  const ammo = `${magazines[activeGun]} / ${magazineSizes[activeGun]}`;
  const armor = `${Math.round(player?.shield || 0)} / ${Math.round(player?.shieldMax || 0)}`;
  const avatar = activeProfile?.avatarType || classProgress?.classId || "scout";
  const avatarDetails = {
    scout: ["Dust Scout", "Fast movement", "Dash"],
    ranger: ["Ranger", "Steadier aim", "Focus"],
    heavy: ["Heavy", "Extra armor", "Shield Brace"],
    tech: ["Tech Runner", "Extra scrap", "Repair Pulse"],
    medic: ["Field Medic", "Recovery support", "Repair Pulse"],
    warden: ["Warden", "Extra armor", "Shield Brace"],
  }[avatar] || ["Dust Scout", "Fast movement", "Dash"];
  const avatarImage = {
    scout: "./assets/nightfall/characters/renders/scout-v2-isolated.png",
    ranger: "./assets/nightfall/characters/renders/ranger-v2-isolated-clean.png",
    heavy: "./assets/nightfall/characters/renders/heavy-v2-isolated.png",
    tech: "./assets/nightfall/characters/renders/tech-runner-v2-isolated.png",
    medic: "./assets/nightfall/characters/renders/field-medic-v2-isolated.png",
    warden: "./assets/nightfall/characters/renders/warden-v2-isolated.png",
  }[avatar] || "./assets/nightfall/characters/renders/scout-v2-isolated.png";
  const image = $("armoryAvatarImage");
  if (image) { image.src = avatarImage; image.alt = avatarDetails[0]; }
  $("armoryAvatarName")?.replaceChildren(document.createTextNode(avatarDetails[0]));
  $("armoryAvatarSkill")?.replaceChildren(document.createTextNode(avatarDetails[1]));
  $("armoryScrap")?.replaceChildren(document.createTextNode(String(Math.max(0, Math.floor(scrap)))));
  $("armoryAmmo")?.replaceChildren(document.createTextNode(ammo));
  $("armoryAmmoDetail")?.replaceChildren(document.createTextNode(ammo));
  $("armoryArmor")?.replaceChildren(document.createTextNode(armor));
  $("armoryAbilityDetail")?.replaceChildren(document.createTextNode(`${avatarDetails[2]} is ready for this survivor.`));
  $("armoryAimDetail")?.replaceChildren(document.createTextNode(isAndroidApp ? "AUTO-AIM" : "AIM ASSIST"));
  [["scout", "equipScoutBtn"], ["cannon", "equipCannonBtn"], ["inferno", "equipInfernoBtn"]].forEach(([gun, id]) => {
    const button = $(id);
    const locked = !gunUnlocked(gun) && activeGun !== gun;
    button.disabled = locked;
    button.textContent = locked ? `${gunUnlocks[gun]} kills` : activeGun === gun ? "Equipped" : "Equip";
  });
}

function selectArmoryTab(tabName = "weapons") {
  document.querySelectorAll("[data-armory-tab]").forEach(tab => {
    const selected = tab.dataset.armoryTab === tabName;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  document.querySelectorAll("[data-armory-folder]").forEach(folder => {
    const selected = folder.dataset.armoryFolder === tabName;
    folder.classList.toggle("hidden", !selected);
    folder.setAttribute("aria-hidden", String(!selected));
  });
}

function equip(gunName) {
  if (!gunUnlocked(gunName) && activeGun !== gunName) return;
  activeGun = gunName;
  createHeldWeapon(gunName);
  updateArmory();
}

addEventListener("resize", resize);
addEventListener("blur", () => interruptLocalInput("window-blur"));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    interruptLocalInput("document-hidden");
    suspendAudioForLifecycle();
  }
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
document.addEventListener("pointerlockerror", () => interruptLocalInput("pointer-lock-unavailable"));
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
    if (controlsTourState.mode === "required" && ["enter", " ", "escape"].includes(key)) {
      event.preventDefault();
      closeControlsTour();
      return;
    }
    setInputMode("keyboard");
    handleControlsTourSignal({ source: "keyboard", kind: "down", key: event.key });
    event.preventDefault();
    return;
  }
  if (event.key === "Escape") {
    if (phase === "over") { endFinishedMatch(); return; }
    if (!ui.settings.classList.contains("hidden")) { closeSettings(); return; }
    if (!$("dashboardModal").classList.contains("hidden")) { $("dashboardModal").classList.add("hidden"); restoreVisibleMenuSection(); return; }
    if (!ui.shop.classList.contains("hidden")) { ui.shop.classList.add("hidden"); restoreVisibleMenuSection(); return; }
  }
  if (!welcomeScreen.classList.contains("hidden") && key === " " && event.target?.matches?.(".avatar-choice")) {
    event.preventDefault();
    event.target.click();
    setInputMode("keyboard");
    return;
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
  if (key === " ") firing = true;
  if (key === "tab") { event.preventDefault(); switchLockedTarget(); }
  keys[key] = true;
  if (key === "arrowleft") keys.a = true;
  if (key === "arrowright") keys.d = true;
  if (key === "arrowup") keys.w = true;
  if (key === "arrowdown") keys.s = true;
  wakeAudio();
});
addEventListener("android-menu-request", () => {
  if (phase !== "combat") return;
  setInputMode("touch");
  if (!handleControlsTourSignal({ source: "touch-button", control: "menu" })) {
    menuOpen ? closeGameMenu() : openGameMenu();
  }
});
addEventListener("keyup", event => {
  if (controllerLocked()) return;
  const key = event.key.toLowerCase();
  if (key === " ") firing = false;
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
      const canvasRect = canvas.getBoundingClientRect();
      virtualMouseLook = virtualMouseLookFromPoint(event, canvasRect);
      virtualMouseLook = advanceVirtualMouseLook(virtualMouseLook, event, {
        width: canvasRect.width || canvas.clientWidth,
        height: canvasRect.height || canvas.clientHeight,
      });
      viewYaw -= event.movementX * .0016 * (adsActive ? aimSettings.adsSensitivity : aimSettings.sensitivity);
      aim.copy(player.g.position).add(new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw)).multiplyScalar(35));
    }
    if (localGameplayInputPaused()) return;
  }
  pointer.set(mouseAimScreen.x / innerWidth * 2 - 1, -(mouseAimScreen.y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(ground)[0];
  if (hit) aim.copy(hit.point);
});
canvas.addEventListener("pointerdown", event => {
  if (controllerLocked()) return;
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
  if (event.key === "Enter" && !event.altKey && !event.ctrlKey && !event.metaKey) {
    if (!welcomeScreen.classList.contains("hidden")) {
      event.preventDefault();
      if (!returnStep.classList.contains("hidden")) returnProfile();
      else if (!$("termsModal").classList.contains("hidden")) $("termsAcceptBtn").click();
      else enterProfile();
      return;
    }
    if (!lobbyScreen.classList.contains("hidden") && event.target?.matches?.("[data-lobby-control]")) {
      event.preventDefault();
      activateLobbyCommand();
      return;
    }
  }
  const resumingPointer = pointerResumeRequired;
  wakeAudio();
  // A deliberate click must always recover windowed play when pointer lock is refused.
  if (resumingPointer) {
    pointerResumeRequired = false;
    updateInputRecoveryNotice();
  }
  if (localGameplayInputPaused()) return;
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
const touchUtilityTray = $("touchUtilityTray");
const touchUtilityButton = $("touchUtilityBtn");
const touchInteractButton = $("touchInteractBtn");
if (coarsePointer.matches && touchInteractButton && touchUtilityTray?.parentElement) {
  touchUtilityTray.parentElement.querySelector("#touchPrimaryActions")?.append(touchInteractButton);
}

function updateMobileContextAction() {
  const button = $("touchInteractBtn");
  if (!button || !player) return;
  const nearChest = phase === "prep" && canAccessChest(player.g.position, chests);
  const label = nearChest ? "Open Chest" : phase === "dialogue" ? "Continue" : mobilePhoneSession() ? "Heat" : "Reload";
  button.textContent = label;
  button.setAttribute("aria-label", label === "Open Chest" ? "Open nearby upgrade chest" : label);
}

function performMobileContextAction() {
  setInputMode("touch");
  const nearChest = phase === "prep" && canAccessChest(player.g.position, chests);
  if (nearChest) return interact();
  if (phase === "dialogue") return;
  if (mobilePhoneSession()) return;
  reloadWeapon(true);
}

function setStoryDialogueMode(active) {
  phase = active ? "dialogue" : "combat";
  document.body.classList.toggle("story-dialogue-active", Boolean(active));
  firing = false;
  touch.fire = false;
  if (active) setNightfallScene("dialogue");
  else setNightfallScene("game");
}
function setTouchUtilityOpen(open) {
  const next = Boolean(open);
  touchUtilityTray.classList.toggle("hidden", !next);
  touchUtilityTray.setAttribute("aria-hidden", String(!next));
  touchUtilityButton.setAttribute("aria-expanded", String(next));
  touchUtilityButton.textContent = next ? "Close" : "More";
}

function endFinishedMatch() {
  if (mode === "solo") return saveStoryAndExit("death-exit");
  exitToLobby();
  return true;
}
bindTransientPointerInterrupts({
  targets: [moveStick, aimStick, touchFireButton, touchAdsButton],
  interrupt: interruptLocalInput,
});
$('touchLockBtn').onclick = () => { setInputMode("touch"); switchLockedTarget(); };
$('touchUtilityBtn').onclick = () => { setInputMode("touch"); setTouchUtilityOpen(touchUtilityTray.classList.contains("hidden")); };
$("touchReloadBtn").onclick = () => { setInputMode("touch"); reloadWeapon(true); };
$("touchWeaponBtn").onclick = () => { setInputMode("touch"); cycleWeapon(1); };
$("touchInteractBtn").onclick = performMobileContextAction;
$("touchAbilityBtn").onclick = () => { setInputMode("touch"); if (!handleControlsTourSignal({ source: "touch-button", control: "ability" })) triggerAbility(); };
$("touchPauseBtn").onclick = () => { setInputMode("touch"); setTouchUtilityOpen(false); if (!handleControlsTourSignal({ source: "touch-button", control: "pause" })) menuOpen ? closeGameMenu() : openGameMenu(); };
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
document.querySelectorAll("[data-armory-tab]").forEach(tab => {
  tab.onclick = () => selectArmoryTab(tab.dataset.armoryTab);
});
$("loadoutArmoryBtn").onclick = () => { setMenuSection("armory"); selectArmoryTab("weapons"); updateArmory(); ui.shop.classList.remove("hidden"); };
$("loadoutReadyBtn").onclick = event => {
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
  requestGameplayPointerLock(event);
};
$("equipScoutBtn").onclick = () => equip("scout");
$("equipCannonBtn").onclick = () => equip("cannon");
$("equipInfernoBtn").onclick = () => equip("inferno");
$("upgradeScoutBtn").onclick = () => upgrade("scout");
$("upgradeCannonBtn").onclick = () => upgrade("cannon");
$("upgradeInfernoBtn").onclick = () => upgrade("inferno");
$("upgradeShieldBtn").onclick = upgradeShield;
$("restartBtn").onclick = () => { ui.over.classList.add("hidden"); start(); };
$("endMatchBtn").onclick = () => endFinishedMatch();
$("settingsBtn").onclick = openSettings;
$("lobbySettingsBtn").onclick = openSettings;
$("lobbyConnectionsBtn").onclick = openConnections;
$("renderLabBtn").onclick = () => { location.href = "./render-lab.html"; };
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
$("resumeGameBtn").onclick = event => { closeGameMenu(); requestGameplayPointerLock(event); };
$("frontViewBtn").onclick = () => { frontView = !frontView; $("frontViewBtn").textContent = frontView ? "Arena View" : "First Person"; };
$("exitGameBtn").onclick = exitToLobby;
$("saveExitStoryBtn").onclick = () => saveStoryAndExit("pause-exit");
$("mobileMenuSelect").onchange = event => {
  if (event.target.value === "resume") closeGameMenu();
  if (event.target.value === "settings") openSettings();
  if (event.target.value === "front") { frontView = true; closeGameMenu(); }
  if (event.target.value === "lobby") exitToLobby();
  event.target.value = "resume";
};
ui.controllerOnly.checked = controllerOnly;
ui.controllerOnly.onchange = () => { controllerOnly = ui.controllerOnly.checked; localStorage.setItem("wastland-survivor-controller-only", String(controllerOnly)); clearKeyboardInput(); };
if (isAndroidApp && ui.aimPreset) {
  ui.aimPreset.value = "full";
  ui.aimPreset.disabled = true;
  ui.aimPreset.setAttribute("aria-label", "Android auto-aim is always on");
}
ui.aimPreset.value = aimSettings.preset;
if (isAndroidApp && ui.aimPreset) ui.aimPreset.value = "full";
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
    if (bundledMusic && !bundledMusic.paused) { stopBuiltInMusic(); $("playMusicBtn").textContent = "Play"; }
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
  updateLobbyConnectivity({ type: "offline-changed", offlineMode });
  updateNetworkStatus();
  if (offlineMode) closeLobbyRoom();
  else {
    syncPublicPlayer();
    ensureLobbyRoom();
  }
};
$("enterWastlandBtn").onclick = enterProfile;
$("termsCancelBtn").onclick = () => $("termsModal").classList.add("hidden");
$("termsAcceptBtn").onclick = () => {
  if (!$("termsConfirm").checked) {
    profileMessage.textContent = "Accept the terms before continuing.";
    return;
  }
  termsAcceptedUntil = Date.now() + 2 * 60 * 60 * 1000;
  $("termsModal").classList.add("hidden");
  enterProfile();
};
$("guestOfflineBtn").onclick = enterGuestOffline;
$("linkProfileBackBtn")?.addEventListener("click", initializeProfileScreen);
$("claimLinkBtn")?.addEventListener("click", claimDeviceLink);
$("phoneCodeBackBtn")?.addEventListener("click", cancelPhoneVerification);
$("confirmPhoneCodeBtn")?.addEventListener("click", confirmPhoneCode);
$("resendPhoneCodeBtn")?.addEventListener("click", resendPhoneCode);
document.querySelectorAll(".avatar-choice").forEach(card => card.onclick = () => {
  profileAvatar.value = card.dataset.avatar;
  updateAvatarCards(card.dataset.avatar);
});
profileAvatar.onchange = () => updateAvatarCards();
profileBirthDate.addEventListener("input", () => {
  const age = ageFromBirthDate(profileBirthDate.value);
  parentSetup.classList.toggle("hidden", !(age > 0 && age < 14));
});
[profilePin, returnPin, parentPin, $("linkLocalPin")].filter(Boolean).forEach(input => {
  ["copy", "cut", "paste", "contextmenu"].forEach(eventName => input.addEventListener(eventName, event => event.preventDefault()));
});
setInterval(() => {
  if (!phoneChallenge) return;
  updatePhoneResendControl();
  if (phoneChallenge.status === "code-sent" && Date.now() > phoneChallenge.expiresAt) {
    phoneChallenge = failPhoneChallenge(phoneChallenge, phoneChallenge.expiresAt + 1);
    if ($("phoneCodeMessage")) $("phoneCodeMessage").textContent = "This code expired. Go back and request a new one.";
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
$("survivalLobbyBtn").onclick = () => { restoreStorySession(); lobbyScreen.classList.add("hidden"); $("soloMode").click(); };
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
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") resumeDesktopMenuBackdrop();
});
window.addEventListener("pageshow", resumeDesktopMenuBackdrop);
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
