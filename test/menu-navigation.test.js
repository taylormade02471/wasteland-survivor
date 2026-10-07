import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createMenuNavigator, resolveMenuKeyAction } from "../public/menu-navigation.mjs";

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

  assert.match(game, /button\.addEventListener\("focus", \(\) => \{\s*focusLobbyCommand\(button\.id, inputMode\);\s*\}\);/);
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

  assert.match(game, /resolveMenuKeyAction\(event\.key, \{ navigationFocused, nativeControlFocused \}\)/);
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
