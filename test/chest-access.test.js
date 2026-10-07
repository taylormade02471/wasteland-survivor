const assert = require("node:assert/strict");
const test = require("node:test");
const { ChestAccess } = require("../backend/chest-access");

test("allows two players into a shared chest and queues the third", () => {
  const access = new ChestAccess(2);
  assert.equal(access.enter("room-a", "player-1").granted, true);
  assert.equal(access.enter("room-a", "player-2").granted, true);
  assert.deepEqual(access.enter("room-a", "player-3"), { granted: false, occupants: 2, capacity: 2 });
});

test("releases a slot when a player closes or disconnects", () => {
  const access = new ChestAccess(2);
  access.enter("room-a", "player-1");
  access.enter("room-a", "player-2");
  access.leave("room-a", "player-1");
  assert.equal(access.enter("room-a", "player-3").granted, true);
  access.removePlayer("player-2");
  assert.deepEqual(access.status("room-a"), { occupants: 1, capacity: 2 });
});
