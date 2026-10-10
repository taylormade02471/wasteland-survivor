import test from "node:test";
import assert from "node:assert/strict";

import {
  createMenuFocusState,
  reduceMenuFocus,
} from "../public/menu-focus-rules.mjs";

const items = [
  { id: "survival" },
  { id: "multiplayer" },
  { id: "settings" },
  { id: "store", enabled: false },
  { id: "about", hidden: true },
  { id: "exit" },
];

test("initial focus selects the first visible enabled item", () => {
  const state = createMenuFocusState(items, { columns: 2 });
  assert.equal(state.index, 0);
  assert.equal(state.lastDirectionAt, -Infinity);
  assert.equal(state.heldDirection, null);
  assert.equal(state.nextRepeatAt, Infinity);
  assert.equal(state.columns, 2);
});

test("directional navigation moves by grid and skips disabled or hidden items", () => {
  let state = createMenuFocusState(items, { columns: 2 });
  state = reduceMenuFocus(state, { type: "direction", direction: "right", at: 0 }, items);
  assert.equal(state.index, 1);
  state = reduceMenuFocus(state, { type: "direction", direction: "down", at: 500 }, items);
  assert.equal(state.index, 5, "down skips disabled store and hidden about");
  state = reduceMenuFocus(state, { type: "direction", direction: "up", at: 1000 }, items);
  assert.equal(state.index, 1, "up returns to the nearest valid item");
});

test("navigation wraps at the edge when wrap is enabled", () => {
  let state = createMenuFocusState(items, { columns: 2, wrap: true });
  state = reduceMenuFocus(state, { type: "direction", direction: "up", at: 0 }, items);
  assert.equal(state.index, 5);
  state = reduceMenuFocus(state, { type: "direction", direction: "down", at: 500 }, items);
  assert.equal(state.index, 0);
});

test("navigation can clamp at the edge when wrap is disabled", () => {
  let state = createMenuFocusState(items, { columns: 2, wrap: false });
  state = reduceMenuFocus(state, { type: "direction", direction: "left", at: 0 }, items);
  assert.equal(state.index, 0);
});

test("horizontal movement stays within the current row while skipping unavailable cells", () => {
  const grid = [
    { id: "a" }, { id: "b", enabled: false }, { id: "c" },
    { id: "d" }, { id: "e" }, { id: "f" },
  ];
  let state = createMenuFocusState(grid, { columns: 3, wrap: true });
  state.index = 2;
  state = reduceMenuFocus(state, { type: "direction", direction: "right", at: 0 }, grid);
  assert.equal(state.index, 0, "right wraps within row one instead of entering row two");
  state = reduceMenuFocus(state, { type: "direction", direction: "left", at: 500 }, grid);
  assert.equal(state.index, 2, "left skips disabled b and wraps within row one");

  state = createMenuFocusState(grid, { columns: 3, wrap: false });
  state.index = 2;
  state = reduceMenuFocus(state, { type: "direction", direction: "right", at: 0 }, grid);
  assert.equal(state.index, 2, "clamped row edge never enters row two");
});

test("held directions debounce and then repeat at a fixed interval", () => {
  let state = createMenuFocusState(items, { columns: 1, repeatDelay: 300, repeatInterval: 100 });
  state = reduceMenuFocus(state, { type: "direction", direction: "down", at: 0 }, items);
  assert.equal(state.index, 1);
  state = reduceMenuFocus(state, { type: "direction", direction: "down", at: 100 }, items);
  assert.equal(state.index, 1, "early repeats are ignored");
  state = reduceMenuFocus(state, { type: "direction", direction: "down", at: 299 }, items);
  assert.equal(state.index, 1);
  state = reduceMenuFocus(state, { type: "direction", direction: "down", at: 300 }, items);
  assert.equal(state.index, 2);
  state = reduceMenuFocus(state, { type: "direction", direction: "down", at: 400 }, items);
  assert.equal(state.index, 5, "repeat skips unavailable entries");
});

test("stale non-monotonic repeat timestamps are ignored", () => {
  let state = createMenuFocusState(items, { columns: 2, repeatDelay: 300, repeatInterval: 100 });
  state = reduceMenuFocus(state, { type: "direction", direction: "right", at: 500 }, items);
  const before = { index: state.index, lastDirectionAt: state.lastDirectionAt, nextRepeatAt: state.nextRepeatAt };
  state = reduceMenuFocus(state, { type: "direction", direction: "right", at: 400 }, items);
  assert.deepEqual(
    { index: state.index, lastDirectionAt: state.lastDirectionAt, nextRepeatAt: state.nextRepeatAt },
    before,
  );
});

test("A/Enter and B/Escape produce activation and back intents", () => {
  const state = createMenuFocusState(items);
  assert.deepEqual(reduceMenuFocus(state, { type: "activate" }, items).intent, { type: "activate", id: "survival" });
  assert.deepEqual(reduceMenuFocus(state, { type: "select", key: "Enter" }, items).intent, { type: "activate", id: "survival" });
  assert.deepEqual(reduceMenuFocus(state, { type: "select", key: "b" }, items).intent, { type: "back" });
  assert.deepEqual(reduceMenuFocus(state, { type: "select", key: "Escape" }, items).intent, { type: "back" });
});
