import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createHudViewModel } from "../public/hud-view-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");
const mobileCss = css.slice(css.indexOf("@media (max-width: 680px)"));

test("clamps and formats combat rail values", () => {
  const hud = createHudViewModel({
    health: 140,
    maxHealth: 100,
    armor: -12,
    maxArmor: 50,
    ammo: { current: 7.9, reserve: 120.4 },
    ability: { label: "Dash", readyAt: 12_000, cooldownMs: 12_000, now: 3_000 },
  });

  assert.deepEqual(hud.health, { value: 100, percentage: 100, label: "100 HP" });
  assert.deepEqual(hud.armor, { value: 0, percentage: 0, label: "0 ARMOR" });
  assert.deepEqual(hud.ammo, { current: 7, reserve: 120, label: "7 / 120" });
  assert.deepEqual(hud.ability, {
    label: "DASH",
    state: "cooldown",
    remainingMs: 9_000,
    percentage: 75,
    statusLabel: "COOLDOWN 9s",
  });
});

test("formats long objectives without changing data", () => {
  const objective = "Secure the radio tower before the toxic fog reaches the evacuation route and disables the final extraction signal.";
  const hud = createHudViewModel({ objective, mission: "  ", round: 3, timer: 75 });

  assert.equal(hud.objective.label, objective);
  assert.equal(hud.objective.overflowClass, "hud-text-ellipsis");
  assert.equal(hud.mission.label, "MISSION UNAVAILABLE");
  assert.equal(hud.round.label, "WAVE 3");
  assert.equal(hud.timer.label, "01:15");
});

test("provides mode-specific team state", () => {
  const solo = createHudViewModel({ mode: "solo", playerName: "  ", teamHealth: 60 });
  const ctf = createHudViewModel({ mode: "ctf", playerName: "Nova", teamHealth: 140, teamHealthMax: 200 });

  assert.deepEqual(solo.team, {
    mode: "solo",
    label: "SOLO OPERATION",
    playerName: "UNKNOWN OPERATOR",
    healthPercentage: 60,
    healthLabel: "60%",
    overflowClass: "hud-text-ellipsis",
  });
  assert.deepEqual(ctf.team, {
    mode: "ctf",
    label: "BLUE TEAM CTF",
    playerName: "Nova",
    healthPercentage: 70,
    healthLabel: "70%",
    overflowClass: "hud-text-ellipsis",
  });
});

test("preserves long player names and objectives for bounded HUD regions", () => {
  const playerName = "Alexandria-Frontier-Command-Operator-With-A-Long-Callsign-01";
  const objective = "Recover the encrypted field relay from the northern watchtower before hostile reinforcements cross the flooded refinery and close the route.";
  const hud = createHudViewModel({ playerName, objective });

  assert.equal(playerName.length, 60);
  assert.equal(hud.team.playerName, playerName);
  assert.equal(hud.objective.label, objective);
  assert.equal(hud.team.overflowClass, "hud-text-ellipsis");
  assert.equal(hud.objective.overflowClass, "hud-text-ellipsis");
  assert.match(html, /id="combatRail"/);
  assert.match(html, /id="objectiveRail"/);
  assert.match(html, /id="teamName"[^>]*class="hud-text-ellipsis"/);
  assert.match(html, /id="objectiveText"[^>]*class="hud-text-ellipsis"/);
  assert.match(css, /\.hud-text-ellipsis\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/s);
});

test("uses ally maximum health in the squad-health denominator", () => {
  const hud = createHudViewModel({
    mode: "teams",
    health: 100,
    maxHealth: 100,
    teamHealth: 250,
    teamHealthMax: 300,
  });

  assert.equal(hud.team.healthPercentage, 83);
  assert.match(game, /return \{ g: group, hp: 100, maxHp: 100, shield: 0,/);
});

test("reserves separate mobile rows for the objective rail and menu", () => {
  assert.match(mobileCss, /#objectiveRail\s*\{[^}]*top:\s*max\(8px, env\(safe-area-inset-top\)\)/s);
  assert.match(mobileCss, /#topRightMenu\s*\{[^}]*top:\s*max\(112px, calc\(env\(safe-area-inset-top\) \+ 104px\)\)/s);
});

test("keeps mobile menu controls at least 44 CSS pixels tall", () => {
  assert.match(mobileCss, /\.mode-control button,\s*\.map-control button,\s*#topRightMenu button\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
});
