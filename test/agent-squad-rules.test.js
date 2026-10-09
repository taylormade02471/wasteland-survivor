import test from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_RIVALS,
  createAgentSquadRoom,
  createFreeForAllRoom,
  getCountdownState,
  updateAgentMemory,
  shareSquadIntel,
  selectAgentIntent,
  calculateAimSolution,
  createTesterReport,
  scoreFreeForAllPlayer,
  rankFreeForAll,
  determineFreeForAllWinner,
  createMatchmakingSearch,
  addMatchmakingHuman,
  advanceMatchmaking,
} from "../public/agent-squad-rules.mjs";

const HUMAN = { id: "player-kyle", name: "Kyle", kind: "human" };

test("Agent Squad starts only from an explicit human initiation", () => {
  assert.throws(
    () => createAgentSquadRoom({ initiated: false, human: HUMAN, seed: 17 }),
    /human initiation/i,
  );

  const room = createAgentSquadRoom({ initiated: true, human: HUMAN, seed: 17 });
  assert.equal(room.startedBy, HUMAN.id);
  assert.equal(room.localSimulation, true);
});

test("Agent Squad creates exactly five named AI rivals plus one human in unique slots", () => {
  const room = createAgentSquadRoom({ initiated: true, human: HUMAN, seed: 17 });
  const rivals = room.roster.filter((member) => member.kind === "ai");

  assert.equal(room.roster.length, 6);
  assert.equal(rivals.length, 5);
  assert.deepEqual(rivals.map((rival) => rival.name), [
    "Raman",
    "Parfit",
    "Heisenberg",
    "Banach",
    "Kierkegaard",
  ]);
  assert.equal(new Set(room.roster.map((member) => member.id)).size, 6);
  assert.equal(new Set(room.roster.map((member) => member.slot)).size, 6);
  assert.ok(rivals.every((rival) => rival.kind === "ai" && rival.networkClient === false));
});

test("Agent Squad preserves unique instance IDs even when a human uses an agent-like ID", () => {
  const room = createAgentSquadRoom({ initiated: true, human: { ...HUMAN, id: "agent-raman" }, seed: 17 });
  assert.equal(new Set(room.roster.map((member) => member.id)).size, 6);
});

test("rivals have measurably distinct tactical and visual profiles", () => {
  assert.equal(AGENT_RIVALS.length, 5);
  for (const field of ["role", "ability", "visualArchetype", "preferredRange", "aggression", "accuracy", "reactionMs"]) {
    assert.equal(new Set(AGENT_RIVALS.map((rival) => rival[field])).size, 5, field);
  }
  assert.equal(new Set(AGENT_RIVALS.map((rival) => JSON.stringify(rival.weights))).size, 5);
});

test("countdown has a deterministic 15-second preparation window", () => {
  const room = createAgentSquadRoom({ initiated: true, human: HUMAN, seed: 17, startedAtMs: 1_000 });
  assert.deepEqual(getCountdownState(room, 1_000), { phase: "preparing", remainingMs: 15_000, remainingSeconds: 15 });
  assert.deepEqual(getCountdownState(room, 15_999), { phase: "preparing", remainingMs: 1, remainingSeconds: 1 });
  assert.deepEqual(getCountdownState(room, 16_000), { phase: "active", remainingMs: 0, remainingSeconds: 0 });
});

test("memory tracks visible evidence and expires stale observations", () => {
  const visible = updateAgentMemory({}, [{ targetId: HUMAN.id, visible: true, position: { x: 4, z: 8 } }], 1_000);
  assert.equal(visible[HUMAN.id].lastSeenAtMs, 1_000);

  const remembered = updateAgentMemory(visible, [{ targetId: HUMAN.id, visible: false }], 3_000, { memoryDurationMs: 4_000 });
  assert.deepEqual(remembered[HUMAN.id].position, { x: 4, z: 8 });

  const expired = updateAgentMemory(remembered, [], 5_001, { memoryDurationMs: 4_000 });
  assert.equal(expired[HUMAN.id], undefined);
});

test("agents never target an unseen player without remembered evidence", () => {
  const agent = AGENT_RIVALS[0];
  const intent = selectAgentIntent({
    agent,
    observation: { self: { health: 100 }, targets: [{ id: HUMAN.id, visible: false, distance: 12 }] },
    memory: {},
    difficulty: "insane",
    seed: 91,
    tick: 10,
  });
  assert.equal(intent.targetId, null);
  assert.notEqual(intent.action, "fire");
});

test("squad intelligence shares only fresh teammate-verified visual evidence", () => {
  const shared = shareSquadIntel({
    memory: {},
    reports: [
      { targetId: HUMAN.id, reporterId: "agent-parfit", verifiedVisible: true, observedAtMs: 2_000, position: { x: 8, z: 3 } },
      { targetId: "rumor", reporterId: "agent-raman", verifiedVisible: false, observedAtMs: 2_000, position: { x: 99, z: 99 } },
      { targetId: "stale", reporterId: "agent-banach", verifiedVisible: true, observedAtMs: 1_000, position: { x: 2, z: 2 } },
    ],
    nowMs: 5_001,
    difficulty: "expert",
  });
  assert.equal(shared[HUMAN.id].source, "squad-visible-report");
  assert.equal(shared.rumor, undefined);
  assert.equal(shared.stale, undefined);
});

test("fixed seed produces deterministic decisions while archetypes choose differently", () => {
  const input = {
    observation: {
      self: { health: 72, position: { x: 0, z: 0 } },
      targets: [{ id: HUMAN.id, visible: true, distance: 19, position: { x: 10, z: 16 }, velocity: { x: 1, z: 0 } }],
      cover: [{ id: "cover-a", distance: 3 }],
      allies: [{ id: "ally", health: 40, distance: 5 }],
    },
    memory: {}, difficulty: "expert", seed: 404, tick: 8,
  };
  const first = selectAgentIntent({ ...input, agent: AGENT_RIVALS[0] });
  const repeat = selectAgentIntent({ ...input, agent: AGENT_RIVALS[0] });
  assert.deepEqual(first, repeat);

  const actions = AGENT_RIVALS.map((agent) => selectAgentIntent({ ...input, agent }).action);
  assert.ok(new Set(actions).size >= 3, actions.join(","));

  const loadouts = AGENT_RIVALS.map((agent) => selectAgentIntent({ ...input, agent }));
  assert.equal(new Set(loadouts.map((intent) => intent.weaponChoice)).size, 5);
  assert.deepEqual(loadouts.map((intent) => intent.abilityChoice), AGENT_RIVALS.map((agent) => agent.ability));
});

test("difficulty changes reaction, coordination, and error without changing health or visibility", () => {
  const easy = calculateAimSolution({
    shooter: AGENT_RIVALS[1], target: { position: { x: 10, z: 5 }, velocity: { x: 2, z: 0 } },
    projectileSpeed: 20, difficulty: "easy", seed: 22, tick: 4,
  });
  const insane = calculateAimSolution({
    shooter: AGENT_RIVALS[1], target: { position: { x: 10, z: 5 }, velocity: { x: 2, z: 0 } },
    projectileSpeed: 20, difficulty: "insane", seed: 22, tick: 4,
  });

  assert.equal(easy.healthMultiplier, 1);
  assert.equal(insane.healthMultiplier, 1);
  assert.equal(easy.requiresVisibility, true);
  assert.equal(insane.requiresVisibility, true);
  assert.ok(easy.reactionMs > insane.reactionMs);
  assert.ok(easy.errorDegrees > insane.errorDegrees);
  assert.ok(easy.errorDegrees <= 12 && insane.errorDegrees >= 0.35);
  assert.ok(easy.coordination < insane.coordination);
});

test("tester report derives accuracy, survival, tactical mix, and fairness metrics", () => {
  const report = createTesterReport([
    { agentId: "agent-raman", shots: 10, hits: 4, damage: 90, eliminations: 1, deaths: 1, survivalMs: 50_000, decisions: ["flank", "fire"] },
    { agentId: "agent-parfit", shots: 20, hits: 10, damage: 130, eliminations: 2, deaths: 0, survivalMs: 80_000, decisions: ["cover", "fire", "retreat"] },
  ]);
  assert.deepEqual(report.totals, { shots: 30, hits: 14, damage: 220, eliminations: 3, deaths: 1, survivalMs: 130_000 });
  assert.equal(report.accuracy, 14 / 30);
  assert.equal(report.averageSurvivalMs, 65_000);
  assert.deepEqual(report.decisionMix, { flank: 1, fire: 2, cover: 1, retreat: 1 });
  assert.equal(report.fairness.hiddenHealthMultiplier, 1);
  assert.equal(report.fairness.usesPlayerDamageRules, true);
});

test("FFA supports only 4 or 6 players and starts only when the user initiates", () => {
  assert.throws(() => createFreeForAllRoom({ initiated: false, human: HUMAN, size: 4, seed: 1 }), /human initiation/i);
  assert.throws(() => createFreeForAllRoom({ initiated: true, human: HUMAN, size: 5, seed: 1 }), /4 or 6/i);

  for (const size of [4, 6]) {
    const room = createFreeForAllRoom({ initiated: true, human: HUMAN, size, seed: 1 });
    assert.equal(room.mode, `ffa-${size}`);
    assert.equal(room.roster.length, size);
    assert.ok(room.roster.every((member) => member.teamId === null));
    assert.equal(room.teamScore, undefined);
    assert.equal(room.opponentModel, "all-vs-all");
    assert.equal(new Set(room.roster.map((member) => member.id)).size, size);
    assert.equal(room.startedBy, HUMAN.id);
  }
});

test("FFA preserves supplied humans and fills only open seats with named local bots", () => {
  const secondHuman = { id: "player-wife", name: "NightRanger", kind: "human" };
  const room = createFreeForAllRoom({ initiated: true, human: HUMAN, players: [secondHuman], size: 6, seed: 88 });
  assert.equal(room.roster.filter((member) => member.kind === "human").length, 2);
  assert.equal(room.roster.filter((member) => member.kind === "ai").length, 4);
  assert.ok(room.roster.filter((member) => member.kind === "ai").every((member) => member.networkClient === false));
});

test("solo six-player FFA immediately becomes one human plus five bots with no bot prompt", () => {
  const room = createFreeForAllRoom({ initiated: true, human: HUMAN, size: 6, seed: 29, autoFill: false });
  assert.equal(room.roster.length, 6);
  assert.equal(room.roster.filter((member) => member.kind === "human").length, 1);
  assert.equal(room.roster.filter((member) => member.kind === "ai").length, 5);
  assert.equal(room.requiresBotPrompt, false);
});

test("FFA assigns every roster slot a distinct class and visual avatar when possible", () => {
  const room = createFreeForAllRoom({ initiated: true, human: HUMAN, size: 6, seed: 31 });
  assert.equal(new Set(room.roster.map((member) => member.className)).size, 6);
  assert.equal(new Set(room.roster.map((member) => member.visualArchetype)).size, 6);
});

test("FFA individual score rewards eliminations and survival time without team score", () => {
  const score = scoreFreeForAllPlayer({ eliminations: 3, damage: 640, survivalMs: 92_500 });
  assert.deepEqual(score, {
    eliminations: 3,
    damage: 640,
    survivalMs: 92_500,
    score: 3_000 + 92,
  });
});

test("FFA ranking uses score then deterministic elimination, damage, survival, and id tie-breakers", () => {
  const ranked = rankFreeForAll([
    { id: "delta", eliminations: 2, damage: 500, survivalMs: 80_000, score: 100 },
    { id: "charlie", eliminations: 3, damage: 300, survivalMs: 90_000, score: 100 },
    { id: "bravo", eliminations: 3, damage: 700, survivalMs: 70_000, score: 100 },
    { id: "alpha", eliminations: 3, damage: 700, survivalMs: 90_000, score: 100 },
  ]);
  assert.deepEqual(ranked.map((entry) => entry.id), ["alpha", "bravo", "charlie", "delta"]);
});

test("last survivor ends the FFA round and winner helper is deterministic", () => {
  const active = determineFreeForAllWinner([
    { id: "alpha", alive: true, eliminations: 2, damage: 500, survivalMs: 50_000 },
    { id: "bravo", alive: true, eliminations: 1, damage: 400, survivalMs: 50_000 },
    { id: "charlie", alive: false, eliminations: 3, damage: 700, survivalMs: 45_000 },
    { id: "delta", alive: false, eliminations: 0, damage: 50, survivalMs: 10_000 },
  ]);
  assert.deepEqual(active, { ended: false, winnerId: null, reason: "multiple-survivors" });

  const ended = determineFreeForAllWinner([
    { id: "alpha", alive: true, eliminations: 2, damage: 500, survivalMs: 60_000 },
    { id: "bravo", alive: false, eliminations: 4, damage: 900, survivalMs: 55_000 },
    { id: "charlie", alive: false, eliminations: 1, damage: 300, survivalMs: 40_000 },
    { id: "delta", alive: false, eliminations: 0, damage: 50, survivalMs: 10_000 },
  ]);
  assert.deepEqual(ended, { ended: true, winnerId: "alpha", reason: "last-survivor" });
});

test("online matchmaking gives a lone player a backend-authoritative 30-second maximum wait", () => {
  const search = createMatchmakingSearch({ initiated: true, human: HUMAN, size: 6, seed: 44, requestedAtMs: 10_000 });
  assert.equal(search.status, "searching");
  assert.equal(search.deadlineAtMs, 40_000);
  assert.equal(search.roster.length, 1);
  assert.equal(search.authority, "backend");
  assert.deepEqual(advanceMatchmaking(search, 39_999), { ...search, remainingMs: 1 });
});

test("human arrivals deterministically shorten but never extend the matchmaking deadline", () => {
  let search = createMatchmakingSearch({ initiated: true, human: HUMAN, size: 6, seed: 44, requestedAtMs: 0 });
  search = addMatchmakingHuman(search, { id: "h2", name: "Two", kind: "human" }, 5_000);
  assert.equal(search.deadlineAtMs, 25_000);
  search = addMatchmakingHuman(search, { id: "h3", name: "Three", kind: "human" }, 6_000);
  assert.equal(search.deadlineAtMs, 21_000);
  search = addMatchmakingHuman(search, { id: "h4", name: "Four", kind: "human" }, 7_000);
  assert.equal(search.deadlineAtMs, 17_000);
  search = addMatchmakingHuman(search, { id: "h5", name: "Five", kind: "human" }, 8_000);
  assert.equal(search.deadlineAtMs, 13_000);

  const duplicate = addMatchmakingHuman(search, { id: "h5", name: "Five Again", kind: "human" }, 12_000);
  assert.equal(duplicate.deadlineAtMs, 13_000);
  assert.equal(duplicate.roster.length, 5);
});

test("a full matchmaking room starts immediately with one shared 15-second startsAt timestamp", () => {
  let search = createMatchmakingSearch({ initiated: true, human: HUMAN, size: 4, seed: 10, requestedAtMs: 1_000 });
  search = addMatchmakingHuman(search, { id: "h2", name: "Two", kind: "human" }, 2_000);
  search = addMatchmakingHuman(search, { id: "h3", name: "Three", kind: "human" }, 3_000);
  search = addMatchmakingHuman(search, { id: "h4", name: "Four", kind: "human" }, 4_000);

  assert.equal(search.status, "preparing");
  assert.equal(search.startsAtMs, 4_000);
  assert.equal(search.preparationEndsAtMs, 19_000);
  assert.ok(search.roster.every((member) => member.startsAtMs === 4_000));
  assert.equal(search.roster.filter((member) => member.kind === "ai").length, 0);
});

test("deadline transition fills every open seat with bots and shares one start timestamp", () => {
  let search = createMatchmakingSearch({ initiated: true, human: HUMAN, size: 6, seed: 99, requestedAtMs: 10_000 });
  search = addMatchmakingHuman(search, { id: "h2", name: "Two", kind: "human" }, 12_000);
  const waiting = advanceMatchmaking(search, 31_999);
  assert.equal(waiting.status, "searching");
  assert.equal(waiting.remainingMs, 1);

  const ready = advanceMatchmaking(search, 32_000);
  assert.equal(ready.status, "preparing");
  assert.equal(ready.roster.length, 6);
  assert.equal(ready.roster.filter((member) => member.kind === "human").length, 2);
  assert.equal(ready.roster.filter((member) => member.kind === "ai").length, 4);
  assert.equal(ready.startsAtMs, 32_000);
  assert.equal(ready.preparationEndsAtMs, 47_000);
  assert.equal(new Set(ready.roster.map((member) => member.startsAtMs)).size, 1);
});
