const GRAPHICS_TIERS = new Set(["low", "medium", "high"]);

export function selectGraphicsTier({
  deviceMemory,
  hardwareConcurrency,
  reducedMotion = false,
  savedTier
} = {}) {
  if (GRAPHICS_TIERS.has(savedTier)) return savedTier;
  if (reducedMotion) return "low";

  const memory = Number(deviceMemory);
  const cores = Number(hardwareConcurrency);
  if ((Number.isFinite(memory) && memory <= 2) || (Number.isFinite(cores) && cores <= 2)) return "low";
  if ((Number.isFinite(memory) && memory >= 8) && (Number.isFinite(cores) && cores >= 8)) return "high";
  return "medium";
}

export function resolveAsset(manifest, key) {
  const value = manifest?.assets?.[key];
  if (typeof value !== "string" || value.length === 0) return null; return value.startsWith("/") ? "." + value : value;
}

