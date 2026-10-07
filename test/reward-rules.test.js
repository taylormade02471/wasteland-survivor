import assert from "node:assert/strict";
import test from "node:test";
import { rewardPreview, settleMatch } from "../public/reward-rules.mjs";
test("risk levels trade larger rewards for larger capped defeat penalties", () => {
  const protectedLoss = settleMatch({ outcome: "loss", risk: "protected", currentScrap: 100, kills: 2 });
  const highLoss = settleMatch({ outcome: "loss", risk: "high", currentScrap: 100, kills: 2 });
  assert.equal(protectedLoss.scrapPenalty, 0);
  assert.equal(highLoss.scrapPenalty, 18);
  assert.ok(highLoss.xpEarned > protectedLoss.xpEarned);
  assert.ok(highLoss.nextScrap >= 0);
});
test("difficulty and win streak increase rewards with a bounded streak bonus", () => {
  const normal = rewardPreview({ risk: "standard", difficulty: "easy", winStreak: 0 });
  const elite = rewardPreview({ risk: "standard", difficulty: "insane", winStreak: 99 });
  assert.equal(elite.streakMultiplier, 1.5);
  assert.ok(elite.rewardMultiplier > normal.rewardMultiplier);
});
test("wins grow streaks, draws preserve them, and losses break them", () => {
  assert.equal(settleMatch({ outcome: "win", winStreak: 2 }).winStreak, 3);
  assert.equal(settleMatch({ outcome: "draw", winStreak: 2 }).winStreak, 2);
  const loss = settleMatch({ outcome: "loss", winStreak: 2 });
  assert.equal(loss.winStreak, 0);
  assert.equal(loss.streakBroken, true);
});
