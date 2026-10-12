import test from "node:test";
import assert from "node:assert/strict";

import { CHARACTER_ANIMATION_STATES, sampleCharacterAnimation } from "../public/character-animation-runtime.mjs";

test("character animation runtime exposes every authored gameplay state", () => {
  assert.deepEqual(CHARACTER_ANIMATION_STATES, ["idle", "walk", "run", "aim", "fire", "hit", "downed", "wade"]);
});

test("character animation samples are deterministic, bounded, and state-aware", () => {
  const idle = sampleCharacterAnimation({ state: "idle", time: 1.25 });
  const run = sampleCharacterAnimation({ state: "run", time: 1.25 });
  assert.deepEqual(idle, sampleCharacterAnimation({ state: "idle", time: 1.25 }));
  assert.notDeepEqual(idle.leftLeg, run.leftLeg);
  for (const pose of Object.values(run)) {
    if (!pose || typeof pose !== "object") continue;
    for (const value of Object.values(pose)) assert.ok(Number.isFinite(value) && Math.abs(value) <= .5);
  }
});
