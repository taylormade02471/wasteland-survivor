import assert from "node:assert/strict";
import test from "node:test";

import {
  STORY_OBJECTIVES,
  applyStoryObjectiveEvent,
  createStoryObjectiveState,
  objectiveInteractionEligibility,
  storyObjectiveForMission,
  storyObjectiveForQuest,
} from "../public/story-objectives.mjs";
import { createConnectedWorldLayout, resolveWorldMovement } from "../public/world-layout.mjs";

test("story objectives unify every campaign mission with its quest, beacon, safe approach, and reward", () => {
  assert.equal(STORY_OBJECTIVES.length, 8);
  assert.deepEqual(STORY_OBJECTIVES.map(objective => objective.missionId), [
    "c1-m1", "c1-m2", "c2-m1", "c2-m2", "c3-m1", "c3-m2", "c4-m1", "c4-m2",
  ]);
  const relay = storyObjectiveForMission("c1-m1");
  assert.equal(relay.questId, "first-watch");
  assert.equal(relay.title, "Wake the Outpost");
  assert.equal(relay.actionLabel, "Restore Relay");
  assert.equal(relay.beacon.mapKey, "wasteland");
  assert.ok(relay.reward.gold > 0);
  assert.ok(relay.reward.silver > relay.reward.gold);
  assert.equal(storyObjectiveForQuest("first-watch"), relay);
  assert.equal(storyObjectiveForMission("missing-mission"), null);
});

test("every authored approach anchor is outside collision blockers and retains its intended beacon map", () => {
  const layout = createConnectedWorldLayout();
  for (const objective of STORY_OBJECTIVES) {
    const anchor = objective.approach;
    const resolved = resolveWorldMovement(
      layout,
      { x: anchor.x, y: 0, z: anchor.z },
      { x: anchor.x, z: anchor.z },
    );
    assert.equal(resolved.blocked, false, `${objective.missionId} anchor must be reachable`);
    assert.deepEqual(resolved.position, { x: anchor.x, y: resolved.position.y, z: anchor.z });
    assert.equal(typeof objective.beacon.mapKey, "string");
    assert.ok(objective.approach.radius >= 4, `${objective.missionId} needs a usable interaction radius`);
  }
});

test("objective progress is durable, ordered, and requires arrival before a single interaction unlock", () => {
  let state = createStoryObjectiveState({
    arrivedMissionIds: ["c1-m1", "unknown"],
    interactedMissionIds: ["unknown"],
  });
  assert.deepEqual(state, {
    version: 1,
    arrivedMissionIds: ["c1-m1"],
    interactedMissionIds: [],
    completedMissionIds: [],
  });

  const locked = objectiveInteractionEligibility(state, { missionId: "c1-m2", currentMissionId: "c1-m1" });
  assert.equal(locked.eligible, false);
  assert.equal(locked.reason, "mission-locked");

  const ready = objectiveInteractionEligibility(state, { missionId: "c1-m1", currentMissionId: "c1-m1" });
  assert.equal(ready.eligible, true);
  assert.equal(ready.reason, "ready");

  const interacted = applyStoryObjectiveEvent(state, {
    type: "interacted",
    missionId: "c1-m1",
    currentMissionId: "c1-m1",
  });
  assert.equal(interacted.changed, true);
  assert.equal(interacted.interacted, true);
  assert.deepEqual(interacted.state.interactedMissionIds, ["c1-m1"]);

  const duplicate = applyStoryObjectiveEvent(interacted.state, {
    type: "interacted",
    missionId: "c1-m1",
    currentMissionId: "c1-m1",
  });
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.reason, "already-interacted");

  const completed = applyStoryObjectiveEvent(interacted.state, {
    type: "completed",
    missionId: "c1-m1",
    currentMissionId: "c1-m1",
  });
  assert.equal(completed.changed, true);
  assert.deepEqual(completed.state.completedMissionIds, ["c1-m1"]);
  assert.deepEqual(completed.state.interactedMissionIds, ["c1-m1"]);
});

test("arrival events are idempotent and cannot advance an inactive campaign objective", () => {
  const state = createStoryObjectiveState();
  const inactive = applyStoryObjectiveEvent(state, {
    type: "arrived",
    missionId: "c1-m2",
    currentMissionId: "c1-m1",
  });
  assert.equal(inactive.changed, false);
  assert.equal(inactive.reason, "mission-locked");

  const arrived = applyStoryObjectiveEvent(state, {
    type: "arrived",
    missionId: "c1-m1",
    currentMissionId: "c1-m1",
  });
  assert.equal(arrived.changed, true);
  assert.deepEqual(arrived.state.arrivedMissionIds, ["c1-m1"]);
  const duplicate = applyStoryObjectiveEvent(arrived.state, {
    type: "arrived",
    missionId: "c1-m1",
    currentMissionId: "c1-m1",
  });
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.reason, "already-arrived");
});

test("malformed persisted objective progress is ignored without losing a valid completed objective", () => {
  const restored = createStoryObjectiveState({
    arrivedMissionIds: "c1-m1",
    interactedMissionIds: 4,
    completedMissionIds: ["c2-m1", "not-a-mission"],
  });
  assert.deepEqual(restored, {
    version: 1,
    arrivedMissionIds: ["c2-m1"],
    interactedMissionIds: ["c2-m1"],
    completedMissionIds: ["c2-m1"],
  });
});
