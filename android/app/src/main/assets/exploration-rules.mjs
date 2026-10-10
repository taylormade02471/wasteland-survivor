export const EXPLORATION_REWARDS = Object.freeze({
  biome: Object.freeze({ score: 25, scrap: 1 }),
  landmark: Object.freeze({ score: 50, scrap: 3 }),
  completion: Object.freeze({ score: 150, scrap: 6 }),
});

const EMPTY_REWARD = Object.freeze({ score: 0, scrap: 0 });
const BIOME_INSET = 20;
const LANDMARK_DISCOVERY_RADIUS = 9;

function unique(values) {
  return [...new Set(Array.isArray(values) ? values.filter(value => typeof value === "string") : [])];
}

function freezeState({ discoveredBiomes = [], discoveredLandmarks = [], completed = false } = {}) {
  return Object.freeze({
    discoveredBiomes: Object.freeze(unique(discoveredBiomes)),
    discoveredLandmarks: Object.freeze(unique(discoveredLandmarks)),
    completed: Boolean(completed),
  });
}

function containsBiomeInterior(biome, position) {
  const xInset = Math.min(BIOME_INSET, biome.w / 4);
  const zInset = Math.min(BIOME_INSET, biome.d / 4);
  return Math.abs(position.x - biome.x) <= biome.w / 2 - xInset
    && Math.abs(position.z - biome.z) <= biome.d / 2 - zInset;
}

function distanceToRect(area, position) {
  const dx = Math.max(Math.abs(position.x - area.x) - area.w / 2, 0);
  const dz = Math.max(Math.abs(position.z - area.z) - area.d / 2, 0);
  return Math.hypot(dx, dz);
}

function readableLabel(item) {
  if (item.label) return item.label;
  return item.id.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function createEvent(item, kind, reward) {
  return Object.freeze({
    id: item.id,
    kind,
    label: readableLabel(item),
    score: reward.score,
    scrap: reward.scrap,
  });
}

export function createExplorationState() {
  return freezeState();
}

export function explorationProgress(layout, state = createExplorationState()) {
  const biomeIds = new Set((layout?.biomes || []).map(item => item.id));
  const landmarkIds = new Set((layout?.landmarks || []).map(item => item.id));
  const discoveredBiomes = unique(state.discoveredBiomes).filter(id => biomeIds.has(id));
  const discoveredLandmarks = unique(state.discoveredLandmarks).filter(id => landmarkIds.has(id));
  const total = biomeIds.size + landmarkIds.size;
  const discovered = discoveredBiomes.length + discoveredLandmarks.length;
  return Object.freeze({ discovered, total, complete: total > 0 && discovered === total });
}

export function evaluateExploration({ layout, state = createExplorationState(), position } = {}) {
  if (!layout || !position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) {
    return Object.freeze({ state: freezeState(state), events: Object.freeze([]), reward: EMPTY_REWARD });
  }

  const discoveredBiomes = new Set(unique(state.discoveredBiomes));
  const discoveredLandmarks = new Set(unique(state.discoveredLandmarks));
  const events = [];

  for (const biome of layout.biomes || []) {
    if (discoveredBiomes.has(biome.id) || !containsBiomeInterior(biome, position)) continue;
    discoveredBiomes.add(biome.id);
    events.push(createEvent(biome, "biome", EXPLORATION_REWARDS.biome));
  }

  for (const landmark of layout.landmarks || []) {
    const radius = Number.isFinite(landmark.discoveryRadius) ? landmark.discoveryRadius : LANDMARK_DISCOVERY_RADIUS;
    if (discoveredLandmarks.has(landmark.id) || distanceToRect(landmark, position) > radius) continue;
    discoveredLandmarks.add(landmark.id);
    events.push(createEvent(landmark, "landmark", EXPLORATION_REWARDS.landmark));
  }

  const nextStateBase = {
    discoveredBiomes: [...discoveredBiomes],
    discoveredLandmarks: [...discoveredLandmarks],
    completed: Boolean(state.completed),
  };
  const progress = explorationProgress(layout, nextStateBase);
  if (progress.complete && !nextStateBase.completed) {
    nextStateBase.completed = true;
    events.push(Object.freeze({
      id: "connected-world-complete",
      kind: "completion",
      label: "Connected World Surveyed",
      score: EXPLORATION_REWARDS.completion.score,
      scrap: EXPLORATION_REWARDS.completion.scrap,
    }));
  }

  const reward = events.reduce((total, event) => ({
    score: total.score + event.score,
    scrap: total.scrap + event.scrap,
  }), { score: 0, scrap: 0 });

  return Object.freeze({
    state: freezeState(nextStateBase),
    events: Object.freeze(events),
    reward: reward.score || reward.scrap ? Object.freeze(reward) : EMPTY_REWARD,
  });
}
