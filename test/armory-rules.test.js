import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveShieldUpgrade } from "../public/armory-rules.mjs";

test("a shield purchase deducts scrap and preserves the class base armor", () => {
  const result = resolveShieldUpgrade({ phase: "loadout", scrap: 40, shieldLevel: 0, baseArmor: 35 });

  assert.equal(result.applied, true);
  assert.equal(result.nextScrap, 16);
  assert.equal(result.nextLevel, 1);
  assert.equal(result.shieldMax, 65);
  assert.match(result.message, /Armor upgraded/i);
});

test("an unaffordable armor click explains the missing scrap instead of failing silently", () => {
  const result = resolveShieldUpgrade({ phase: "prep", scrap: 9, shieldLevel: 0, baseArmor: 0 });

  assert.equal(result.applied, false);
  assert.equal(result.reason, "insufficient-scrap");
  assert.match(result.message, /15 more scrap/i);
});

test("armor upgrades remain limited to loadout and supply phases", () => {
  assert.equal(resolveShieldUpgrade({ phase: "combat", scrap: 100, shieldLevel: 0 }).reason, "wrong-phase");
  assert.equal(resolveShieldUpgrade({ phase: "prep", scrap: 1000, shieldLevel: 10 }).reason, "max-level");
});

test("the armory exposes a visible purchase result and uses the shared shield rule", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");

  assert.match(html, /id="armoryStatus"[^>]*role="status"/);
  assert.match(game, /resolveShieldUpgrade\(/);
  assert.match(game, /\$\("armoryStatus"\)\.textContent = result\.message/);
});

test("controller users can move through and activate armory choices without a mouse", () => {
  const game = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "game3d.js"), "utf8");

  assert.match(game, /function handleShopController\(\)/);
  assert.match(game, /resolveMenuStickNavigation\(\{ x: controller\.mx, y: controller\.mz \}, shopStickDirection\)/);
  assert.match(game, /else if \(!ui\.shop\.classList\.contains\("hidden"\) && controllerConnected\) handleShopController\(\)/);
});
