const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("first-run and restore screens use verified phone plus local PIN without adult math or player email fields", () => {
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  assert.match(html, /id="profilePhone"[^>]*type="tel"/);
  assert.match(html, /id="phoneCodeStep"/);
  assert.match(html, /id="phoneCode"[^>]*autocomplete="one-time-code"/);
  assert.match(html, /id="linkPhone"[^>]*type="tel"/);
  assert.match(html, /id="linkLocalPin"[^>]*maxlength="4"/);
  assert.match(html, /id="parentPhone"[^>]*type="tel"/);
  assert.match(html, /id="parentPin"[^>]*maxlength="4"/);
  assert.doesNotMatch(html, /profileContact|mathStep|mathQuestion|verifyMathBtn/i);
  assert.doesNotMatch(html, /email or phone|player email|recovery email/i);
});

test("game setup routes phone credentials through the private account endpoint and keeps PIN hashing local", () => {
  const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");
  assert.match(game, /loadPhoneAuthProvider/);
  assert.match(game, /fetch\("\/api\/account\/phone"/);
  assert.match(game, /buildPhoneLinkRequest/);
  assert.match(game, /pinDigest\(pin\)/);
  assert.doesNotMatch(game, /\/api\/link\/(?:create|claim)|\/api\/recovery\//);
  assert.doesNotMatch(game, /beginMathCheck|finishMathCheck|profileContact/);
});
