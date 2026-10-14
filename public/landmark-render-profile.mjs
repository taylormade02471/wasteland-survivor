// Landmark detail stays deterministic so every visual pass can be rendered,
// compared, and rolled forward without changing the connected-world rules.

const BASELINE = Object.freeze({ mountainCragCount: 20, armorySalvageCount: 20, infernoFireClusterCount: 17 });

export const LANDMARK_RENDER_PASSES = Object.freeze([
  Object.freeze({ pass: 1, name: "silhouette", mountainCragCount: 24, armorySalvageCount: 24, infernoFireClusterCount: 20 }),
  Object.freeze({ pass: 2, name: "mesh-density", mountainCragCount: 28, armorySalvageCount: 28, infernoFireClusterCount: 24 }),
  Object.freeze({ pass: 3, name: "texture-detail", mountainCragCount: 32, armorySalvageCount: 32, infernoFireClusterCount: 28 }),
  Object.freeze({ pass: 4, name: "lighting-points", mountainCragCount: 37, armorySalvageCount: 37, infernoFireClusterCount: 33 }),
  Object.freeze({ pass: 5, name: "final-polish", mountainCragCount: 44, armorySalvageCount: 44, infernoFireClusterCount: 39 }),
]);

function clampPass(value) {
  return Math.min(LANDMARK_RENDER_PASSES.length, Math.max(1, Math.floor(Number(value) || 1)));
}

function fixed(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function frozenPlan(count, build) {
  return Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze(build(index))));
}

export function landmarkRenderProfile(pass = 1) {
  return LANDMARK_RENDER_PASSES[clampPass(pass) - 1];
}

export function landmarkRenderPassReport(pass = 1) {
  const current = landmarkRenderProfile(pass);
  const previous = current.pass > 1 ? landmarkRenderProfile(current.pass - 1) : BASELINE;
  const gain = field => Math.round((current[field] / previous[field] - 1) * 100);
  return Object.freeze({
    pass: current.pass,
    name: current.name,
    mountainCragCount: current.mountainCragCount,
    mountainCragGainPercent: gain("mountainCragCount"),
    armorySalvageCount: current.armorySalvageCount,
    armorySalvageGainPercent: gain("armorySalvageCount"),
    infernoFireClusterCount: current.infernoFireClusterCount,
    infernoFireClusterGainPercent: gain("infernoFireClusterCount"),
  });
}

export function buildMountainCragPlan(pass = 1) {
  const { mountainCragCount } = landmarkRenderProfile(pass);
  return frozenPlan(mountainCragCount, index => ({
    x: -240 + (index * 37 % 184),
    z: -240 + (index * 61 % 178),
    scale: fixed(.66 + (index * 19 % 41) / 100, 2),
    rotation: fixed((index * 29 % 63) / 10),
    snow: index % 3 !== 1,
  }));
}

export function buildArmorySalvagePlan(pass = 1) {
  const { armorySalvageCount } = landmarkRenderProfile(pass);
  return frozenPlan(armorySalvageCount, index => ({
    x: -108 + (index * 11 % 47),
    z: 166 + (index * 13 % 37),
    scale: fixed(.58 + (index * 23 % 39) / 100, 2),
    rotation: fixed((index * 31 % 63) / 10),
    kind: ["barricade", "equipment", "supply"][index % 3],
  }));
}

export function buildInfernoFirelinePlan(pass = 1) {
  const { infernoFireClusterCount } = landmarkRenderProfile(pass);
  return frozenPlan(infernoFireClusterCount, index => ({
    x: -212 + (index * 17 % 177),
    z: 68 + (index * 7 % 23),
    scale: fixed(.66 + (index * 17 % 43) / 100, 2),
    rotation: fixed((index * 13 % 63) / 10),
    color: index % 3 === 0 ? "hot" : index % 3 === 1 ? "amber" : "red",
  }));
}
