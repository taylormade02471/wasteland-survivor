const path = require("node:path");

const storeModule = require(path.join(process.cwd(), "backend", "firestore-store.js"));
const player = {
  id: "durability-player",
  deviceProfileId: "durability-device",
  deviceProfileIds: ["durability-device"],
  playerTag: "WS-D00AB1E",
  displayName: "Durability Test",
  avatarType: "scout",
  level: 1,
  online: true,
  stats: { kills: 0, deaths: 0, wins: 0, matches: 0 },
  progress: {},
};
const durableFailure = {
  then(_resolve, reject) {
    const error = new Error("Account storage is temporarily unavailable");
    error.code = "account-storage-unavailable";
    error.status = 503;
    reject(error);
  },
};

storeModule.createBackendStore = () => ({
  storageType: "firestore-test",
  ready: Promise.resolve(),
  consumePhoneAuthToken: () => true,
  linkVerifiedPhoneAccount: () => durableFailure,
  playerByProviderUid: () => null,
  playerByDeviceProfileId: () => null,
  playerById: id => id === player.id ? player : null,
  playerHasVerifiedIdentity: () => false,
  verifyDeviceCredential: () => false,
  upsertPlayer: () => player,
  bindVerifiedIdentity: () => undefined,
  addDeviceProfile: () => player,
  setDeviceCredential: () => undefined,
  phoneHintForPlayer: () => "+1 ••• ••• 0123",
  audit: () => undefined,
  persist: () => durableFailure,
});
