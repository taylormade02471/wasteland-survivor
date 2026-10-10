const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "public/site.webmanifest"), "utf8"));
const worker = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");

test("website is installable as a standalone PWA with an offline shell", () => {
  assert.match(html, /rel="manifest" href="site\.webmanifest"/);
  assert.match(html, /serviceWorker\.register\("\.\/sw\.js"\)/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some(icon => icon.src.includes("icon-512-v1.png")));
  assert.match(worker, /caches\.open\(CACHE_NAME\)/);
  assert.match(worker, /caches\.match\("\/index\.html"\)/);
});
