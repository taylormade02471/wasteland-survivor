import { landmarkRenderPassReport } from "./landmark-render-profile.mjs";

// A deterministic, mobile-aware quality ladder for the authored 3D field.
// Each pass increases the previous pass by 12–20% so visual upgrades can be
// rendered, checked, and rolled forward without changing gameplay controls.

export const RENDER_QUALITY_PASSES = Object.freeze([
  Object.freeze({ id: 1, name: "silhouette", gain: 0.12 }),
  Object.freeze({ id: 2, name: "mesh-density", gain: 0.14 }),
  Object.freeze({ id: 3, name: "texture-detail", gain: 0.16 }),
  Object.freeze({ id: 4, name: "lighting-points", gain: 0.18 }),
  Object.freeze({ id: 5, name: "final-polish", gain: 0.20 }),
]);

const BASE = Object.freeze({
  terrainSegments: 40,
  triangleBudget: 48000,
  textureRepeat: 7,
  textureAnisotropy: 2,
  visualPoints: 24,
  propDensity: 1,
});

const clampPass = value => Math.min(RENDER_QUALITY_PASSES.length, Math.max(1, Math.floor(Number(value) || 1)));

export function renderQualityProfile(pass = 1) {
  const target = clampPass(pass);
  let multiplier = 1;
  for (const entry of RENDER_QUALITY_PASSES.slice(0, target)) multiplier *= 1 + entry.gain;
  const rounded = Math.round;
  return Object.freeze({
    pass: target,
    name: RENDER_QUALITY_PASSES[target - 1].name,
    gainFromPrevious: RENDER_QUALITY_PASSES[target - 1].gain,
    multiplier: Number(multiplier.toFixed(4)),
    terrainSegments: rounded(BASE.terrainSegments * (1 + (multiplier - 1) * 0.72)),
    triangleBudget: rounded(BASE.triangleBudget * multiplier),
    textureRepeat: Number((BASE.textureRepeat * multiplier).toFixed(2)),
    textureAnisotropy: Math.max(BASE.textureAnisotropy, target + 1),
    visualPoints: rounded(BASE.visualPoints * multiplier),
    propDensity: Number(multiplier.toFixed(2)),
  });
}

export function nextRenderQualityProfile(pass = 1) {
  return renderQualityProfile(clampPass(pass) + 1);
}

export function renderQualityPassReport(pass = 1) {
  const current = renderQualityProfile(pass);
  const previous = pass > 1 ? renderQualityProfile(pass - 1) : null;
  const percent = field => previous ? Math.round((current[field] / previous[field] - 1) * 100) : Math.round((current[field] / BASE[field] - 1) * 100);
  return Object.freeze({
    pass: current.pass,
    name: current.name,
    triangleGainPercent: percent("triangleBudget"),
    textureGainPercent: percent("textureRepeat"),
    pointGainPercent: percent("visualPoints"),
    triangleBudget: current.triangleBudget,
    terrainSegments: current.terrainSegments,
    textureRepeat: current.textureRepeat,
    visualPoints: current.visualPoints,
  });
}

export function renderPassEvidence(pass = 1) {
  const quality = renderQualityPassReport(pass);
  const landmarks = landmarkRenderPassReport(quality.pass);
  return Object.freeze({ pass: quality.pass, quality, landmarks });
}
