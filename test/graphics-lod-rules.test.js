import test from "node:test";
import assert from "node:assert/strict";

import {
  createGraphicsLodSelector,
  selectGraphicsLod,
} from "../public/graphics-lod-rules.mjs";

const phone = { kind: "phone", viewportWidth: 390, viewportHeight: 844, dpr: 3, memory: 4, cores: 8 };
const tablet = { kind: "tablet", viewportWidth: 1024, viewportHeight: 1366, dpr: 2, memory: 8, cores: 8 };
const desktop = { kind: "desktop", viewportWidth: 1920, viewportHeight: 1080, dpr: 1, memory: 16, cores: 12 };
const tv = { kind: "tv", viewportWidth: 3840, viewportHeight: 2160, dpr: 1, memory: 4, cores: 4 };

test("selects stable device-aware budgets for phone, tablet, desktop, and TV", () => {
  const phoneLod = selectGraphicsLod({ device: phone });
  const tabletLod = selectGraphicsLod({ device: tablet });
  const desktopLod = selectGraphicsLod({ device: desktop });
  const tvLod = selectGraphicsLod({ device: tv });

  assert.equal(phoneLod.tier, "low");
  assert.equal(tabletLod.tier, "medium");
  assert.equal(desktopLod.tier, "high");
  assert.equal(tvLod.tier, "medium");
  for (const lod of [phoneLod, tabletLod, desktopLod, tvLod]) {
    assert.ok(Number.isInteger(lod.shadows) && lod.shadows >= 0);
    assert.ok(Number.isInteger(lod.particles) && lod.particles >= 0);
    assert.ok(Number.isInteger(lod.enemyDetail) && lod.enemyDetail >= 0);
    assert.match(lod.textureTier, /^(low|medium|high)$/);
    assert.ok(lod.renderScale > 0 && lod.renderScale <= 1);
  }
});

test("uses viewport, DPR, memory, and cores without requiring optional fields", () => {
  const constrained = selectGraphicsLod({ device: { viewportWidth: 1280, viewportHeight: 720, dpr: 1, memory: 2, cores: 2 } });
  const capable = selectGraphicsLod({ device: { viewportWidth: 1280, viewportHeight: 720, dpr: 1, memory: 16, cores: 16 } });

  assert.equal(constrained.tier, "low");
  assert.equal(capable.tier, "high");
  assert.ok(constrained.renderScale < capable.renderScale);
});

test("hardware constraints override device labels while capable phones may reach medium", () => {
  const constrainedTv = selectGraphicsLod({ device: { ...tv, memory: 1, cores: 2 } });
  const capablePhone = selectGraphicsLod({ device: { ...phone, memory: 8, cores: 8 } });

  assert.equal(constrainedTv.tier, "low");
  assert.equal(capablePhone.tier, "medium");
});

test("frame-time samples lower quality and recovery requires sustained headroom", () => {
  const hot = selectGraphicsLod({ device: desktop, frameTimes: [42, 44, 46, 48] });
  const cool = selectGraphicsLod({ device: desktop, frameTimes: [12, 13, 14, 15] });

  assert.equal(hot.tier, "medium");
  assert.equal(cool.tier, "high");
});

test("hysteresis requires consecutive meaningful batches and ignores one outlier", () => {
  const selector = createGraphicsLodSelector({ device: desktop });
  const first = selector.update([34, 35, 36, 35]);
  const second = selector.update([29, 30, 31, 30]);
  const shortOutlier = selector.update([90]);
  const firstHot = selector.update([42, 43, 44, 45]);
  const secondHot = selector.update([42, 43, 44, 45]);

  assert.equal(first.tier, "high");
  assert.equal(second.tier, "high");
  assert.equal(shortOutlier.tier, "high");
  assert.equal(firstHot.tier, "high");
  assert.equal(secondHot.tier, "medium");
});

test("returns immutable budget objects and honors a previous tier", () => {
  const previous = selectGraphicsLod({ device: phone });
  const next = selectGraphicsLod({ device: desktop, previous, frameTimes: [12, 13, 14] });

  assert.notEqual(next, previous);
  assert.equal(next.tier, "high");
  assert.equal(previous.tier, "low");
  assert.throws(() => { next.renderScale = 0.1; }, TypeError);
});
