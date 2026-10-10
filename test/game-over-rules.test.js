import test from "node:test";
import assert from "node:assert/strict";

import {
  gameOverActionModel,
  nextGameOverActionIndex,
} from "../public/game-over-rules.mjs";

test("story survival offers a restart and a safe save-and-exit route", () => {
  assert.deepEqual(gameOverActionModel("solo"), {
    restartLabel: "Restart Survival",
    exitLabel: "Save & End Survival",
    exitAction: "save-story-and-exit",
  });
});

test("competitive results offer play again and a clean lobby exit", () => {
  for (const mode of ["teams", "ctf", "ffa"]) {
    assert.deepEqual(gameOverActionModel(mode), {
      restartLabel: "Play Again",
      exitLabel: "End Match - Back To Lobby",
      exitAction: "exit-to-lobby",
    });
  }
});

test("controller result navigation wraps across the available actions", () => {
  assert.equal(nextGameOverActionIndex(0, -1, 2), 1);
  assert.equal(nextGameOverActionIndex(0, 1, 2), 1);
  assert.equal(nextGameOverActionIndex(1, 1, 2), 0);
  assert.equal(nextGameOverActionIndex(6, 0, 2), 1);
  assert.equal(nextGameOverActionIndex(0, 1, 0), 0);
});
