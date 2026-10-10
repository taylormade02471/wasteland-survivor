import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const game = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("first-run profile flow is local-only with name, birthday, and PIN", () => {
  assert.doesNotMatch(index, /Continue with Google/);
  assert.doesNotMatch(index, /Continue with Microsoft/);
  assert.doesNotMatch(game, /signInWithProvider/);
  assert.match(index, /Create a 4-digit PIN/);
  assert.match(index, /welcome-copy">Build your survivor profile with a name, birthday, and local PIN/);
  assert.match(index, /title-cover-art/);
  assert.doesNotMatch(index, />Phone Account</);
  assert.doesNotMatch(index, /id="showLinkProfile(?:New)?Btn"/);
  assert.doesNotMatch(index, /profilePhone|parentPhone|linkProfileStep|phoneCodeStep/);
});

test("profile initialization keeps legacy phone fields hidden", () => {
  assert.doesNotMatch(game, /profilePhone\.value|parentPhone\.value/);
  assert.doesNotMatch(game, /profilePhone\.closest\("label"\)|parentPhone\.closest\("label"\)/);
});
