import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { questBeaconFrame, questBeaconProfile } from "../public/quest-beacon.mjs";

const gameSource = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("story quests resolve to authored map beacon destinations", () => {
  const first = questBeaconProfile({ questId: "first-watch", mapKey: "inferno" });
  const wrongMap = questBeaconProfile({ questId: "first-watch", mapKey: "ice" });
  const finale = questBeaconProfile({ questId: "crown-of-steel", mapKey: "city" });
  assert.equal(first.visible, true);
  assert.equal(wrongMap.visible, false);
  assert.equal(finale.visible, true);
  assert.ok(first.x !== finale.x || first.z !== finale.z);
  assert.match(first.label, /relay|armory/i);
});

test("quest beacon animation stays deterministic and bounded", () => {
  const profile = questBeaconProfile({ questId: "first-watch", mapKey: "inferno" });
  const first = questBeaconFrame({ profile, elapsed: 1.25 });
  assert.deepEqual(first, questBeaconFrame({ profile, elapsed: 1.25 }));
  assert.ok(first.scale >= .86 && first.scale <= 1.18);
  assert.ok(first.opacity >= .45 && first.opacity <= 1);
  assert.ok(first.rotation >= 0 && first.rotation <= Math.PI * 2);
});

test("the renderer wires an active quest beacon into map visuals", () => {
  assert.match(gameSource, /quest-beacon\.mjs/);
  assert.match(gameSource, /addQuestBeacon/);
  assert.match(gameSource, /quest-beacon:/);
  assert.match(gameSource, /mapAnim === "quest-beacon"/);
  assert.match(gameSource, /refreshQuestBeacon/);
});
