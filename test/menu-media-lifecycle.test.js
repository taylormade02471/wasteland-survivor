const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const modulePath = new URL("../public/menu-media-lifecycle.mjs", `file://${__filename.replace(/\\/g, "/")}`);

function mediaActions(log, options = {}) {
  return {
    showFallback: async reason => { log.push(`fallback:${reason}`); },
    resumeCurrent: async kind => { log.push(`resume:${kind}`); return options.resume !== false; },
    playReplay: async () => { log.push("replay"); return Boolean(options.replay); },
    playLegacyReplay: async () => { log.push("legacy"); return Boolean(options.legacy); },
    playBundled: async () => { log.push("bundled"); return options.bundled !== false; },
  };
}

test("normal lobby re-entry probes and selects a newly available replay without reload", async () => {
  const { selectMenuMediaOnEntry } = await import(modulePath);
  const initialLog = [];
  const initial = await selectMenuMediaOnEntry(
    { currentKind: "bundled", replayRefreshPending: false },
    mediaActions(initialLog),
  );

  assert.deepEqual(initial, { kind: "bundled", replayChecked: false });
  assert.deepEqual(initialLog, ["resume:bundled"]);

  const returnLog = [];
  const afterCapture = await selectMenuMediaOnEntry(
    { currentKind: "bundled", replayRefreshPending: true },
    mediaActions(returnLog, { replay: true }),
  );

  assert.deepEqual(afterCapture, { kind: "replay", replayChecked: true });
  assert.deepEqual(returnLog, ["fallback:replay-check", "replay"]);
});

test("no replay resumes the existing bundled source after probing and keeps a fallback visible", async () => {
  const { selectMenuMediaOnEntry } = await import(modulePath);
  const log = [];
  const result = await selectMenuMediaOnEntry(
    { currentKind: "bundled", replayRefreshPending: true },
    mediaActions(log),
  );

  assert.deepEqual(result, { kind: "bundled", replayChecked: true });
  assert.deepEqual(log, ["fallback:replay-check", "replay", "legacy", "resume:bundled"]);
});

test("a selected replay only resumes on unrelated menu transitions", async () => {
  const { selectMenuMediaOnEntry } = await import(modulePath);
  const log = [];
  const result = await selectMenuMediaOnEntry(
    { currentKind: "replay", replayRefreshPending: false },
    mediaActions(log, { replay: true }),
  );

  assert.deepEqual(result, { kind: "replay", replayChecked: false });
  assert.deepEqual(log, ["resume:replay"]);
});

test("overlapping refresh signals rerun serially and select the newest replay", async () => {
  const { createMenuMediaLifecycle } = await import(modulePath);
  const lifecycle = createMenuMediaLifecycle();
  let releaseFirstProbe;
  let signalFirstProbeStarted;
  let currentKind = "bundled";
  let replayProbes = 0;
  let activeProbes = 0;
  let maxActiveProbes = 0;
  const firstProbe = new Promise(resolve => { releaseFirstProbe = resolve; });
  const firstProbeStarted = new Promise(resolve => { signalFirstProbeStarted = resolve; });
  const actions = {
    currentKind: () => currentKind,
    isVisible: () => true,
    showFallback: async () => {},
    playReplay: async () => {
      replayProbes += 1;
      activeProbes += 1;
      maxActiveProbes = Math.max(maxActiveProbes, activeProbes);
      if (replayProbes === 1) {
        signalFirstProbeStarted();
        await firstProbe;
      }
      activeProbes -= 1;
      if (replayProbes === 2) {
        currentKind = "replay";
        return true;
      }
      return false;
    },
    playLegacyReplay: async () => false,
    resumeCurrent: async kind => {
      currentKind = kind;
      return true;
    },
    playBundled: async () => {
      currentKind = "bundled";
      return true;
    },
  };

  lifecycle.markReplayRefresh();
  const firstEntry = lifecycle.selectOnEntry({}, actions);
  await firstProbeStarted;
  lifecycle.markReplayRefresh();
  const secondEntry = lifecycle.selectOnEntry({}, actions);

  assert.equal(replayProbes, 1);
  releaseFirstProbe();
  const [firstResult, secondResult] = await Promise.all([firstEntry, secondEntry]);

  assert.equal(maxActiveProbes, 1);
  assert.equal(replayProbes, 2);
  assert.equal(firstResult.kind, "replay");
  assert.equal(secondResult.kind, "replay");
  assert.equal(lifecycle.replayRefreshPending(), false);
});

test("game3d routes capture success and lobby return through the executable lifecycle", () => {
  const game = fs.readFileSync(path.resolve(__dirname, "../public/game3d.js"), "utf8");
  const captureBlock = game.match(/if \(!replayCaptureActive\) \{[\s\S]*?\n  \}/)?.[0] || "";
  const exitFunction = game.match(/function exitToLobby\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const initializeFunction = game.match(/async function initializeMenuBackdrop[\s\S]*?\n\}/)?.[0] || "";

  assert.match(game, /import \{ createMenuMediaLifecycle \} from "\.\/menu-media-lifecycle\.mjs"/);
  assert.match(game, /const menuMediaLifecycle = createMenuMediaLifecycle\(\)/);
  assert.match(captureBlock, /\.then\(saved => \{[\s\S]*markMenuReplayRefresh\(\{ recheckVisible: true \}\)/);
  assert.match(exitFunction, /markMenuReplayRefresh\(\);[\s\S]*openLobby\(/);
  assert.match(initializeFunction, /menuMediaLifecycle\.selectOnEntry\(/);
});
