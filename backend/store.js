const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const EMPTY_STATE = Object.freeze({ version: 4, players: {}, identities: {}, phoneTokenUses: {}, privatePreferences: {}, friendships: {}, invites: {}, matches: {}, audit: [] });
const cleanText = (value, maximum = 40) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
const PUBLIC_PLAYER_TAG_PATTERN = /^WS-[A-F0-9]{6,8}$/;
const proposedPlayerTag = value => typeof value === "string" && PUBLIC_PLAYER_TAG_PATTERN.test(value.trim()) ? value.trim() : "";
const randomPlayerTag = () => `WS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
function safeProgress(source = {}, existing = {}) {
  const guns = {};
  for (const id of ["scout", "cannon", "inferno"]) guns[id] = Math.max(0, Math.min(id === "inferno" ? 50 : id === "cannon" ? 100 : 999, Math.floor(Number(source.guns?.[id]) || existing.guns?.[id] || 0)));
  return {
    playerLevel: Math.max(1, Math.min(999, Math.floor(Number(source.playerLevel) || existing.playerLevel || 1))),
    totalXp: Math.max(0, Math.min(999999999, Math.floor(Number(source.totalXp) || existing.totalXp || 0))),
    storyStage: Math.max(1, Math.min(999, Math.floor(Number(source.storyStage) || existing.storyStage || 1))),
    missionIndex: Math.max(0, Math.min(99, Math.floor(Number(source.missionIndex) || existing.missionIndex || 0))),
    wave: Math.max(1, Math.min(9999, Math.floor(Number(source.wave) || existing.wave || 1))),
    score: Math.max(0, Math.min(999999999, Math.floor(Number(source.score) || existing.score || 0))),
    kills: Math.max(0, Math.min(999999999, Math.floor(Number(source.kills) || existing.kills || 0))),
    scrap: Math.max(0, Math.min(999999999, Math.floor(Number(source.scrap) || existing.scrap || 0))),
    shieldLevel: Math.max(0, Math.min(10, Math.floor(Number(source.shieldLevel) || existing.shieldLevel || 0))),
    kingdomUnlocked: Boolean(source.kingdomUnlocked ?? existing.kingdomUnlocked),
    guns,
    rewards: {
      winStreak: Math.max(0, Math.min(999, Math.floor(Number(source.rewards?.winStreak) || existing.rewards?.winStreak || 0))),
      lifetimeRewards: Math.max(0, Math.min(999999999, Math.floor(Number(source.rewards?.lifetimeRewards) || existing.rewards?.lifetimeRewards || 0))),
    },
  };
}

const CONTROLS_FAMILY_ALIASES = Object.freeze({ keyboard: "keyboard-mouse", mouse: "keyboard-mouse", "keyboard-mouse": "keyboard-mouse", touch: "touch", controller: "controller" });
function safePrivatePreferences(source = {}, existing = {}) {
  const current = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const prior = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  const controlsTourSeenFamilies = [];
  const existingFamilies = Array.isArray(prior.controlsTourSeenFamilies) ? prior.controlsTourSeenFamilies : [];
  const currentFamilies = Array.isArray(current.controlsTourSeenFamilies) ? current.controlsTourSeenFamilies : [];
  for (const value of [...existingFamilies, ...currentFamilies]) {
    const family = CONTROLS_FAMILY_ALIASES[String(value || "").toLowerCase()];
    if (family && !controlsTourSeenFamilies.includes(family)) controlsTourSeenFamilies.push(family);
  }
  return { controlsTourSeenFamilies };
}

class BackendStoreError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.name = "BackendStoreError";
    this.code = code;
    this.status = status;
  }
}

const cloneBackendState = state => JSON.parse(JSON.stringify(state || EMPTY_STATE));

function normalizeBackendState(source = {}) {
  const state = cloneBackendState(EMPTY_STATE);
  if (!source || typeof source !== "object") return state;
  state.version = Math.max(4, Math.floor(Number(source.version) || 0));
  for (const key of ["players", "identities", "phoneTokenUses", "privatePreferences", "friendships", "invites", "matches"]) {
    state[key] = source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) ? cloneBackendState(source[key]) : {};
  }
  state.audit = Array.isArray(source.audit) ? cloneBackendState(source.audit).slice(-500) : [];
  return state;
}

function findPlayerByDeviceProfileIdInState(state, deviceProfileId) {
  const profileId = cleanText(deviceProfileId, 80);
  if (!profileId) return null;
  return Object.values(state.players || {}).find(player => player.deviceProfileId === profileId || player.deviceProfileIds?.includes(profileId)) || null;
}

function identityForPlayerInState(state, playerId) {
  return Object.entries(state.identities || {}).find(([, identity]) => identity?.playerId === playerId) || null;
}

function verifyDeviceCredentialInState(state, playerId, credentialHash) {
  const player = state.players?.[playerId];
  const credentials = player?.deviceCredentialHashes || (player?.deviceCredentialHash ? [player.deviceCredentialHash] : []);
  return credentials.includes(credentialHash);
}

function issuePlayerTagInState(state, proposed = "") {
  const existingTags = new Set(Object.values(state.players || {}).map(player => player.playerTag));
  const accepted = proposedPlayerTag(proposed);
  if (accepted && !existingTags.has(accepted)) return accepted;
  let generated = randomPlayerTag();
  while (existingTags.has(generated)) generated = randomPlayerTag();
  return generated;
}

function appendAudit(state, action, detail = {}) {
  state.audit.push({ id: crypto.randomUUID(), action, at: new Date().toISOString(), ...detail });
  state.audit = state.audit.slice(-500);
}

function applyVerifiedPhoneAccountState(state, input = {}, { playerId = "", restored = false, authoritative = false } = {}) {
  const uid = cleanText(input.providerUid, 128);
  const hint = cleanText(input.phoneHint, 40);
  const profileId = cleanText(input.deviceProfileId, 80);
  const credentialHash = cleanText(input.newDeviceCredentialHash, 128);
  if (!uid || !profileId || !/^[a-f0-9]{64}$/.test(credentialHash)) {
    throw new BackendStoreError("phone-account-invalid", "Verified account details are incomplete", 400);
  }
  if (!/[\u2022*]/.test(hint) || hint.replace(/\D/g, "").length > 7) {
    throw new BackendStoreError("phone-hint-invalid", "Only a masked phone hint may be stored", 400);
  }

  let existing = playerId ? state.players[playerId] : null;
  if (playerId && !existing && restored) throw new BackendStoreError("phone-account-missing", "No player is linked to that verified phone", 404);
  const aliasOwner = findPlayerByDeviceProfileIdInState(state, profileId);
  if (aliasOwner && aliasOwner.id !== playerId) {
    if (!authoritative) throw new BackendStoreError("phone-device-conflict", "Device profile belongs to a different player", 409);
    aliasOwner.deviceProfileIds = (aliasOwner.deviceProfileIds || []).filter(id => id !== profileId);
    if (aliasOwner.deviceProfileId === profileId) aliasOwner.deviceProfileId = aliasOwner.deviceProfileIds[0] || "";
  }

  if (!existing) {
    const source = input.player && typeof input.player === "object" ? input.player : {};
    if (typeof source.displayName !== "string" || !source.displayName.trim()) {
      throw new BackendStoreError("phone-account-not-found", "No player is linked to that verified phone", 404);
    }
    const id = playerId || crypto.randomUUID();
    existing = {
      id,
      deviceProfileId: profileId,
      deviceProfileIds: [profileId],
      playerTag: issuePlayerTagInState(state, source.playerTag),
      displayName: cleanText(source.displayName, 24) || "Survivor",
      avatarType: ["scout", "ranger", "heavy", "tech"].includes(source.avatarType) ? source.avatarType : "scout",
      level: Math.max(1, Math.floor(Number(source.level) || 1)),
      online: Boolean(source.online),
      lastSeenAt: new Date().toISOString(),
      stats: {
        kills: Math.max(0, Math.floor(Number(source.stats?.kills) || 0)),
        deaths: Math.max(0, Math.floor(Number(source.stats?.deaths) || 0)),
        wins: Math.max(0, Math.floor(Number(source.stats?.wins) || 0)),
        matches: Math.max(0, Math.floor(Number(source.stats?.matches) || 0)),
      },
      progress: safeProgress(source.progress),
    };
    state.players[id] = existing;
    appendAudit(state, "player.created", { playerId: id });
  } else if (!restored) {
    const source = input.player && typeof input.player === "object" ? input.player : {};
    existing.deviceProfileIds = [...new Set([...(existing.deviceProfileIds || []), existing.deviceProfileId, profileId].filter(Boolean))].slice(-10);
    existing.displayName = cleanText(source.displayName, 24) || existing.displayName || "Survivor";
    existing.avatarType = ["scout", "ranger", "heavy", "tech"].includes(source.avatarType) ? source.avatarType : existing.avatarType || "scout";
    existing.level = Math.max(1, Math.floor(Number(source.level) || existing.level || 1));
    existing.online = Boolean(source.online);
    existing.lastSeenAt = new Date().toISOString();
    existing.stats = {
      kills: Math.max(0, Math.floor(Number(source.stats?.kills) || existing.stats?.kills || 0)),
      deaths: Math.max(0, Math.floor(Number(source.stats?.deaths) || existing.stats?.deaths || 0)),
      wins: Math.max(0, Math.floor(Number(source.stats?.wins) || existing.stats?.wins || 0)),
      matches: Math.max(0, Math.floor(Number(source.stats?.matches) || existing.stats?.matches || 0)),
    };
    existing.progress = safeProgress(source.progress, existing.progress);
    appendAudit(state, "player.updated", { playerId: existing.id });
  } else {
    existing.deviceProfileIds = [...new Set([...(existing.deviceProfileIds || []), existing.deviceProfileId, profileId].filter(Boolean))].slice(-10);
  }

  const existingUidIdentity = state.identities[uid];
  const existingPlayerIdentity = identityForPlayerInState(state, existing.id);
  if (!authoritative && existingUidIdentity && existingUidIdentity.playerId !== existing.id) {
    throw new BackendStoreError("phone-identity-conflict", "Verified identity is already linked", 409);
  }
  if (!authoritative && existingPlayerIdentity && existingPlayerIdentity[0] !== uid) {
    throw new BackendStoreError("phone-player-already-linked", "Player is already linked to a verified phone", 409);
  }
  if (authoritative) {
    for (const [knownUid, identity] of Object.entries(state.identities)) {
      if (knownUid === uid || identity?.playerId === existing.id) delete state.identities[knownUid];
    }
  }
  state.identities[uid] = {
    playerId: existing.id,
    phoneHint: hint,
    linkedAt: existingUidIdentity?.linkedAt || new Date().toISOString(),
  };
  const credentials = new Set(existing.deviceCredentialHashes || (existing.deviceCredentialHash ? [existing.deviceCredentialHash] : []));
  credentials.add(credentialHash);
  existing.deviceCredentialHashes = [...credentials].slice(-5);
  delete existing.deviceCredentialHash;
  appendAudit(state, restored ? "identity.phone-restored" : "identity.phone-created", { playerId: existing.id });
  return { restored, player: existing, phoneHint: hint };
}

class BackendStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = this.read();
  }
  read() {
    try {
      const stored = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return normalizeBackendState(stored);
    }
    catch { return JSON.parse(JSON.stringify(EMPTY_STATE)); }
  }
  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.state, null, 2));
    fs.renameSync(temporary, this.filePath);
  }
  audit(action, detail = {}) {
    this.state.audit.push({ id: crypto.randomUUID(), action, at: new Date().toISOString(), ...detail });
    this.state.audit = this.state.audit.slice(-500);
  }
  issuePlayerTag(proposed = "") {
    const existingTags = new Set(Object.values(this.state.players).map(player => player.playerTag));
    const accepted = proposedPlayerTag(proposed);
    if (accepted && !existingTags.has(accepted)) return accepted;
    let generated = randomPlayerTag();
    while (existingTags.has(generated)) generated = randomPlayerTag();
    return generated;
  }
  upsertPlayer(input = {}) {
    const deviceProfileId = cleanText(input.deviceProfileId, 80);
    if (!deviceProfileId) throw new Error("deviceProfileId is required");
    const existing = Object.values(this.state.players).find(player => player.deviceProfileId === deviceProfileId || player.deviceProfileIds?.includes(deviceProfileId));
    const id = existing?.id || crypto.randomUUID();
    const player = {
      id, deviceProfileId: existing?.deviceProfileId || deviceProfileId,
      deviceProfileIds: [...new Set([...(existing?.deviceProfileIds || []), existing?.deviceProfileId, deviceProfileId].filter(Boolean))].slice(-10),
      playerTag: existing?.playerTag || this.issuePlayerTag(input.playerTag),
      displayName: cleanText(input.displayName, 24) || existing?.displayName || "Survivor",
      avatarType: ["scout", "ranger", "heavy", "tech"].includes(input.avatarType) ? input.avatarType : existing?.avatarType || "scout",
      level: Math.max(1, Math.floor(Number(input.level) || existing?.level || 1)),
      online: Boolean(input.online), lastSeenAt: new Date().toISOString(),
      stats: {
        kills: Math.max(0, Math.floor(Number(input.stats?.kills) || existing?.stats?.kills || 0)),
        deaths: Math.max(0, Math.floor(Number(input.stats?.deaths) || existing?.stats?.deaths || 0)),
        wins: Math.max(0, Math.floor(Number(input.stats?.wins) || existing?.stats?.wins || 0)),
        matches: Math.max(0, Math.floor(Number(input.stats?.matches) || existing?.stats?.matches || 0)),
      },
      progress: safeProgress(input.progress, existing?.progress),
    };
    this.state.players[id] = player;
    this.audit(existing ? "player.updated" : "player.created", { playerId: id });
    this.persist();
    return player;
  }
  findPlayer(query) {
    const needle = cleanText(query, 80).toLowerCase();
    if (!needle) return [];
    return Object.values(this.state.players)
      .filter(player => player.playerTag.toLowerCase() === needle || player.displayName.toLowerCase().includes(needle))
      .map(({ deviceProfileId, deviceProfileIds, deviceCredentialHash, deviceCredentialHashes, ...player }) => player).slice(0, 20);
  }
  playerById(id) { return this.state.players[id] || null; }
  playerByDeviceProfileId(id) { return Object.values(this.state.players).find(player => player.deviceProfileId === id || player.deviceProfileIds?.includes(id)) || null; }
  playerByProviderUid(providerUid) {
    const identity = this.state.identities[cleanText(providerUid, 128)];
    return identity ? this.state.players[identity.playerId] || null : null;
  }
  bindVerifiedIdentity({ providerUid, playerId, phoneHint }) {
    const uid = cleanText(providerUid, 128);
    const hint = cleanText(phoneHint, 40);
    if (!uid || !this.state.players[playerId]) throw new Error("Verified identity requires a known player");
    if (!/[\u2022*]/.test(hint) || hint.replace(/\D/g, "").length > 7) throw new Error("Only a masked phone hint may be stored");
    const existing = this.state.identities[uid];
    if (existing && existing.playerId !== playerId) throw new Error("Verified identity is already linked");
    const playerIdentity = Object.entries(this.state.identities).find(([knownUid, identity]) => knownUid !== uid && identity.playerId === playerId);
    if (playerIdentity) throw new Error("Player is already linked to a verified phone");
    this.state.identities[uid] = { playerId, phoneHint: hint, linkedAt: existing?.linkedAt || new Date().toISOString() };
    this.audit("identity.phone-linked", { playerId });
    this.persist();
    return this.state.identities[uid];
  }
  phoneHintForPlayer(playerId) {
    return Object.values(this.state.identities).find(identity => identity.playerId === playerId)?.phoneHint || "";
  }
  playerHasVerifiedIdentity(playerId) {
    return Object.values(this.state.identities).some(identity => identity.playerId === playerId);
  }
  addDeviceProfile(playerId, deviceProfileId) {
    const player = this.state.players[playerId];
    const profileId = cleanText(deviceProfileId, 80);
    if (!player || !profileId) throw new Error("A known player and device profile are required");
    const owner = this.playerByDeviceProfileId(profileId);
    if (owner && owner.id !== playerId) throw new Error("Device profile belongs to a different player");
    player.deviceProfileIds = [...new Set([...(player.deviceProfileIds || []), player.deviceProfileId, profileId].filter(Boolean))].slice(-10);
    this.audit("player.device-linked", { playerId });
    this.persist();
    return player;
  }
  setDeviceCredential(playerId, credentialHash) {
    const player = this.state.players[playerId];
    if (!player) throw new Error("Unknown player");
    const credentials = new Set(player.deviceCredentialHashes || (player.deviceCredentialHash ? [player.deviceCredentialHash] : []));
    credentials.add(credentialHash);
    player.deviceCredentialHashes = [...credentials].slice(-5);
    delete player.deviceCredentialHash;
    this.audit("player.credential-issued", { playerId }); this.persist();
  }
  verifyDeviceCredential(playerId, credentialHash) {
    const player = this.state.players[playerId];
    const credentials = player?.deviceCredentialHashes || (player?.deviceCredentialHash ? [player.deviceCredentialHash] : []);
    return credentials.includes(credentialHash);
  }
  consumePhoneAuthToken({ fingerprint, expiresAt, now = Math.floor(Date.now() / 1000) } = {}) {
    const key = typeof fingerprint === "string" ? fingerprint.trim().toLowerCase() : "";
    const expiry = Number(expiresAt);
    const current = Math.floor(Number(now));
    if (!/^[a-f0-9]{64}$/.test(key) || !Number.isFinite(expiry) || !Number.isFinite(current) || expiry <= current) {
      throw new Error("A valid private phone token claim is required");
    }
    for (const [known, knownExpiry] of Object.entries(this.state.phoneTokenUses)) {
      if (!Number.isFinite(Number(knownExpiry)) || Number(knownExpiry) <= current) delete this.state.phoneTokenUses[known];
    }
    if (this.state.phoneTokenUses[key]) return false;
    this.state.phoneTokenUses[key] = expiry;
    this.persist();
    return true;
  }
  async linkVerifiedPhoneAccount(input = {}) {
    const uid = cleanText(input.providerUid, 128);
    const profileId = cleanText(input.deviceProfileId, 80);
    const source = input.player && typeof input.player === "object" ? input.player : {};
    let player = this.playerByProviderUid(uid);
    const restored = Boolean(player);
    if (!player) {
      if (typeof source.displayName !== "string" || !source.displayName.trim()) {
        throw new BackendStoreError("phone-account-not-found", "No player is linked to that verified phone", 404);
      }
      const profileOwner = this.playerByDeviceProfileId(profileId);
      const sessionOwner = input.sessionPlayerId ? this.playerById(input.sessionPlayerId) : null;
      if (profileOwner && sessionOwner && profileOwner.id !== sessionOwner.id) {
        throw new BackendStoreError("phone-device-conflict", "Device profile belongs to a different player", 409);
      }
      if (profileOwner) {
        const ownsDevice = sessionOwner?.id === profileOwner.id
          || this.verifyDeviceCredential(profileOwner.id, input.ownershipCredentialHash);
        if (!ownsDevice) throw new BackendStoreError("phone-device-ownership-required", "Existing device ownership is required", 401);
        player = profileOwner;
      } else if (sessionOwner) {
        player = sessionOwner;
      }
      if (player && this.playerHasVerifiedIdentity(player.id)) {
        throw new BackendStoreError("phone-player-already-linked", "Player is already linked to a verified phone", 409);
      }
    } else {
      const profileOwner = this.playerByDeviceProfileId(profileId);
      if (profileOwner && profileOwner.id !== player.id) {
        throw new BackendStoreError("phone-device-conflict", "Device profile belongs to a different player", 409);
      }
    }

    const previous = this.state;
    const working = cloneBackendState(this.state);
    const result = applyVerifiedPhoneAccountState(working, input, { playerId: player?.id, restored });
    this.state = working;
    try {
      this.persist();
      return result;
    } catch {
      this.state = previous;
      throw new BackendStoreError("account-storage-unavailable", "Account storage is temporarily unavailable", 503);
    }
  }
  privatePreferencesForPlayer(playerId) {
    if (!this.state.players[playerId]) return null;
    return safePrivatePreferences(this.state.privatePreferences[playerId]);
  }
  async setPrivatePreferences(playerId, input = {}) {
    if (!this.state.players[playerId]) throw new BackendStoreError("player-not-found", "Unknown player", 404);
    const previous = this.state.privatePreferences[playerId];
    const preferences = safePrivatePreferences(input, previous);
    this.state.privatePreferences[playerId] = preferences;
    this.audit("player.preferences-updated", { playerId });
    try {
      await this.persist();
      return cloneBackendState(preferences);
    } catch {
      if (previous) this.state.privatePreferences[playerId] = previous;
      else delete this.state.privatePreferences[playerId];
      throw new BackendStoreError("preferences-storage-unavailable", "Private preferences are temporarily unavailable", 503);
    }
  }
  addFriend(playerId, friendId) {
    if (!this.state.players[playerId] || !this.state.players[friendId] || playerId === friendId) throw new Error("Invalid friendship");
    const key = [playerId, friendId].sort().join(":");
    this.state.friendships[key] = { players: [playerId, friendId], status: "accepted", createdAt: new Date().toISOString() };
    this.audit("friend.accepted", { playerId, friendId }); this.persist();
    return this.state.friendships[key];
  }
  createInvite({ fromPlayerId, toPlayerId, room, mode }) {
    if (!this.state.players[fromPlayerId] || !this.state.players[toPlayerId]) throw new Error("Unknown player");
    const invite = { id: crypto.randomUUID(), fromPlayerId, toPlayerId, room: cleanText(room, 80), mode: cleanText(mode, 24), status: "pending", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() };
    this.state.invites[invite.id] = invite;
    this.audit("invite.created", { inviteId: invite.id, fromPlayerId, toPlayerId }); this.persist();
    return invite;
  }
  recordMatch(input = {}) {
    const match = {
      id: cleanText(input.id, 80) || crypto.randomUUID(), room: cleanText(input.room, 80),
      mode: cleanText(input.mode, 24), map: cleanText(input.map, 24),
      status: ["waiting", "active", "complete", "abandoned"].includes(input.status) ? input.status : "complete",
      players: Array.isArray(input.players) ? input.players.filter(id => this.state.players[id]).slice(0, 12) : [],
      score: input.score && typeof input.score === "object" ? input.score : {},
      startedAt: input.startedAt || new Date().toISOString(), endedAt: input.endedAt || new Date().toISOString(),
    };
    this.state.matches[match.id] = match;
    this.audit("match.recorded", { matchId: match.id, status: match.status }); this.persist();
    return match;
  }
  dashboard(activeRooms = []) {
    const players = Object.values(this.state.players), matches = Object.values(this.state.matches);
    return {
      generatedAt: new Date().toISOString(),
      totals: { players: players.length, onlinePlayers: players.filter(player => player.online).length, matches: matches.length, completedMatches: matches.filter(match => match.status === "complete").length, activeRooms: activeRooms.length },
      activeRooms,
      recentMatches: matches.sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt))).slice(0, 20),
      recentAudit: this.state.audit.slice(-40).reverse(),
    };
  }
}
module.exports = {
  applyVerifiedPhoneAccountState,
  BackendStore,
  BackendStoreError,
  cloneBackendState,
  findPlayerByDeviceProfileIdInState,
  identityForPlayerInState,
  normalizeBackendState,
  PUBLIC_PLAYER_TAG_PATTERN,
  safePrivatePreferences,
  verifyDeviceCredentialInState,
};
