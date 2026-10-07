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
  assert.match(player.playerTag, /^WS-[A-F0-9]{6}$/); assert.equal(player.displayName, "Night Ranger");
  assert.equal(player.birthDate, undefined); assert.equal(player.contact, undefined); assert.equal(player.pin, undefined);
});
test("players persist and can be found by tag or display name", () => {
  const backend = store(); const player = backend.upsertPlayer({ deviceProfileId: "one", displayName: "Kyle", online: true });
  const reopened = new BackendStore(backend.filePath);
  assert.equal(reopened.findPlayer(player.playerTag)[0].id, player.id); assert.equal(reopened.findPlayer("kyl")[0].displayName, "Kyle"); assert.equal(reopened.findPlayer("kyl")[0].deviceProfileId, undefined);
});
test("friends, invitations, matches, and dashboard totals work", () => {
  const backend = store(); const one = backend.upsertPlayer({ deviceProfileId: "one", displayName: "One" }); const two = backend.upsertPlayer({ deviceProfileId: "two", displayName: "Two" });
  assert.equal(backend.addFriend(one.id, two.id).status, "accepted"); assert.equal(backend.createInvite({ fromPlayerId: one.id, toPlayerId: two.id, room: "ABC123", mode: "2v2" }).status, "pending");
  backend.recordMatch({ mode: "2v2", map: "wasteland", players: [one.id, two.id], score: { blue: 2, red: 1 } });
  assert.deepEqual(backend.dashboard([{ id: "room-1", players: 2 }]).totals, { players: 2, onlinePlayers: 0, matches: 1, completedMatches: 1, activeRooms: 1 });
});
