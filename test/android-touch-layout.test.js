const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("Android override keeps the reticle centered and exposes the action button", () => {
  const css = fs.readFileSync(path.join(root, "android", "overrides", "android-platform.css"), "utf8");
  const js = fs.readFileSync(path.join(root, "android", "overrides", "android-platform.js"), "utf8");

  assert.match(css, /#aimStick[\s\S]*display:\s*none/);
  assert.match(css, /#touchLockBtn[\s\S]*display:\s*none/);
  assert.match(css, /#touchWeaponBtn[\s\S]*display:\s*none/);
  assert.doesNotMatch(css, /#touchInteractBtn[\s\S]*display:\s*none/);
  assert.match(js, /Interact with chest or objective/);
  assert.match(js, /touchUtilityBtn/);
  assert.match(js, /Menu/);
  assert.match(js, /touchUtilityTray/);
});
