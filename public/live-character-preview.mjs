import { getCharacterArchetype } from "./character-models.mjs";
import { sampleSimpleCharacterMotion } from "./simple-character-motion.mjs";
import { cloneSkinnedScene } from "./skeleton-clone.mjs";

const PREFERRED_CHARACTER_MODELS = Object.freeze({
  scout: "./assets/nightfall/aaa/characters/meshy/scout-meshy-v1.glb",
  ranger: "./assets/nightfall/aaa/characters/meshy/ranger-meshy-v2.glb",
  heavy: "./assets/nightfall/aaa/characters/meshy/heavy-meshy-v1.glb",
  tech: "./assets/nightfall/aaa/characters/meshy/tech-runner-meshy-v1.glb",
  medic: "./assets/nightfall/aaa/characters/meshy/field-medic-meshy-v1.glb",
  warden: "./assets/nightfall/aaa/characters/meshy/warden-meshy-v1.glb",
});

// The menu preview needs a compact first request so it can become a real 3D
// canvas quickly on phones and in-app browsers. These are downscaled copies
// of the same textured meshes used by gameplay; the full-resolution assets
// remain available through getPreferredCharacterModelPaths().
const PREVIEW_TEXTURED_MODELS = Object.freeze({
  scout: "./assets/nightfall/aaa/characters/menu/scout-meshy-v1-menu-v1.glb",
  ranger: "./assets/nightfall/aaa/characters/menu/ranger-meshy-v2-menu-v1.glb",
  heavy: "./assets/nightfall/aaa/characters/menu/heavy-meshy-v1-menu-v1.glb",
  tech: "./assets/nightfall/aaa/characters/menu/tech-runner-meshy-v1-menu-v1.glb",
  medic: "./assets/nightfall/aaa/characters/menu/field-medic-meshy-v1-menu-v1.glb",
  warden: "./assets/nightfall/aaa/characters/menu/warden-meshy-v1-menu-v1.glb",
});

const PREVIEW_CHARACTER_MODELS = Object.freeze({
  scout: "./assets/nightfall/characters/3d/scout-operator-v1.glb",
  ranger: "./assets/nightfall/characters/3d/ranger-operator-v1.glb",
  heavy: "./assets/nightfall/characters/3d/heavy-operator-v1.glb",
  tech: "./assets/nightfall/characters/3d/tech-operator-v1.glb",
  medic: "./assets/nightfall/characters/3d/medic-operator-v1.glb",
  warden: "./assets/nightfall/characters/3d/warden-operator-v1.glb",
});

function cloneMaterial(material) {
  if (Array.isArray(material)) return material.map(item => item?.clone ? item.clone() : item);
  return material?.clone ? material.clone() : material;
}

function cloneScene(scene) {
  const clone = cloneSkinnedScene(scene);
  clone?.traverse?.(node => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      node.material = cloneMaterial(node.material);
    }
  });
  return clone;
}

function frameObject(THREE, root, camera) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const largest = Math.max(size.x, size.y, size.z, 1);
  root.position.sub(center);
  // Lift the full figure slightly so the knees stay inside the preview frame
  // instead of being clipped against the lower edge of the card.
  root.position.y += size.y * .30;
  root.scale.setScalar(2.45 / largest);
  camera.position.set(0, 1.12, 4.2);
  camera.lookAt(0, 1.02, 0);
}

export function getPreferredCharacterModelPaths(id) {
  const archetype = getCharacterArchetype(id);
  return [...new Set([PREFERRED_CHARACTER_MODELS[archetype.id], archetype.modelAsset].filter(Boolean))];
}

export function getPreviewCharacterModelPaths(id) {
  const archetype = getCharacterArchetype(id);
  return [...new Set([
    PREVIEW_TEXTURED_MODELS[archetype.id],
    PREVIEW_CHARACTER_MODELS[archetype.id],
    PREFERRED_CHARACTER_MODELS[archetype.id],
    archetype.modelAsset,
  ].filter(Boolean))];
}

export async function loadFirstAvailableModel({ loader, paths, cache = new Map(), preferBundled = false, timeoutMs = 15000 }) {
  for (const path of new Set((paths || []).filter(Boolean))) {
    const runtimePath = globalThis.window?.__WASTELAND_MEDIA__?.url?.(path) || path;
    // Authored GLBs are part of the reviewed release and should appear
    // immediately even when the optional GCS mirror is slow or unavailable.
    // Media-heavy menu/video files may still prefer the external route by
    // leaving this opt-in disabled.
    const candidates = preferBundled ? [path, runtimePath] : [runtimePath, path];
    for (const candidate of [...new Set(candidates)]) {
      if (!cache.has(candidate)) cache.set(candidate, new Promise(resolve => loader.load(candidate, resolve, undefined, () => resolve(null))));
      const asset = await Promise.race([
        cache.get(candidate),
        new Promise(resolve => setTimeout(() => resolve(null), Math.max(250, Number(timeoutMs) || 15000))),
      ]);
      if (asset?.scene) return asset;
    }
  }
  return null;
}

export function createLiveCharacterPreview({ canvas, THREE, GLTFLoader, defaultCharacter = "scout" }) {
  if (!canvas || !THREE || !GLTFLoader) return { setCharacter() {}, dispose() {} };
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(2.4, 4.2, 3.2);
  scene.add(new THREE.HemisphereLight(0xb9f6ff, 0x241510, 1.35), key);
  const loader = new GLTFLoader();
  const cache = new Map();
  const state = { id: null, root: null, basePosition: null, yaw: .08, dragging: false, pointerX: 0, raf: 0 };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || canvas.clientWidth || 180));
    const height = Math.max(1, Math.round(rect.height || canvas.clientHeight || 220));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const load = id => loadFirstAvailableModel({
    loader,
    paths: getPreviewCharacterModelPaths(id),
    cache,
  });

  const render = (now = performance.now()) => {
    state.raf = requestAnimationFrame(render);
    if (!document.body.contains(canvas)) return;
    resize();
    if (state.root) {
      const idle = sampleSimpleCharacterMotion({ state: "idle", time: now / 1000 });
      if (state.basePosition) state.root.position.set(state.basePosition.x, state.basePosition.y + idle.position.y, state.basePosition.z);
      if (!state.dragging) state.yaw += .0025;
      state.root.rotation.set(idle.rotation.x, state.yaw + idle.rotation.y, idle.rotation.z);
    }
    renderer.render(scene, camera);
  };

  const setCharacter = id => {
    const nextId = getCharacterArchetype(id).id;
    if (state.id === nextId && state.root) return;
    state.id = nextId;
    load(nextId).then(asset => {
      if (state.id !== nextId) return;
      const root = cloneScene(asset?.scene);
      if (!root) {
        state.basePosition = null;
        canvas.classList.remove("is-ready");
        return;
      }
      if (state.root) scene.remove(state.root);
      state.root = root;
      frameObject(THREE, root, camera);
      state.basePosition = root.position.clone();
      scene.add(root);
      canvas.classList.add("is-ready");
    });
  };

  canvas.addEventListener("pointerdown", event => {
    event.stopPropagation();
    state.dragging = true;
    state.pointerX = event.clientX;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    event.stopPropagation();
    if (!state.dragging) return;
    state.yaw += (event.clientX - state.pointerX) * .012;
    state.pointerX = event.clientX;
  });
  canvas.addEventListener("pointerup", event => {
    event.stopPropagation();
    state.dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointercancel", event => { event.stopPropagation(); state.dragging = false; });
  canvas.addEventListener("click", event => event.stopPropagation());

  setCharacter(defaultCharacter);
  render();
  return {
    setCharacter,
    dispose() {
      cancelAnimationFrame(state.raf);
      renderer.dispose();
    },
  };
}
