const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createBackendStore } = require("../backend/firestore-store");
test("storage factory uses the file store when Firestore is not configured", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-storage-"));
  const store = createBackendStore({ rootDirectory: directory, env: { DATA_FILE: path.join(directory, "state.json") } });
  await store.ready;
  assert.equal(store.storageType, "file");
  assert.equal(store.upsertPlayer({ deviceProfileId: "one", displayName: "Local" }).displayName, "Local");
});
