import { simulateAgentMatchSeries } from "../public/agent-squad-rules.mjs";

const matches = Math.min(12, Math.max(1, Number(process.argv[2]) || 5));
const durationMs = Math.min(180_000, Math.max(5_000, Number(process.argv[3]) || 30_000));
const result = simulateAgentMatchSeries({
  initiated: true,
  human: { id: "player-kyle", name: "Player Test", kind: "human" },
  seed: 20261008,
  matches,
  durationMs,
  stepMs: 250,
});

console.log(JSON.stringify({
  matches: result.matches.length,
  durationMs,
  winnerCounts: result.winnerCounts,
  totals: result.report.totals,
  accuracy: Number(result.report.accuracy.toFixed(3)),
  fairness: result.report.fairness,
}, null, 2));
