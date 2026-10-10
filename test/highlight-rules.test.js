import test from "node:test";
import assert from "node:assert/strict";
import { detectHighlights, normalizeHighlightEvent } from "../public/highlight-rules.mjs";

test("detects eliminations, boss defeats, objective captures, and victories", () => {
  const result = detectHighlights([
    { id: "a", type: "elimination", atMs: 1000, targetId: "rusher" },
    { id: "b", type: "boss-defeat", atMs: 2400, targetId: "boss" },
    { id: "c", type: "objective-capture", atMs: 4100, objective: "bridge" },
    { id: "d", type: "match-victory", atMs: 6200 },
  ]);

  assert.deepEqual(result.map(item => item.type), ["elimination", "boss-defeat", "objective-capture", "match-victory"]);
  assert.equal(result[1].label, "Boss defeated");
  assert.equal(result[3].priority, 100);
});

test("groups multi-eliminations inside the configured window", () => {
  const result = detectHighlights([
    { id: "a", type: "elimination", atMs: 1000 },
    { id: "b", type: "elimination", atMs: 2400 },
    { id: "c", type: "elimination", atMs: 3600 },
  ], { multiEliminationWindowMs: 2500 });

  assert.equal(result.length, 1);
  assert.equal(result[0].type, "multi-elimination");
  assert.deepEqual(result[0].eventIds, ["a", "b", "c"]);
});

test("normalizes malformed events and returns deeply frozen output", () => {
  const event = normalizeHighlightEvent({ type: "unknown", atMs: -4, id: "" });
  assert.deepEqual(event, { id: "event-0", type: "event", atMs: 0 });
  const result = detectHighlights([{ id: "win", type: "match-victory", atMs: 10 }]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result[0]), true);
  assert.throws(() => { result[0].label = "changed"; }, TypeError);
});
