import test from "node:test";
import assert from "node:assert/strict";

import { reduceClientMatchLifecycle } from "../public/matchmaking-client.mjs";

const plan = (startsAt = 25_000, generation = 1) => ({
  type: "match-ready",
  generation,
  startsAt,
  humanPlayers: 2,
  botPlayers: 0,
  slots: [
    { slot: 0, team: "alpha", playerType: "human", playerId: "player-a" },
    { slot: 1, team: "bravo", playerType: "human", playerId: "player-b" },
  ],
});

test("match-ready starts the authoritative plan only from loadout", () => {
  const message = plan();
  assert.deepEqual(reduceClientMatchLifecycle({
    phase: "loadout",
    activeMatchPlan: null,
    awaitingRematch: true,
  }, message), {
    action: "start-countdown",
    activeMatchPlan: message,
    awaitingRematch: false,
  });
});

test("match-ready is idempotent during its existing countdown", () => {
  const message = plan();
  assert.deepEqual(reduceClientMatchLifecycle({
    phase: "countdown",
    activeMatchPlan: message,
    awaitingRematch: false,
  }, message), {
    action: "ignore",
    activeMatchPlan: message,
    awaitingRematch: false,
  });
});

test("fresh match-ready plans cannot start behind countdown, combat, prep, or results", () => {
  for (const phase of ["countdown", "combat", "prep", "over"]) {
    assert.deepEqual(reduceClientMatchLifecycle({
      phase,
      activeMatchPlan: null,
      awaitingRematch: true,
    }, plan(30_000, 2)), {
      action: "hold-current-view",
      activeMatchPlan: null,
      awaitingRematch: true,
    }, phase);
  }
});

test("match-reset returns pre-combat clients to loadout", () => {
  for (const phase of ["loadout", "countdown"]) {
    assert.deepEqual(reduceClientMatchLifecycle({
      phase,
      activeMatchPlan: plan(),
      awaitingRematch: false,
    }, { type: "match-reset", awaitingRematch: true }), {
      action: "reset-loadout",
      activeMatchPlan: null,
      awaitingRematch: true,
    }, phase);
  }
});

test("match-reset preserves combat, prep, and results while queuing the rematch", () => {
  for (const phase of ["combat", "prep", "over"]) {
    assert.deepEqual(reduceClientMatchLifecycle({
      phase,
      activeMatchPlan: plan(),
      awaitingRematch: false,
    }, { type: "match-reset", awaitingRematch: true }), {
      action: "preserve-current-view",
      activeMatchPlan: null,
      awaitingRematch: true,
    }, phase);
  }
});

test("match-waiting records rematch state without changing the current view", () => {
  assert.deepEqual(reduceClientMatchLifecycle({
    phase: "loadout",
    activeMatchPlan: null,
    awaitingRematch: false,
  }, { type: "match-waiting", awaitingRematch: true, readyPlayers: 1 }), {
    action: "wait-for-rematch",
    activeMatchPlan: null,
    awaitingRematch: true,
  });
});
