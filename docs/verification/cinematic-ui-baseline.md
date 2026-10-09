# Cinematic UI Baseline

Captured on 2026-10-07 before the cinematic military interface implementation.

## Source Checkpoint

- Protected application baseline: `2f2465d chore: checkpoint working wasteland survivor`
- Design-only branch head at capture: `ae748b7 docs: define toxic floating menu treatment`
- Preview used: `http://localhost:8098/?debug=1`
- Capture browser: Google Chrome 154 headless through the Chrome DevTools Protocol
- Desktop viewport: 1440 by 900 CSS pixels
- Phone viewport: 390 by 844 CSS pixels with touch emulation enabled

The capture flow used the real guest path: home, Enter Story as Guest, All-Out Story Survival, Final Loadout, Ready for Nightfall, and active combat after the 15-second opening.

## Automated Baseline

Command:

```powershell
node --test test/*.test.js
```

Result: 71 tests passed, 0 failed, 0 skipped. Node printed existing module-type performance warnings for ES-module test files; no test failed.

## Desktop Captures

| State | Evidence | Observed baseline |
| --- | --- | --- |
| Home | `docs/verification/screenshots/baseline/desktop-1440x900-home.jpg` | Artwork is vivid and readable, but the large left form card dominates the screen and the lower profile form extends below the viewport. |
| Lobby | `docs/verification/screenshots/baseline/desktop-1440x900-lobby.jpg` | Background art is strong, but Choose Your Fight is still a conventional half-screen card with rigid boxed actions. |
| Final Loadout | `docs/verification/screenshots/baseline/desktop-1440x900-loadout.jpg` | The centered modal is legible but blocks the environmental focal point; the HUD remains visible behind a pre-match decision. |
| Combat | `docs/verification/screenshots/baseline/desktop-1440x900-combat.jpg` | The WebGL scene is nonblank. Permanent data spans the full top edge, utility buttons occupy the upper-right, and the debug panel occupies the lower-left. The center reticle remains usable. |

## Phone Captures

| State | Evidence | Observed baseline |
| --- | --- | --- |
| Home | `docs/verification/screenshots/baseline/phone-390x844-home.jpg` | Content is scrollable and avatar choices are visible, but the landscape notice overlays the hero/title region. The form remains visually dense. |
| Lobby | `docs/verification/screenshots/baseline/phone-390x844-lobby.jpg` | Mode controls stack without horizontal overflow, but the landscape notice competes with Back and the heading. The large card consumes nearly the entire viewport. |
| Final Loadout | `docs/verification/screenshots/baseline/phone-390x844-loadout.jpg` | The modal fits, but the ungrouped HUD compresses into overlapping rows above it. Touch controls remain visible behind the modal and increase visual noise. |
| Combat | `docs/verification/screenshots/baseline/phone-390x844-combat.jpg` | The scene is nonblank and the reticle is clear. HUD labels collide in the upper-left, menu controls crowd the upper-right, and the debug panel competes with touch controls at the bottom. Portrait play needs stronger safe-area separation and compaction. |

## Comparison Targets

- Keep the combat center free except for temporary feedback and the reticle.
- Move persistent combat data into bounded edge rails.
- Replace the lobby card with stable semantic commands whose visual layers appear buoyant over toxic water or slime.
- Keep phone touch controls, safe areas, notices, and HUD regions disjoint.
- Preserve every existing gameplay path, control mapping, profile, local save key, and critical DOM ID.

Task 7 will capture matching after-images and append the final comparison and remaining risks here.
