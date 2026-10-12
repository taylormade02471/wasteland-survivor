// Burned-armory detail is kept deterministic so each quality pass can be
// rendered and measured without changing collision, controls, or game rules.

export const ARMORY_SURFACE_TEXTURES = Object.freeze({
  baseColor: "./assets/nightfall/textures/burned-armory-steel-v1.webp",
  bump: "./assets/nightfall/textures/burned-armory-steel-bump-v1.webp",
});

const BASELINE = Object.freeze({ surfaceDetailPoints: 20, textureRepeat: 1.5 });
const RUBBLE_TRIANGLES_PER_INSTANCE = 36;

export const ARMORY_VISUAL_PASSES = Object.freeze([
  Object.freeze({ pass: 1, name: "silhouette", surfaceDetailPoints: 24, textureRepeat: 1.8 }),
  Object.freeze({ pass: 2, name: "mesh-density", surfaceDetailPoints: 28, textureRepeat: 2.1 }),
  Object.freeze({ pass: 3, name: "texture-detail", surfaceDetailPoints: 32, textureRepeat: 2.4 }),
  Object.freeze({ pass: 4, name: "lighting-points", surfaceDetailPoints: 37, textureRepeat: 2.76 }),
  Object.freeze({ pass: 5, name: "final-polish", surfaceDetailPoints: 44, textureRepeat: 3.24 }),
]);

function clampPass(value) {
  return Math.min(ARMORY_VISUAL_PASSES.length, Math.max(1, Math.floor(Number(value) || 1)));
}

export function armoryVisualProfile(pass = 1) {
  const profile = ARMORY_VISUAL_PASSES[clampPass(pass) - 1];
  return Object.freeze({
    ...profile,
    rubbleTriangles: profile.surfaceDetailPoints * RUBBLE_TRIANGLES_PER_INSTANCE,
    pointLights: Math.min(3, Math.max(1, Math.ceil(profile.pass / 2))),
  });
}

export function armoryVisualPassReport(pass = 1) {
  const current = armoryVisualProfile(pass);
  const previous = current.pass > 1 ? armoryVisualProfile(current.pass - 1) : BASELINE;
  const percent = field => Math.round((current[field] / previous[field] - 1) * 100);
  return Object.freeze({
    pass: current.pass,
    name: current.name,
    surfaceDetailPoints: current.surfaceDetailPoints,
    rubbleTriangles: current.rubbleTriangles,
    rubbleTriangleGainPercent: percent("surfaceDetailPoints"),
    textureRepeat: current.textureRepeat,
    textureGainPercent: percent("textureRepeat"),
    pointLights: current.pointLights,
  });
}

export function buildArmoryRubblePlan(pass = 1) {
  const profile = armoryVisualProfile(pass);
  const points = Array.from({ length: profile.surfaceDetailPoints }, (_, index) => {
    const x = -14 + ((index * 53) % 281) / 10;
    const z = 12.8 + ((index * 37) % 41) / 10;
    const scale = 0.62 + ((index * 19) % 37) / 100;
    return Object.freeze({
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
      scale: Number(scale.toFixed(2)),
      rotationX: Number((((index * 17) % 41) / 30).toFixed(3)),
      rotationY: Number((((index * 29) % 63) / 10).toFixed(3)),
      rotationZ: Number((((index * 11) % 37) / 28).toFixed(3)),
    });
  });
  return Object.freeze(points);
}
