import { resolveAsset, selectGraphicsTier } from "./graphics-config.mjs";

const VALID_TIERS = new Set(["low", "medium", "high"]);
let state = null;

export function backgroundEffectsForTier(tier, reducedMotion = false) {
  const normalized = VALID_TIERS.has(tier) ? tier : "medium";
  const effects = normalized === "low"
    ? { fog: false, waterReflection: false, searchlight: false, particles: 8, parallax: false, pulsingLights: false }
    : normalized === "high"
      ? { fog: true, waterReflection: true, searchlight: true, particles: 36, parallax: true, pulsingLights: true }
      : { fog: true, waterReflection: true, searchlight: false, particles: 20, parallax: true, pulsingLights: false };

  if (!reducedMotion) return effects;
  return { ...effects, searchlight: false, particles: 0, parallax: false, pulsingLights: false };
}

function addLayer(root, className, tagName = "div") {
  const layer = root.ownerDocument.createElement(tagName);
  layer.className = className;
  layer.setAttribute("aria-hidden", "true");
  root.appendChild(layer);
  return layer;
}

function applyState() {
  if (!state) return;
  const { root, tier, reducedMotion } = state;
  const effects = backgroundEffectsForTier(tier, reducedMotion);
  root.dataset.tier = tier;
  root.dataset.scene = state.scene;
  root.classList.toggle("nightfall-reduced-motion", reducedMotion);
  for (const [effect, enabled] of Object.entries(effects)) {
    root.classList.toggle(`nightfall-${effect}`, Boolean(enabled));
  }
  state.particles.replaceChildren();
  for (let index = 0; index < effects.particles; index += 1) {
    const particle = root.ownerDocument.createElement("i");
    particle.style.setProperty("--particle-index", String(index));
    particle.style.setProperty("--particle-x", `${(index * 37) % 101}%`);
    particle.style.setProperty("--particle-delay", `${-(index % 12) * 0.7}s`);
    state.particles.appendChild(particle);
  }
}

export function createNightfallBackground(root, options = {}) {
  if (!root) return null;
  if (state?.root === root) {
    state.reducedMotion = options.reducedMotion ?? state.reducedMotion;
    state.tier = VALID_TIERS.has(options.tier) ? options.tier : state.tier;
    state.scene = options.scene || state.scene;
    applyState();
    return state.root;
  }
  destroyNightfallBackground();

  const reducedMotion = options.reducedMotion ?? globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const tier = VALID_TIERS.has(options.tier) ? options.tier : selectGraphicsTier({
    deviceMemory: globalThis.navigator?.deviceMemory,
    hardwareConcurrency: globalThis.navigator?.hardwareConcurrency,
    reducedMotion,
    savedTier: options.savedTier,
  });
  const imageUrl = options.imageUrl || resolveAsset(options.manifest, "loading");

  root.replaceChildren();
  root.classList.add("nightfall-background");
  const image = addLayer(root, "nightfall-image", "img");
  image.alt = "";
  if (imageUrl) image.src = imageUrl;
  else root.classList.add("nightfall-fallback");
  image.addEventListener("error", () => root.classList.add("nightfall-fallback"), { once: true });
  addLayer(root, "nightfall-color-wash");
  addLayer(root, "nightfall-water");
  addLayer(root, "nightfall-reflection");
  addLayer(root, "nightfall-fog nightfall-fog-back");
  addLayer(root, "nightfall-fog nightfall-fog-front");
  addLayer(root, "nightfall-searchlight");
  const particles = addLayer(root, "nightfall-particles");
  addLayer(root, "nightfall-survivor");
  addLayer(root, "nightfall-weapon");
  addLayer(root, "nightfall-vignette");

  state = { root, tier, reducedMotion, particles, scene: options.scene || "menu" };
  applyState();
  return root;
}

export function setNightfallTier(tier) {
  if (!state || !VALID_TIERS.has(tier)) return;
  state.tier = tier;
  applyState();
}

export function setNightfallScene(scene) {
  if (!state) return;
  state.scene = ["menu", "countdown", "game"].includes(scene) ? scene : "menu";
  applyState();
}

export function destroyNightfallBackground() {
  if (!state) return;
  state.root.replaceChildren();
  state.root.classList.remove("nightfall-background", "nightfall-fallback", "nightfall-reduced-motion");
  delete state.root.dataset.tier;
  delete state.root.dataset.scene;
  state = null;
}
