import assert from "node:assert/strict";
import test from "node:test";

import { CHARACTER_ARCHETYPE_IDS, getCharacterArchetype } from "../public/character-models.mjs";
import {
  SUPPORTED_FREE_FOR_ALL_ROOM_SIZES,
  createFreeForAllCharacterRoster,
} from "../public/character-roster.mjs";

const archetypeSet = new Set(CHARACTER_ARCHETYPE_IDS);

function human(id, preferredArchetype = null) {
  return {
    id,
    type: "human",
    playerTag: `WS-${id.toUpperCase().padEnd(8, "0").slice(0, 8)}`,
    displayName: `Player ${id}`,
    preferredArchetype,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertUniqueArchetypes(roster) {
  const assigned = roster.slots.map((slot) => slot.archetypeId);
  assert.equal(new Set(assigned).size, assigned.length);
  for (const archetypeId of assigned) assert.ok(archetypeSet.has(archetypeId), `${archetypeId} is a known archetype`);
}

test("exports the supported free-for-all room sizes", () => {
  assert.deepEqual(SUPPORTED_FREE_FOR_ALL_ROOM_SIZES, [4, 6]);
});

test("builds deterministic repeated output without mutating caller input", () => {
  const humans = [human("alpha", "ranger"), human("bravo", "medic")];
  const before = clone(humans);
  const first = createFreeForAllCharacterRoster({ roomSize: 4, seed: "dust-bowl", humans });
  const second = createFreeForAllCharacterRoster({ roomSize: 4, seed: "dust-bowl", humans });

  assert.deepEqual(first, second);
  assert.deepEqual(humans, before);
  assert.equal(first.slots.length, 4);
  assertUniqueArchetypes(first);
});

test("assigns four-player rosters with unique archetypes and stable bot IDs", () => {
  const roster = createFreeForAllCharacterRoster({
    roomSize: 4,
    seed: "garage",
    humans: [human("a", "scout"), human("b", "heavy")],
  });

  assert.deepEqual(roster.slots.map((slot) => slot.slotIndex), [0, 1, 2, 3]);
  assert.deepEqual(roster.slots.slice(0, 2).map((slot) => slot.id), ["a", "b"]);
  assert.deepEqual(roster.slots.slice(0, 2).map((slot) => slot.type), ["human", "human"]);
  assert.deepEqual(roster.slots.slice(2).map((slot) => slot.type), ["bot", "bot"]);
  assert.deepEqual(roster.slots.slice(2).map((slot) => slot.id), ["bot-garage-03", "bot-garage-04"]);
  assert.equal(new Set(roster.slots.map((slot) => slot.id)).size, 4);
  assertUniqueArchetypes(roster);
});

test("assigns six-player rosters with every archetype exactly once", () => {
  const roster = createFreeForAllCharacterRoster({
    roomSize: 6,
    seed: "six-pack",
    humans: [human("a", "scout"), human("b", "ranger"), human("c", "tech")],
  });

  assert.equal(roster.slots.length, 6);
  assert.deepEqual([...new Set(roster.slots.map((slot) => slot.archetypeId))].sort(), [...CHARACTER_ARCHETYPE_IDS].sort());
  assertUniqueArchetypes(roster);
});

test("solo six-player room becomes exactly one human and five bots using all rigs and classes", () => {
  const roster = createFreeForAllCharacterRoster({
    roomSize: 6,
    seed: "solo-night",
    humans: [human("solo", "warden")],
  });

  assert.equal(roster.slots.filter((slot) => slot.type === "human").length, 1);
  assert.equal(roster.slots.filter((slot) => slot.type === "bot").length, 5);
  assert.deepEqual(roster.slots.map((slot) => slot.archetypeId).sort(), [...CHARACTER_ARCHETYPE_IDS].sort());
  assert.deepEqual(
    roster.slots.map((slot) => slot.classId),
    roster.slots.map((slot) => getCharacterArchetype(slot.archetypeId).classId),
  );
});

test("preserves human order identity and honors valid preferences when possible", () => {
  const roster = createFreeForAllCharacterRoster({
    roomSize: 6,
    seed: "identity",
    humans: [
      human("first", "medic"),
      human("second", "ranger"),
      human("third", "heavy"),
    ],
  });

  assert.deepEqual(roster.slots.slice(0, 3).map((slot) => slot.id), ["first", "second", "third"]);
  assert.deepEqual(roster.slots.slice(0, 3).map((slot) => slot.playerTag), ["WS-FIRST000", "WS-SECOND00", "WS-THIRD000"]);
  assert.deepEqual(roster.slots.slice(0, 3).map((slot) => slot.archetypeId), ["medic", "ranger", "heavy"]);
});

test("resolves duplicate preferences deterministically by input order then seeded remaining choices", () => {
  const roster = createFreeForAllCharacterRoster({
    roomSize: 4,
    seed: "duplicate-choice",
    humans: [human("first", "tech"), human("second", "tech"), human("third", "tech")],
  });
  const repeated = createFreeForAllCharacterRoster({
    roomSize: 4,
    seed: "duplicate-choice",
    humans: [human("first", "tech"), human("second", "tech"), human("third", "tech")],
  });

  assert.deepEqual(roster, repeated);
  assert.equal(roster.slots[0].archetypeId, "tech");
  assert.notEqual(roster.slots[1].archetypeId, "tech");
  assert.notEqual(roster.slots[2].archetypeId, "tech");
  assertUniqueArchetypes(roster);
});

test("rejects invalid room sizes malformed humans duplicate IDs and overfilled rooms", () => {
  assert.throws(() => createFreeForAllCharacterRoster({ roomSize: 5, seed: "x", humans: [human("a")] }), /roomSize.*4.*6/i);
  assert.throws(() => createFreeForAllCharacterRoster({ roomSize: 4, seed: "x", humans: [human("a"), human("a")] }), /duplicate.*id/i);
  assert.throws(() => createFreeForAllCharacterRoster({ roomSize: 4, seed: "x", humans: [human("a"), human("b"), human("c"), human("d"), human("e")] }), /too many humans/i);
  assert.throws(() => createFreeForAllCharacterRoster({ roomSize: 4, seed: "x", humans: [{ id: "a", type: "bot" }] }), /type.*human/i);
  assert.throws(() => createFreeForAllCharacterRoster({ roomSize: 4, seed: "x", humans: [{ id: "a", type: "human", preferredArchetype: "sniper" }] }), /preferredArchetype/i);
  assert.throws(() => createFreeForAllCharacterRoster({ roomSize: 4, seed: "", humans: [human("a")] }), /seed/i);
  assert.throws(() => createFreeForAllCharacterRoster({ roomSize: 4, seed: "x", humans: "bad" }), /humans/i);
});

test("does not depend on THREE browser globals random time network storage or global state", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  const previousLocalStorage = globalThis.localStorage;
  const previousRandom = Math.random;
  const previousNow = Date.now;
  try {
    globalThis.window = undefined;
    globalThis.document = undefined;
    globalThis.fetch = () => { throw new Error("network not allowed"); };
    globalThis.localStorage = { getItem: () => { throw new Error("storage not allowed"); } };
    Math.random = () => { throw new Error("random not allowed"); };
    Date.now = () => { throw new Error("time not allowed"); };

    const roster = createFreeForAllCharacterRoster({ roomSize: 4, seed: "pure", humans: [human("a")] });
    assert.equal(roster.slots.length, 4);
    assertUniqueArchetypes(roster);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousLocalStorage;
    Math.random = previousRandom;
    Date.now = previousNow;
  }
});
