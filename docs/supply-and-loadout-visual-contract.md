# Supply And Loadout Visual Contract

This follow-up extends the procedural graphics foundation without wiring it into the live scene. The exported contracts are pure data and Three.js factories so the coordinator can integrate them later from `public/game3d.js`, `public/index.html`, and `public/style.css`.

## Supply Props

- Use `createSupplyStationModel(THREE, "gun-upgrade-station", { seed })` for the upright workbench silhouette. It has an overhead tool arm, weapon clamp, amber metal cues, and toxic-green calibration light.
- Use `createSupplyStationModel(THREE, "ammunition-supply-crate", { seed })` for the lower stacked ammo silhouette. It has open crates, a dirty-white band, and military-green material cues.
- Read `model.interaction.socket` for the gameplay socket type and accepted resource kinds.
- Read `model.interaction.marker` for prompt text and use radius.
- Read `model.collider` and `model.footprint` to block players and reserve placement space.

## Waypoint Guidance

- Use `sampleWaypointArrow({ player, target, viewport, supplyName })` every UI frame for a small amber chevron.
- Treat `visible: false` as a near-target fade and hide the marker.
- Use `offscreen: true` to pin the chevron to the safe viewport edge.
- Use `ui.x`, `ui.y`, `ui.scale`, `rotation`, and `opacity` directly; do not upscale this into a center-screen overlay.
- Use `accessibility.label` beside or under the icon for non-color identification.

## Arena Spacing

- Use `WORLD_ARENA_PRESETS[mapId]` for larger world bounds and spacing targets.
- Use `sampleArenaPlacements(mapId, { seed })` to get deterministic obstacle, supply, objective, lane, and spawn-clear-zone placements.
- Keep the returned `navigation.lanes` clear and reject new blockers that overlap returned `blockers`.
- Supply stations should remain separated by at least `preset.supplySeparation`.

## Lobby And Loadout

- Use `LOBBY_LOADOUT_VISUAL_CONTRACT` as the HTML/CSS integration source of truth.
- Keep the screen visually combined: one slim profile/status rail, one compact mode strip, one integrated loadout ribbon with a shallow drawer, and floating controls over the cinematic backdrop.
- Use restrained backing plates only for legibility. Avoid nested cards, blocky grid panels, and giant center overlays.
- Follow `controllerFocus.order` for controller navigation and retain desktop/mobile placement differences from the exported contract.
