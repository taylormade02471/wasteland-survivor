const path = require("path");
const { BackendStore } = require("./store");

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
  constructor({ projectId, databaseId, collection = "wastelandBackend", document = "production", cacheFile }) {
    super(cacheFile);
    const { Firestore } = require("@google-cloud/firestore");
    this.firestore = new Firestore({ projectId, databaseId: databaseId || "(default)" });
    this.document = this.firestore.collection(collection).doc(document);
    this.storageType = "firestore";
    this.writeQueue = Promise.resolve();
    this.ready = this.document.get().then(snapshot => {
      if (snapshot.exists && snapshot.data()?.state) {
        this.state = { ...this.state, ...snapshot.data().state, phoneTokenUses: {} };
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
      .then(() => this.document.set({ state: snapshot, updatedAt: new Date().toISOString() }, { merge: false }));
  }
  consumePhoneAuthToken(claim) {
    return consumeFirestorePhoneTokenUse(this.document, claim);
  }
  async close() {
    await this.writeQueue;
    await this.firestore.terminate();
  }
}

function createBackendStore({ rootDirectory, env = process.env } = {}) {
  const cacheFile = env.DATA_FILE || path.join(rootDirectory, ".data", "backend.json");
  if (!env.FIRESTORE_PROJECT_ID) {
    const store = new BackendStore(cacheFile);
    store.storageType = "file";
    store.ready = Promise.resolve(store);
    return store;
  }
  return new FirestoreBackendStore({
    projectId: env.FIRESTORE_PROJECT_ID,
    databaseId: env.FIRESTORE_DATABASE_ID,
    collection: env.FIRESTORE_COLLECTION,
    document: env.FIRESTORE_DOCUMENT,
    cacheFile,
  });
}

module.exports = { consumeFirestorePhoneTokenUse, FirestoreBackendStore, createBackendStore };
