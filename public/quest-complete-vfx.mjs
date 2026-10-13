const GOLD_COLOR = 0xffd75a;
const SILVER_COLOR = 0xd9e4ef;

export function questCompleteProfile({ gold = 0, silver = 0 } = {}) {
  return Object.freeze({
    gold: Math.max(0, Math.floor(Number(gold) || 0)),
    silver: Math.max(0, Math.floor(Number(silver) || 0)),
    goldColor: GOLD_COLOR,
    silverColor: SILVER_COLOR,
    maxRadius: 4.8,
    durationMs: 1800,
  });
}

export function questCompleteFrame({ profile = questCompleteProfile(), elapsed = 0 } = {}) {
  const safeElapsed = Math.max(0, Number(elapsed) || 0);
  const progress = Math.min(1, safeElapsed / (profile.durationMs / 1000));
  const eased = 1 - (1 - progress) ** 2;
  return Object.freeze({
    radius: Number((eased * profile.maxRadius).toFixed(4)),
    opacity: Number((1 - progress).toFixed(4)),
    rotation: Number(((safeElapsed * 1.8) % (Math.PI * 2)).toFixed(4)),
  });
}
