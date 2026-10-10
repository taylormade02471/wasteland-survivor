const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.resolve(__dirname, "../public/style.css"), "utf8");

test("the first-run controls guide stays reachable on short phone screens", () => {
  assert.match(css, /\.controls-tour-modal\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.controls-tour-card\s*\{[^}]*max-height:\s*calc\(100dvh/s);
  assert.match(css, /\.controls-tour-card\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.controls-tour-card \.text-button\s*\{[^}]*position:\s*sticky/s);
});
