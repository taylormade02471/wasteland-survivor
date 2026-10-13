import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/style.css", import.meta.url), "utf8");
const game = readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");
const controls = readFileSync(new URL("../public/control-direction-lock.mjs", import.meta.url), "utf8");

test("gameplay shell exposes responsive exploration progress and an accessible discovery notice", () => {
  assert.match(html, /id="explorationText"[^>]*>EXPLORE 0\/14</);
  assert.match(html, /id="discoveryToast"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="discoveryTitle"/);
  assert.match(html, /id="discoveryReward"/);
  assert.match(css, /\.discovery-toast\s*\{/);
  assert.match(css, /@media \(pointer: coarse\) and \(orientation: landscape\)[\s\S]*\.discovery-toast\s*\{/);
  assert.match(css, /@media \(pointer: coarse\) and \(orientation: landscape\)[\s\S]*\.discovery-toast\s*\{[^}]*top:\s*110px/);
});

test("live game movement evaluates discoveries and publishes a browser verification event", () => {
  assert.match(game, /from "\.\/exploration-rules\.mjs"/);
  assert.match(game, /evaluateExploration\(\{[^}]*layout:\s*worldLayout/);
  assert.match(game, /explorationState\s*=\s*discovery\.state/);
  assert.match(game, /score\s*\+=\s*discovery\.reward\.score/);
  assert.match(game, /scrap\s*\+=\s*discovery\.reward\.scrap/);
  assert.match(game, /new CustomEvent\("wasteland:discovery"/);
});

test("discovery notice expires after its nonblocking display window", () => {
  assert.match(game, /discoveryToastUntil\s*=\s*performance\.now\(\)\s*\+\s*3200/);
  assert.match(game, /performance\.now\(\)\s*>=\s*discoveryToastUntil/);
  assert.match(game, /discoveryToast\.classList\.add\("hidden"\)/);
});

test("mouse aim remains unlocked, right-positive, and clamped to the browser edge", () => {
  const pointerMove = game.match(/canvas\.addEventListener\("pointermove", event => \{([\s\S]*?)\n\}\);/)?.[1] || "";
  const pointerDown = game.match(/canvas\.addEventListener\("pointerdown", event => \{([\s\S]*?)\n\}\);/)?.[1] || "";

  assert.match(pointerMove, /mouseAimScreen\.x\s*=\s*THREE\.MathUtils\.clamp\(event\.clientX, 0, innerWidth\)/);
  assert.match(pointerMove, /mouseAimScreen\.y\s*=\s*THREE\.MathUtils\.clamp\(event\.clientY, 0, innerHeight\)/);
  assert.match(pointerMove, /viewYaw\s*=\s*nextMouseYaw\(\{ yaw: viewYaw, movementX: event\.movementX, sensitivity:/);
  assert.match(controls, /mouseRadiansPerPixel:\s*0\.0032/);
  assert.doesNotMatch(pointerMove, /document\.pointerLockElement/);
  assert.doesNotMatch(pointerDown, /requestGameplayPointerLock/);
});
