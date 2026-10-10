const STORY_MODES = new Set(["solo", "story", "survival"]);

export function gameOverActionModel(mode) {
  if (STORY_MODES.has(String(mode || "").toLowerCase())) {
    return Object.freeze({
      restartLabel: "Restart Survival",
      exitLabel: "Save & End Survival",
      exitAction: "save-story-and-exit",
    });
  }
  return Object.freeze({
    restartLabel: "Play Again",
    exitLabel: "End Match - Back To Lobby",
    exitAction: "exit-to-lobby",
  });
}

export function nextGameOverActionIndex(current, direction, count) {
  const size = Math.max(0, Math.trunc(Number(count) || 0));
  if (!size) return 0;
  const index = Math.min(size - 1, Math.max(0, Math.trunc(Number(current) || 0)));
  const step = Math.sign(Number(direction) || 0);
  return step ? (index + step + size) % size : index;
}
