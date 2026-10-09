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

The lobby presents exactly three primary fight commands:

- Survival Mode.
- Multiplayer.
- Capture the Flag.

Settings, friends/connections, survivor/loadout, and profile switching remain available as smaller edge commands, not equal-weight fight choices.

Back is a standalone safe-area control at the top-left, outside title and profile plates. The top-right contains only the Menu command. Player identity may appear in the dashboard or player-selection view, but a persistent `Profile:` label does not occupy the lobby header. Each primary lobby choice is its own floating command rather than a cell inside one large card.

Online Multiplayer opens a focused room-size choice for 1v1, 2v2, or 3v3. There is no visible Computer Team Match command. When a match starts before every slot is occupied by a human player, the roster service fills the remaining slots with bots while preserving the selected team size.

Each command has a stable interaction area while its visual layer may move subtly. Idle controls breathe through restrained light, depth, and particle response. They must not move far enough to make clicking, tapping, or controller focus unpredictable.

The remaining hero space belongs to the selected survivor. The avatar is a strong environmental figure rather than a card thumbnail. Scene-mounted readouts show display name, permanent Player Tag, level, XP progress, class, known skill, equipped weapon, shield, and online state. Selecting the avatar or its loadout readout opens the detailed dashboard. On phone, this composition collapses into a compact survivor strip without covering the three fight choices.

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

## Private Account Identity

The adult math challenge and email sign-in are removed. A verified mobile phone number is the private cross-device account link. The phone number is normalized before verification, is never included in public player or friend records, and is never shown in the operator dashboard beyond a masked form needed for support.

Phone verification uses a six-digit, time-limited SMS code with attempt limits and resend cooldowns. In production, Google Identity Platform/Firebase Authentication owns SMS delivery, abuse protection, and the verified phone credential. Local development uses registered fictional test numbers or an explicitly marked development adapter; it must never send a real SMS or expose a development code in production.

The four-digit PIN remains a device-local quick lock. It is never treated as the online account password and is never stored or transmitted in plaintext. A verified phone session may restore the player account on a new device or authorize choosing a new local PIN. The permanent Player Tag remains stable across devices.

Players under 14 retain the separate parental-control path. A parent or guardian phone record and parent PIN are private and distinct from the child's player PIN.

## First-Run Controls Tour

Every player completes a short controls tour once before their first playable match. The tour detects the active input family and shows only relevant steps for keyboard and mouse, touch, or Xbox-style controller. Each step requires a simple demonstrated action, keeps the underlying game safe, and ends with a clear readiness confirmation.

Tour completion is saved to the linked player profile with a local fallback, so it does not repeat on another linked device. Settings exposes a `Controls Tour` command for voluntary replay. If the player changes to a previously unseen input family, the game may offer the matching mini-tour without blocking play.

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

- A muted, seamless home-screen loop shows the survivor endlessly wading through shallow apocalyptic water. Recent locally saved match replays may temporarily replace it, and the animated Nightfall scene remains the low-power or load-failure fallback.
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
