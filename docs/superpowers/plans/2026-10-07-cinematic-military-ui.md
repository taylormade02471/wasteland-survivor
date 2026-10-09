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
- Floating commands must read as buoyant objects over toxic water or slime without moving their interactive hit targets; covered by Task 4 presentation and motion tests.
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

Use real buttons in a stable absolute-positioned navigation region. Preserve existing command IDs and accessible names. Keep account/profile forms in a localized plate until authenticated; move post-login lobby actions into the floating command system. Back is its own safe-area control at the top-left, the top-right contains only Menu, and the lobby does not retain a persistent `Profile:` header label.

- [ ] **Step 5: Bind mouse, keyboard, touch, and controller focus**

Use one selected-state class and `aria-current` or `aria-pressed` as appropriate. A visual layer may move, but the button box remains fixed.

- [ ] **Step 6: Verify and commit**

Run: `node --test test/menu-navigation.test.js test/game-rules.test.js test/branding.test.js`
Expected: all pass.

```powershell
git add public/index.html public/style.css public/game3d.js public/menu-navigation.mjs test/menu-navigation.test.js
git commit -m "feat: add unified floating menu navigation"
```

### Task 3A: Online Rooms And Automatic Bot Fill

**Files:**
- Create: `public/matchmaking-rules.mjs`
- Create: `test/matchmaking-rules.test.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/game3d.js`
- Modify: `server.js`

**Interfaces:**
- Consumes: selected team size, room peers, and a match-start command
- Produces: a room plan with `{ teamSize, capacity, humanPlayers, botPlayers, slots }` and team-size-specific room capacity

- [ ] **Step 1: Write failing room-plan tests**

Cover 1v1, 2v2, and 3v3 capacities; full-human rooms; underfilled rooms; zero-peer fallback; stable team balance; and invalid input normalization.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/matchmaking-rules.test.js`
Expected: FAIL because `matchmaking-rules.mjs` does not exist.

- [ ] **Step 3: Implement the pure roster rule**

Return deterministic slot assignments and the exact bot count needed to reach the selected capacity. Do not let UI code invent roster totals.

- [ ] **Step 4: Replace the visible computer-team option**

Repurpose the preserved lobby command as Online Multiplayer. Activating it reveals separate 1v1, 2v2, and 3v3 controls. Remove visible `Computer Team Match` text and the persistent lobby `Profile:` prefix.

- [ ] **Step 5: Add team-size-specific rooms and match start fill**

Encode the selected team size in the room ID, make the server enforce 2, 4, or 6 total human seats, and include human and bot counts in the match-ready payload. Starting an underfilled match fills every open slot with a bot; starting a full room adds none.

- [ ] **Step 6: Verify and commit**

Run: `node --check server.js; node --check public/game3d.js; node --test test/matchmaking-rules.test.js test/game-rules.test.js test/branding.test.js`
Expected: all pass.

```powershell
git add public/matchmaking-rules.mjs public/index.html public/style.css public/game3d.js server.js test/matchmaking-rules.test.js
git commit -m "feat: add online rooms with automatic bot fill"
```

### Task 3B: Hero Lobby Composition And Survivor Readouts

**Files:**
- Create: `public/lobby-profile-view.mjs`
- Create: `test/lobby-profile-view.test.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/game3d.js`

**Interfaces:**
- Consumes: active profile, class definition, player progress, equipped weapon, shield level, and network state
- Produces: a display-safe survivor summary and the final three-choice hero lobby composition

- [ ] **Step 1: Write failing survivor-summary and structure tests**

Cover sanitized display name and tag, level and XP percentage, class and known skill, weapon, shield, online state, missing profile fallback, exactly three primary fight commands, and secondary edge actions.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/lobby-profile-view.test.js`
Expected: FAIL because the lobby-profile view model does not exist and the current lobby exposes too many equal-weight commands.

- [ ] **Step 3: Implement the pure survivor summary**

Return text and progress values only. Reuse the existing class, weapon, and progression rules instead of duplicating formulas.

- [ ] **Step 4: Reduce the hero menu to three fight commands**

Keep only `Survival Mode`, `Multiplayer`, and `Capture the Flag` in the primary floating group. Move Settings, Friends/Connections, Loadout/Profile, and Switch Profile into smaller safe-area edge actions. Preserve legacy IDs and every existing route.

- [ ] **Step 5: Fill the scene with the active survivor**

Render the selected avatar as a strong environmental figure and mount name, Player Tag, level, XP, class, known skill, weapon, shield, and online state as compact readouts in the open hero space. Selecting the avatar/readout opens the existing dashboard. Phone uses a compact survivor strip that cannot cover the three fight choices.

- [ ] **Step 6: Verify and commit**

Run: `node --check public/game3d.js; node --test test/lobby-profile-view.test.js test/menu-navigation.test.js test/class-rules.test.js test/progression-rules.test.js test/combat-rules.test.js test/*.test.js`
Expected: all pass.

```powershell
git add public/lobby-profile-view.mjs public/index.html public/style.css public/game3d.js test/lobby-profile-view.test.js
git commit -m "feat: compose the survivor hero lobby"
```

### Task 4: Cinematic Menu Presentation And Motion Preferences

**Files:**
- Create: `public/menu-presentation.mjs`
- Create: `test/menu-presentation.test.js`
- Add: `public/assets/nightfall/backgrounds/nightfall-water-walk-loop-v1.mp4`
- Add: `public/assets/nightfall/backgrounds/nightfall-water-walk-loop-v1.webm`
- Modify: `public/index.html`
- Modify: `public/nightfall-background.mjs`
- Modify: `public/style.css`
- Modify: `public/game3d.js`

**Interfaces:**
- Consumes: `{ section, focusedCommand, tier, reducedMotion }`
- Produces: `resolveMenuPresentation(input)` returning declarative camera, lighting, particle, and motion settings

- [ ] **Step 1: Write failing presentation tests**

Test distinct scene responses for home, lobby, survivor, armory, friends, and settings. Assert that full-motion presentation enables toxic-surface buoyancy, ripples, vapor, and disturbed particles. Assert reduced motion sets positional duration, looping drift, ripples, and particle disturbance to zero while leaving focus illumination and static toxic-surface treatment enabled.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/menu-presentation.test.js`
Expected: FAIL because the presentation resolver does not exist.

- [ ] **Step 3: Implement `resolveMenuPresentation(input)`**

Return data only. Use existing graphics tiers to limit particles, reflections, and camera drift on lower-capability phones.

- [ ] **Step 4: Extend the Nightfall renderer**

Add named menu regions and interpolate existing camera/background layers between them. Do not create a second rendering loop.

Set the bundled eight-second, muted water-walking cinemagraph as the default home video. Preserve locally saved recent-match replay rotation as the higher-priority source when a replay exists. If autoplay, decoding, data-saver, or graphics tier prevents video, reveal the existing animated Nightfall water scene without a blank frame.

- [ ] **Step 5: Add floating-control visual layers**

Implement restrained breathing light, forward focus movement, warning-amber/cyan selected states, and a toxic-surface treatment that makes each control appear buoyant over radioactive water or slime. Add localized ripple/glow layers, thin vapor, and small particle disturbances around the selected control. Keep transforms and effects on child visual layers so hit targets remain stable.

- [ ] **Step 6: Verify reduced motion and commit**

Run: `node --test test/menu-presentation.test.js test/nightfall-background.test.js`
Expected: all pass.

```powershell
git add public/menu-presentation.mjs public/assets/nightfall/backgrounds/nightfall-water-walk-loop-v1.mp4 public/assets/nightfall/backgrounds/nightfall-water-walk-loop-v1.webm public/index.html public/nightfall-background.mjs public/style.css public/game3d.js test/menu-presentation.test.js
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

### Task 5A: Verified Phone Account Linking And Local PIN

**Files:**
- Create: `public/phone-account.mjs`
- Create: `public/phone-auth-provider.mjs`
- Create: `test/phone-account.test.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/game3d.js`
- Modify: `backend/store.js`
- Modify: `backend/security.js`
- Create: `backend/phone-auth.js`
- Modify: `server.js`
- Modify: `package.json`
- Modify: `test/backend-security.test.js`
- Modify: `test/backend-store.test.js`

**Interfaces:**
- Consumes: verified phone credential, permanent player identity, device profile ID, and local PIN digest
- Produces: private phone-to-player link, cross-device restore, and one-device quick unlock without email or adult math challenges

- [ ] **Step 1: Write failing identity and privacy tests**

Cover phone normalization and masking, private lookup, unique ownership, no phone field in public records, expiring/replay-safe SMS challenges for development, attempt limits, resend cooldowns, and production refusal when a real verifier is not configured.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/phone-account.test.js test/backend-security.test.js test/backend-store.test.js`
Expected: FAIL on missing phone-account contracts.

- [ ] **Step 3: Replace the setup flow**

Remove the adult math view and all email wording. Require a mobile number, send a six-digit verification code, confirm it, then create the permanent player profile and a four-digit local PIN. Keep under-14 parental phone and parent PIN separate.

- [ ] **Step 4: Add private account linking**

Verify the Firebase/Identity Platform ID token on the server and map its stable provider UID to one private player account. Google owns the verified phone credential; the game backend does not need to persist a raw phone number. A verified phone session may restore the stable Player Tag and progress on a new device and authorize a new local PIN. Never return phone claims or private identity keys from player search, friends, rooms, public profile, or operator responses.

- [ ] **Step 5: Keep production delivery gated**

Use Google Identity Platform/Firebase Authentication as the production verifier: browser phone sign-in with reCAPTCHA, then server-side Firebase Admin ID-token verification. Support registered fictional test numbers, the Auth emulator, or a clearly labeled local-development adapter. Fail closed in production when verification is not configured; never expose a development code in production.

- [ ] **Step 6: Verify and commit**

Run: `node --check public/game3d.js; node --check server.js; node --test test/phone-account.test.js test/backend-security.test.js test/backend-store.test.js test/*.test.js`
Expected: all pass.

```powershell
git add public/phone-account.mjs public/phone-auth-provider.mjs public/index.html public/style.css public/game3d.js backend/store.js backend/security.js backend/phone-auth.js server.js package.json package-lock.json test/phone-account.test.js test/backend-security.test.js test/backend-store.test.js
git commit -m "feat: link private accounts with verified phones"
```

### Task 5B: One-Time Device-Aware Controls Tour

**Files:**
- Create: `public/controls-tour.mjs`
- Create: `test/controls-tour.test.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/game3d.js`
- Modify: `backend/store.js`
- Modify: `test/backend-store.test.js`

**Interfaces:**
- Consumes: active input family, demonstrated control actions, linked player progress, and local fallback state
- Produces: required first-run checklist, completion state, and voluntary replay from Settings

- [ ] **Step 1: Write failing controls-tour tests**

Cover keyboard and mouse, touch, and controller step sets; ordered demonstrated actions; one-time completion; linked-device persistence; local offline fallback; and voluntary replay.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/controls-tour.test.js test/backend-store.test.js`
Expected: FAIL because the controls-tour module does not exist.

- [ ] **Step 3: Implement the pure tour state machine**

Return the current device-relevant step, progress, completion, and replay state without owning DOM or gameplay state.

- [ ] **Step 4: Present a short mandatory first-run tour**

Before the first playable match, show a compact notification checklist and require the relevant move, aim, fire, pause/menu, and ability actions. Keep combat damage disabled while the checklist is active. Do not show irrelevant input methods.

- [ ] **Step 5: Persist once and add Settings replay**

Save completion to the linked profile and local fallback. Do not automatically repeat it on linked devices. Add `Controls Tour` to Settings, and offer but do not force a mini-tour for a newly detected input family.

- [ ] **Step 6: Verify and commit**

Run: `node --check public/game3d.js; node --test test/controls-tour.test.js test/backend-store.test.js test/game-rules.test.js test/*.test.js`
Expected: all pass.

```powershell
git add public/controls-tour.mjs public/index.html public/style.css public/game3d.js backend/store.js test/controls-tour.test.js test/backend-store.test.js
git commit -m "feat: add one-time controls tour"
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

### Task 6A: Desktop Pointer Capture And Renderer Recovery

**Files:**
- Create: `public/input-recovery.mjs`
- Create: `test/input-recovery.test.js`
- Modify: `public/game3d.js`
- Modify: `public/index.html`
- Modify: `public/style.css`

**Interfaces:**
- Consumes: gameplay phase, input mode, pointer-lock state, viewport dimensions, device pixel ratio, and graphics tier
- Produces: pure pointer-capture eligibility, transient-input reset state, and bounded renderer metrics

- [ ] **Step 1: Write failing recovery tests**

Cover pointer-lock eligibility, menu and non-combat exclusions, blur/visibility reset of firing and movement, pointer-lock loss, cross-monitor device-pixel-ratio changes, and bounded renderer dimensions.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/input-recovery.test.js`
Expected: FAIL because `input-recovery.mjs` does not exist.

- [ ] **Step 3: Implement pure recovery decisions**

Keep DOM, Three.js, and browser event ownership out of the module. Return normalized values only.

- [ ] **Step 4: Bind pointer lock and focus recovery**

Request pointer lock only from a deliberate gameplay-canvas action with a fine pointer. On window blur, hidden visibility, pointer-lock loss, or canvas exit, clear firing, ADS, keyboard direction, and touch deltas. Re-entry requires one deliberate click and never reloads the match.

- [ ] **Step 5: Handle cross-monitor rendering changes**

On resize or device-pixel-ratio change, update camera aspect, renderer size, and the graphics-tier-bounded pixel ratio without replacing the scene or renderer. Handle `webglcontextlost` with a visible paused recovery state and resume after `webglcontextrestored`.

- [ ] **Step 6: Verify and commit**

Run: `node --check public/game3d.js; node --test test/input-recovery.test.js test/game-rules.test.js`
Expected: all pass.

```powershell
git add public/input-recovery.mjs public/game3d.js public/index.html public/style.css test/input-recovery.test.js
git commit -m "fix: harden desktop mouse and renderer recovery"
```

### Task 6B: Death Camera And Rules-Based Respawn

**Files:**
- Create: `public/death-rules.mjs`
- Create: `test/death-rules.test.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/game3d.js`

**Interfaces:**
- Consumes: mode, round state, live teammates, death time, and respawn delay
- Produces: `resolveDeathPresentation(input)` returning spectator behavior, respawn eligibility, countdown, action label, and round-wait state

- [ ] **Step 1: Write failing death-rule tests**

Cover CTF delayed respawn, elimination and last-man-standing no-respawn states, solo run restart wording, surviving teammates keeping an elimination round active, and malformed input fallbacks.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/death-rules.test.js`
Expected: FAIL because `death-rules.mjs` does not exist.

- [ ] **Step 3: Implement the pure death presentation rule**

The rule decides whether a Respawn control exists. It does not mutate combat, scoring, or actors.

- [ ] **Step 4: Preserve a body and continue the match view**

At player death, leave a round-scoped body at the exact death position, stop player input, and move to a stable death/spectator camera that frames the body and nearby live actors. Keep simulation, scoring, and other players moving. Remove or recycle the body only on allowed respawn or round reset.

- [ ] **Step 5: Gate the Respawn control**

In CTF, reveal Respawn only after the existing delay and respawn at a safe team position after activation. In elimination or last-man-standing, render no Respawn button while teammates and opponents finish the round. Solo game-over may offer Restart Run, but must not mislabel it as a same-match respawn.

- [ ] **Step 6: Verify and commit**

Run: `node --check public/game3d.js; node --test test/death-rules.test.js test/game-rules.test.js test/reward-rules.test.js`
Expected: all pass.

```powershell
git add public/death-rules.mjs public/index.html public/style.css public/game3d.js test/death-rules.test.js
git commit -m "feat: add death camera and rules-based respawn"
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
