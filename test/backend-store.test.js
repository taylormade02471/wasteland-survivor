const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { BackendStore } = require("../backend/store");
function store() { const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-backend-")); return new BackendStore(path.join(directory, "state.json")); }
test("player records exclude private profile information", () => {
  const backend = store();
  const player = backend.upsertPlayer({ deviceProfileId: "local-profile-1", displayName: "Night Ranger", avatarType: "ranger", level: 7, birthDate: "2000-01-01", contact: "private@example.com", pin: "1234" });
  assert.match(player.playerTag, /^WS-[A-F0-9]{8}$/); assert.equal(player.displayName, "Night Ranger");
  assert.equal(player.birthDate, undefined); assert.equal(player.contact, undefined); assert.equal(player.pin, undefined);
});
test("accepts a unique strict proposed tag only for a new player and preserves existing tags", () => {
  const backend = store();
  const proposed = backend.upsertPlayer({ deviceProfileId: "one", displayName: "One", playerTag: "WS-A1B2C3D4", contact: "private@example.com" });
  const updated = backend.upsertPlayer({ deviceProfileId: "one", displayName: "Renamed", playerTag: "WS-FFFFFFFF" });
  const collision = backend.upsertPlayer({ deviceProfileId: "two", displayName: "Two", playerTag: "WS-A1B2C3D4" });
  const invalid = backend.upsertPlayer({ deviceProfileId: "three", displayName: "Three", playerTag: "private@example.com" });

  assert.equal(proposed.playerTag, "WS-A1B2C3D4");
  assert.equal(updated.playerTag, "WS-A1B2C3D4");
  assert.notEqual(collision.playerTag, "WS-A1B2C3D4");
  assert.match(collision.playerTag, /^WS-[A-F0-9]{8}$/);
  assert.match(invalid.playerTag, /^WS-[A-F0-9]{8}$/);
  assert.equal(invalid.contact, undefined);
});
test("players persist and can be found by tag or display name", () => {
  const backend = store(); const player = backend.upsertPlayer({ deviceProfileId: "one", displayName: "Kyle", online: true });
  const reopened = new BackendStore(backend.filePath);
  assert.equal(reopened.findPlayer(player.playerTag)[0].id, player.id); assert.equal(reopened.findPlayer("kyl")[0].displayName, "Kyle"); assert.equal(reopened.findPlayer("kyl")[0].deviceProfileId, undefined);
});
test("verified provider identity restores one permanent player across device profiles without storing a raw phone", () => {
  const backend = store();
  const player = backend.upsertPlayer({ deviceProfileId: "device-one", displayName: "Kyle", playerTag: "WS-A1B2C3D4" });
  backend.bindVerifiedIdentity({ providerUid: "firebase-user-1", playerId: player.id, phoneHint: "+1 ••• ••• 0123" });
  backend.addDeviceProfile(player.id, "device-two");

  assert.equal(backend.playerByProviderUid("firebase-user-1").playerTag, "WS-A1B2C3D4");
  assert.equal(backend.playerByDeviceProfileId("device-two").id, player.id);
  assert.throws(() => backend.bindVerifiedIdentity({ providerUid: "firebase-user-2", playerId: player.id, phoneHint: "+16155550123" }), /masked/i);

  const persisted = fs.readFileSync(backend.filePath, "utf8");
  assert.equal(persisted.includes("+16155550123"), false);
  assert.equal(JSON.stringify(backend.findPlayer("Kyle")).includes("firebase-user-1"), false);
  assert.equal(JSON.stringify(backend.dashboard([])).includes("firebase-user-1"), false);
});
test("a player accepts only one verified phone identity", () => {
  const backend = store();
  const player = backend.upsertPlayer({ deviceProfileId: "device-one", displayName: "Kyle" });
  backend.bindVerifiedIdentity({ providerUid: "firebase-user-1", playerId: player.id, phoneHint: "+1 ••• ••• 0123" });

  assert.throws(
    () => backend.bindVerifiedIdentity({ providerUid: "firebase-user-2", playerId: player.id, phoneHint: "+1 ••• ••• 0124" }),
    /player is already linked/i,
  );
  assert.equal(backend.playerByProviderUid("firebase-user-2"), null);
});
test("a device profile alias cannot move between players", () => {
  const backend = store();
  const first = backend.upsertPlayer({ deviceProfileId: "device-one", displayName: "One" });
  const second = backend.upsertPlayer({ deviceProfileId: "device-two", displayName: "Two" });

  assert.throws(() => backend.addDeviceProfile(first.id, "device-two"), /different player/i);
  assert.equal(backend.playerByDeviceProfileId("device-two").id, second.id);
});
test("friends, invitations, matches, and dashboard totals work", () => {
  const backend = store(); const one = backend.upsertPlayer({ deviceProfileId: "one", displayName: "One" }); const two = backend.upsertPlayer({ deviceProfileId: "two", displayName: "Two" });
  assert.equal(backend.addFriend(one.id, two.id).status, "accepted"); assert.equal(backend.createInvite({ fromPlayerId: one.id, toPlayerId: two.id, room: "ABC123", mode: "2v2" }).status, "pending");
  backend.recordMatch({ mode: "2v2", map: "wasteland", players: [one.id, two.id], score: { blue: 2, red: 1 } });
  assert.deepEqual(backend.dashboard([{ id: "room-1", players: 2 }]).totals, { players: 2, onlinePlayers: 0, matches: 1, completedMatches: 1, activeRooms: 1 });
});
