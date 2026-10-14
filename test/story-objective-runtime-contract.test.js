import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");

test("the live solo renderer connects the safe map objective to interaction, metric completion, reward persistence, and a visible prompt", () => {
  assert.match(game, /createStoryObjectiveState/);
  assert.match(game, /let storyObjectiveState\s*=\s*createStoryObjectiveState\(\)/);
  assert.match(game, /function updateStoryObjectiveArrival\(/);
  assert.match(game, /function interactWithStoryObjective\(/);
  assert.match(game, /if \(interactWithStoryObjective\(\)\) return;/);
  assert.match(game, /const activeObjectiveStatus\s*=\s*activeObjective[\s\S]*?storyObjectiveStatus\(storyObjectiveState/);
  assert.match(game, /objectiveReady:\s*activeObjectiveStatus\s*===\s*"interacted"/);
  assert.match(game, /storyObjectiveState,\s*shieldLevel/);
  assert.match(game, /createStoryObjectiveState\(\{[\s\S]*?progress\.storyObjectiveState/);
  assert.match(game, /type:\s*"completed"/);
  assert.match(game, /story-objective-terminal:/);
  assert.match(game, /renderFocus === "story-objective"/);
  assert.match(game, /directRenderFocus\s*\?\s*"RENDER"/);
  assert.match(game, /MAPS\[mapKey\]\?\.label[\s\S]*?biomeAt\(worldLayout, player\.g\.position\)\.label/);

  assert.match(html, /id="questPrompt"/);
  assert.match(html, /id="questPromptAction"/);
  assert.match(html, /id="openQuestObjectiveBtn"/);
  assert.match(css, /\.quest-prompt\s*\{/);
});
