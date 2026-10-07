const crypto = require("crypto");
const path = require("path");
const {
  applyVerifiedPhoneAccountState,
  BackendStore,
  BackendStoreError,
  cloneBackendState,
  findPlayerByDeviceProfileIdInState,
  identityForPlayerInState,
  normalizeBackendState,
  verifyDeviceCredentialInState,
} = require("./store");

const privateClaimHash = (kind, value) => crypto.createHash("sha256").update(`${kind}:${String(value || "")}`).digest("hex");

function mergePlayerState(remote, local) {
  if (!remote) return cloneBackendState(local);
  if (!local) return cloneBackendState(remote);
  const aliases = [...new Set([
    ...(remote.deviceProfileIds || []),
    remote.deviceProfileId,
    ...(local.deviceProfileIds || []),
    local.deviceProfileId,
  ].filter(Boolean))].slice(-10);
  const credentials = [...new Set([
    ...(remote.deviceCredentialHashes || (remote.deviceCredentialHash ? [remote.deviceCredentialHash] : [])),
    ...(local.deviceCredentialHashes || (local.deviceCredentialHash ? [local.deviceCredentialHash] : [])),
  ])].slice(-5);
  const merged = {
    ...remote,
    ...local,
    deviceProfileId: remote.deviceProfileId || local.deviceProfileId || aliases[0] || "",
    deviceProfileIds: aliases,
    deviceCredentialHashes: credentials,
    playerTag: remote.playerTag || local.playerTag,
  };
  delete merged.deviceCredentialHash;
  return merged;
}

function mergeFirestoreState(remoteSource, localSource, remoteExists = true) {
  const remote = normalizeBackendState(remoteSource);
  const local = normalizeBackendState(localSource);
  if (!remoteExists) {
    local.phoneTokenUses = {};
    return local;
  }
  const players = {};
  for (const id of new Set([...Object.keys(remote.players), ...Object.keys(local.players)])) {
    players[id] = mergePlayerState(remote.players[id], local.players[id]);
  }
  const auditById = new Map();
  for (const entry of [...remote.audit, ...local.audit]) if (entry?.id) auditById.set(entry.id, entry);
  return {
    version: Math.max(remote.version, local.version, 3),
    players,
    identities: cloneBackendState(remote.identities),
    phoneTokenUses: {},
    friendships: { ...remote.friendships, ...local.friendships },
    invites: { ...remote.invites, ...local.invites },
    matches: { ...remote.matches, ...local.matches },
    audit: [...auditById.values()].slice(-500),
  };
}

async function consumeFirestorePhoneTokenUse(document, { fingerprint, expiresAt } = {}) {
  const key = typeof fingerprint === "string" ? fingerprint.trim().toLowerCase() : "";
  const expiry = Number(expiresAt);
  if (!/^[a-f0-9]{64}$/.test(key) || !Number.isFinite(expiry)) throw new Error("A valid private phone token claim is required");
  try {
    await document.collection("privatePhoneTokenUses").doc(key).create({ expiresAt: expiry });
    return true;
  } catch (error) {
    if (error?.code === 6 || error?.code === "6" || error?.code === "already-exists") return false;
    throw error;
  }
}

class FirestoreBackendStore extends BackendStore {
  constructor({ projectId, databaseId, collection = "wastelandBackend", document = "production", cacheFile, firestore }) {
    super(cacheFile);
    if (firestore) this.firestore = firestore;
    else {
      const { Firestore } = require("@google-cloud/firestore");
      this.firestore = new Firestore({ projectId, databaseId: databaseId || "(default)" });
    }
    this.document = this.firestore.collection(collection).doc(document);
    this.storageType = "firestore";
    this.writeQueue = Promise.resolve();
    this.ready = this.document.get().then(snapshot => {
      if (snapshot.exists && snapshot.data()?.state) {
        this.state = normalizeBackendState(snapshot.data().state);
        this.state.phoneTokenUses = {};
        super.persist();
      }
      return this;
    });
  }
  persist() {
    super.persist();
    if (!this.document) return;
    const snapshot = JSON.parse(JSON.stringify(this.state));
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(() => this.firestore.runTransaction(async transaction => {
        const stored = await transaction.get(this.document);
        const merged = mergeFirestoreState(stored.data()?.state, snapshot, stored.exists);
        transaction.set(this.document, { state: merged, updatedAt: new Date().toISOString() }, { merge: false });
      }));
    return this.writeQueue;
  }
  consumePhoneAuthToken(claim) {
    return consumeFirestorePhoneTokenUse(this.document, claim);
  }
  async linkVerifiedPhoneAccount(input = {}) {
    try {
      await this.ready;
      await this.writeQueue;
      const providerUid = String(input.providerUid || "").trim();
      const deviceProfileId = String(input.deviceProfileId || "").trim();
      if (!providerUid || !deviceProfileId) throw new BackendStoreError("phone-account-invalid", "Verified account details are incomplete", 400);
      const providerUidHash = privateClaimHash("phone-provider", providerUid);
      const deviceProfileHash = privateClaimHash("device-profile", deviceProfileId);
      const identityReference = this.document.collection("privatePhoneIdentities").doc(providerUidHash);
      const aliasReference = this.document.collection("privateDeviceProfiles").doc(deviceProfileHash);
      const linked = await this.firestore.runTransaction(async transaction => {
        const [stateSnapshot, identitySnapshot, aliasSnapshot] = await Promise.all([
          transaction.get(this.document),
          transaction.get(identityReference),
          transaction.get(aliasReference),
        ]);
        const state = normalizeBackendState(stateSnapshot.data()?.state || this.state);
        const legacyIdentity = state.identities[providerUid];
        const legacyAliasOwner = findPlayerByDeviceProfileIdInState(state, deviceProfileId);
        const providerPlayerId = identitySnapshot.exists ? identitySnapshot.data()?.playerId : legacyIdentity?.playerId;
        const aliasPlayerId = aliasSnapshot.exists ? aliasSnapshot.data()?.playerId : legacyAliasOwner?.id;
        let restored = Boolean(providerPlayerId);
        let targetPlayerId = providerPlayerId || "";

        if (!targetPlayerId) {
          const source = input.player && typeof input.player === "object" ? input.player : {};
          if (typeof source.displayName !== "string" || !source.displayName.trim()) {
            throw new BackendStoreError("phone-account-not-found", "No player is linked to that verified phone", 404);
          }
          const sessionPlayer = input.sessionPlayerId ? state.players[input.sessionPlayerId] : null;
          if (aliasPlayerId && sessionPlayer && aliasPlayerId !== sessionPlayer.id) {
            throw new BackendStoreError("phone-device-conflict", "Device profile belongs to a different player", 409);
          }
          if (aliasPlayerId) {
            const ownsDevice = sessionPlayer?.id === aliasPlayerId
              || verifyDeviceCredentialInState(state, aliasPlayerId, input.ownershipCredentialHash);
            if (!ownsDevice) throw new BackendStoreError("phone-device-ownership-required", "Existing device ownership is required", 401);
            targetPlayerId = aliasPlayerId;
          } else if (sessionPlayer) targetPlayerId = sessionPlayer.id;
          else targetPlayerId = crypto.randomUUID();
        }

        const playerReference = this.document.collection("privatePhonePlayers").doc(targetPlayerId);
        const playerIdentitySnapshot = await transaction.get(playerReference);
        const claimedProviderHash = playerIdentitySnapshot.data()?.providerUidHash || "";
        const legacyPlayerIdentity = identityForPlayerInState(state, targetPlayerId);
        const legacyProviderHash = legacyPlayerIdentity ? privateClaimHash("phone-provider", legacyPlayerIdentity[0]) : "";
        if (claimedProviderHash && claimedProviderHash !== providerUidHash) {
          throw new BackendStoreError("phone-player-already-linked", "Player is already linked to a verified phone", 409);
        }
        if (!claimedProviderHash && legacyProviderHash && legacyProviderHash !== providerUidHash) {
          throw new BackendStoreError("phone-player-already-linked", "Player is already linked to a verified phone", 409);
        }
        if (aliasPlayerId && aliasPlayerId !== targetPlayerId) {
          throw new BackendStoreError("phone-device-conflict", "Device profile belongs to a different player", 409);
        }
        if (playerIdentitySnapshot.exists && claimedProviderHash === providerUidHash) restored = true;

        const working = cloneBackendState(state);
        const result = applyVerifiedPhoneAccountState(working, input, {
          playerId: targetPlayerId,
          restored,
          authoritative: true,
        });
        const linkedAt = new Date().toISOString();
        if (!identitySnapshot.exists) transaction.create(identityReference, { playerId: result.player.id, phoneHint: result.phoneHint, linkedAt });
        else transaction.set(identityReference, { playerId: result.player.id, phoneHint: result.phoneHint }, { merge: true });
        if (!playerIdentitySnapshot.exists) transaction.create(playerReference, { playerId: result.player.id, providerUidHash, linkedAt });
        if (!aliasSnapshot.exists) transaction.create(aliasReference, { playerId: result.player.id, linkedAt });
        transaction.set(this.document, { state: working, updatedAt: linkedAt }, { merge: false });
        return { result, state: working };
      });
      this.state = linked.state;
      try { super.persist(); } catch { /* Firestore is authoritative; the local cache is best-effort. */ }
      return linked.result;
    } catch (error) {
      if (error instanceof BackendStoreError) throw error;
      throw new BackendStoreError("account-storage-unavailable", "Account storage is temporarily unavailable", 503);
    }
  }
  async close() {
    await this.writeQueue;
    await this.firestore.terminate();
  }
}

function createFirestoreBackendStore(options) {
  return new FirestoreBackendStore(options);
}

function createBackendStore({ rootDirectory, env = process.env } = {}) {
  const cacheFile = env.DATA_FILE || path.join(rootDirectory, ".data", "backend.json");
  if (!env.FIRESTORE_PROJECT_ID) {
    const store = new BackendStore(cacheFile);
    store.storageType = "file";
    store.ready = Promise.resolve(store);
    return store;
  }
  return createFirestoreBackendStore({
    projectId: env.FIRESTORE_PROJECT_ID,
    databaseId: env.FIRESTORE_DATABASE_ID,
    collection: env.FIRESTORE_COLLECTION,
    document: env.FIRESTORE_DOCUMENT,
    cacheFile,
  });
}

module.exports = {
  consumeFirestorePhoneTokenUse,
  createBackendStore,
  createFirestoreBackendStore,
  FirestoreBackendStore,
  mergeFirestoreState,
};
