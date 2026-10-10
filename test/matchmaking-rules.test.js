import test from "node:test";
import assert from "node:assert/strict";

import {
  createLobbyRoomId,
  createFreeForAllPlan,
  createMatchPlan,
  createTeamRoomId,
  normalizeTeamSize,
  parseTeamRoomId,
  parseFfaRoomId,
  resolveMatchCountdown,
  teamCapacity,
} from "../public/matchmaking-rules.mjs";

test("normalizes every multiplayer request to the four-player team format", () => {
  for (const value of [1, "1v1", 2, "2v2", 3, "3v3", 4, "4v4", null, undefined]) {
    assert.equal(normalizeTeamSize(value), 4);
  }
});

test("maps the team format to eight total seats", () => {
  assert.equal(teamCapacity(4), 8);
});

test("creates one connected-world team room and parses its eight seats", () => {
  assert.equal(createTeamRoomId("wasteland", 4), "immersive-teams-4v4");
  assert.equal(createTeamRoomId("inferno", 2), "immersive-teams-4v4");
  assert.deepEqual(parseTeamRoomId("immersive-teams-4v4"), { map: "immersive", teamSize: 4, capacity: 8 });
  assert.equal(parseTeamRoomId("wasteland-teams-3v3"), null);
});

test("routes all modes through the connected immersive world", () => {
  assert.equal(createLobbyRoomId({ map: "ice", mode: "solo", teamSize: 3, ctfPlayers: 6 }), "immersive-solo");
  assert.equal(createLobbyRoomId({ map: "toxic", mode: "teams", teamSize: 3, ctfPlayers: 4 }), "immersive-teams-4v4");
  assert.equal(createLobbyRoomId({ map: "inferno", mode: "ctf", teamSize: 2, ctfPlayers: 6 }), "immersive-ctf-6");
  assert.equal(createLobbyRoomId({ map: "wasteland", mode: "ffa" }), "immersive-ffa-6");
  assert.deepEqual(parseFfaRoomId("immersive-ffa-6"), { map: "immersive", players: 6, capacity: 6 });
});

test("free-for-all fills the six-player room without teams", () => {
  const plan = createFreeForAllPlan(["p1"]);
  assert.deepEqual({ mode: plan.mode, capacity: plan.capacity, humanPlayers: plan.humanPlayers, botPlayers: plan.botPlayers }, {
    mode: "ffa", capacity: 6, humanPlayers: 1, botPlayers: 5,
  });
  assert.ok(plan.slots.every(slot => slot.team === "free-for-all"));
  assert.equal(plan.slots.filter(slot => slot.playerType === "bot").length, 5);
});

test("derives synchronized countdown state from the authoritative start deadline", () => {
  assert.deepEqual(resolveMatchCountdown(25_000, 10_000), {
    startsAt: 25_000,
    millisecondsRemaining: 15_000,
    secondsRemaining: 15,
    expired: false,
  });
  assert.deepEqual(resolveMatchCountdown(9_000, 10_000), {
    startsAt: 9_000,
    millisecondsRemaining: 0,
    secondsRemaining: 0,
    expired: true,
  });
});

test("fills every open 4v4 seat with a bot when no humans have joined", () => {
  const plan = createMatchPlan(4, []);
  assert.equal(plan.teamSize, 4);
  assert.equal(plan.capacity, 8);
  assert.equal(plan.humanPlayers, 0);
  assert.equal(plan.botPlayers, 8);
  assert.deepEqual(plan.slots.slice(0, 2), [
    { slot: 0, team: "alpha", teamSlot: 0, playerType: "bot", playerId: "bot-1" },
    { slot: 1, team: "alpha", teamSlot: 1, playerType: "bot", playerId: "bot-2" },
  ]);
});

test("keeps the first four humans together and fills the opposing team with bots", () => {
  const plan = createMatchPlan(4, ["p1", "p2", "p3", "p4"]);
  assert.equal(plan.humanPlayers, 4);
  assert.equal(plan.botPlayers, 4);
  assert.deepEqual(plan.slots.slice(0, 4).map(slot => ({ team: slot.team, playerId: slot.playerId })), [
    { team: "alpha", playerId: "p1" },
    { team: "alpha", playerId: "p2" },
    { team: "alpha", playerId: "p3" },
    { team: "alpha", playerId: "p4" },
  ]);
  assert.ok(plan.slots.slice(4).every(slot => slot.team === "bravo" && slot.playerType === "bot"));
});

test("fills only the open seats in an underfilled 4v4 room", () => {
  const plan = createMatchPlan(4, ["player-a", "player-b", "player-c"]);
  assert.equal(plan.humanPlayers, 3);
  assert.equal(plan.botPlayers, 5);
  assert.deepEqual(plan.slots.slice(0, 4).map(({ team, playerId, playerType }) => ({ team, playerId, playerType })), [
    { team: "alpha", playerId: "player-a", playerType: "human" },
    { team: "alpha", playerId: "player-b", playerType: "human" },
    { team: "alpha", playerId: "player-c", playerType: "human" },
    { team: "alpha", playerId: "bot-1", playerType: "bot" },
  ]);
});

test("does not add bots to a full 4v4 room", () => {
  const humans = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
  const plan = createMatchPlan(4, humans);
  assert.equal(plan.capacity, 8);
  assert.equal(plan.humanPlayers, 8);
  assert.equal(plan.botPlayers, 0);
  assert.deepEqual(plan.slots.map(slot => slot.playerType), Array(8).fill("human"));
});

test("keeps excess humans out of a full room", () => {
  const plan = createMatchPlan("invalid", ["p1", "p2", "p3", "p4", "p5"]);
  assert.equal(plan.teamSize, 4);
  assert.equal(plan.capacity, 8);
  assert.equal(plan.humanPlayers, 5);
  assert.equal(plan.botPlayers, 3);
  assert.deepEqual(plan.slots.slice(4).map(({ team, teamSlot, playerId }) => ({ team, teamSlot, playerId })), [
    { team: "bravo", teamSlot: 0, playerId: "p5" },
    { team: "bravo", teamSlot: 1, playerId: "bot-1" },
    { team: "bravo", teamSlot: 2, playerId: "bot-2" },
    { team: "bravo", teamSlot: 3, playerId: "bot-3" },
  ]);
});
