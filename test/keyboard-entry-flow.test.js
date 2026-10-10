const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.resolve(__dirname, "../public/game3d.js"), "utf8");

test("Enter activation is handled globally for profile and lobby screens", () => {
  const keydownStart = source.indexOf('addEventListener("keydown", event => {');
  const pointerdownStart = source.indexOf('canvas.addEventListener("pointerdown", event => {');
  assert.ok(keydownStart >= 0);
  assert.ok(pointerdownStart > keydownStart);

  const keydownBlock = source.slice(keydownStart, pointerdownStart);
  assert.match(keydownBlock, /event\.key === "Enter"/);
  assert.match(keydownBlock, /enterProfile\(\)/);
  assert.match(keydownBlock, /activateLobbyCommand\(\)/);

  const pointerdownBlock = source.slice(pointerdownStart, pointerdownStart + 1900);
  assert.doesNotMatch(pointerdownBlock, /event\.key === "Enter"/);
});
