const REQUIRED_SCENE_METHODS = Object.freeze(["traverse"]);

function fallbackResult(fallbackFactory, reason, archetypeId = null) {
  let scene = null;
  let fallbackError = null;
  if (typeof fallbackFactory === "function") {
    try {
      scene = fallbackFactory();
    } catch (error) {
      fallbackError = error;
    }
  }
  const baseReason = String(reason || "character asset unavailable");
  return {
    ok: false,
    usedFallback: true,
    scene,
    archetypeId,
    reason: fallbackError ? `${baseReason}; fallback failed: ${fallbackError.message || fallbackError}` : baseReason,
  };
}

function isScene(value) {
  return Boolean(value && typeof value === "object" && REQUIRED_SCENE_METHODS.every(method => typeof value[method] === "function"));
}

function containsNamedDescendant(scene, name) {
  const normalizedName = String(name).replace(/[^a-z0-9]/gi, "").toLowerCase();
  let found = false;
  scene.traverse(node => {
    const candidateName = String(node?.name || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (node !== scene && (node?.name === name || candidateName === normalizedName)) found = true;
  });
  return found;
}

const PILOT_ANIMATION_NAMES = Object.freeze(["idle", "walk", "aim", "fire"]);
const PILOT_SOCKET_NAMES = Object.freeze(["weaponAnchor", "muzzle"]);

function namedDescendantSet(scene) {
  const names = new Set();
  if (!scene || typeof scene.traverse !== "function") return names;
  scene.traverse(node => {
    if (node?.name) names.add(String(node.name));
  });
  return names;
}

function hasSkeleton(scene) {
  let found = false;
  if (scene && typeof scene.traverse === "function") scene.traverse(node => {
    if (node?.isSkinnedMesh || node?.skeleton || node?.userData?.skeleton) found = true;
  });
  return found;
}

export function inspectCharacterAsset({ scene, animations = [], requiredSockets = PILOT_SOCKET_NAMES, requiredAnimations = PILOT_ANIMATION_NAMES } = {}) {
  const names = namedDescendantSet(scene);
  const animationNames = new Set((Array.isArray(animations) ? animations : []).map(clip => String(clip?.name || clip || "").toLowerCase()));
  const sockets = requiredSockets.filter(name => names.has(name));
  const clips = requiredAnimations.filter(name => animationNames.has(name.toLowerCase()));
  const skeleton = hasSkeleton(scene);
  const rigged = skeleton && sockets.length === requiredSockets.length && clips.length === requiredAnimations.length;
  return {
    status: rigged ? "rigged" : "blockout",
    skeleton,
    sockets,
    missingSockets: requiredSockets.filter(name => !names.has(name)),
    animations: clips,
    missingAnimations: requiredAnimations.filter(name => !animationNames.has(name.toLowerCase())),
  };
}

function setScale(scene, scale) {
  if (!Number.isFinite(scale) || scale <= 0) return;
  if (typeof scene.scale?.set === "function") scene.scale.set(scale, scale, scale);
  else if (scene.scale && typeof scene.scale === "object") Object.assign(scene.scale, { x: scale, y: scale, z: scale });
}

function setGround(scene, groundY) {
  if (!Number.isFinite(groundY)) return;
  if (scene.position && typeof scene.position === "object") scene.position.y = groundY;
}

function applyShadows(scene) {
  scene.traverse(node => {
    if (!node || typeof node !== "object") return;
    // These flags are understood by Three.js meshes and harmless on test doubles.
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function loadWith(loader, path) {
  if (typeof loader?.loadAsync === "function") return Promise.resolve(loader.loadAsync(path));
  if (typeof loader?.load === "function") {
    return new Promise((resolve, reject) => loader.load(path, resolve, undefined, reject));
  }
  return Promise.reject(new TypeError("a GLB loader with loadAsync or load is required"));
}

export function normalizeCharacterAsset({ scene, archetype, scale = 1, groundY = 0 } = {}) {
  const archetypeId = typeof archetype?.id === "string" ? archetype.id : null;
  if (!isScene(scene)) return fallbackResult(null, "loaded character scene must expose traverse", archetypeId);
  if (archetypeId && typeof scene.name === "string" && scene.name && scene.name !== `character:${archetypeId}` && !containsNamedDescendant(scene, `character:${archetypeId}`)) {
    return fallbackResult(null, `loaded character scene root does not match ${archetypeId}`, archetypeId);
  }
  try {
    setScale(scene, scale);
    setGround(scene, groundY);
    applyShadows(scene);
  } catch (error) {
    return fallbackResult(null, `character normalization failed: ${error.message || error}`, archetypeId);
  }
  return { ok: true, usedFallback: false, scene, archetypeId };
}

export async function loadCharacterAsset({ archetype, loader, fallbackFactory, scale = 1, groundY = 0 } = {}) {
  const archetypeId = typeof archetype?.id === "string" ? archetype.id : null;
  const path = typeof archetype?.modelAsset === "string" && archetype.modelAsset.trim() ? archetype.modelAsset : null;
  if (!archetypeId || !path) return fallbackResult(fallbackFactory, "archetype modelAsset is required", archetypeId);

  try {
    const loaded = await loadWith(loader, path);
    const normalized = normalizeCharacterAsset({ scene: loaded?.scene, archetype, scale, groundY });
    if (normalized.ok) {
      const animations = Array.isArray(loaded?.animations) ? loaded.animations : [];
      return { ...normalized, path, animations, assetStatus: inspectCharacterAsset({ scene: normalized.scene, animations }) };
    }
    return { ...fallbackResult(fallbackFactory, normalized.reason, archetypeId), path };
  } catch (error) {
    return { ...fallbackResult(fallbackFactory, error?.message || "character asset load failed", archetypeId), path };
  }
}
