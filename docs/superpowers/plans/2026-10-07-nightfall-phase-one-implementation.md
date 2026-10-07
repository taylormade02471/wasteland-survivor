# Wasteland Survivor Nightfall Phase One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first production Nightfall visual upgrade with the official Wasteland Survivor name, web/loading artwork, an interactive menu background, graphics quality controls, avatar classes, and familiar mobile military-FPS controls.

**Architecture:** Add a small asset manifest and pure graphics/input rules beside the existing Three.js game, then let the UI consume those rules without moving multiplayer or profile logic. Nightfall presentation uses optimized local assets and layered browser effects; gameplay never calls a paid image API.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Three.js 0.180.0, Node.js built-in test runner, Vercel, local WebP/PNG assets.

**Spec:** `docs/superpowers/specs/2026-10-06-nightfall-first-person-graphics-design.md`

## Global Constraints

- The official product name is exactly `Wasteland Survivor`; migrate visible `Wastland Survivor` copy without renaming existing browser storage keys in this phase.
- First-person remains the default in story, survival, team, and Capture the Flag modes.
- Mouse or controller input overrides mobile Easy auto-lock immediately.
- Gameplay must not call Google Cloud, Vertex AI, or any paid image service.
- Optional high-resolution assets must fall back to the current lightweight presentation when unavailable.
- Generated masters stay local; deploy only optimized derivatives under `public/assets/nightfall/`.
- Preserve profiles, local progress, lobby behavior, voice controls, music, pause, and Exit to Lobby.
- Do not initialize a Git repository as part of this plan. Each task records a tested filesystem checkpoint because this source directory is not currently a Git worktree.

## Review Focus

- An older profile using `wastland-survivor-*` storage keys must load after the visible rename; Task 1 pins this with a browser-storage regression check.
- Missing Nightfall artwork must preserve login, lobby, and playable fallback rendering; Task 2 pins this in manifest tests and Task 5 browser checks.
- A phone with a connected mouse must use desktop mapping and disable Easy auto-lock; Task 4 extends the input-rule tests.
- Reduced-motion users must receive a static readable menu without fog, parallax, or flashing effects; Task 3 tests the preference rule and browser state.
- Slow phones must start at Low or Medium and retain a user override; Task 2 tests tier selection and persistence behavior.

---

### Task 1: Official Name And Web Metadata

**Files:**
- Modify: `public/index.html`
- Modify: `public/game3d.js`
- Modify: `package.json`
- Create: `test/branding.test.js`

**Interfaces:**
- Consumes: Existing DOM ids, local storage keys, and profile-loading flow.
- Produces: Visible `Wasteland Survivor` branding and stable legacy storage compatibility.

- [ ] **Step 1: Write the failing branding test**

Create `test/branding.test.js` with assertions that `public/index.html`, `public/game3d.js`, and `package.json` contain the official visible title and package name, while `game3d.js` still contains the legacy `wastland-survivor-` storage prefix.

- [ ] **Step 2: Run the branding test and verify it fails**

Run: `node --test test/branding.test.js`

Expected: FAIL because visible copy and package metadata still use `Wastland`.

- [ ] **Step 3: Correct visible branding and metadata**

Change headings, story copy, labels, page title, and package name to `Wasteland Survivor`. Keep element ids and local storage keys unchanged to avoid losing existing profiles and settings.

- [ ] **Step 4: Add social and install metadata hooks**

Add `theme-color`, Open Graph title/image, Twitter card metadata, favicon links, and a manifest link to `public/index.html`. Paths must point to the Nightfall assets created in Task 2.

- [ ] **Step 5: Run the test and syntax checks**

Run: `node --test test/branding.test.js && node --check public/game3d.js`

Expected: PASS with no syntax errors.

- [ ] **Step 6: Record checkpoint**

Record the passing command and changed files in the execution summary. If the user later initializes Git, use commit message `feat: adopt Wasteland Survivor branding`.

### Task 2: Nightfall Asset Manifest And Graphics Tiers

**Files:**
- Create: `public/graphics-config.mjs`
- Create: `public/assets/nightfall/manifest.json`
- Create: `public/assets/nightfall/backgrounds/nightfall-loading-v1.webp`
- Create: `public/assets/nightfall/thumbnails/wasteland-survivor-share-v1.png`
- Create: `public/assets/nightfall/icons/icon-512-v1.png`
- Create: `public/site.webmanifest`
- Create: `test/graphics-config.test.js`
- Modify: `server.js`
- Modify: `nginx.conf`

**Interfaces:**
- Consumes: Approved Nightfall concept C and existing static-file servers.
- Produces: `selectGraphicsTier(capabilities) -> "low" | "medium" | "high"`, `resolveAsset(manifest, key) -> string | null`, and a versioned manifest consumed by Tasks 3-5.

- [ ] **Step 1: Write failing graphics configuration tests**

Test that reduced motion or low device memory selects Low, typical phones select Medium, capable desktops select High, an explicit saved override wins, and an unknown manifest key returns `null`.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test test/graphics-config.test.js`

Expected: FAIL because `public/graphics-config.mjs` does not exist.

- [ ] **Step 3: Implement the pure configuration module**

Export `selectGraphicsTier({ deviceMemory, hardwareConcurrency, reducedMotion, savedTier })` and `resolveAsset(manifest, key)` from `public/graphics-config.mjs`. Accept only `low`, `medium`, or `high` saved values.

- [ ] **Step 4: Prepare optimized Nightfall derivatives**

Create a text-free loading background derived from concept C, a correctly spelled 1200 by 630 share thumbnail, and a 512 by 512 icon. Use versioned filenames and preserve the source mockup outside `public/`.

- [ ] **Step 5: Create the manifest and web manifest**

Map stable keys `loading`, `shareThumbnail`, and `icon512` to versioned files. Set the install name and short name to `Wasteland Survivor`.

- [ ] **Step 6: Add required static MIME types**

Ensure local and container servers return correct types for `.webp`, `.png`, `.json`, `.webmanifest`, `.js`, and `.mjs`.

- [ ] **Step 7: Run configuration and endpoint checks**

Run: `node --test test/graphics-config.test.js`

Expected: PASS.

Start the local server and request the manifest and each listed asset. Expected: HTTP 200 with correct content types.

- [ ] **Step 8: Record checkpoint**

Record manifest version, generated derivative paths, tests, and endpoint results. Future Git commit: `feat: add Nightfall asset manifest and quality tiers`.

### Task 3: Interactive Nightfall Menu Background

**Files:**
- Create: `public/nightfall-background.mjs`
- Create: `test/nightfall-background.test.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/game3d.js`

**Interfaces:**
- Consumes: `selectGraphicsTier(...)` and `resolveAsset(...)` from Task 2.
- Produces: `createNightfallBackground(root, options)`, `setNightfallTier(tier)`, and `destroyNightfallBackground()`.

- [ ] **Step 1: Write failing background-state tests**

Test `backgroundEffectsForTier(tier, reducedMotion)` so Low disables water reflection and limits particles, Medium enables restrained fog and water, High enables all effects, and reduced motion disables parallax and pulsing lights at every tier.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test test/nightfall-background.test.js`

Expected: FAIL because the background module is missing.

- [ ] **Step 3: Implement background state and lifecycle**

Export `backgroundEffectsForTier`, `createNightfallBackground`, `setNightfallTier`, and `destroyNightfallBackground`. The module owns only menu visual layers and must not mutate gameplay state.

- [ ] **Step 4: Replace the empty/video-only home background**

Add semantic layers for the approved Nightfall image, water reflection, fog, weather particles, searchlight, and color lighting. Keep all layers non-interactive and below the menu.

- [ ] **Step 5: Add reduced-motion and tier-specific CSS**

Use opacity, transform, and filter animation only. Disable animation under `prefers-reduced-motion: reduce` and keep title, profile fields, and buttons above WCAG-readable contrast levels.

- [ ] **Step 6: Wire lifecycle to menu and gameplay transitions**

Start effects on welcome and lobby screens, reduce or stop them during gameplay, and restore them on Exit to Lobby without leaking timers or duplicate DOM layers.

- [ ] **Step 7: Run tests and rendered checks**

Run: `node --test test/nightfall-background.test.js`

Expected: PASS.

Verify welcome, returning profile, lobby, game start, pause, and Exit to Lobby at 390 by 844 and 1440 by 900. Expected: no overlap, duplicate layers, unreadable text, or console errors.

- [ ] **Step 8: Record checkpoint**

Save desktop and phone screenshots and test output. Future Git commit: `feat: add interactive Nightfall menu background`.

### Task 4: First-Person Mobile Control Refinement

**Files:**
- Modify: `public/game-rules.mjs`
- Modify: `test/game-rules.test.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/game3d.js`

**Interfaces:**
- Consumes: Existing `shouldAutoLock(...)`, touch state, controller polling, pointer-lock handling, and `frontView` first-person camera.
- Produces: `resolveInputMode({ coarsePointer, mouseInputActive, controllerConnected }) -> "touch" | "mouse" | "controller"`, `normalizeAimSettings({ sensitivity, adsSensitivity, assistStrength, preset })`, and `aimPresetForDifficulty(difficultyRatio)`.

- [ ] **Step 1: Extend failing input-rule tests**

Test controller precedence, mouse precedence on coarse-pointer devices, touch fallback, sensitivity clamping, aim-assist clamping, Easy-to-Full-Auto-Aim mapping, Medium-to-Aim-Assist mapping, harder-to-Manual mapping, invalid preset fallback, and auto-lock suppression whenever mouse or controller manual input is active.

- [ ] **Step 2: Run tests and verify the new cases fail**

Run: `node --test test/game-rules.test.js`

Expected: Existing tests pass and new interface tests fail.

- [ ] **Step 3: Implement pure input-mode and settings rules**

Add the exact exports from the Interfaces section. Clamp sensitivity and ADS sensitivity to `0.5` through `2.0`, assist strength to `0` through `1`, and presets to `full`, `assist`, or `manual`.

- [ ] **Step 4: Add mobile gameplay controls and settings**

Add a left movement stick, right-side swipe aiming, and large Fire, ADS/Focus, Reload, Weapon, Interact, Ability, and Pause buttons. Add aim sensitivity, ADS sensitivity, aim-assist strength, and preset controls, plus safe-area padding and a landscape recommendation. Do not show mobile action controls while mouse mapping or controller mapping is active.

- [ ] **Step 5: Apply input mode to gameplay**

Keep first-person default. A mouse pointer event sets mouse mode, controller input sets controller mode, and a touch-stick interaction returns to touch mode. Manual input always wins over auto-lock.

Full Auto-Aim maintains a visible valid-target lock while Fire is held and supports explicit target switching. Aim Assist applies target friction and restrained magnetic pull without persistent lock. Manual disables both. Automatic reload occurs only when the current magazine is empty.

- [ ] **Step 6: Add graphics tier setting to the existing settings modal**

Expose Auto, Low, Medium, and High. Persist the explicit override locally and apply it to Nightfall background and gameplay effects.

- [ ] **Step 7: Run unit and browser tests**

Run: `node --test test/game-rules.test.js test/graphics-config.test.js`

Expected: PASS.

Verify mouse, touch, and an Xbox-compatible controller in debug mode. At phone size, confirm the center reticle, no occluded target area, reachable controls, and landscape warning behavior.

Verify the controller mapping: left stick movement, right stick aim, right trigger fire, left trigger ADS/focus, `A` interact, `X` reload, `Y` weapon switch, `B` ability/dodge, D-pad weapon selection, Menu pause, and right-stick target switch.

- [ ] **Step 8: Record checkpoint**

Record input devices tested, viewport results, and settings persistence. Future Git commit: `feat: refine first-person mobile controls`.

### Task 4A: Avatar Class Skills

**Files:**
- Create: `public/class-rules.mjs`
- Create: `test/class-rules.test.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/game3d.js`

**Interfaces:**
- Consumes: Existing avatar selection, player stats, scrap, shield, damage, movement, and cooldown update loop.
- Produces: `CLASS_PROFILES`, `classStats(avatarType, baseStats)`, `canActivateAbility(avatarType, state)`, and `activateClassAbility(avatarType, state)`.

- [ ] **Step 1: Write failing class-rule tests**

Test Scout speed and Dash cooldown, Ranger spread reduction and Focus duration, Heavy health/shield gain and movement reduction, Tech Runner scrap bonus and Repair Pulse cap, invalid class fallback, and cooldown rejection.

- [ ] **Step 2: Run tests and verify they fail**

Run: `node --test test/class-rules.test.js`

Expected: FAIL because `public/class-rules.mjs` does not exist.

- [ ] **Step 3: Implement pure class profiles and ability transitions**

Define all four classes in `CLASS_PROFILES` and implement the exact exports above. Keep visual effects and DOM access out of this module.

- [ ] **Step 4: Apply class stats during player creation and respawn**

Use the active profile's avatar type to apply class trade-offs. Preserve class identity across rounds and local progress reloads.

- [ ] **Step 5: Add the Ability control and cooldown feedback**

Place one large mobile Ability button above the movement stick and map Xbox `B` to the same action. Show the selected ability name and remaining cooldown without covering the target area.

- [ ] **Step 6: Run tests and rendered verification**

Run: `node --test test/class-rules.test.js test/game-rules.test.js`

Expected: PASS.

Verify each class in a first-person phone match and with controller input. Confirm abilities cannot trigger during menus, countdown, death, or cooldown.

- [ ] **Step 7: Record checkpoint**

Record class balance values, cooldown results, and input evidence. Future Git commit: `feat: add survivor class abilities`.

### Task 5: Fallbacks, Production Verification, And Deployment

**Files:**
- Create: `test/nightfall-integration.test.js`
- Modify: `public/game3d.js`
- Modify: `public/style.css`
- Update mechanically: `C:/Users/kylet/Documents/Codex/2026-10-06/i/outputs/ruin-runners-google-cloud-package/`

**Interfaces:**
- Consumes: Branding, manifest, background lifecycle, graphics tiers, and input rules from Tasks 1-4.
- Produces: A verified production deployment at `https://ruin-runners.vercel.app/` and a synchronized Google Cloud package.

- [ ] **Step 1: Write failing integration checks**

Assert that the manifest contains existing files, HTML metadata points to existing assets, fallback CSS exists, all module imports resolve, the official title is visible, and legacy storage prefixes remain available.

- [ ] **Step 2: Run the integration test and verify it identifies missing links**

Run: `node --test test/nightfall-integration.test.js`

Expected: FAIL for any incomplete manifest, metadata, fallback, or module reference.

- [ ] **Step 3: Implement asset-load fallback behavior**

If a manifest or optional image fails, retain the current terrain/material presentation, hide only the failed layer, and keep login, lobby, and gameplay interactive.

- [ ] **Step 4: Run the complete automated suite**

Run: `node --test test/*.test.js && node --check public/game3d.js && node --check server.js`

Expected: all tests pass and both scripts parse.

- [ ] **Step 5: Perform complete local browser verification**

Verify new profile, returning profile, guest, story survival, Easy auto-lock, mouse override, pause, settings, local music, Exit to Lobby, missing-asset fallback, reduced motion, and Low/Medium/High graphics at desktop and phone sizes.

- [ ] **Step 6: Synchronize the deployment package**

Copy only the tested source, configuration, and optimized assets into the existing output package. Do not include credentials, caches, generation masters, or temporary comparison files.

- [ ] **Step 7: Deploy and verify production**

Run: `npx vercel --prod --yes`

Expected: deployment reaches READY and aliases to `https://ruin-runners.vercel.app/`.

Request `/`, `/healthz`, the manifest, web manifest, share thumbnail, loading image, and all module files. Expected: HTTP 200 and correct content types.

- [ ] **Step 8: Verify the live user journey**

At phone and desktop sizes, visibly confirm the Nightfall login/lobby, first-person match, centered reticle, settings, pause menu, and Exit to Lobby. Check browser logs for errors.

- [ ] **Step 9: Record release checkpoint**

Record production URL, deployment id, endpoint results, browser evidence, and remaining Phase Two assets. Future Git commit: `feat: ship Nightfall phase one`.

## Deferred Plans

The following approved work receives separate implementation plans after Phase One is live and the billed Google Cloud project is verified:

- Four avatar portraits and character sheets.
- Three weapon families and upgrade-stage sheets.
- Four complete map texture packs and environment art sets.
- Structures, kingdom assets, obstacles, and associated thumbnails.
- Paid Vertex AI preview and high-resolution generation batches with an explicit budget.
