import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { FIRST_PERSON_WEAPON_VIEW, firstPersonWeaponPose } from "../public/first-person-weapon-view.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");

test("first-person authored weapon pose stays finite, recoil-aware, and tightens during aim", () => {
  const hip = firstPersonWeaponPose({ pose: { kickZ: -0.24, liftY: 0.08, roll: -0.02, swayX: 0.018 } });
  const aimed = firstPersonWeaponPose({ pose: { kickZ: -0.24, liftY: 0.08, roll: -0.02, swayX: 0.018 } }, { aim: 1 });

  assert.equal(hip.renderOrder, 1000);
  assert.equal(hip.position.z, FIRST_PERSON_WEAPON_VIEW.ready.z + 0.24);
  assert.ok(Math.abs(aimed.position.x) < Math.abs(hip.position.x));
  assert.ok(aimed.position.y > hip.position.y);
  assert.ok(Number.isFinite(hip.rotation.z));
  assert.deepEqual(firstPersonWeaponPose({ pose: { kickZ: Number.NaN, liftY: Infinity } }, { aim: Infinity }), firstPersonWeaponPose({ pose: {} }));
});

test("the live renderer parents a dedicated textured weapon view model to the camera without altering movement code", () => {
  assert.match(game, /from "\.\/first-person-weapon-view\.mjs"/);
  assert.match(game, /FIRST_PERSON_WEAPON_VIEW\.rigName/);
  assert.match(game, /camera\.add\(firstPersonWeaponRig\)/);
  assert.match(game, /scene\.add\(camera\)/);
  assert.match(game, /FIRST_PERSON_WEAPON_VIEW\.weaponName/);
  assert.match(game, /material\.depthTest = false/);
  assert.match(game, /material\.depthWrite = false/);
  assert.match(game, /firstPersonWeaponRig\.visible/);
  assert.match(game, /renderFocus === "weapon-viewmodel"/);
  assert.match(game, /const isPlayerWeapon = group === player\?\.g/);
  assert.match(game, /if \(isPlayerWeapon\) attachFirstPersonWeapon\(asset, gunName\)/);
  assert.match(game, /function resetMap\(\)[\s\S]*?firstPersonWeaponRig\.visible = false/);
  assert.match(game, /firstPersonWeaponPose\(frame/);
  assert.doesNotMatch(game, /function firstPersonMovementDelta/);
  assert.doesNotMatch(game, /function nextMouseYaw/);
});
