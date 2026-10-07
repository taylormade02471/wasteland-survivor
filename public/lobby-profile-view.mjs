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

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || fallback;
}

function normalizePlayerTag(value) {
  if (typeof value !== "string") return "LOCAL PROFILE";
  const tag = value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 18);
  return tag || "LOCAL PROFILE";
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
    playerTag: normalizePlayerTag(activeProfile.playerTag),
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
    network: source.online === true
      ? { online: true, label: "Online" }
      : { online: false, label: "Local / Offline" },
  };
}
