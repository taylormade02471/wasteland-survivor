const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.resolve(__dirname, "../public");

test("loads the isolated graphics QA layer after the main theme", () => {
  const html = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
  const themeIndex = html.indexOf('href="style.css"');
  const qaIndex = html.indexOf('href="graphics-qa.css"');

  assert.ok(themeIndex >= 0, "main theme stylesheet is missing");
  assert.ok(qaIndex > themeIndex, "graphics QA stylesheet must load after the main theme");
});

test("mobile profile layout reserves a bounded row for the fixed Back control", () => {
  const css = fs.readFileSync(path.join(publicRoot, "graphics-qa.css"), "utf8");

  assert.match(css, /@media[^\{]*max-width:\s*680px/);
  assert.match(css, /#welcomeScreen\s*\{[^}]*padding-top:\s*max\(64px,\s*calc\(env\(safe-area-inset-top\)\s*\+\s*54px\)\)/s);
  assert.match(css, /#welcomeScreen\s+\.welcome-panel\s*\{[^}]*max-height:\s*calc\(100dvh\s*-\s*74px\s*-\s*env\(safe-area-inset-top\)\s*-\s*env\(safe-area-inset-bottom\)\)/s);
});

test("non-touch controls tours do not render the touch HUD", () => {
  const css = fs.readFileSync(path.join(publicRoot, "graphics-qa.css"), "utf8");

  assert.match(css, /body\.controls-tour-active:not\(\[data-input-mode="touch"\]\)\s+#touchControls\s*\{[^}]*display:\s*none\s*!important/s);
  assert.doesNotMatch(css, /body\.controls-tour-active\s+#touchControls\s*\{[^}]*display:\s*none/s);
});
