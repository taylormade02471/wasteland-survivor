import test from "node:test";
import assert from "node:assert/strict";

import * as agentRules from "../public/agent-squad-rules.mjs";

const { simulateAgentMatch, simulateAgentMatchSeries } = agentRules;

const HUMAN = { id: "player-kyle", name: "Kyle", kind: "human" };

test("simulated agent matches use all six roster slots and produce observable combat", () => {
  const result = simulateAgentMatch({ initiated: true, human: HUMAN, seed: 42, durationMs: 30_000, stepMs: 250 });

  assert.equal(result.room.roster.length, 6);
  assert.equal(result.room.localSimulation, true);
  assert.ok(result.events.length > 0);
  assert.ok(result.samples.every(sample => sample.shots >= sample.hits));
  assert.ok(result.report.totals.shots > 0);
  assert.equal(result.report.fairness.hiddenHealthMultiplier, 1);
  assert.equal(result.report.fairness.omniscience, false);
  assert.ok(result.entries.every(entry => entry.survivalMs >= 0));
});

test("simulated matches are deterministic and reuse the selected difficulty", () => {
  const options = { initiated: true, human: HUMAN, seed: 7, difficulty: "expert", durationMs: 20_000, stepMs: 500 };
  const first = simulateAgentMatch(options);
  const second = simulateAgentMatch(options);

  assert.equal(first.difficulty, "expert");
  assert.deepEqual(first.entries, second.entries);
  assert.deepEqual(first.events, second.events);
  assert.equal(first.winnerId, second.winnerId);
});

test("simulation series aggregates tester evidence across multiple matches", () => {
  const series = simulateAgentMatchSeries({ initiated: true, human: HUMAN, seed: 11, matches: 3, durationMs: 12_000, stepMs: 500 });

  assert.equal(series.matches.length, 3);
  assert.equal(series.report.totals.shots, series.matches.reduce((sum, match) => sum + match.report.totals.shots, 0));
  assert.equal(Object.values(series.winnerCounts).reduce((sum, count) => sum + count, 0), 3);
  assert.ok(series.report.totals.damage > 0);
});

test("full game audit covers modes, maps, difficulty, movement, and combat systems", () => {
  assert.equal(typeof agentRules.runFullGameAudit, "function");
  if (typeof agentRules.runFullGameAudit !== "function") return;
  const audit = agentRules.runFullGameAudit({ matches: 1_000, seed: 20261008 });

  assert.equal(audit.matches, 1_000);
  assert.equal(Object.values(audit.modeCounts).reduce((sum, count) => sum + count, 0), 1_000);
  assert.ok(Object.values(audit.modeCounts).every(count => count > 0));
  assert.ok(Object.values(audit.mapCounts).every(count => count > 0));
  assert.ok(Object.values(audit.difficultyCounts).every(count => count > 0));
  assert.ok(Object.values(audit.movementCounts).every(count => count > 0));
  assert.ok(audit.metrics.shots > 0);
  assert.ok(audit.metrics.hits > 0);
  assert.ok(audit.metrics.overheatEvents > 0);
  assert.ok(audit.metrics.flagCaptures > 0);
  assert.ok(audit.score.overallPercent >= 0 && audit.score.overallPercent <= 100);
  assert.match(audit.score.rating, /^[1-5](\.\d)?\/5$/);
});

test("expert average-gamer stress audit runs sixteen ranger profiles with actionable findings", () => {
  assert.equal(typeof agentRules.runExpertAverageGamerAudit, "function");
  if (typeof agentRules.runExpertAverageGamerAudit !== "function") return;
  const audit = agentRules.runExpertAverageGamerAudit({ matches: 16, players: 16, seed: 20261008 });

  assert.equal(audit.matches, 16);
  assert.equal(audit.players, 16);
  assert.equal(audit.difficulty, "expert");
  assert.equal(audit.experienceBand, "average-gamer-range");
  assert.equal(audit.roster.length, 16);
  assert.ok(audit.roster.every(player => player.className === "Ranger"));
  assert.ok(audit.metrics.shots > 0);
  assert.ok(audit.metrics.hits > 0);
  assert.ok(audit.metrics.overheatEvents > 0);
  assert.ok(audit.metrics.cooldownEvents > 0);
  assert.ok(audit.metrics.respawns > 0);
  assert.ok(audit.metrics.flagContests > 0);
  assert.ok(audit.findings.length > 0);
  assert.ok(audit.capabilityUpgrades.length > 0);
  assert.equal(audit.score.overallPercent, 100);
  assert.equal(audit.score.rating, "5.0/5");
});
