import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const game = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("solo mode is presented as escalating survival instead of a story campaign", () => {
  assert.match(index, />Play Survival Offline</);
  assert.match(index, /Each level expands the map and raises the threat/);
  assert.doesNotMatch(index, /Play Story Survival Offline/);
  assert.match(game, /mode === "solo" \? "SURVIVAL"/);
  assert.match(game, /`Level \$\{storyStage\}: \$\{chapter\.title\}`/);
});
