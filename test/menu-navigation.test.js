import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  LOBBY_CONTROL_ORDER,
  createMenuNavigator,
  describeLobbyControl,
  isMenuCommandDisabled,
  nextLobbySelectIndex,
  resolveLobbyControllerAction,
  resolveMenuStickNavigation,
  resolveMenuKeyAction,
  visibleLobbyControlDescriptors,
} from "../public/menu-navigation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "style.css"), "utf8");
const game = fs.readFileSync(path.join(root, "public", "game3d.js"), "utf8");

test("wraps keyboard movement through ordered commands", () => {
  const navigator = createMenuNavigator(["survival", "online", "loadout"], "survival");

  assert.deepEqual(navigator.move("previous", "keyboard"), { id: "loadout", input: "keyboard" });
  assert.deepEqual(navigator.move("next", "keyboard"), { id: "survival", input: "keyboard" });
});

test("skips disabled commands and falls back to the first enabled command", () => {
  const navigator = createMenuNavigator([
    { id: "survival", disabled: true },
    { id: "online", disabled: false },
    { id: "loadout", disabled: true },
  ], "survival");

  assert.deepEqual(navigator.current(), { id: "online", input: "programmatic" });
  assert.deepEqual(navigator.move("next", "controller"), { id: "online", input: "controller" });
});

test("disables commands nested inside a collapsed lobby choice group", () => {
  const collapsedChoice = { id: "teamSize1Btn", disabled: false, closest: selector => selector === ".hidden, [hidden]" ? { id: "teamSizeChoices" } : null };
  const visibleChoice = { id: "survivalLobbyBtn", disabled: false, closest: () => null };

  assert.equal(isMenuCommandDisabled(collapsedChoice), true);
  assert.equal(isMenuCommandDisabled(visibleChoice), false);
  assert.equal(isMenuCommandDisabled({ ...visibleChoice, disabled: true }), true);
});

test("hands selected state from mouse to controller movement", () => {
  const navigator = createMenuNavigator(["survival", "online", "loadout"], "survival");

  assert.deepEqual(navigator.focus("online", "mouse"), { id: "online", input: "mouse" });
  assert.deepEqual(navigator.move("next", "controller"), { id: "loadout", input: "controller" });
});

test("accepts keyboard movement after a controller disconnect", () => {
  const navigator = createMenuNavigator(["survival", "online", "loadout"], "survival");

  navigator.focus("online", "controller");
  assert.deepEqual(navigator.move("next", "keyboard"), { id: "loadout", input: "keyboard" });
});

test("uses touch to focus a command before activation", () => {
  const navigator = createMenuNavigator(["survival", "online"], "survival");

  assert.deepEqual(navigator.focus("online", "touch"), { id: "online", input: "touch" });
  assert.deepEqual(navigator.current(), { id: "online", input: "touch" });
  assert.deepEqual(navigator.activate(), { id: "online", input: "touch" });
});

test("activates the currently focused command without changing focus", () => {
  const navigator = createMenuNavigator(["survival", "online", "loadout"], "survival");

  navigator.focus("loadout", "keyboard");
  assert.deepEqual(navigator.activate(), { id: "loadout", input: "keyboard" });
  assert.deepEqual(navigator.current(), { id: "loadout", input: "keyboard" });
});

test("leaves Tab native and synchronizes focus after mouse or touch input", () => {
  assert.equal(resolveMenuKeyAction("Tab", { navigationFocused: false, nativeControlFocused: false }), null);

  for (const pointerInput of ["mouse", "touch"]) {
    const navigator = createMenuNavigator(["survival", "ctf", "loadout"], "survival");
    navigator.focus("loadout", pointerInput);

    assert.deepEqual(navigator.focus("ctf", "keyboard"), { id: "ctf", input: "keyboard" });
    assert.deepEqual(navigator.activate(), { id: "ctf", input: "keyboard" });
  }

  assert.match(game, /control\.addEventListener\("focus", \(\) => \{\s*focusLobbyCommand\(control\.id, inputMode\);\s*\}\);/);
});

test("routes Enter and Space to the focused floating command", () => {
  for (const key of ["Enter", " "]) {
    const navigator = createMenuNavigator(["survival", "ctf", "loadout"], "survival");
    navigator.focus("ctf", "keyboard");

    assert.deepEqual(
      resolveMenuKeyAction(key, { navigationFocused: true, nativeControlFocused: true }),
      { type: "activate" },
    );
    assert.equal(navigator.activate()?.id, "ctf");
    assert.equal(
      resolveMenuKeyAction(key, { navigationFocused: false, nativeControlFocused: true }),
      null,
    );
  }

  assert.match(game, /resolveMenuKeyAction\(event\.key, \{ navigationFocused, nativeControlFocused, selectFocused \}\)/);
  assert.match(game, /focusLobbyCommand\(activeElement\.id, "keyboard"\)/);
});

test("does not intercept arrows owned by lobby selects or native controls", () => {
  for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
    assert.equal(
      resolveMenuKeyAction(key, { navigationFocused: false, nativeControlFocused: true }),
      null,
    );
  }

  assert.deepEqual(
    resolveMenuKeyAction("ArrowDown", { navigationFocused: false, nativeControlFocused: false }),
    { type: "move", direction: "next" },
  );
  assert.match(game, /if \(nativeControlFocused \|\| key === "tab"\) return;/);
});

test("registers every required lobby controller target in one explicit order", () => {
  const required = [
    "lobbyAvatarButton", "lobbyProfileReadout",
    "survivalLobbyBtn", "teamLobbyBtn", "ctf6LobbyBtn",
    "teamSize1Btn", "teamSize2Btn", "teamSize3Btn",
    "ctf4PlayersLobbyBtn", "ctf6PlayersLobbyBtn",
    "dashboardBtn", "editProfileBtn", "lobbyConnectionsBtn", "lobbySettingsBtn", "signOutProfileBtn",
    "lobbyGameOptionsSummary", "botTeamSize", "botDifficulty", "storyMapSelect", "riskLevel",
    "lobbyBackBtn",
  ];

  for (const id of required) {
    assert.ok(LOBBY_CONTROL_ORDER.includes(id), `missing #${id} from controller order`);
    assert.match(html, new RegExp(`id="${id}"[^>]*data-lobby-control`), `#${id} is not marked as a lobby control`);
  }
  assert.equal(new Set(LOBBY_CONTROL_ORDER).size, LOBBY_CONTROL_ORDER.length);
});

test("excludes hidden groups and closed detail contents while retaining the Game Options summary", () => {
  const mock = ({ id, tagName = "BUTTON", hidden = false, closedDetails = false, disabled = false }) => ({
    id,
    tagName,
    disabled,
    closest(selector) {
      if (selector === ".hidden, [hidden]") return hidden ? { id: "hidden-parent" } : null;
      if (selector === "details:not([open])") return closedDetails ? { id: "lobbyGameOptions" } : null;
      return null;
    },
  });
  const controls = [
    mock({ id: "teamSize1Btn", hidden: true }),
    mock({ id: "lobbyGameOptionsSummary", tagName: "SUMMARY", closedDetails: true }),
    mock({ id: "botTeamSize", tagName: "SELECT", closedDetails: true }),
    mock({ id: "dashboardBtn" }),
  ];

  assert.equal(describeLobbyControl(controls[0]).visible, false);
  assert.equal(describeLobbyControl(controls[1]).visible, true);
  assert.equal(describeLobbyControl(controls[2]).visible, false);
  assert.deepEqual(
    visibleLobbyControlDescriptors(controls).map(control => [control.id, control.type]),
    [["lobbyGameOptionsSummary", "summary"], ["dashboardBtn", "button"]],
  );
});

test("uses horizontal controller input to change selects and vertical input to leave them", () => {
  const select = { id: "botDifficulty", type: "select", visible: true, disabled: false };

  assert.deepEqual(resolveLobbyControllerAction({ dpadLeft: true }, select), { type: "select", step: -1 });
  assert.deepEqual(resolveLobbyControllerAction({ dpadRight: true }, select), { type: "select", step: 1 });
  assert.deepEqual(resolveLobbyControllerAction({ dpadUp: true }, select), { type: "move", direction: "previous" });
  assert.deepEqual(resolveLobbyControllerAction({ dpadDown: true }, select), { type: "move", direction: "next" });
  assert.deepEqual(resolveLobbyControllerAction({ interact: true }, { id: "dashboardBtn", type: "button" }), { type: "activate" });

  const options = [{ disabled: false }, { disabled: true }, { disabled: false }];
  assert.equal(nextLobbySelectIndex(options, 0, 1), 2);
  assert.equal(nextLobbySelectIndex(options, 2, 1), 0);
  assert.equal(nextLobbySelectIndex(options, 0, -1), 2);
  assert.match(game, /dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
});

test("left-stick menu navigation moves once per deliberate tilt and resets after release", () => {
  const first = resolveMenuStickNavigation({ x: 0.82, y: 0.12 }, null);
  const held = resolveMenuStickNavigation({ x: 0.9, y: 0.08 }, first.heldDirection);
  const released = resolveMenuStickNavigation({ x: 0.1, y: 0.05 }, held.heldDirection);
  const upward = resolveMenuStickNavigation({ x: 0.1, y: -0.9 }, released.heldDirection);

  assert.deepEqual(first, { direction: "right", heldDirection: "right" });
  assert.deepEqual(held, { direction: null, heldDirection: "right" });
  assert.deepEqual(released, { direction: null, heldDirection: null });
  assert.deepEqual(upward, { direction: "up", heldDirection: "up" });
});

test("lobby controller wiring accepts the left stick, A activation, and B back", () => {
  assert.match(game, /resolveMenuStickNavigation\(\{ x: controller\.mx, y: controller\.mz \}, lobbyStickDirection\)/);
  assert.match(game, /if \(controller\.ability\) \{ \$\("lobbyBackBtn"\)\.click\(\); return; \}/);
  assert.match(css, /body\[data-input-mode="controller"\][^\{]*\.is-selected/);
});

test("keeps lobby actions as independent floating semantic commands", () => {
  assert.match(html, /<nav id="lobbyNavigation"[^>]*aria-label="Lobby commands"/);

  for (const id of ["survivalLobbyBtn", "onlineSurvivalBtn", "teamLobbyBtn", "ctf6LobbyBtn", "dashboardBtn", "editProfileBtn", "lobbySettingsBtn", "signOutProfileBtn"]) {
    assert.match(html, new RegExp(`<button id="${id}"[^>]*class="[^"]*floating-command`), `missing floating command #${id}`);
  }

  const floatingCommandRule = css.match(/\.floating-command\s*\{([^}]*)\}/)?.[1] || "";
  const minWidth = Number(floatingCommandRule.match(/min-width:\s*(\d+)px/)?.[1]);
  const minHeight = Number(floatingCommandRule.match(/min-height:\s*(\d+)px/)?.[1]);
  assert.ok(minWidth >= 44);
  assert.ok(minHeight >= 44);
  assert.match(css, /\.floating-command small\s*\{[^}]*max-height:\s*0/);
  assert.match(css, /\.floating-command\.is-selected small\s*\{[^}]*max-height:/);
  assert.doesNotMatch(game, /lobbyPlayer\.textContent\s*=\s*`Profile:/);
});

test("uses standalone safe-area Back controls and keeps combat top-right to Menu", () => {
  const topRightMenu = html.match(/<div id="topRightMenu">([\s\S]*?)<\/div>/)?.[1] || "";

  assert.match(html, /<section id="lobbyScreen"[^>]*>\s*<img[^>]*>\s*<button id="lobbyBackBtn"/);
  assert.match(css, /#lobbyBackBtn\s*\{[^}]*top:\s*max\([^}]*safe-area-inset-top[^}]*left:\s*max\([^}]*safe-area-inset-left/s);
  assert.match(topRightMenu, /<button id="menuToggle"/);
  assert.doesNotMatch(topRightMenu, /id="(soloMode|teamMode|ctfMode|openShopBtn|settingsBtn)"/);
  assert.match(game, /createMenuNavigator/);
});

test("keeps the relocated Armory command available only from a prep-phase menu", () => {
  assert.match(html, /<button id="openShopBtn" type="button">Armory<\/button>/);
  assert.match(game, /let menuOpenedFromPrep = false;/);
  assert.match(game, /menuOpenedFromPrep = phase === "prep";/);
  assert.match(game, /\$\("openShopBtn"\)\.onclick = \(\) => \s*\{\s*if \(menuOpenedFromPrep\)/);
});
