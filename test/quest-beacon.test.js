import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { questBeaconFrame, questBeaconProfile } from "../public/quest-beacon.mjs";

const gameSource = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("story quests resolve to authored map beacon destinations", () => {
  const first = questBeaconProfile({ questId: "first-watch", mapKey: "wasteland" });
  const wrongMap = questBeaconProfile({ questId: "first-watch", mapKey: "ice" });
  const finale = questBeaconProfile({ questId: "crown-of-steel", mapKey: "inferno" });
  assert.equal(first.visible, true);
  assert.equal(wrongMap.visible, false);
  assert.equal(finale.visible, true);
  assert.ok(first.x !== finale.x || first.z !== finale.z);
  assert.match(first.label, /relay|armory/i);
});

test("quest beacon animation stays deterministic and bounded", () => {
  const profile = questBeaconProfile({ questId: "first-watch", mapKey: "wasteland" });
  const first = questBeaconFrame({ profile, elapsed: 1.25 });
  assert.deepEqual(first, questBeaconFrame({ profile, elapsed: 1.25 }));
  assert.ok(first.scale >= .86 && first.scale <= 1.18);
  assert.ok(first.opacity >= .45 && first.opacity <= 1);
  assert.ok(first.rotation >= 0 && first.rotation <= Math.PI * 2);
});

test("every quest beacon targets one of the four playable biomes", () => {
  const maps = ["wasteland", "toxic", "ice", "inferno"];
  const questIds = ["first-watch", "scrap-run", "raider-breaker", "frontier-reach", "defend-the-frontier", "white-signal", "across-the-cinders", "crown-of-steel"];
  for (const questId of questIds) {
    const profile = questBeaconProfile({ questId, mapKey: "wasteland" });
    assert.ok(maps.includes(profile.mapKey), `${questId} must target a playable map`);
  }
});

test("the renderer wires an active quest beacon into map visuals", () => {
  assert.match(gameSource, /quest-beacon\.mjs/);
  assert.match(gameSource, /addQuestBeacon/);
  assert.match(gameSource, /quest-beacon:/);
  assert.match(gameSource, /mapAnim === "quest-beacon"/);
  assert.match(gameSource, /refreshQuestBeacon/);
});

test("active quest beacons carry a visible volumetric beam for long-range story navigation", () => {
  assert.match(gameSource, /quest-beacon-beam/);
  assert.match(gameSource, /new THREE\.CylinderGeometry\(\.16, \.52, 9\.5/);
  assert.match(gameSource, /node\.userData\.beam\.material\.opacity/);
});
