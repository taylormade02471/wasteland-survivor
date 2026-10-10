const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("first-run uses a local PIN without provider, phone, or adult math prompts", () => {
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  assert.doesNotMatch(html, /Continue with Google/);
  assert.doesNotMatch(html, /Continue with Microsoft/);
  assert.doesNotMatch(html, /profilePhone|parentPhone|linkProfileStep|phoneCodeStep/);
  assert.match(html, /id="parentPin"[^>]*maxlength="4"/);
  assert.doesNotMatch(html, /id="showLinkProfile(?:New)?Btn"/);
  assert.doesNotMatch(html, />Phone Account</);
  assert.doesNotMatch(html, /profileContact|mathStep|mathQuestion|verifyMathBtn/i);
  assert.doesNotMatch(html, /email or phone|player email|recovery email/i);
});

test("game setup keeps the name, birthday, and PIN path local", () => {
  const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");
  assert.match(game, /pinDigest\(pin\)/);
  assert.doesNotMatch(game, /selectedAuthProvider|loadSocialAuthProvider|providerUnavailableMessage/);
  assert.doesNotMatch(game, /openPhoneAccountBtn/);
  assert.doesNotMatch(game, /showLinkProfile(?:New)?Btn/);
  assert.doesNotMatch(game, /beginMathCheck|finishMathCheck|profileContact/);
});
