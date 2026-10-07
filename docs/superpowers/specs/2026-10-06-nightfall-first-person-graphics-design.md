# Wasteland Survivor Nightfall First-Person Graphics Design

## Purpose

Upgrade Wasteland Survivor from its current prototype presentation to a realistic, first-person Nightfall Survival visual system that remains usable on mobile phones. The work must preserve existing gameplay, profiles, local progress, controller support, lobbies, and the public Vercel deployment.

The approved visual reference is concept C, Nightfall Survival: flooded ruins, realistic toxic water, moonlight, firelight, snow, smoke, warning lights, distant enemy silhouettes, and an immersive first-person weapon view.

## Visual Direction

- Photorealistic, original post-apocalyptic survival imagery.
- First-person perspective is the default for every playable mode.
- Environments remain readable despite night lighting.
- Cyan toxic reflections, warm firelight, red warning lights, neutral moonlight, and cold snow provide a multi-color palette.
- Characters and equipment are original and do not resemble real people or protected game characters.
- Violence may be tense but not gruesome.

## Production Approach

Use a hybrid asset pipeline:

1. Generate high-resolution concept art, portraits, character sheets, weapon sheets, textures, thumbnails, and layered background sources.
2. Use Three.js for real-time movement, depth, lighting, fog, particles, water motion, weather, and camera behavior.
3. Do not call a paid image API during gameplay.
4. Keep generated masters locally and deploy optimized derivatives with the game.

This approach provides a substantial visual improvement without continuously operating a cloud GPU or streaming rendered gameplay.

## Asset Package

### Characters

- Four original adult survivors: Scout, Ranger, Heavy, and Tech Runner.
- One 1024 by 1024 portrait for each avatar.
- One 2048 by 2048 model sheet for each avatar with front, side, equipment, materials, and color details.
- Distinct silhouettes, gear, color accents, and weapon roles.

### Weapons

- Scout, Cannon, and Inferno weapon sheets at 2048 by 1024.
- Each sheet shows a side profile, first-person view, material details, and upgrade-stage changes.
- Weapon silhouettes must remain recognizable on a phone screen.
- The first-person model stays in the lower part of the screen and does not cover the target area.

### Environments

- Wasteland, Toxic Pond, Icy Mountain, and Fiery Inferno key art.
- Seamless 2048 by 2048 textures for cracked terrain, mud, ruined walls, weathered metal, timber, ice, snow, ash, toxic water, and scorched structures.
- Structure art for ruined houses, fortified houses, towers, barriers, crates, bridges, objective beacons, and later kingdom buildings.
- Map thumbnails at 800 by 450.

### Website And Menu Media

- Web-sharing thumbnail at 1200 by 630.
- Loading and menu backgrounds at 1920 by 1080.
- Browser and mobile icon master at 512 by 512 with smaller exported sizes.
- Supporting lobby, story, survival, team, and Capture the Flag thumbnails.
- The selected Nightfall concept becomes the first loading-screen reference.

## Interactive Backgrounds

Menu backgrounds use layered images rather than a continuously generated video. Each scene may contain:

- Separate sky, far environment, middle environment, foreground, fog, and particle layers.
- Slow parallax camera movement.
- Life-like water ripples and toxic reflections.
- Moving fog, snow, rain, ash, and embers.
- Rotating searchlights and objective beacons.
- Controlled lightning, firelight, and warning-light pulses.
- Reduced-motion fallback when the player requests reduced motion.

The menu remains readable over all background states.

## First-Person Gameplay

- First-person is the default camera for story, survival, team battles, and Capture the Flag.
- The crosshair remains fixed at screen center.
- Desktop mouse movement controls view and aim.
- Xbox and compatible controllers use the left stick for movement and right stick for aim.
- Touch devices use a left movement stick and right aim/fire control.
- Easy difficulty may auto-lock onto the nearest valid living enemy.
- Manual touch, mouse, or controller aim immediately overrides auto-lock.
- Detecting real mouse input on a phone or tablet switches to desktop mapping and suspends touch auto-lock.
- The existing arena camera remains an optional accessibility and debugging view, not the default match view.

### Aim Presets

- `Full Auto-Aim`: default on Easy. A visible target marker locks onto the nearest valid enemy inside a wide aim cone, follows that enemy while Fire is held, and permits right-side swipe or target-switch input to select another enemy. Optional auto-fire begins only when the marked target enters the center firing tolerance.
- `Aim Assist`: default on Medium. The player aims manually while target friction slows the crosshair and applies a restrained pull near a valid enemy. It never maintains a permanent target lock.
- `Manual`: default on Expert and Insane. No target lock and little or no magnetic assistance.
- Players may override the preset independently of difficulty in Settings.
- Aim assistance never targets defeated enemies, allies, targets behind solid cover, or targets outside the configured range.

### Avatar Classes

- Scout passive: increased movement speed. Active ability: short Dash with a visible cooldown.
- Ranger passive: reduced weapon spread and steadier long-range aim. Active ability: Focus temporarily strengthens target acquisition and accuracy.
- Heavy passive: increased health and shield capacity with reduced movement speed. Active ability: Shield Brace temporarily reduces incoming damage.
- Tech Runner passive: increased scrap collection. Active ability: Repair Pulse restores part of the player's shield and provides reduced support to nearby teammates.
- Every avatar has one passive and one activated ability. Classes must be balanced through trade-offs rather than one class being strictly stronger.
- The mobile HUD provides one large Ability button with cooldown feedback.

### Controller Mapping

- Phone left thumb: movement joystick.
- Phone right side: swipe to turn and aim; a separate large Fire button supports press-and-hold firing.
- Phone actions: ADS/focus, Reload, Weapon Switch, Interact, Ability, and Pause use stable touch targets.
- Xbox left stick: movement. Right stick: aim. Right trigger: fire. Left trigger: ADS/focus. `A`: interact. `X`: reload. `Y`: switch weapon. `B`: class ability or dodge. D-pad: direct weapon selection. Menu: pause. Right-stick click: change locked target.
- Automatic reload occurs when a magazine is empty; manual reload remains available.

## Mobile Ergonomics

- Landscape orientation is recommended during gameplay.
- A portrait warning appears without blocking account and lobby screens.
- Touch controls use stable dimensions and respect notches and system safe areas.
- Pause, reload, weapon switch, interaction, and exit actions use large touch targets.
- Aim sensitivity, aim-assist strength, ADS sensitivity, and the Full Auto-Aim/Aim Assist/Manual preset are adjustable.
- The pause menu contains Resume, Settings, Change Weapon, and Exit to Lobby.
- Pausing an online match does not stop the match simulation; the existing difficulty-based return grace remains in effect.

## Graphics Quality Tiers

### Low

- Simplified water and fog.
- Reduced particles and texture resolution.
- Dynamic shadows disabled or sharply limited.
- Intended for slower phones.

### Medium

- Animated water, moderate fog and particles, and limited shadows.
- Default for most phones.

### High

- Full water reflections, volumetric atmosphere, denser particles, dynamic lights, and higher-resolution textures.
- Intended for stronger phones and desktop computers.

The game selects an initial tier conservatively and lets the player override it. If frame rate remains poor, the game offers a lower tier instead of silently changing settings repeatedly.

## Google Cloud And Cost Controls

- Confirm the intended Google Cloud account, billed project, available credits, Vertex AI access, region, and quotas before any paid request.
- Current CLI account detection alone is not permission to spend credits.
- Generate small preview batches first.
- Generate one approved high-resolution master per asset unless a specific revision is approved.
- Set a batch budget before generation and stop when the limit is reached.
- Do not enable services, change IAM, attach billing, create credentials, or spend credits without explicit approval at the relevant step.
- Never place API credentials in browser code, generated assets, source control, handoff documents, or chat output.

## File Organization

Store game-ready assets under `public/assets/nightfall/` with these groups:

- `avatars/`
- `weapons/`
- `maps/`
- `textures/`
- `structures/`
- `backgrounds/`
- `thumbnails/`
- `icons/`

Keep high-resolution generation masters in a separate local production folder. Deploy optimized WebP or PNG derivatives only. Use versioned filenames rather than overwriting an approved master.

## Loading And Failure Behavior

- Preload only assets needed by the current screen or map.
- Show a loading state while essential assets decode.
- Fall back to the current lightweight materials if an optional high-resolution asset fails.
- A missing background, texture, or animation must never block profile login, lobby entry, or gameplay.
- Local downloaded music remains local and is not uploaded with graphics requests.

## Verification

- Confirm first-person camera, centered reticle, mouse, touch, and controller behavior.
- Verify Easy auto-lock and manual-input override.
- Test portrait and landscape phone layouts, desktop layouts, and safe-area spacing.
- Measure frame rate and memory behavior at Low, Medium, and High tiers.
- Verify menus remain readable over animated backgrounds.
- Verify every asset URL returns successfully from the production deployment.
- Confirm loading fallbacks with selected assets deliberately unavailable.
- Test profile, progress, lobby, story, survival, team, Capture the Flag, music, pause, and Exit to Lobby flows.
- Verify the public Vercel alias after deployment rather than relying only on build status.

## Delivery Order

1. Integrate the selected Nightfall mockup as web thumbnail and initial loading art.
2. Add layered interactive menu background and quality controls.
3. Add first-person weapon presentation and mobile control refinements.
4. Produce and integrate four avatar portraits and profile thumbnails.
5. Produce and integrate map art, textures, structures, and weapon sheets.
6. Optimize, verify, and deploy each increment independently.

## Acceptance Criteria

- Every match starts in first-person.
- Mobile controls are reachable, stable, and easier to use than the current layout.
- A connected mouse switches a touch device to desktop mapping.
- Nightfall art appears in the website thumbnail and loading experience.
- Interactive backgrounds move without preventing menu interaction.
- Four visually distinct avatars, three weapon families, four maps, and associated thumbnail sets are represented consistently.
- The game remains playable when advanced graphics are disabled or unavailable.
- No paid Google generation occurs until the billed project and budget are explicitly approved.
