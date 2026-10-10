import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const activity = fs.readFileSync(path.join(root, "android", "app", "src", "main", "java", "com", "wastelandsurvivor", "app", "MainActivity.java"), "utf8");
const manifest = fs.readFileSync(path.join(root, "android", "app", "src", "main", "AndroidManifest.xml"), "utf8");
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");
const androidGame = fs.readFileSync(path.join(root, "android", "app", "src", "main", "assets", "game3d.js"), "utf8");

test("Android wrapper loads the bundled game without debug mode", () => {
  assert.match(activity, /appassets\.androidplatform\.net\/assets\/index\.html/);
  assert.match(activity, /WebViewAssetLoader/);
  assert.match(activity, /BuildConfig\.DEBUG/);
  assert.match(activity, /WebView\.setWebContentsDebuggingEnabled\(true\)/);
  assert.doesNotMatch(activity, /file:\/\/\/android_asset\/index\.html/);
  assert.doesNotMatch(activity, /debug=1/);
  assert.match(androidGame, /\.\/vendor\/three\.module\.js/);
  assert.doesNotMatch(androidGame, /cdn\.jsdelivr\.net\/npm\/three/);
});

test("Android wrapper follows adaptive orientation and forwards system Back", () => {
  assert.doesNotMatch(manifest, /android:screenOrientation="landscape"/);
  assert.match(manifest, /android:enableOnBackInvokedCallback="true"/);
  assert.match(activity, /onBackPressed\(\)/);
  assert.match(activity, /key:'Escape'/);
});

test("Android wrapper refreshes bundled game files after an APK update without clearing player storage", () => {
  assert.match(activity, /settings\.setCacheMode\(WebSettings\.LOAD_NO_CACHE\)/);
  assert.match(activity, /webView\.clearCache\(true\)/);
  assert.doesNotMatch(activity, /WebStorage\.getInstance\(\)\.deleteAllData\(\)/);
  assert.ok(
    activity.indexOf("webView.clearCache(true)") < activity.indexOf("webView.loadUrl(GAME_URL)"),
    "cache must be cleared before the local game bundle loads"
  );
});

test("Android bundle contains current game and visual assets", () => {
  const assets = path.join(root, "android", "app", "src", "main", "assets");
  for (const relative of [
    "index.html",
    "game3d.js",
    "style.css",
    "android-platform.js",
    "android-platform.css",
    "render-lab.html",
    "render-lab.js",
    "render-lab.css",
    "vendor/three.module.js",
    "vendor/three.core.js",
    "assets/nightfall/backgrounds/nightfall-six-survivors-v2.png",
    "assets/nightfall/video/nightfall-water-walk-v1.mp4",
  ]) {
    assert.ok(fs.existsSync(path.join(assets, relative)), `missing bundled asset: ${relative}`);
  }
});

test("Android bundle stays byte-for-byte aligned with the public app tree", () => {
  const publicRoot = path.join(root, "public");
  const androidRoot = path.join(root, "android", "app", "src", "main", "assets");
  const files = [];
  const collect = (directory, prefix = "") => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = path.join(prefix, entry.name);
      if (entry.isDirectory()) collect(path.join(directory, entry.name), relative);
      else files.push(relative);
    }
  };
  collect(publicRoot);
  const platformOverrides = new Set(["index.html", "game3d.js", "graphics-config.mjs", "style.css"]);
  for (const relative of files) {
    const publicPath = path.join(publicRoot, relative);
    const androidPath = path.join(androidRoot, relative);
    assert.ok(fs.existsSync(androidPath), `missing Android copy: ${relative}`);
    if (!platformOverrides.has(relative.replaceAll(path.sep, "/"))) {
      assert.deepEqual(fs.readFileSync(androidPath), fs.readFileSync(publicPath), `stale Android copy: ${relative}`);
    }
  }
  const androidGame = fs.readFileSync(path.join(androidRoot, "game3d.js"), "utf8");
  const androidCss = fs.readFileSync(path.join(androidRoot, "android-platform.css"), "utf8");
  const androidIndex = fs.readFileSync(path.join(androidRoot, "index.html"), "utf8");
  assert.match(androidGame, /\.\/vendor\/three\.module\.js/);
  assert.match(androidCss, /body\.mobile-profile-ready/);
  assert.match(androidCss, /\.game-menu-panel \{[^}]*overflow-y:\s*auto/);
  assert.match(androidIndex, /android-platform\.js/);
});
