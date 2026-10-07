# Nightfall Cinematic Military UI Design

## Purpose

Upgrade Wasteland Survivor from a conventional panel-based browser-game interface to a cinematic 2024 military-survival presentation. The redesign must preserve gameplay clarity across desktop, phone, keyboard and mouse, touch, and Xbox-style controllers.

Nightfall is the overarching world identity. Wasteland Survivor remains the game title. The visual experience should communicate the final days of an apocalypse through realistic military equipment, damaged environments, smoke, ash, embers, radioactive haze, distant fires, and wet reflective surfaces.

## Scope

This design covers:

- The in-game HUD.
- The home and lobby menu presentation.
- The pre-match Final Loadout room.
- Pause, settings, armory, and dashboard transitions.
- Desktop, phone, and controller-focused navigation.
- Reduced-motion behavior.

Procedural map generation, enemy behavior, matchmaking, and server-authoritative combat are separate systems. This UI may display their state but does not define their simulation rules.

## Combat HUD

### Left Tactical Rail

A narrow status rail stays against the far-left safe edge and never occupies the center play area. It displays:

- Health.
- Armor or shield.
- Current weapon and ammunition.
- Active ability and cooldown.
- Compact team status.

The rail uses compact military instrumentation rather than individual dashboard cards. Bars and numbers use stable dimensions so damage, reloads, weapon changes, and status updates cannot shift the layout.

### Top Objective Rail

The upper safe edge displays:

- Mission or game mode.
- Current round or wave.
- Match timer.
- Active objective.
- Team score when applicable.

The objective rail remains visually subordinate to the battlefield. Information appears in small, locally backed plates that retain contrast against bright fire, snow, toxic fog, and water.

### Center-Screen Rules

The center remains clear except for temporary gameplay feedback:

- Reticle and target lock.
- Hit markers.
- Directional damage indicators.
- Short interaction prompts.
- Objective capture feedback.
- Reload and ability feedback when immediately relevant.

Temporary feedback fades after use and does not become a permanent center panel.

## Mobile HUD

Phone layouts keep essential health, armor, ammunition, and ability status visible. Secondary details collapse into an expandable edge control. Touch controls remain anchored to stable zones and do not overlap the tactical rail, objective rail, chest locator, or pause control.

Safe-area insets are honored on notched devices. Text and controls must remain readable at 390 by 844 CSS pixels in portrait menus and common landscape phone sizes during combat.

## Living Menu

The main menu removes the large central form-card composition. Menu commands become floating tactical controls positioned over the cinematic Nightfall environment. Their visual layers should feel buoyed by radioactive water or slime: slow uneven rise and fall, soft ripples or glow beneath each command, thin vapor, and tiny disturbed particles. The underlying button geometry stays fixed so the animation never makes a command difficult to click or tap.

Primary commands include:

- Enter Wasteland or Continue.
- Choose Fight.
- Survivor and Loadout.
- Friends and Rooms.
- Settings.

Each command has a stable interaction area while its visual layer may move subtly. Idle controls breathe through restrained light, depth, and particle response. They must not move far enough to make clicking, tapping, or controller focus unpredictable.

### Selection Behavior

- Mouse hover moves the selected control slightly forward and increases edge illumination.
- Keyboard or controller focus uses the same selected state and a visible focus indicator.
- Touch reveals supporting text on first focus and activates the command on a deliberate tap.
- Selection changes may shift environmental lighting or camera framing.
- Opening a section transitions the camera toward the associated environment region instead of abruptly replacing the entire screen.

Buttons use familiar text and icons for commands. Motion is decorative and never changes their hit targets or causes layout movement.

## Panels And Overlays

Armory, profile, avatar selection, settings, and loadout details may use localized tactical plates. These plates should feel mounted into the scene through perspective, lighting, and material treatment rather than appearing as generic centered modals.

No panel may obscure the full battlefield during live multiplayer. Pause and menu overlays leave the player character stationary while the server simulation continues under the existing grace-period rules.

## Visual System

### Palette

- Muted steel and charcoal for structure.
- Dirty white for primary information.
- Warning amber for objectives and supply systems.
- Toxic green for radioactive threats.
- Emergency red for danger and damage.
- Restrained cyan for friendly systems and interactive focus.

The interface must not become dominated by a single color family.

### Materials

UI surfaces use scratched metal, smoked glass, worn paint, low-opacity scan texture, and illuminated instrument edges. Effects remain restrained enough that text, icons, and state changes remain immediately readable.

### Typography

The Nightfall and Wasteland Survivor wordmarks use condensed military display typography. HUD data uses a highly readable condensed sans serif or monospaced instrument face. Body copy uses a neutral sans serif. Letter spacing remains zero except for short uppercase labels where a restrained positive value supports identification.

## Motion

Motion supports depth and state:

- Slow environmental camera drift.
- Subtle floating menu depth with toxic-surface buoyancy, localized ripples, vapor, and particle disturbance.
- Focus illumination and forward movement.
- Smoke, embers, haze, rain, and reflective surface motion.
- Short camera transitions between menu regions.

Motion must not delay commands, move interactive hit targets, or hide required state. With reduced motion enabled, position changes and looping drift stop. Lighting and opacity changes provide equivalent focus and state feedback.

## Component Boundaries

The implementation should separate:

- `hud-layout`: combat status and objective placement.
- `menu-navigation`: focus, controller, keyboard, mouse, and touch behavior.
- `menu-presentation`: cinematic camera and environmental responses.
- `motion-preferences`: reduced-motion and graphics-tier behavior.
- `responsive-layout`: desktop and phone adaptations.

Gameplay state remains owned by the existing game systems. UI components receive normalized display data and emit commands without changing combat rules directly.

## State Flow

1. Gameplay systems update health, armor, ammunition, ability, objective, and team state.
2. A normalized HUD view model converts game state into display-safe values.
3. HUD components update only their relevant text, bars, icons, and temporary indicators.
4. Menu navigation maintains one focused command across all input methods.
5. Menu presentation responds to focus and section changes without controlling navigation validity.
6. Graphics-tier and reduced-motion settings determine which visual effects are enabled.

## Accessibility And Safety

- Every command remains accessible by keyboard and controller.
- Focus is always visible.
- Color is never the only state indicator.
- Text contrast is maintained through localized backing plates and shadows.
- Motion reduction is respected.
- Controls maintain stable dimensions and hit targets.
- Mobile touch targets are at least 44 CSS pixels in their shortest dimension.

## Verification

The redesign is complete only after:

- Automated checks confirm required HUD and menu controls remain present.
- Input tests cover mouse, keyboard, touch, and controller focus behavior.
- Reduced-motion tests confirm looping movement is disabled.
- Desktop and phone screenshots show no overlap or clipped text.
- Canvas-pixel checks confirm the 3D scene and cinematic background are nonblank.
- The center of the gameplay viewport remains free of permanent menu panels.
- The Final Loadout, pause, settings, armory, and return-to-lobby flows remain functional.
- Existing gameplay and backend tests continue to pass.

## Acceptance Criteria

- The HUD is edge-mounted and does not cover the central battlefield.
- The left tactical rail contains health, armor, ammunition, ability cooldown, and team status.
- The top rail contains mission, round, timer, objective, and applicable score.
- Main menu commands appear as animated floating controls buoyed over toxic water or slime, with stable hit targets and readable labels.
- Controller, keyboard, mouse, and touch share consistent focus states.
- Section changes use cinematic environmental transitions.
- Bright backgrounds do not compromise text readability.
- Reduced-motion mode provides a complete non-moving alternative.
- Desktop and phone layouts remain polished and usable.
