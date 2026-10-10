import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const game = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");
const androidScript = fs.readFileSync(new URL("../android/overrides/android-platform.js", import.meta.url), "utf8");
const androidCss = fs.readFileSync(new URL("../android/overrides/android-platform.css", import.meta.url), "utf8");

test("the live combat loop uses the Android touch auto-fire decision", () => {
  assert.match(game, /import \{ decideAndroidTouchAutoFire \} from "\.\/mobile-auto-fire-rules\.mjs";/);
  assert.match(game, /const androidAutoTarget\s*=/);
  assert.match(game, /androidTouchTarget\(touchCrosshairTarget\)/);
  assert.doesNotMatch(game, /touchCrosshairTarget\s*\|\|\s*androidTouchTarget\(\)/);
  assert.match(game, /const androidAutoFire\s*=\s*decideAndroidTouchAutoFire\(\{/);
  assert.match(game, /target:\s*androidAutoTarget/);
  assert.match(game, /androidAutoFire\.targetMayBeAcquired/);
  assert.match(game, /androidAutoFire\.firingRequested/);
  assert.match(game, /const touchAutoFire\s*=\s*inputMode === "touch"\s*&&\s*shouldAutoFireFromTouch/);
});

test("the Android package presents a reduced auto-fire control cluster", () => {
  assert.match(androidScript, /AUTO-AIM \+ AUTO-FIRE/);
  assert.match(androidScript, /Manual Fire/);
  const globalAndroidControls = androidCss.slice(0, androidCss.indexOf("@media"));
  assert.match(globalAndroidControls, /#touchLockBtn[\s\S]*#touchAdsBtn[\s\S]*display:\s*none/);
});
