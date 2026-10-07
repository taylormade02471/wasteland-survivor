# Nightfall Cinematic Military UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the conventional centered-panel interface with a cinematic Nightfall menu and edge-mounted combat HUD that remain polished and usable on desktop, phone, keyboard, mouse, touch, and Xbox-style controllers.

**Architecture:** Keep gameplay state in `game3d.js`, but move UI normalization and navigation decisions into small pure modules. HTML supplies stable semantic controls and regions; CSS supplies the presentation and responsive layout; `menu-presentation.mjs` coordinates camera and environmental responses without deciding whether a command is valid.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, ES modules, Three.js 0.180, Node test runner, existing Nightfall background renderer.

**Spec:** `docs/superpowers/specs/2026-10-07-cinematic-military-ui-design.md`

## Global Constraints

- Preserve existing profiles, progress, graphics, backend, game modes, and control mappings.
- Do not replace or delete working assets; all changes must be additive or reversible.
- Keep the center of combat free of permanent panels.
- Touch targets must be at least 44 CSS pixels on their shortest side.
- Honor safe-area insets and reduced-motion preferences.
- Keep button hit targets stable even when their visual layers animate.
- Preserve all gameplay-critical DOM IDs verified by `test/branding.test.js`.
- Do not add a frontend framework or new runtime dependency.
- Validate at 390 by 844 portrait and at least one landscape phone viewport.

## Review Focus

- A long player name, mission title, or objective must wrap or truncate without expanding an edge rail into the battlefield; covered by Task 2 responsive-content tests.
- A controller disconnected while a floating command is focused must preserve focus and allow keyboard or touch takeover; covered by Task 3 navigation tests.
- Reduced-motion mode must stop positional loops while retaining visible focus and section feedback; covered by Task 4 motion tests.
- A bright inferno or icy background must not reduce text below readable contrast; covered by Task 5 screenshot checks and backing-plate assertions.
- A narrow phone in landscape must keep combat controls clear of the HUD, chest locator, and safe areas; covered by Task 6 viewport checks.

---

### Task 1: Preservation Baseline And Reversible Checkpoint

**Files:**
- Create: `.git/` through local repository initialization if still absent
- Create: `docs/verification/cinematic-ui-baseline.md`
- Test: existing `test/*.test.js`

**Interfaces:**
- Consumes: current working source and 71-test baseline
- Produces: immutable baseline commit and documented desktop/phone screenshots for comparison

- [ ] **Step 1: Run the complete baseline suite**

Run: `node --test test/*.test.js`
Expected: all existing tests pass.

- [ ] **Step 2: Capture current desktop and phone screenshots**

Capture the home menu, lobby, Final Loadout, and live combat at the default desktop viewport and 390 by 844. Record paths and observed overlap issues in `docs/verification/cinematic-ui-baseline.md`.

- [ ] **Step 3: Initialize local version control if needed**

Run: `git init` only when `git rev-parse --is-inside-work-tree` fails. Add a `.gitignore` entry for `.data/`, `node_modules/`, `.vercel/`, logs, and local media captures.

- [ ] **Step 4: Commit the verified baseline**

```powershell
git add .
git commit -m "chore: checkpoint working wasteland survivor"
```

### Task 2: HUD View Model And Edge-Mounted Layout

**Files:**
- Create: `public/hud-view-model.mjs`
- Create: `test/hud-view-model.test.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/game3d.js`

**Interfaces:**
- Consumes: gameplay values already held by `game3d.js`
- Produces: `createHudViewModel(state)` returning `{ health, armor, ammo, ability, team, mission, round, timer, objective, score }`

- [ ] **Step 1: Write failing HUD normalization tests**

Add tests named `clamps and formats combat rail values`, `formats long objectives without changing data`, and `provides mode-specific team state`. Assert clamped 0-100 percentages, stable ammunition labels, explicit cooldown state, and sanitized fallback labels.

- [ ] **Step 2: Run the HUD tests and verify failure**

Run: `node --test test/hud-view-model.test.js`
Expected: FAIL because `hud-view-model.mjs` does not exist.

- [ ] **Step 3: Implement `createHudViewModel(state)`**

Keep it pure and DOM-independent. Do not move combat ownership out of `game3d.js`.

- [ ] **Step 4: Replace the current HUD structure**

Keep existing IDs while grouping them into `#combatRail` on the far-left edge and `#objectiveRail` along the top safe edge. Add stable regions for ammunition, ability cooldown, team health, and temporary center feedback.

- [ ] **Step 5: Bind the view model in `game3d.js`**

Create one `renderHud()` function that updates only values and CSS custom properties. Remove scattered presentation decisions from the frame loop without changing gameplay calculations.

- [ ] **Step 6: Add content-overflow assertions**

Extend the HUD tests with a 60-character player name and 120-character objective. Assert the view model preserves content while the DOM uses bounded regions with wrapping or ellipsis classes.

- [ ] **Step 7: Verify and commit**

Run: `node --test test/hud-view-model.test.js test/branding.test.js test/game-rules.test.js`
Expected: all pass.

```powershell
git add public/index.html public/style.css public/game3d.js public/hud-view-model.mjs test/hud-view-model.test.js
git commit -m "feat: add cinematic edge-mounted combat hud"
```

### Task 3: Unified Floating-Menu Navigation

**Files:**
- Create: `public/menu-navigation.mjs`
- Create: `test/menu-navigation.test.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/game3d.js`

**Interfaces:**
- Consumes: ordered command IDs and input events
- Produces: `createMenuNavigator(commandIds, initialId)`, with `move(direction)`, `focus(id)`, `activate()`, and `current()`

- [ ] **Step 1: Write failing navigation tests**

Cover wraparound movement, disabled-command skipping, mouse-to-controller handoff, controller disconnect followed by keyboard input, touch first-focus behavior, and stable activation of the focused command.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/menu-navigation.test.js`
Expected: FAIL because the navigator does not exist.

- [ ] **Step 3: Implement the pure navigator**

The module returns state and commands but never reads the DOM or starts animations.

- [ ] **Step 4: Replace the centered menu card with semantic floating commands**

Use real buttons in a stable absolute-positioned navigation region. Preserve existing command IDs and accessible names. Keep account/profile forms in a localized plate until authenticated; move post-login lobby actions into the floating command system.

- [ ] **Step 5: Bind mouse, keyboard, touch, and controller focus**

Use one selected-state class and `aria-current` or `aria-pressed` as appropriate. A visual layer may move, but the button box remains fixed.

- [ ] **Step 6: Verify and commit**

Run: `node --test test/menu-navigation.test.js test/game-rules.test.js test/branding.test.js`
Expected: all pass.

```powershell
git add public/index.html public/style.css public/game3d.js public/menu-navigation.mjs test/menu-navigation.test.js
git commit -m "feat: add unified floating menu navigation"
```

### Task 4: Cinematic Menu Presentation And Motion Preferences

**Files:**
- Create: `public/menu-presentation.mjs`
- Create: `test/menu-presentation.test.js`
- Modify: `public/nightfall-background.mjs`
- Modify: `public/style.css`
- Modify: `public/game3d.js`

**Interfaces:**
- Consumes: `{ section, focusedCommand, tier, reducedMotion }`
- Produces: `resolveMenuPresentation(input)` returning declarative camera, lighting, particle, and motion settings

- [ ] **Step 1: Write failing presentation tests**

Test distinct scene responses for home, lobby, survivor, armory, friends, and settings. Assert reduced motion sets positional duration and looping drift to zero while leaving focus illumination enabled.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/menu-presentation.test.js`
Expected: FAIL because the presentation resolver does not exist.

- [ ] **Step 3: Implement `resolveMenuPresentation(input)`**

Return data only. Use existing graphics tiers to limit particles, reflections, and camera drift on lower-capability phones.

- [ ] **Step 4: Extend the Nightfall renderer**

Add named menu regions and interpolate existing camera/background layers between them. Do not create a second rendering loop.

- [ ] **Step 5: Add floating-control visual layers**

Implement restrained breathing light, forward focus movement, particle response, and warning-amber/cyan selected states. Keep transforms on child visual layers so hit targets remain stable.

- [ ] **Step 6: Verify reduced motion and commit**

Run: `node --test test/menu-presentation.test.js test/nightfall-background.test.js`
Expected: all pass.

```powershell
git add public/menu-presentation.mjs public/nightfall-background.mjs public/style.css public/game3d.js test/menu-presentation.test.js
git commit -m "feat: add cinematic nightfall menu motion"
```

### Task 5: Tactical Plates And Environmental Transitions

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/game3d.js`
- Create: `test/ui-flow.test.js`

**Interfaces:**
- Consumes: section changes emitted by Task 3 and presentation state from Task 4
- Produces: preserved profile, avatar, dashboard, Final Loadout, armory, settings, pause, and lobby flows using scene-mounted tactical plates

- [ ] **Step 1: Write failing UI-flow structure tests**

Assert all existing critical IDs remain present, each overlay has a Back path, active overlays have one focus entry point, and no live-combat overlay is permanently centered.

- [ ] **Step 2: Verify failure before markup changes**

Run: `node --test test/ui-flow.test.js`
Expected: FAIL on the new tactical-region assertions.

- [ ] **Step 3: Convert each overlay one at a time**

Order: Final Loadout, armory, avatar selection, profile/dashboard, settings, pause. Preserve form fields, validation, and button handlers. Add localized smoked-glass or metal backing plates with map-specific contrast variants.

- [ ] **Step 4: Add transition state management**

Ensure only one section transition can run at a time. Escape/Back reverses to the previous section and never exits the game unintentionally.

- [ ] **Step 5: Verify bright-background readability**

Add structural assertions for backing plates on text-heavy regions. Capture screenshots against Inferno and Icy Mountain and record visual results.

- [ ] **Step 6: Verify and commit**

Run: `node --test test/ui-flow.test.js test/branding.test.js test/*.test.js`
Expected: all pass.

```powershell
git add public/index.html public/style.css public/game3d.js test/ui-flow.test.js
git commit -m "feat: integrate tactical plates and cinematic transitions"
```

### Task 6: Phone-First Responsive Combat And Menu Layout

**Files:**
- Modify: `public/style.css`
- Modify: `public/game3d.js`
- Create: `test/responsive-ui.test.js`
- Modify: `docs/verification/cinematic-ui-baseline.md`

**Interfaces:**
- Consumes: stable HUD regions and floating commands from Tasks 2 and 3
- Produces: desktop, portrait-menu, and landscape-combat layouts with safe-area support

- [ ] **Step 1: Write failing responsive structure tests**

Assert minimum 44-pixel touch target rules, safe-area usage, left-rail compaction classes, objective truncation rules, and no CSS viewport-width font scaling.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/responsive-ui.test.js`
Expected: FAIL on missing responsive contracts.

- [ ] **Step 3: Implement portrait menu adaptation**

Place floating commands within thumb reach, maintain the Nightfall character composition, and keep profile/account plates scrollable without overlapping controls.

- [ ] **Step 4: Implement landscape combat adaptation**

Compact the tactical rail to essential icons and values. Keep touch sticks, action buttons, chest locator, pause, objective rail, and device safe areas disjoint.

- [ ] **Step 5: Add coarse-pointer and mouse-on-phone handoff checks**

Preserve the existing rule that a detected mouse selects desktop mappings. Confirm the HUD changes layout without resetting game state.

- [ ] **Step 6: Verify and commit**

Run: `node --test test/responsive-ui.test.js test/game-rules.test.js`
Expected: all pass.

```powershell
git add public/style.css public/game3d.js test/responsive-ui.test.js docs/verification/cinematic-ui-baseline.md
git commit -m "feat: finish phone-first cinematic interface"
```

### Task 7: End-To-End Visual And Interaction Verification

**Files:**
- Modify: `docs/verification/cinematic-ui-baseline.md`
- Modify: `outputs/Wasteland-Survivor-Latest/` through the established packaging step

**Interfaces:**
- Consumes: completed Tasks 1-6
- Produces: verified package and comparison evidence

- [ ] **Step 1: Run the complete automated suite**

Run: `node --check public/game3d.js; node --check server.js; node --test test/*.test.js`
Expected: syntax checks pass and every test passes.

- [ ] **Step 2: Verify desktop flows**

In the browser, test first login, returning profile, avatar selection, lobby, Final Loadout, 15-second countdown, combat, pause, settings, shared chest, armory, death, respawn, and exit-to-lobby.

- [ ] **Step 3: Verify phone flows**

At 390 by 844 portrait and a common landscape viewport, verify readable menus, 44-pixel targets, non-overlapping touch controls, safe areas, and expandable HUD details.

- [ ] **Step 4: Verify controller and keyboard focus**

Confirm every menu command, Back action, loadout action, and pause command is reachable and visibly focused. Disconnect the controller while focused and continue with keyboard.

- [ ] **Step 5: Verify graphics tiers and reduced motion**

Confirm high-tier effects render, low tier stays responsive and nonblank, and reduced motion stops positional loops without removing focus feedback.

- [ ] **Step 6: Compare screenshots and record results**

Capture the same views as Task 1. Record remaining visual risks and confirm no permanent UI occupies the combat center.

- [ ] **Step 7: Refresh the user package and commit**

Copy the verified source to `outputs/Wasteland-Survivor-Latest` while excluding `.git`, `.data`, `node_modules`, `.vercel`, logs, and development-only cache folders.

```powershell
git add docs/verification/cinematic-ui-baseline.md
git commit -m "test: verify cinematic military interface"
```
