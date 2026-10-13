import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { questCompleteFrame, questCompleteProfile } from "../public/quest-complete-vfx.mjs";

const gameSource = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("quest completion burst uses bounded authored reward colors", () => {
  const profile = questCompleteProfile({ gold: 30, silver: 90 });
  assert.equal(profile.gold, 30);
  assert.equal(profile.silver, 90);
  assert.notEqual(profile.goldColor, profile.silverColor);
  const frame = questCompleteFrame({ profile, elapsed: .35 });
  assert.ok(frame.radius > 0 && frame.radius <= profile.maxRadius);
  assert.ok(frame.opacity >= 0 && frame.opacity <= 1);
  assert.ok(frame.rotation >= 0 && frame.rotation <= Math.PI * 2);
});

test("quest completion connects reward state to an in-world burst", () => {
  assert.match(gameSource, /quest-complete-vfx\.mjs/);
  assert.match(gameSource, /spawnQuestCompletionBurst/);
  assert.match(gameSource, /quest-complete-ring/);
});
