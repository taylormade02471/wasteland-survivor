export const RISK_PROFILES = Object.freeze({
  protected: Object.freeze({ id: "protected", label: "Protected", rewardMultiplier: 0.8, defeatScrapRate: 0, xpFloor: 50 }),
  standard: Object.freeze({ id: "standard", label: "Standard", rewardMultiplier: 1, defeatScrapRate: 0.08, xpFloor: 75 }),
  high: Object.freeze({ id: "high", label: "High Risk", rewardMultiplier: 1.65, defeatScrapRate: 0.18, xpFloor: 100 }),
});
const DIFFICULTY = Object.freeze({ easy: 1, medium: 1.25, expert: 1.6, insane: 2.2 });
const whole = value => Math.max(0, Math.floor(Number(value) || 0));
const ENEMY_CURRENCY = Object.freeze({
  rusher: Object.freeze({ gold: 1, silver: 3 }),
  shooter: Object.freeze({ gold: 2, silver: 5 }),
  heavy: Object.freeze({ gold: 3, silver: 8 }),
  sniper: Object.freeze({ gold: 3, silver: 8 }),
  spider: Object.freeze({ gold: 4, silver: 10 }),
  boss: Object.freeze({ gold: 8, silver: 18 }),
});

export function enemyCurrencyDrop({ enemyType = "rusher", wave = 1 } = {}) {
  const base = ENEMY_CURRENCY[enemyType] || ENEMY_CURRENCY.rusher;
  const tier = Math.max(0, whole(wave) - 1);
  return Object.freeze({
    gold: base.gold + Math.floor(tier * .5),
    silver: base.silver + tier,
  });
}

export function rewardPreview({ risk = "standard", difficulty = "medium", winStreak = 0 } = {}) {
  const profile = RISK_PROFILES[risk] || RISK_PROFILES.standard;
  const streakMultiplier = 1 + Math.min(0.5, whole(winStreak) * 0.05);
  return {
    risk: profile.id,
    rewardMultiplier: Number((profile.rewardMultiplier * (DIFFICULTY[difficulty] || DIFFICULTY.medium) * streakMultiplier).toFixed(3)),
    defeatScrapRate: profile.defeatScrapRate,
    streakMultiplier: Number(streakMultiplier.toFixed(2)),
  };
}

export function settleMatch({
  outcome = "loss", risk = "standard", difficulty = "medium", kills = 0, wave = 1,
  score = 0, currentScrap = 0, currentGold = 0, currentSilver = 0, currentXp = 0, winStreak = 0,
} = {}) {
  const won = outcome === "win";
  const draw = outcome === "draw";
  const preview = rewardPreview({ risk, difficulty, winStreak });
  const profile = RISK_PROFILES[preview.risk];
  const baseXp = Math.max(profile.xpFloor, whole(kills) * 35 + whole(wave) * 45 + Math.floor(whole(score) / 20));
  const earnedXp = Math.round(baseXp * preview.rewardMultiplier * (won ? 1.25 : draw ? 0.75 : 0.45));
  const earnedScrap = Math.round((whole(kills) * 2 + whole(wave) * 3) * preview.rewardMultiplier * (won ? 1.2 : draw ? 0.7 : 0.35));
  const earnedGold = Math.round((8 + whole(kills) + whole(wave) * 2) * preview.rewardMultiplier * (won ? 1.2 : draw ? 0.8 : 0.45));
  const earnedSilver = Math.round((16 + whole(kills) * 3 + whole(wave) * 5) * preview.rewardMultiplier * (won ? 1.2 : draw ? 0.8 : 0.45));
  const penalty = won || draw ? 0 : Math.min(whole(currentScrap), Math.round(whole(currentScrap) * profile.defeatScrapRate));
  const nextStreak = won ? whole(winStreak) + 1 : draw ? whole(winStreak) : 0;
  return {
    outcome: won ? "win" : draw ? "draw" : "loss",
    risk: profile.id,
    xpEarned: earnedXp,
    scrapEarned: earnedScrap,
    goldEarned: earnedGold,
    silverEarned: earnedSilver,
    scrapPenalty: penalty,
    nextXp: whole(currentXp) + earnedXp,
    nextScrap: Math.max(0, whole(currentScrap) + earnedScrap - penalty),
    nextGold: whole(currentGold) + earnedGold,
    nextSilver: whole(currentSilver) + earnedSilver,
    winStreak: nextStreak,
    streakBroken: !won && !draw && whole(winStreak) > 0,
  };
}
