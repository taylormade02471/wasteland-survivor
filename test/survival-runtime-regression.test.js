import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const game = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("solo survival has no combat timer and advances only after the wave is clear", () => {
  assert.match(game, /timer = mode === "ctf" \? 300 : mode === "teams" \? 60 : null;/);
  assert.match(game, /if \(Number\.isFinite\(timer\)\) timer -= dt;/);
  assert.match(game, /\} else if \(mode !== "solo" && Number\.isFinite\(timer\) && timer <= 0\) \{/);
  assert.match(game, /else if \(!enemies\.length && spawnQueue === 0\) finishRound\("blue"\);/);
  assert.match(game, /timer: phase === "loadout" \? "WAITING" : phase === "prep" \? formatTime\(timer\) : mode === "solo" && \["combat", "paused", "dialogue"\]\.includes\(phase\) \? "WAVE ACTIVE"/);
});

test("solo prep keeps the movement loop active while clearing stale aim state", () => {
  assert.match(game, /phase = "prep";\s+timer = 60;\s+touch\.ax = touch\.az = 0;\s+touch\.aiming = false;/);
  assert.match(game, /menuOpen = false;\s+menuOpenedFromPrep = false;\s+pointerResumeRequired = false;\s+firing = false;/);
  assert.match(game, /const prepActive = phase === "prep";[\s\S]*?player\.g\.position\.addScaledVector/);
  assert.match(game, /if \(!prepActive\) \{[\s\S]*?updateSoloEnemies\(dt\);/);
  assert.match(game, /viewYaw = normalizeYaw\(viewYaw \+ androidSingleStick\.turnRate \* dt\);/);
  assert.match(game, /viewYaw = normalizeYaw\(viewYaw \+ rates\.yawRate \* dt\);/);
});
