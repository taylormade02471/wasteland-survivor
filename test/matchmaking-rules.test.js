import test from "node:test";
import assert from "node:assert/strict";

import {
  createMatchPlan,
  createTeamRoomId,
  normalizeTeamSize,
  parseTeamRoomId,
  teamCapacity,
} from "../public/matchmaking-rules.mjs";

test("normalizes supported team sizes and defaults invalid values to 2v2", () => {
  for (const value of [1, "1", "1v1"]) assert.equal(normalizeTeamSize(value), 1);
  for (const value of [2, "2", "2v2"]) assert.equal(normalizeTeamSize(value), 2);
  for (const value of [3, "3", "3v3"]) assert.equal(normalizeTeamSize(value), 3);
  for (const value of [0, 4, "3v2", "teams", null, undefined, NaN]) {
    assert.equal(normalizeTeamSize(value), 2);
  }
});

test("maps 1v1, 2v2, and 3v3 to capacities 2, 4, and 6", () => {
  assert.equal(teamCapacity(1), 2);
  assert.equal(teamCapacity(2), 4);
  assert.equal(teamCapacity(3), 6);
});

test("creates and parses team-size-specific room ids", () => {
  assert.equal(createTeamRoomId("wasteland", 1), "wasteland-teams-1v1");
  assert.equal(createTeamRoomId("toxic", 2), "toxic-teams-2v2");
  assert.equal(createTeamRoomId("ice", 3), "ice-teams-3v3");
  assert.deepEqual(parseTeamRoomId("inferno-teams-3v3"), { map: "inferno", teamSize: 3, capacity: 6 });
  assert.equal(parseTeamRoomId("wasteland-teams-3v2"), null);
  assert.equal(parseTeamRoomId("unknown-teams-2v2"), null);
});

test("fills every open 1v1 seat with a bot when no humans have joined", () => {
  assert.deepEqual(createMatchPlan(1, []), {
    teamSize: 1,
    capacity: 2,
    humanPlayers: 0,
    botPlayers: 2,
    slots: [
      { slot: 0, team: "alpha", teamSlot: 0, playerType: "bot", playerId: "bot-1" },
      { slot: 1, team: "bravo", teamSlot: 0, playerType: "bot", playerId: "bot-2" },
    ],
  });
});

test("fills only the open seats in an underfilled 2v2 room", () => {
  const plan = createMatchPlan(2, ["player-a", "player-b", "player-c"]);
  assert.equal(plan.humanPlayers, 3);
  assert.equal(plan.botPlayers, 1);
  assert.deepEqual(plan.slots, [
    { slot: 0, team: "alpha", teamSlot: 0, playerType: "human", playerId: "player-a" },
    { slot: 1, team: "bravo", teamSlot: 0, playerType: "human", playerId: "player-b" },
    { slot: 2, team: "alpha", teamSlot: 1, playerType: "human", playerId: "player-c" },
    { slot: 3, team: "bravo", teamSlot: 1, playerType: "bot", playerId: "bot-1" },
  ]);
});

test("adds no bots to a full 3v3 room", () => {
  const humans = ["p1", "p2", "p3", "p4", "p5", "p6"];
  const plan = createMatchPlan(3, humans);
  assert.equal(plan.capacity, 6);
  assert.equal(plan.humanPlayers, 6);
  assert.equal(plan.botPlayers, 0);
  assert.deepEqual(plan.slots.map(slot => slot.playerType), Array(6).fill("human"));
});

test("caps excess humans and keeps slot assignment stable and balanced", () => {
  const plan = createMatchPlan("invalid", ["p1", "p2", "p3", "p4", "p5"]);
  assert.equal(plan.teamSize, 2);
  assert.equal(plan.capacity, 4);
  assert.equal(plan.humanPlayers, 4);
  assert.equal(plan.botPlayers, 0);
  assert.deepEqual(plan.slots.map(({ team, teamSlot, playerId }) => ({ team, teamSlot, playerId })), [
    { team: "alpha", teamSlot: 0, playerId: "p1" },
    { team: "bravo", teamSlot: 0, playerId: "p2" },
    { team: "alpha", teamSlot: 1, playerId: "p3" },
    { team: "bravo", teamSlot: 1, playerId: "p4" },
  ]);
});
