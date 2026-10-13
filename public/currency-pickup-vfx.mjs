const PROFILES = Object.freeze({
  gold: Object.freeze({ kind: "gold", color: 0xffd75a, accent: 0xfff2b632, scale: .34, lift: 1.5, durationMs: 1350 }),
  silver: Object.freeze({ kind: "silver", color: 0xd9e4ef, accent: 0x8ab4d6, scale: .3, lift: 1.25, durationMs: 1200 }),
});

export function currencyPickupProfile(kind = "silver") {
  return PROFILES[kind] || PROFILES.silver;
}

export function currencyPickupFrame({ profile = currencyPickupProfile(), elapsed = 0, index = 0 } = {}) {
  const safeElapsed = Math.max(0, Number(elapsed) || 0);
  const safeIndex = Math.max(0, Math.floor(Number(index) || 0));
  const duration = profile.durationMs / 1000;
  const progress = Math.min(1, safeElapsed / duration);
  const eased = 1 - (1 - progress) ** 2;
  return Object.freeze({
    y: Number((eased * profile.lift).toFixed(4)),
    rotation: Number(((safeElapsed * (4.4 + safeIndex * .45)) % (Math.PI * 2)).toFixed(4)),
    opacity: Number((1 - Math.max(0, progress - .72) / .28).toFixed(4)),
  });
}
