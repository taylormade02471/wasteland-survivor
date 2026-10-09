import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPLORATION_REWARDS,
  createExplorationState,
  evaluateExploration,
  explorationProgress,
} from "../public/exploration-rules.mjs";
import {
  BIOME_KEYS,
  LANDMARK_IDS,
  createConnectedWorldLayout,
} from "../public/world-layout.mjs";

test("exploration begins empty and the central crossroads grants no free discovery", () => {
  const layout = createConnectedWorldLayout();
  const state = createExplorationState();

  assert.deepEqual(state, {
    discoveredBiomes: [],
    discoveredLandmarks: [],
    completed: false,
  });

  const result = evaluateExploration({ layout, state, position: { x: 0, z: 0 } });
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.reward, { score: 0, scrap: 0 });
  assert.deepEqual(result.state, state);
  assert.deepEqual(explorationProgress(layout, state), {
    discovered: 0,
    total: BIOME_KEYS.length + LANDMARK_IDS.length,
    complete: false,
  });
});

test("entering a biome interior rewards it once without mutating prior state", () => {
  const layout = createConnectedWorldLayout();
  const original = createExplorationState();
  const first = evaluateExploration({
    layout,
    state: original,
    position: { x: 60, z: 110 },
  });

  assert.deepEqual(original.discoveredBiomes, []);
  assert.deepEqual(first.state.discoveredBiomes, ["desert"]);
  assert.deepEqual(first.events.map(event => ({ id: event.id, kind: event.kind, label: event.label })), [
    { id: "desert", kind: "biome", label: "Desert Wasteland" },
  ]);
  assert.deepEqual(first.reward, EXPLORATION_REWARDS.biome);

  const repeat = evaluateExploration({
    layout,
    state: first.state,
    position: { x: 60, z: 110 },
  });
  assert.deepEqual(repeat.events, []);
  assert.deepEqual(repeat.reward, { score: 0, scrap: 0 });
  assert.deepEqual(repeat.state, first.state);
});

test("approaching a landmark rewards its readable name once", () => {
  const layout = createConnectedWorldLayout();
  const landmark = layout.landmarks.find(item => item.id === "looted-armory");
  const position = { x: landmark.x + landmark.w / 2 + 8, z: landmark.z };
  const first = evaluateExploration({
    layout,
    state: { ...createExplorationState(), discoveredBiomes: ["inferno"] },
    position,
  });

  assert.deepEqual(first.state.discoveredLandmarks, ["looted-armory"]);
  assert.deepEqual(first.events.map(event => ({ id: event.id, kind: event.kind, label: event.label })), [
    { id: "looted-armory", kind: "landmark", label: "Looted Armory" },
  ]);
  assert.deepEqual(first.reward, EXPLORATION_REWARDS.landmark);

  const repeat = evaluateExploration({ layout, state: first.state, position });
  assert.deepEqual(repeat.events, []);
  assert.deepEqual(repeat.reward, { score: 0, scrap: 0 });
});

test("discovering the full connected world grants the exact completion bonus", () => {
  const layout = createConnectedWorldLayout();
  let state = createExplorationState();
  let score = 0;
  let scrap = 0;
  const events = [];

  for (const biome of layout.biomes) {
    const result = evaluateExploration({ layout, state, position: { x: biome.x, z: biome.z } });
    state = result.state;
    score += result.reward.score;
    scrap += result.reward.scrap;
    events.push(...result.events);
  }
  for (const landmark of layout.landmarks) {
    const result = evaluateExploration({ layout, state, position: { x: landmark.x, z: landmark.z } });
    state = result.state;
    score += result.reward.score;
    scrap += result.reward.scrap;
    events.push(...result.events);
  }

  assert.equal(state.completed, true);
  assert.deepEqual(new Set(state.discoveredBiomes), new Set(BIOME_KEYS));
  assert.deepEqual(new Set(state.discoveredLandmarks), new Set(LANDMARK_IDS));
  assert.equal(events.filter(event => event.kind === "completion").length, 1);
  assert.equal(score, 750);
  assert.equal(scrap, 40);
  assert.deepEqual(explorationProgress(layout, state), {
    discovered: 14,
    total: 14,
    complete: true,
  });
});
