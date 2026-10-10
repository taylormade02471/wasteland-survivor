const TIERS = ["low", "medium", "high"];

const BUDGETS = Object.freeze({
  low: Object.freeze({ shadows: 0, particles: 12, enemyDetail: 0, textureTier: "low", renderScale: 0.72 }),
  medium: Object.freeze({ shadows: 1, particles: 28, enemyDetail: 1, textureTier: "medium", renderScale: 0.86 }),
  high: Object.freeze({ shadows: 2, particles: 56, enemyDetail: 2, textureTier: "high", renderScale: 1 }),
});

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizedDevice(device = {}) {
  return {
    kind: String(device.kind || "").toLowerCase(),
    width: Math.max(1, numberOr(device.viewportWidth, 1280)),
    height: Math.max(1, numberOr(device.viewportHeight, 720)),
    dpr: Math.max(1, numberOr(device.dpr, 1)),
    memory: Math.max(0, numberOr(device.memory, 4)),
    cores: Math.max(1, numberOr(device.cores, 4)),
  };
}

function baseTier(device) {
  const d = normalizedDevice(device);
  const pixels = d.width * d.height * Math.min(d.dpr, 2);
  if (d.memory <= 2 || d.cores <= 2) return "low";
  if (d.kind === "phone") return d.memory >= 6 && d.cores >= 8 ? "medium" : "low";
  if (d.kind !== "tablet" && pixels <= 900_000 && d.width < 700) return "low";
  if (d.kind === "tv") return "medium";
  if ((d.kind === "desktop" || (!d.kind && d.width >= 1000)) && d.memory >= 8 && d.cores >= 6 && pixels >= 800_000) return "high";
  if (d.kind === "tablet") return "medium";
  if (d.memory >= 12 && d.cores >= 8 && pixels >= 1_000_000) return "high";
  return "medium";
}

function averageFrameTime(frameTimes) {
  const values = Array.isArray(frameTimes) ? frameTimes.filter(value => Number.isFinite(value) && value > 0) : [];
  return values.length >= 4 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function stepTier(tier, delta) {
  const index = Math.max(0, TIERS.indexOf(tier));
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, index + delta))];
}

export function shouldProcessRenderFrame({
  phase = "combat",
  now = 0,
  lastFrameAt = 0,
  documentHidden = false,
  menuFps = 15,
} = {}) {
  if (documentHidden) return false;
  if (phase !== "menu" && phase !== "over") return true;
  const safeFps = Math.max(1, Number(menuFps) || 15);
  return Math.max(0, Number(now) || 0) - Math.max(0, Number(lastFrameAt) || 0) >= 1000 / safeFps;
}

function chooseTier({ device, frameTimes, previousTier } = {}) {
  const baseline = baseTier(device);
  const average = averageFrameTime(frameTimes);
  let tier = baseline;
  if (average !== null && average >= 40) tier = stepTier(tier, -1);
  if (average !== null && average <= 18) tier = stepTier(tier, 1);

  // A previous tier is only sticky in the uncertain middle band. Clear frame-time
  // headroom can recover, while sustained heat can still reduce quality promptly.
  if (previousTier && average !== null && average > 18 && average < 40) {
    const previousIndex = TIERS.indexOf(previousTier);
    const baselineIndex = TIERS.indexOf(tier);
    if (previousIndex >= 0 && Math.abs(previousIndex - baselineIndex) === 1) tier = previousTier;
  }
  return tier;
}

export function selectGraphicsLod({ device = {}, frameTimes = [], previous = null } = {}) {
  const tier = chooseTier({
    device,
    frameTimes,
    previousTier: previous?.tier,
  });
  return Object.freeze({ tier, ...BUDGETS[tier] });
}

export function createGraphicsLodSelector({ device = {}, initial = null } = {}) {
  const baselineTier = baseTier(device);
  const initialTier = TIERS.includes(initial?.tier) ? initial.tier : baselineTier;
  let current = Object.freeze({ tier: initialTier, ...BUDGETS[initialTier] });
  let hotBatches = 0;
  let coolBatches = 0;
  return Object.freeze({
    update(frameTimes = []) {
      const average = averageFrameTime(frameTimes);
      hotBatches = average !== null && average >= 40 ? hotBatches + 1 : 0;
      coolBatches = average !== null && average <= 18 ? coolBatches + 1 : 0;
      let tier = current.tier;
      if (hotBatches >= 2) {
        tier = stepTier(tier, -1);
        hotBatches = 0;
      } else if (coolBatches >= 2 && TIERS.indexOf(tier) < TIERS.indexOf(baselineTier)) {
        tier = stepTier(tier, 1);
        coolBatches = 0;
      }
      current = Object.freeze({ tier, ...BUDGETS[tier] });
      return current;
    },
    get current() {
      return current;
    },
  });
}

export { BUDGETS };
