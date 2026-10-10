# Nightfall AAA Character Asset Contract

Status: production specification and handoff for the six survivor characters.

The current bundled GLBs remain optimized static operator meshes. This contract defines the next production package: high-resolution sculpt source, clean retopology, cinematic PBR materials, a shared deforming skeleton, facial rigs, motion-captured animation, named attachment sockets, and validated LOD exports. It does not claim those source packages have already been authored.

## Deliverable per survivor

Each package uses the matching entry in `public/assets/nightfall/characters/aaa-production-manifest.json` and includes:

- High-resolution sculpt with separate body, clothing, armor, weapon, grime, and damage masks.
- Hero, gameplay, mobile, and crowd retopology targets with clean deformation loops.
- UV layout and material sets for skin, cloth, armor, rubber, metal, glass, emissive, and decals.
- PBR cinematic textures for base color, normal, metallic-roughness, ambient occlusion, emissive, and optional height.
- Retargetable humanoid skeleton in the Nightfall A-pose, four-influence skinning, and tested bind-pose round trip.
- Facial blendshapes or a joint/blendshape hybrid with the required dialogue and combat expressions.
- Motion-captured clips for locomotion, aiming, firing, heat/overheat, reload, interaction, damage, downed, revive, respawn, and dialogue.
- Gameplay sockets from the shared contract plus attachment sockets for the survivor's class gear.
- GLB exports for each LOD, validation report, texture manifest, animation manifest, and source revision identifier.

## Shared validation gate

An asset is ready for runtime integration only when the GLB passes JSON 2.0, texture, transform, skeleton, socket, animation, and LOD validation. The existing `test/character-glb-assets.test.js` remains the current runtime smoke test; the new manifest test guards coverage of this production specification until authored rigged packages arrive.

## Six-character coverage

The manifest covers Dust Scout, Ranger, Heavy, Tech Runner, Field Medic, and Warden. Their current v1 GLBs and concept references are retained as blockout/reference inputs, while the `productionPackage` identifiers provide stable handoff names for the AAA pass.
