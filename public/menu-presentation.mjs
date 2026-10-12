const VALID_TIERS = new Set(["low", "medium", "high"]);

const SECTION_ALIASES = Object.freeze({
  profile: "survivor",
  connections: "friends",
});

const SCENES = Object.freeze({
  home: { camera: [-1.6, 0, 1.035], light: [0.24, 0.42], emphasis: "entry" },
  lobby: { camera: [0, -0.6, 1.055], light: [0.38, 0.52], emphasis: "fight" },
  survivor: { camera: [2.8, -1.4, 1.075], light: [0.30, 0.68], emphasis: "identity" },
  armory: { camera: [-2.7, 0.8, 1.065], light: [0.66, 0.28], emphasis: "arsenal" },
  friends: { camera: [1.7, 0.4, 1.045], light: [0.32, 0.62], emphasis: "signal" },
  settings: { camera: [-1.1, 1.2, 1.025], light: [0.46, 0.38], emphasis: "systems" },
});

const TIER_EFFECTS = Object.freeze({
  low: { particles: 4, reflection: 0.10, disturbance: 0.08, vapor: 0.10, idleFocus: 0.38, selectedFocus: 0.70, forwardPx: 2 },
  medium: { particles: 14, reflection: 0.24, disturbance: 0.20, vapor: 0.18, idleFocus: 0.48, selectedFocus: 0.85, forwardPx: 4 },
  high: { particles: 28, reflection: 0.42, disturbance: 0.34, vapor: 0.26, idleFocus: 0.58, selectedFocus: 1, forwardPx: 6 },
});

const BUNDLED_SOURCES = Object.freeze([
  Object.freeze({ src: "./assets/nightfall/backgrounds/nightfall-water-walk-loop-v1.webm", type: "video/webm" }),
  Object.freeze({ src: "./assets/nightfall/backgrounds/nightfall-water-walk-loop-v1.mp4", type: "video/mp4" }),
]);

function normalizeSection(section) {
  const named = SECTION_ALIASES[section] || section;
  return Object.hasOwn(SCENES, named) ? named : "home";
}

function normalizeTier(tier) {
  return VALID_TIERS.has(tier) ? tier : "medium";
}

export function resolveMenuPresentation(input = {}) {
  const section = normalizeSection(input.section);
  const tier = normalizeTier(input.tier);
  const reducedMotion = Boolean(input.reducedMotion);
  const focusedCommand = typeof input.focusedCommand === "string" && input.focusedCommand
    ? input.focusedCommand
    : null;
  const scene = SCENES[section];
  const effects = TIER_EFFECTS[tier];
  const focusIllumination = focusedCommand ? effects.selectedFocus : effects.idleFocus;

  return {
    section,
    tier,
    reducedMotion,
    emphasis: scene.emphasis,
    camera: {
      xPercent: scene.camera[0],
      yPercent: scene.camera[1],
      scale: scene.camera[2],
      transitionMs: reducedMotion ? 0 : 520,
      driftPercent: reducedMotion ? 0 : tier === "low" ? 0.2 : tier === "medium" ? 0.55 : 0.9,
    },
    lighting: {
      amber: scene.light[0],
      cyan: scene.light[1],
      focus: focusIllumination,
    },
    particles: {
      budget: reducedMotion ? 0 : effects.particles,
      disturbance: reducedMotion || !focusedCommand ? 0 : effects.disturbance,
    },
    surface: {
      staticTreatment: true,
      buoyancyPx: reducedMotion ? 0 : tier === "low" ? 1.5 : tier === "medium" ? 2.5 : 4,
      loopDurationMs: reducedMotion ? 0 : tier === "low" ? 6200 : tier === "medium" ? 5000 : 4200,
      rippleOpacity: reducedMotion ? 0 : tier === "low" ? 0.14 : tier === "medium" ? 0.28 : 0.44,
      reflectionOpacity: effects.reflection,
      vaporOpacity: effects.vapor,
      vaporDriftDurationMs: reducedMotion ? 0 : tier === "low" ? 9000 : tier === "medium" ? 7200 : 6000,
      localDisturbance: reducedMotion ? 0 : effects.disturbance,
    },
    focus: {
      command: focusedCommand,
      forwardPx: reducedMotion || !focusedCommand ? 0 : effects.forwardPx,
      illumination: focusIllumination,
      selectedForwardPx: reducedMotion ? 0 : effects.forwardPx,
      selectedIllumination: effects.selectedFocus,
    },
  };
}

export function resolveMenuMedia(input = {}) {
  const tier = normalizeTier(input.tier);
  const heroVideo = Boolean(input.heroVideo);
  const blocked = (!heroVideo && tier === "low")
    || (!heroVideo && Boolean(input.reducedMotion))
    || Boolean(input.saveData)
    || Boolean(input.autoplayFailed)
    || Boolean(input.decodeFailed);

  if (blocked) {
    return { kind: "fallback", sources: [], autoplay: false, fallbackVisible: true };
  }

  const replayAvailable = typeof input.replayUrl === "string" && input.replayUrl && !input.replayFailed;
  const kind = replayAvailable ? "replay" : "bundled";
  const sources = replayAvailable
    ? [{ src: input.replayUrl, type: input.replayType || "video/webm" }]
    : BUNDLED_SOURCES.map(source => ({ ...source }));

  return {
    kind,
    sources,
    autoplay: true,
    fallbackVisible: input.playbackState !== "playing",
  };
}
