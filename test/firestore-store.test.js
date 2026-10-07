const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { BackendStore } = require("../backend/store");
const {
  consumeFirestorePhoneTokenUse,
  createBackendStore,
  createFirestoreBackendStore,
} = require("../backend/firestore-store");

const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

class FakeSnapshot {
  constructor(value) {
    this.exists = value !== undefined;
    this.value = clone(value);
  }
  data() { return clone(this.value); }
}

class FakeDocument {
  constructor(firestore, documentPath) {
    this.firestore = firestore;
    this.path = documentPath;
  }
  get() { return Promise.resolve(new FakeSnapshot(this.firestore.documents.get(this.path))); }
  set(value, options = {}) { this.firestore.write(this.path, value, options); return Promise.resolve(); }
  create(value) {
    if (this.firestore.documents.has(this.path)) return Promise.reject(Object.assign(new Error("already exists"), { code: 6 }));
    this.firestore.write(this.path, value);
    return Promise.resolve();
  }
  collection(name) {
    return { doc: id => new FakeDocument(this.firestore, `${this.path}/${name}/${id}`) };
  }
}

class FakeTransaction {
  constructor(firestore) {
    this.firestore = firestore;
    this.writes = new Map();
  }
  async get(reference) {
    const value = this.writes.has(reference.path) ? this.writes.get(reference.path) : this.firestore.documents.get(reference.path);
    return new FakeSnapshot(value);
  }
  create(reference, value) {
    if (this.firestore.documents.has(reference.path) || this.writes.has(reference.path)) {
      throw Object.assign(new Error("already exists"), { code: 6 });
    }
    this.writes.set(reference.path, clone(value));
  }
  set(reference, value, options = {}) {
    const existing = this.writes.has(reference.path) ? this.writes.get(reference.path) : this.firestore.documents.get(reference.path);
    this.writes.set(reference.path, options.merge ? { ...(clone(existing) || {}), ...clone(value) } : clone(value));
  }
  commit() {
    for (const [documentPath, value] of this.writes) this.firestore.documents.set(documentPath, clone(value));
  }
}

class FakeFirestore {
  constructor() {
    this.documents = new Map();
    this.transactionQueue = Promise.resolve();
  }
  collection(name) { return { doc: id => new FakeDocument(this, `${name}/${id}`) }; }
  write(documentPath, value, options = {}) {
    const existing = this.documents.get(documentPath);
    this.documents.set(documentPath, options.merge ? { ...(clone(existing) || {}), ...clone(value) } : clone(value));
  }
  runTransaction(callback) {
    const run = async () => {
      const transaction = new FakeTransaction(this);
      const result = await callback(transaction);
      transaction.commit();
      return result;
    };
    const result = this.transactionQueue.then(run, run);
    this.transactionQueue = result.then(() => undefined, () => undefined);
    return result;
  }
  terminate() { return Promise.resolve(); }
  recordsContaining(segment) {
    return [...this.documents.entries()].filter(([documentPath]) => documentPath.includes(`/${segment}/`));
  }
}

function cacheFile(t, prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return path.join(directory, "state.json");
}

function phoneLink(providerUid, deviceProfileId, displayName, overrides = {}) {
  return {
    providerUid,
    phoneHint: "+1 ••• ••• 0123",
    deviceProfileId,
    ownershipCredentialHash: "",
    sessionPlayerId: "",
    newDeviceCredentialHash: "d".repeat(64),
    player: { displayName, avatarType: "scout", online: true },
    ...overrides,
  };
}
test("storage factory uses the file store when Firestore is not configured", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-storage-"));
  const store = createBackendStore({ rootDirectory: directory, env: { DATA_FILE: path.join(directory, "state.json") } });
  await store.ready;
  assert.equal(store.storageType, "file");
  assert.equal(store.upsertPlayer({ deviceProfileId: "one", displayName: "Local" }).displayName, "Local");
});

test("Firestore token claims use atomic create-if-absent semantics at a private seam", async () => {
  assert.equal(typeof consumeFirestorePhoneTokenUse, "function");
  const records = new Map();
  const document = {
    collection(name) {
      assert.equal(name, "privatePhoneTokenUses");
      return {
        doc(fingerprint) {
          return {
            async create(record) {
              if (records.has(fingerprint)) {
                const error = new Error("already exists");
                error.code = 6;
                throw error;
              }
              records.set(fingerprint, record);
            },
          };
        },
      };
    },
  };
  const claim = { fingerprint: "a".repeat(64), expiresAt: 1_000_000 };

  const results = await Promise.all([
    consumeFirestorePhoneTokenUse(document, claim),
    consumeFirestorePhoneTokenUse(document, claim),
  ]);

  assert.deepEqual(results.sort(), [false, true]);
  assert.deepEqual(records.get(claim.fingerprint), { expiresAt: claim.expiresAt });
});

test("two Firestore instances atomically reject conflicting device-alias claims and stale persists cannot erase the winner", async t => {
  assert.equal(typeof createFirestoreBackendStore, "function");
  const firestore = new FakeFirestore();
  const first = createFirestoreBackendStore({ firestore, collection: "testBackend", document: "shared", cacheFile: cacheFile(t, "wasteland-firestore-a-") });
  const second = createFirestoreBackendStore({ firestore, collection: "testBackend", document: "shared", cacheFile: cacheFile(t, "wasteland-firestore-b-") });
  await Promise.all([first.ready, second.ready]);
  const attempts = [
    phoneLink("provider-alpha", "shared-device", "Alpha"),
    phoneLink("provider-bravo", "shared-device", "Bravo"),
  ];

  const results = await Promise.allSettled([
    first.linkVerifiedPhoneAccount(attempts[0]),
    second.linkVerifiedPhoneAccount(attempts[1]),
  ]);

  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  assert.equal(firestore.recordsContaining("privateDeviceProfiles").length, 1);
  assert.equal(firestore.recordsContaining("privatePhoneIdentities").length, 1);
  assert.equal(firestore.recordsContaining("privatePhonePlayers").length, 1);

  const winner = results.findIndex(result => result.status === "fulfilled");
  second.persist();
  await second.writeQueue;
  const restarted = createFirestoreBackendStore({ firestore, collection: "testBackend", document: "shared", cacheFile: cacheFile(t, "wasteland-firestore-c-") });
  await restarted.ready;
  const restored = await restarted.linkVerifiedPhoneAccount(phoneLink(attempts[winner].providerUid, "restored-device", "Ignored", { player: {} }));
  assert.equal(restored.restored, true);
  assert.equal(restored.player.id, results[winner].value.player.id);
});

test("two Firestore instances cannot bind different provider UIDs to one legacy player", async t => {
  assert.equal(typeof createFirestoreBackendStore, "function");
  const firestore = new FakeFirestore();
  const seed = new BackendStore(cacheFile(t, "wasteland-firestore-seed-"));
  const legacy = seed.upsertPlayer({ deviceProfileId: "legacy-device", displayName: "Legacy" });
  const ownershipHash = "a".repeat(64);
  seed.setDeviceCredential(legacy.id, ownershipHash);
  await firestore.collection("testBackend").doc("shared").set({ state: seed.state });
  const first = createFirestoreBackendStore({ firestore, collection: "testBackend", document: "shared", cacheFile: cacheFile(t, "wasteland-firestore-d-") });
  const second = createFirestoreBackendStore({ firestore, collection: "testBackend", document: "shared", cacheFile: cacheFile(t, "wasteland-firestore-e-") });
  await Promise.all([first.ready, second.ready]);

  const results = await Promise.allSettled([
    first.linkVerifiedPhoneAccount(phoneLink("provider-one", "legacy-device", "Legacy", { ownershipCredentialHash: ownershipHash })),
    second.linkVerifiedPhoneAccount(phoneLink("provider-two", "legacy-device", "Legacy", { ownershipCredentialHash: ownershipHash })),
  ]);

  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  assert.equal(firestore.recordsContaining("privatePhoneIdentities").length, 1);
  assert.equal(firestore.recordsContaining("privatePhonePlayers").length, 1);
});

test("one provider UID cannot atomically claim two legacy players on separate Firestore instances", async t => {
  assert.equal(typeof createFirestoreBackendStore, "function");
  const firestore = new FakeFirestore();
  const seed = new BackendStore(cacheFile(t, "wasteland-firestore-seed-two-"));
  const firstPlayer = seed.upsertPlayer({ deviceProfileId: "legacy-one", displayName: "One" });
  const secondPlayer = seed.upsertPlayer({ deviceProfileId: "legacy-two", displayName: "Two" });
  const ownershipHash = "b".repeat(64);
  seed.setDeviceCredential(firstPlayer.id, ownershipHash);
  seed.setDeviceCredential(secondPlayer.id, ownershipHash);
  await firestore.collection("testBackend").doc("shared").set({ state: seed.state });
  const first = createFirestoreBackendStore({ firestore, collection: "testBackend", document: "shared", cacheFile: cacheFile(t, "wasteland-firestore-f-") });
  const second = createFirestoreBackendStore({ firestore, collection: "testBackend", document: "shared", cacheFile: cacheFile(t, "wasteland-firestore-g-") });
  await Promise.all([first.ready, second.ready]);

  const results = await Promise.allSettled([
    first.linkVerifiedPhoneAccount(phoneLink("shared-provider", "legacy-one", "One", { ownershipCredentialHash: ownershipHash })),
    second.linkVerifiedPhoneAccount(phoneLink("shared-provider", "legacy-two", "Two", { ownershipCredentialHash: ownershipHash })),
  ]);

  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  assert.equal(firestore.recordsContaining("privatePhoneIdentities").length, 1);
});
