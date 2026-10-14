# Burned Armory and Terrain Render Passes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current connected-world terrain into a visibly layered burned-armory, mountain, and inferno scene whose five auditable rendering passes each add 12–20% authored visual complexity without changing gameplay rules or controls.

**Architecture:** Keep deterministic visual plans in a pure module, then consume those plans in the existing Three.js scene builders. The pass selector is read only from an explicit render-audit URL parameter; normal games retain their device-selected Low, Medium, or High profile. Runtime data attributes expose the selected pass and authored landmark detail for browser verification.

**Tech Stack:** Vanilla JavaScript ES modules, Three.js 0.180, Node test runner, existing `render-quality.mjs`, `armory-visual-profile.mjs`, and `game3d.js` render-audit routes.

**Spec:** `docs/superpowers/specs/2026-10-06-nightfall-first-person-graphics-design.md`

## Global Constraints

- Preserve right-positive mouse, keyboard, touch, and controller controls exactly; this is render-only work.
- Keep all collision, road, elevation, boundary, quest, reward, and story rules intact; visual detail must never introduce invisible blockers.
- The five passes must independently increase visible triangle/detail counts by 12–20% and remain deterministic for test and screenshot comparison.
- All render-pass URL overrides are audit-only; standard gameplay still selects a device-appropriate graphics tier.
- Use existing local assets and procedural Three.js meshes only; do not initiate paid image generation or cloud-storage changes.
- Missing optional textures or meshes must leave gameplay, sign-in, lobby, and matches usable.
- Preserve unrelated working-tree artifacts; stage only files named in each task.

## Review Focus

- A malformed `renderPass` query cannot change a normal player’s quality tier or make the scene blank.
- Each low-to-high pass retains actual mountain, armory, and fire geometry rather than merely reporting higher numbers.
- Deterministic placement keeps all new prop positions outside the spawn lane, traversal roads, and existing collision state.
- Reduced and mobile tiers retain a readable armory silhouette and fire cues without unbounded particles.
- Runtime audit data updates after delayed authored textures/GLB assets load rather than reporting the earlier fallback as complete.

---

### Task 1: Deterministic Landmark Pass Contract

**Files:**
- Create: `public/landmark-render-profile.mjs`
- Create: `test/landmark-render-profile.test.js`

**Interfaces:**
- Produces: `LANDMARK_RENDER_PASSES`, `landmarkRenderProfile(pass)`, `landmarkRenderPassReport(pass)`, `buildMountainCragPlan(pass)`, `buildArmorySalvagePlan(pass)`, and `buildInfernoFirelinePlan(pass)`.
- Consumed by: Task 2’s Three.js landmark builders.

- [ ] **Step 1: Write the failing contract tests**

Add tests that expect five profiles, 12–20% growth in crags, salvage pieces, and flame clusters, deterministic plans, and finite world coordinates away from the central spawn.

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `node --test test\\landmark-render-profile.test.js`

Expected: FAIL because `landmark-render-profile.mjs` does not exist.

- [ ] **Step 3: Implement the pure landmark pass module**

Implement the named exports using a clamped 1–5 pass, 24→44 crag/salvage counts, 20→39 fire clusters, and seeded arithmetic placements bounded to their existing armory, inferno, and mountain regions.

- [ ] **Step 4: Run the contract test to verify it passes**

Run: `node --test test\\landmark-render-profile.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add public/landmark-render-profile.mjs test/landmark-render-profile.test.js
git commit -m "feat: define landmark render pass contracts"
```

### Task 2: Layered Landmark Geometry and Audit Override

**Files:**
- Modify: `public/game3d.js:41-56, 2200-2615, 2947-2965, 6519-6565`
- Modify: `test/render-audit.test.js`
- Modify: `test/armory-visual-profile.test.js`

**Interfaces:**
- Consumes: Task 1’s pure landmark plans and the existing `renderQualityProfile(pass)` function.
- Produces: layered mountain crags, armory salvage and defensive details, multi-cluster inferno fires, and audit data attributes `landmarkRenderPass`, `mountainCragCount`, `armorySalvageCount`, and `infernoFireClusterCount`.

- [ ] **Step 1: Write the failing runtime wiring tests**

Extend render-audit tests to require the explicit audit-only `renderPass` resolver, every Task 1 plan builder, and all four audit data attributes in `game3d.js`.

- [ ] **Step 2: Run the focused runtime tests to verify they fail**

Run: `node --test test\\render-audit.test.js test\\armory-visual-profile.test.js`

Expected: FAIL because the scene does not yet consume the new landmark plans or publish the new attributes.

- [ ] **Step 3: Implement the visual scene builders and audit-only pass selection**

Import the pure plans. Replace the fixed mountain set with a base ridge plus deterministic rock, snow, and exposed-metal crags; add deterministic salvage, barricade, and broken equipment silhouettes around the burned-armory shell; replace the fixed fire line with the fire-cluster plan. Permit `?renderFocus=<audit>&renderPass=1..5` to override only an audit render, then publish the counts to the canvas dataset.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `node --test test\\render-audit.test.js test\\armory-visual-profile.test.js test\\landmark-render-profile.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add public/game3d.js test/render-audit.test.js test/armory-visual-profile.test.js
git commit -m "feat: render layered world landmarks"
```

### Task 3: Five-Pass Render Evidence and Release Gate

**Files:**
- Modify: `test/render-quality.test.js`
- Modify: `docs/verification/burned-armory-render-passes.md`

**Interfaces:**
- Consumes: Task 1 profiles and Task 2’s audit route.
- Produces: an evidence table for passes 1–5, including selected pass, reported geometry counts, image path, and visual check outcome.

- [ ] **Step 1: Write a failing evidence-coverage test**

Add an assertion that every render-quality pass has a matching landmark pass report with 12–20% gains.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test\\render-quality.test.js`

Expected: FAIL because landmark reports are not yet joined to the quality ladder.

- [ ] **Step 3: Implement the joined report and record render evidence**

Export the minimal joined report from the new landmark module, then capture one local audit render for each `renderPass=1..5`. Record observed geometry counts and screenshot paths; a pass may be marked failed rather than hidden if it does not render.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test test\\render-quality.test.js test\\landmark-render-profile.test.js`

Expected: PASS.

- [ ] **Step 5: Run full verification, commit, and publish only after it passes**

Run: `node --check public\\game3d.js; git diff --check; node --test (Get-ChildItem test -Filter '*.test.js' | ForEach-Object { $_.FullName })`

Expected: syntax check, diff check, and the full Node suite all pass. Commit the evidence and explicit source/test files, then publish the already authorized release branch and verify the live production alias with a cache-busting audit URL.
