export function reduceClientMatchLifecycle(state = {}, message = {}) {
  const activeMatchPlan = state.activeMatchPlan || null;
  const awaitingRematch = Boolean(state.awaitingRematch);
  const unchanged = action => ({ action, activeMatchPlan, awaitingRematch });

  if (message?.type === "match-ready") {
    const startsAt = Number(message.startsAt);
    if (!Number.isFinite(startsAt)) return unchanged("ignore");
    const sameGeneration = message.generation !== undefined
      && activeMatchPlan?.generation === message.generation;
    if (sameGeneration || Number(activeMatchPlan?.startsAt) === startsAt) return unchanged("ignore");
    if (state.phase !== "loadout") return unchanged("hold-current-view");
    return { action: "start-countdown", activeMatchPlan: message, awaitingRematch: false };
  }

  if (message?.type === "match-reset") {
    const action = state.phase === "loadout" || state.phase === "countdown"
      ? "reset-loadout"
      : "preserve-current-view";
    return { action, activeMatchPlan: null, awaitingRematch: true };
  }

  if (message?.type === "match-waiting") {
    return { action: "wait-for-rematch", activeMatchPlan: null, awaitingRematch: true };
  }

  return unchanged("ignore");
}
