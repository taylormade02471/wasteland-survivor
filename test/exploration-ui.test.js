import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/style.css", import.meta.url), "utf8");
const game = readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("gameplay shell exposes responsive exploration progress and an accessible discovery notice", () => {
  assert.match(html, /id="explorationText"[^>]*>EXPLORE 0\/14</);
  assert.match(html, /id="discoveryToast"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="discoveryTitle"/);
  assert.match(html, /id="discoveryReward"/);
  assert.match(css, /\.discovery-toast\s*\{/);
  assert.match(css, /@media \(pointer: coarse\) and \(orientation: landscape\)[\s\S]*\.discovery-toast\s*\{/);
});

test("live game movement evaluates discoveries and publishes a browser verification event", () => {
  assert.match(game, /from "\.\/exploration-rules\.mjs"/);
  assert.match(game, /evaluateExploration\(\{[^}]*layout:\s*worldLayout/);
  assert.match(game, /explorationState\s*=\s*discovery\.state/);
  assert.match(game, /score\s*\+=\s*discovery\.reward\.score/);
  assert.match(game, /scrap\s*\+=\s*discovery\.reward\.scrap/);
  assert.match(game, /new CustomEvent\("wasteland:discovery"/);
});
