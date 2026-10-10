import assert from "node:assert/strict";
import test from "node:test";

import { shouldProcessRenderFrame } from "../public/graphics-lod-rules.mjs";

test("menu and game-over rendering is capped while combat stays responsive", () => {
  assert.equal(shouldProcessRenderFrame({ phase: "menu", now: 100, lastFrameAt: 50 }), false);
  assert.equal(shouldProcessRenderFrame({ phase: "menu", now: 120, lastFrameAt: 50 }), true);
  assert.equal(shouldProcessRenderFrame({ phase: "over", now: 200, lastFrameAt: 150 }), false);
  assert.equal(shouldProcessRenderFrame({ phase: "combat", now: 101, lastFrameAt: 100 }), true);
  assert.equal(shouldProcessRenderFrame({ phase: "countdown", now: 101, lastFrameAt: 100 }), true);
});

test("hidden documents skip rendering until visible again", () => {
  assert.equal(shouldProcessRenderFrame({ phase: "combat", now: 500, lastFrameAt: 0, documentHidden: true }), false);
  assert.equal(shouldProcessRenderFrame({ phase: "menu", now: 500, lastFrameAt: 0, documentHidden: false }), true);
});
