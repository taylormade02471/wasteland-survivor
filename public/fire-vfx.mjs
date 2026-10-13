// Deterministic, mobile-bounded inferno VFX parameters. The renderer uses
// these values for smoke, embers, and heat shimmer without affecting physics.

function clampPass(value) {
  return Math.min(5, Math.max(1, Math.floor(Number(value) || 1)));
}

export function buildFireVfxProfile(pass = 1) {
  const target = clampPass(pass);
  return Object.freeze({
    pass: target,
    smokeCount: 12 + (target - 1) * 15,
    emberCount: 16 + (target - 1) * 20,
    smokeOpacity: Number((.18 + target * .025).toFixed(3)),
    heatOpacity: Number((.08 + target * .025).toFixed(3)),
    maxHeight: 7 + target * .8,
    horizontalSpread: 1.2 + target * .18,
  });
}

export function fireVfxFrame({ profile, elapsed = 0, index = 0 } = {}) {
  const safe = profile || buildFireVfxProfile(1);
  const time = Number.isFinite(Number(elapsed)) ? Number(elapsed) : 0;
  const slot = Math.max(0, Math.floor(Number(index) || 0));
  const phase = slot * .83;
  const rise = (time * (.34 + (slot % 5) * .025) + slot * .19) % 1;
  const wobble = Math.sin(time * 1.7 + phase) * safe.horizontalSpread * (.28 + rise * .2);
  return Object.freeze({
    x: Number(wobble.toFixed(4)),
    y: Number((rise * safe.maxHeight).toFixed(4)),
    opacity: Number((safe.smokeOpacity * (1 - rise * .65)).toFixed(4)),
    scale: Number((.72 + rise * .82 + Math.sin(time * 2.3 + phase) * .06).toFixed(4)),
  });
}
