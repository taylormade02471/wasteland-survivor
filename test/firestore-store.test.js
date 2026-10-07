const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { consumeFirestorePhoneTokenUse, createBackendStore } = require("../backend/firestore-store");
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
