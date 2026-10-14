# Burned Armory Render Pass Evidence

Run: local Three.js audit at `http://127.0.0.1:4173/index.html?renderFocus=armory&renderPass=<n>` on 2026-10-13.

The URL override is audit-only. Normal matches retain the Low/Medium/High device profile and did not receive a control, collision, or gameplay-rule change.

| Pass | Mountain crags | Armory salvage | Fire clusters | Authored world assets | Fallback assets | Check |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 — silhouette | 24 | 24 | 20 | 27 | 0 | Rendered and inspected |
| 2 — mesh density | 28 | 28 | 24 | 27 | 0 | Rendered, settled, and inspected |
| 3 — texture detail | 32 | 32 | 28 | 27 | 0 | Rendered, settled, and inspected |
| 4 — lighting points | 37 | 37 | 33 | 27 | 0 | Rendered, settled, and inspected |
| 5 — final polish | 44 | 44 | 39 | 27 | 0 | Rendered, settled, and inspected |

Each count grows 12–20% from the preceding pass. The fifth-pass browser canvas reported `worldFieldComplete=true`, `terrainTextureState=authored`, `terrainMicrodetailComplete=true`, `worldFieldAuthored=27`, and `worldFieldFallback=0`.

## Visual result

The preserved local audit tab is on the fifth-pass armory view. It visibly shows the textured terrain, burned armory shell, rubble/salvage line, firelight, and HUD/quest layer. The mountain and inferno counts are checked through the same live canvas dataset because they are part of the connected field but lie outside the armory camera frame.

This is a fidelity increment, not an AAA-completion claim: the next visual phase should replace the remaining primitive procedural silhouette pieces with higher-detail authored meshes and improve the armory camera composition before treating the art direction as final.
