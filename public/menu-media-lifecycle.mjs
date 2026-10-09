const RESUMABLE_MEDIA = new Set(["replay", "bundled"]);

export async function selectMenuMediaOnEntry(state = {}, actions = {}) {
  const currentKind = RESUMABLE_MEDIA.has(state.currentKind) ? state.currentKind : null;
  const replayRefreshPending = Boolean(state.force || state.replayRefreshPending || !currentKind);

  if (!replayRefreshPending) {
    if (await actions.resumeCurrent?.(currentKind)) {
      return { kind: currentKind, replayChecked: false };
    }
    await actions.showFallback?.("resume-failed");
    return { kind: "fallback", replayChecked: false };
  }

  await actions.showFallback?.("replay-check");
  if (await actions.playReplay?.()) return { kind: "replay", replayChecked: true };
  if (await actions.playLegacyReplay?.()) return { kind: "replay", replayChecked: true };
  if (currentKind && await actions.resumeCurrent?.(currentKind)) {
    return { kind: currentKind, replayChecked: true };
  }
  if (await actions.playBundled?.()) return { kind: "bundled", replayChecked: true };
  return { kind: "fallback", replayChecked: true };
}

export function createMenuMediaLifecycle() {
  let replayRevision = 0;
  let checkedReplayRevision = 0;
  let forcePending = false;
  let entryPromise = null;

  function replayRefreshPending() {
    return replayRevision !== checkedReplayRevision;
  }

  function markReplayRefresh() {
    replayRevision += 1;
    return replayRevision;
  }

  function selectOnEntry(state = {}, actions = {}) {
    forcePending ||= Boolean(state.force);
    if (entryPromise) return entryPromise;

    entryPromise = (async () => {
      let result;
      do {
        const targetRevision = replayRevision;
        const force = forcePending;
        forcePending = false;
        result = await selectMenuMediaOnEntry({
          currentKind: actions.currentKind?.() ?? state.currentKind,
          force,
          replayRefreshPending: targetRevision !== checkedReplayRevision,
        }, actions);
        if (result.replayChecked) checkedReplayRevision = targetRevision;
      } while ((forcePending || replayRefreshPending()) && actions.isVisible?.() !== false);
      return result;
    })().finally(() => { entryPromise = null; });

    return entryPromise;
  }

  return { markReplayRefresh, replayRefreshPending, selectOnEntry };
}
