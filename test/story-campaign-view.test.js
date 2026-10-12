import test from "node:test";
import assert from "node:assert/strict";

import { storyCampaignView } from "../public/story-campaign-view.mjs";

test("runtime campaign view follows the authored chapter and mission catalog", () => {
  assert.deepEqual(storyCampaignView({ stage: 1, missionIndex: 0 }), {
    chapterId: 1,
    chapterTitle: "First Watch",
    map: "Wasteland",
    missionId: "c1-m1",
    missionTitle: "Wake the Outpost",
    objective: "Restore the abandoned relay.",
    missionIndex: 0,
  });
  assert.deepEqual(storyCampaignView({ stage: 2, missionIndex: 1 }), {
    chapterId: 2,
    chapterTitle: "Poisoned Ground",
    map: "Toxic Pond",
    missionId: "c2-m2",
    missionTitle: "Clean Water",
    objective: "Defend the purifier during startup.",
    missionIndex: 1,
  });
});

test("campaign view clamps malformed saves and exposes the kingdom epilogue", () => {
  const view = storyCampaignView({ stage: 999, missionIndex: 999, kingdomUnlocked: true });
  assert.equal(view.chapterTitle, "Kingdom Rising");
  assert.equal(view.missionTitle, "Crown of Steel");
  assert.equal(view.objective, "Secure the fortress core and establish the survivor kingdom.");
  assert.equal(view.map, "Fiery Inferno");
});
