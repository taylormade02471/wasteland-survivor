import math
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "nightfall" / "characters" / "3d"


ARCHETYPES = {
    "scout": {
        "colors": {"primary": "#5f6f55", "cloth": "#2f5958", "accent": "#d8b55a", "dark": "#202922", "visor": "#8ed4cf"},
        "height": 1.74,
        "shoulder": 0.78,
        "bulk": 0.82,
        "features": ["hood", "teal_cloak", "radio_whip", "compact_smg"],
    },
    "ranger": {
        "colors": {"primary": "#596874", "cloth": "#7a3b28", "accent": "#c78d45", "dark": "#1c252b", "visor": "#b7dbe8"},
        "height": 1.82,
        "shoulder": 0.86,
        "bulk": 0.92,
        "features": ["brim_hat", "rust_scarf", "coat_tail", "rifle_sling"],
    },
    "heavy": {
        "colors": {"primary": "#65615b", "cloth": "#38332d", "accent": "#d36f3d", "dark": "#252729", "visor": "#f1cf7b"},
        "height": 1.88,
        "shoulder": 1.14,
        "bulk": 1.24,
        "features": ["sealed_faceplate", "belly_armor", "breach_shield", "drum_lmg"],
    },
    "tech": {
        "colors": {"primary": "#3f686a", "cloth": "#2d3435", "accent": "#69d6bb", "dark": "#172426", "visor": "#e2fff3"},
        "height": 1.78,
        "shoulder": 0.82,
        "bulk": 0.9,
        "features": ["antenna", "tool_frame", "blue_cells", "coil_carbine"],
    },
    "medic": {
        "colors": {"primary": "#6f776f", "cloth": "#5e2424", "accent": "#f2f0da", "dark": "#22312c", "visor": "#9be4d4"},
        "height": 1.7,
        "shoulder": 0.8,
        "bulk": 0.86,
        "features": ["white_jacket", "red_harness", "medical_pack", "pulse_pistol"],
    },
    "warden": {
        "colors": {"primary": "#4e5e64", "cloth": "#2f3b28", "accent": "#bfc7b5", "dark": "#151d21", "visor": "#d9ede5"},
        "height": 1.94,
        "shoulder": 1.02,
        "bulk": 1.08,
        "features": ["high_collar", "long_cloak", "tower_shield", "riot_shotgun"],
    },
}


def hex_to_rgba(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)


def material(name, color, roughness=0.78, metallic=0.08):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_to_rgba(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def cube(name, mat, loc, scale, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def cylinder(name, mat, loc, radius=0.05, depth=1.0, vertices=10, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def cone(name, mat, loc, radius1=0.2, radius2=0.05, depth=0.28, vertices=10, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def empty(name, loc):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.08
    obj.location = loc
    bpy.context.collection.objects.link(obj)
    return obj


def build_character(archetype_id, spec):
    mats = {key: material(f"{archetype_id}_{key}", value) for key, value in spec["colors"].items()}
    h = spec["height"]
    shoulder = spec["shoulder"]
    bulk = spec["bulk"]
    root = empty(f"character:{archetype_id}", (0, 0, 0))

    parts = [
        cube("hips:pelvis", mats["cloth"], (0, 0, 0.82), (0.46 * shoulder, 0.28 * bulk, 0.26)),
        cube("torso:chest", mats["primary"], (0, 0, 1.27), (0.56 * shoulder, 0.34 * bulk, 0.58)),
        cube("torso:vest", mats["dark"], (0, -0.18, 1.28), (0.48 * shoulder, 0.12, 0.46)),
        cylinder("head:helmet", mats["primary"], (0, 0, 1.72 * h / 1.8), 0.18 * bulk, 0.22, 12, (math.pi / 2, 0, 0)),
        cube("head:visor", mats["visor"], (0, -0.17, 1.72 * h / 1.8), (0.24, 0.035, 0.06)),
        cylinder("leftLeg:boot", mats["dark"], (-0.16 * shoulder, 0, 0.38), 0.07 * bulk, 0.72, 8),
        cylinder("rightLeg:boot", mats["dark"], (0.16 * shoulder, 0, 0.38), 0.07 * bulk, 0.72, 8),
        cylinder("leftArm:upper", mats["primary"], (-0.42 * shoulder, 0, 1.24), 0.055 * bulk, 0.56, 8, (0.26, 0, 0.16)),
        cylinder("rightArm:upper", mats["primary"], (0.42 * shoulder, 0, 1.24), 0.055 * bulk, 0.56, 8, (0.26, 0, -0.16)),
        cube("backMount:pack", mats["dark"], (0, 0.23, 1.2), (0.34 * bulk, 0.14, 0.68)),
        cube("hipMount:left", mats["accent"], (-0.36, -0.02, 0.78), (0.15, 0.12, 0.22)),
        cube("hipMount:right", mats["dark"], (0.36, -0.02, 0.78), (0.15, 0.12, 0.22)),
    ]

    if "hood" in spec["features"]:
        parts += [
            cone("head:hood", mats["cloth"], (0, 0.01, 1.9 * h / 1.8), 0.25, 0.08, 0.3, 10),
            cube("head:hood-cowl", mats["cloth"], (0, -0.04, 1.68), (0.38, 0.18, 0.1)),
            cube("torso:torn-teal-cloak-left", mats["visor"], (-0.36, 0.1, 1.0), (0.12, 0.05, 0.78)),
            cylinder("shoulderMount:radio-whip", mats["visor"], (-0.55, 0.08, 1.82), 0.01, 0.66, 6, (0.16, 0.24, 0)),
            cube("weapon:compact-smg", mats["dark"], (0.36, -0.43, 1.0), (0.48, 0.12, 0.12)),
        ]
    if "brim_hat" in spec["features"]:
        parts += [
            cylinder("head:ranger-brim", mats["cloth"], (0, 0, 1.82), 0.31, 0.035, 16),
            cube("torso:rust-scarf", mats["cloth"], (0, -0.06, 1.54), (0.58, 0.16, 0.1)),
            cube("torso:coat-tail", mats["cloth"], (0, 0.14, 0.84), (0.44, 0.08, 0.58)),
            cylinder("backMount:rifle-sling", mats["accent"], (-0.2, 0.31, 1.2), 0.018, 0.96, 6, (0.72, 0, -0.46)),
            cube("weapon:marksman-rifle", mats["dark"], (0.34, -0.42, 1.0), (0.82, 0.1, 0.12)),
        ]
    if "breach_shield" in spec["features"]:
        parts += [
            cube("head:sealed-faceplate", mats["dark"], (0, -0.19, 1.74), (0.28, 0.06, 0.2)),
            cube("torso:belly-armor", mats["accent"], (0, -0.2, 1.02), (0.6, 0.14, 0.34)),
            cube("shield:breach-slab", mats["dark"], (-0.65, -0.18, 1.0), (0.46, 0.12, 0.9)),
            cube("weapon:drum-lmg", mats["dark"], (0.38, -0.46, 1.0), (0.68, 0.16, 0.16)),
            cylinder("weapon:drum", mats["accent"], (0.24, -0.5, 0.9), 0.15, 0.08, 12, (math.pi / 2, 0, 0)),
        ]
    if "tool_frame" in spec["features"]:
        parts += [
            cylinder("backMount:antenna", mats["accent"], (0.18, 0.25, 1.78), 0.012, 0.62, 6, (0.12, 0, -0.16)),
            cube("backMount:tool-frame", mats["accent"], (-0.04, 0.32, 1.24), (0.42, 0.08, 0.48)),
            cube("backMount:glow-cell-left", mats["visor"], (-0.2, 0.38, 1.34), (0.08, 0.05, 0.18)),
            cube("hipMount:blue-tool-case", mats["visor"], (0.48, -0.02, 0.68), (0.18, 0.12, 0.3)),
            cube("weapon:coil-carbine", mats["dark"], (0.36, -0.43, 1.0), (0.58, 0.12, 0.12)),
        ]
    if "white_jacket" in spec["features"]:
        parts += [
            cube("torso:white-field-jacket", mats["accent"], (0, -0.22, 1.24), (0.44, 0.08, 0.42)),
            cube("torso:red-harness", mats["cloth"], (-0.16, -0.27, 1.22), (0.1, 0.05, 0.58)),
            cube("torso:red-harness-cross", mats["cloth"], (0, -0.28, 1.3), (0.42, 0.05, 0.08)),
            cube("backMount:med-cross", mats["accent"], (0, 0.34, 1.25), (0.3, 0.04, 0.08)),
            cube("hipMount:triage-pouch", mats["visor"], (-0.48, -0.04, 0.72), (0.2, 0.1, 0.16)),
            cube("weapon:pulse-pistol", mats["dark"], (0.38, -0.38, 0.98), (0.32, 0.1, 0.12)),
        ]
    if "high_collar" in spec["features"]:
        parts += [
            cube("torso:high-collar", mats["dark"], (0, 0.06, 1.58), (0.6, 0.2, 0.2)),
            cube("torso:long-warden-cloak-left", mats["cloth"], (-0.36, 0.14, 0.86), (0.17, 0.07, 0.88)),
            cube("torso:long-warden-cloak-right", mats["cloth"], (0.36, 0.14, 0.86), (0.17, 0.07, 0.88)),
            cube("shield:tower", mats["dark"], (-0.62, -0.18, 1.02), (0.38, 0.1, 0.98)),
            cube("weapon:riot-shotgun", mats["dark"], (0.4, -0.44, 1.0), (0.58, 0.13, 0.13)),
        ]

    for obj in parts:
        obj.parent = root
    for name, loc in {
        "leftHandAnchor": (-0.46 * shoulder, -0.12, 0.88),
        "rightHandAnchor": (0.46 * shoulder, -0.12, 0.88),
        "weaponAnchor": (0.36, -0.42, 1.0),
        "muzzle": (0.74, -0.42, 1.0),
        "classAttachmentAnchor": (0, 0.34, 1.38),
    }.items():
        obj = empty(name, loc)
        obj.parent = root

    root["sourceReference"] = f"./assets/nightfall/characters/index/{'tech-runner' if archetype_id == 'tech' else 'field-medic' if archetype_id == 'medic' else archetype_id}-v1.webp"
    root["assetContract"] = "Authored low-poly Blender GLB generated locally from bundled concept art direction; not a skinned rig or motion-capture asset."
    return root


def export_one(archetype_id, spec):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    root = build_character(archetype_id, spec)
    for obj in bpy.context.scene.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_DIR / f"{archetype_id}-operator-v1.glb"),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
    )


def main():
    for archetype_id, spec in ARCHETYPES.items():
        export_one(archetype_id, spec)


if __name__ == "__main__":
    main()
