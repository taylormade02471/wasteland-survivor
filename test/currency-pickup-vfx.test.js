import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { currencyPickupFrame, currencyPickupProfile } from "../public/currency-pickup-vfx.mjs";

const gameSource = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("gold and silver pickup profiles stay distinct and bounded", () => {
  const gold = currencyPickupProfile("gold");
  const silver = currencyPickupProfile("silver");
  assert.equal(gold.kind, "gold");
  assert.equal(silver.kind, "silver");
  assert.notEqual(gold.color, silver.color);
  assert.ok(gold.scale > 0 && silver.scale > 0);
  assert.ok(gold.lift > 0 && silver.lift > 0);
  assert.ok(gold.durationMs <= 1800 && silver.durationMs <= 1800);
});

test("currency pickup motion is deterministic and settles upward", () => {
  const profile = currencyPickupProfile("gold");
  const first = currencyPickupFrame({ profile, elapsed: .42, index: 2 });
  const second = currencyPickupFrame({ profile, elapsed: .42, index: 2 });
  assert.deepEqual(first, second);
  assert.ok(first.y >= 0 && first.y <= profile.lift);
  assert.ok(first.rotation >= 0 && first.rotation <= Math.PI * 2);
  assert.ok(first.opacity >= 0 && first.opacity <= 1);
});

test("discovery rewards create visible gold and silver pickup bursts", () => {
  assert.match(gameSource, /currency-pickup-vfx\.mjs/);
  assert.match(gameSource, /spawnCurrencyPickupBurst/);
  assert.match(gameSource, /currency-pickup:gold/);
  assert.match(gameSource, /currency-pickup:silver/);
  assert.match(gameSource, /currency-pickup-rim:\$\{reward\.kind\}/);
  assert.match(gameSource, /currencyKind = reward\.kind/);
});

test("enemy defeats award deterministic currency and spawn the same pickup visuals", () => {
  assert.match(gameSource, /enemyCurrencyDrop\(\{ enemyType: enemy\.enemyType, wave \}\)/);
  assert.match(gameSource, /gold \+= currencyDrop\.gold/);
  assert.match(gameSource, /silver \+= currencyDrop\.silver/);
  assert.match(gameSource, /spawnCurrencyPickupBurst\(enemy\.g\.position, currencyDrop\)/);
});
