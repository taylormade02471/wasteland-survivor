import { getClassDefinition, normalizeClassProgress } from "./class-rules.mjs";
import { WEAPON_FAMILIES, getWeaponProfile } from "./combat-rules.mjs";
import { normalizeProfile, xpForLevel } from "./progression-rules.mjs";

export const LOBBY_AVATARS = Object.freeze([
  Object.freeze({ id: "scout", name: "Dust Scout", classId: "scout", image: "./assets/nightfall/characters/index/scout-v1.webp" }),
  Object.freeze({ id: "ranger", name: "Ranger", classId: "ranger", image: "./assets/nightfall/characters/index/ranger-v1.webp" }),
  Object.freeze({ id: "heavy", name: "Heavy", classId: "heavy", image: "./assets/nightfall/characters/index/heavy-v1.webp" }),
  Object.freeze({ id: "tech", name: "Tech Runner", classId: "tech", image: "./assets/nightfall/characters/index/tech-runner-v1.webp" }),
  Object.freeze({ id: "medic", name: "Field Medic", classId: "tech", image: "./assets/nightfall/characters/index/field-medic-v1.webp" }),
  Object.freeze({ id: "warden", name: "Warden", classId: "heavy", image: "./assets/nightfall/characters/index/warden-v1.webp" }),
]);

const AVATAR_BY_ID = new Map(LOBBY_AVATARS.map(avatar => [avatar.id, avatar]));
const MAX_SHIELD_LEVEL = 10;
export const PUBLIC_PLAYER_TAG_PATTERN = /^WS-[A-F0-9]{6,8}$/;

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || fallback;
}

export function normalizePublicPlayerTag(value) {
  if (typeof value !== "string") return "";
  const tag = value.trim().toUpperCase();
  return PUBLIC_PLAYER_TAG_PATTERN.test(tag) ? tag : "";
}

export function createStablePlayerTag(profileId) {
  const source = typeof profileId === "string" ? profileId.trim() : "";
  if (!source) return "";
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `WS-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function defaultProfileId() {
  return globalThis.crypto?.randomUUID?.() || "";
}

export function ensureProfileIdentity(profile = {}, createProfileId = defaultProfileId) {
  const source = profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {};
  const currentId = typeof source.profileId === "string" ? source.profileId.trim() : "";
  const generatedId = currentId || String(createProfileId?.() || "").trim();
  const currentTag = normalizePublicPlayerTag(source.playerTag);
  const generatedTag = currentTag || createStablePlayerTag(generatedId);
  return { ...source, profileId: generatedId, playerTag: generatedTag };
}

export function backfillProfileIdentities(profiles, createProfileId = defaultProfileId) {
  let changed = false;
  const normalized = (Array.isArray(profiles) ? profiles : []).map(profile => {
    const next = ensureProfileIdentity(profile, createProfileId);
    if (profile?.profileId !== next.profileId || profile?.playerTag !== next.playerTag) changed = true;
    return next;
  });
  return { profiles: normalized, changed };
}

export function applyAuthoritativePlayerIdentity(profile = {}, player = {}) {
  const local = ensureProfileIdentity(profile);
  const authoritativeTag = normalizePublicPlayerTag(player?.playerTag);
  const backendPlayerId = typeof player?.id === "string" && player.id.trim()
    ? player.id.trim()
    : local.backendPlayerId;
  return {
    ...local,
    ...(backendPlayerId ? { backendPlayerId } : {}),
    playerTag: authoritativeTag || local.playerTag,
  };
}

export function reduceLobbyConnectivity(state = {}, event = {}) {
  const current = {
    offlineMode: state?.offlineMode === true,
    playerServiceReachable: state?.playerServiceReachable === true,
    lobbySocketOpen: state?.lobbySocketOpen === true,
  };
  if (event?.type === "player-service-success") current.playerServiceReachable = true;
  if (event?.type === "player-service-failure") current.playerServiceReachable = false;
  if (event?.type === "lobby-socket-open") current.lobbySocketOpen = true;
  if (event?.type === "lobby-socket-closed") current.lobbySocketOpen = false;
  if (event?.type === "offline-changed") {
    current.offlineMode = event.offlineMode === true;
    if (current.offlineMode) {
      current.playerServiceReachable = false;
      current.lobbySocketOpen = false;
    }
  }
  return current;
}

export function resolveLobbyConnectivity(state = {}) {
  const online = state?.offlineMode !== true
    && (state?.playerServiceReachable === true || state?.lobbySocketOpen === true);
  return online
    ? { online: true, label: "Online" }
    : { online: false, label: "Local / Offline" };
}

function finiteWhole(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function normalizeWeapon(weaponId, weaponLevel) {
  const id = Object.hasOwn(WEAPON_FAMILIES, weaponId) ? weaponId : "scout";
  const definition = WEAPON_FAMILIES[id];
  const level = Math.min(definition.maxLevel, finiteWhole(weaponLevel));
  const weapon = getWeaponProfile(id, level);
  return { id: weapon.id, label: weapon.name, level: weapon.level };
}

export function createLobbyProfileView(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const activeProfile = source.activeProfile && typeof source.activeProfile === "object"
    ? source.activeProfile
    : {};
  const progress = source.progress && typeof source.progress === "object"
    ? source.progress
    : activeProfile.progress || {};
  const avatar = AVATAR_BY_ID.get(activeProfile.avatarType) || LOBBY_AVATARS[0];
  const normalizedProgress = normalizeProfile({
    name: activeProfile.name,
    xp: progress.totalXp ?? progress.xp,
  });
  const levelStart = xpForLevel(normalizedProgress.level);
  const nextLevel = xpForLevel(normalizedProgress.level + 1);
  const neededThisLevel = Math.max(1, nextLevel - levelStart);
  const earnedThisLevel = Math.min(neededThisLevel, Math.max(0, normalizedProgress.xp - levelStart));
  const classProgress = normalizeClassProgress({
    ...(source.classProgress && typeof source.classProgress === "object" ? source.classProgress : {}),
    classId: avatar.classId,
  });
  const classDefinition = getClassDefinition(classProgress.classId);
  const shieldLevel = Math.min(MAX_SHIELD_LEVEL, finiteWhole(source.shieldLevel ?? progress.shieldLevel));

  return {
    displayName: cleanText(activeProfile.name, "Survivor", 32),
    playerTag: normalizePublicPlayerTag(activeProfile.playerTag) || "TAG UNAVAILABLE",
    avatar: { ...avatar },
    level: normalizedProgress.level,
    xp: {
      total: normalizedProgress.xp,
      earnedThisLevel,
      neededThisLevel,
      percentage: Math.round((earnedThisLevel / neededThisLevel) * 100),
      label: `${earnedThisLevel.toLocaleString("en-US")} / ${neededThisLevel.toLocaleString("en-US")} XP`,
    },
    classLabel: classDefinition.label,
    skillLabel: classDefinition.passive.label,
    abilityLabel: classDefinition.ability.label,
    weapon: normalizeWeapon(source.activeWeapon, source.weaponLevel),
    shield: {
      level: shieldLevel,
      label: shieldLevel > 0 ? `Level ${shieldLevel}` : "Unreinforced",
    },
    network: resolveLobbyConnectivity(source.connectivity || {
      playerServiceReachable: source.online === true,
    }),
  };
}
