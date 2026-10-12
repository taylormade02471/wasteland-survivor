"""Generate small authored world-detail GLBs with embedded textures.

These meshes are intentionally lightweight so the connected-world scene can add
landmarks and roadside detail without turning the first map load into a large
download.  Each output contains real mesh primitives, normals, UVs, a material,
and an embedded JPEG texture; the runtime can use the same GLTFLoader path as
the larger authored field assets.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import struct
from pathlib import Path

from PIL import Image, ImageDraw


def align4(value: int) -> int:
    return (value + 3) & ~3


class MeshBuilder:
    def __init__(self) -> None:
        self.positions: list[float] = []
        self.normals: list[float] = []
        self.uvs: list[float] = []
        self.indices: list[int] = []

    def _vertex(self, position: tuple[float, float, float], normal: tuple[float, float, float], uv: tuple[float, float]) -> int:
        index = len(self.positions) // 3
        self.positions.extend(position)
        self.normals.extend(normal)
        self.uvs.extend(uv)
        return index

    def add_box(self, center: tuple[float, float, float], size: tuple[float, float, float], rotation: float = 0.0) -> None:
        cx, cy, cz = center
        sx, sy, sz = (value / 2 for value in size)
        corners = [
            (-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
            (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz),
        ]
        faces = [
            ((0, 0, -1), (0, 1, 2, 3)),
            ((0, 0, 1), (4, 7, 6, 5)),
            ((-1, 0, 0), (0, 3, 7, 4)),
            ((1, 0, 0), (1, 5, 6, 2)),
            ((0, 1, 0), (3, 2, 6, 7)),
            ((0, -1, 0), (0, 4, 5, 1)),
        ]
        cos_r = math.cos(rotation)
        sin_r = math.sin(rotation)

        def transform(point: tuple[float, float, float]) -> tuple[float, float, float]:
            x, y, z = point
            return (cx + x * cos_r - z * sin_r, cy + y, cz + x * sin_r + z * cos_r)

        for normal, face in faces:
            start = len(self.positions) // 3
            for uv, corner_index in zip(((0, 0), (1, 0), (1, 1), (0, 1)), face):
                self._vertex(transform(corners[corner_index]), normal, uv)
            self.indices.extend((start, start + 1, start + 2, start, start + 2, start + 3))

    def add_cylinder(
        self,
        center: tuple[float, float, float],
        radius: float,
        height: float,
        segments: int = 16,
        rotation: float = 0.0,
        cap_top: bool = True,
        cap_bottom: bool = True,
    ) -> None:
        cx, cy, cz = center
        cos_r = math.cos(rotation)
        sin_r = math.sin(rotation)
        ring_bottom: list[int] = []
        ring_top: list[int] = []
        for index in range(segments):
            angle = (index / segments) * math.tau
            x = math.cos(angle) * radius
            z = math.sin(angle) * radius
            px = cx + x * cos_r - z * sin_r
            pz = cz + x * sin_r + z * cos_r
            nx = math.cos(angle)
            nz = math.sin(angle)
            ring_bottom.append(self._vertex((px, cy - height / 2, pz), (nx, 0, nz), (index / segments, 0)))
            ring_top.append(self._vertex((px, cy + height / 2, pz), (nx, 0, nz), (index / segments, 1)))
        for index in range(segments):
            nxt = (index + 1) % segments
            self.indices.extend((ring_bottom[index], ring_bottom[nxt], ring_top[nxt], ring_bottom[index], ring_top[nxt], ring_top[index]))
        if cap_bottom:
            center_index = self._vertex((cx, cy - height / 2, cz), (0, -1, 0), (.5, .5))
            for index in range(segments):
                nxt = (index + 1) % segments
                self.indices.extend((center_index, ring_bottom[nxt], ring_bottom[index]))
        if cap_top:
            center_index = self._vertex((cx, cy + height / 2, cz), (0, 1, 0), (.5, .5))
            for index in range(segments):
                nxt = (index + 1) % segments
                self.indices.extend((center_index, ring_top[index], ring_top[nxt]))

    def add_cone(self, center: tuple[float, float, float], radius: float, height: float, segments: int = 16) -> None:
        cx, cy, cz = center
        tip = self._vertex((cx, cy + height / 2, cz), (0, 1, 0), (.5, 1))
        ring: list[int] = []
        slope = radius / max(height, 0.001)
        for index in range(segments):
            angle = (index / segments) * math.tau
            x = math.cos(angle) * radius
            z = math.sin(angle) * radius
            normal = (math.cos(angle), slope, math.sin(angle))
            ring.append(self._vertex((cx + x, cy - height / 2, cz + z), normal, (index / segments, 0)))
        for index in range(segments):
            nxt = (index + 1) % segments
            self.indices.extend((ring[index], ring[nxt], tip))


def texture_bytes(base: tuple[int, int, int], accent: tuple[int, int, int]) -> bytes:
    image = Image.new("RGB", (64, 64), base)
    draw = ImageDraw.Draw(image)
    for x in range(0, 64, 8):
        draw.line((x, 0, x, 64), fill=accent, width=1)
    for y in range(0, 64, 16):
        draw.line((0, y, 64, y), fill=accent, width=2)
    draw.rectangle((5, 5, 58, 58), outline=accent, width=2)
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=82, optimize=True)
    return output.getvalue()


def make_mesh(kind: str) -> tuple[MeshBuilder, bytes]:
    mesh = MeshBuilder()
    if kind == "water-tower":
        mesh.add_cylinder((0, 7.4, 0), 3.6, 4.8, segments=20)
        mesh.add_cone((0, 10.2, 0), 3.8, 1.5, segments=20)
        mesh.add_cylinder((0, 4.8, 0), 4.0, .22, segments=20)
        for x, z in ((-2.5, -2.5), (2.5, -2.5), (2.5, 2.5), (-2.5, 2.5)):
            mesh.add_box((x, 2.3, z), (.46, 4.6, .46))
        mesh.add_box((0, 5.1, -3.6), (.28, 4.9, .28))
        mesh.add_box((0, 3.2, -3.6), (2.8, .18, .18))
        return mesh, texture_bytes((93, 106, 108), (45, 53, 57))
    if kind == "rail-signal":
        mesh.add_box((0, 3.4, 0), (.34, 6.8, .34))
        mesh.add_box((0, 6.2, 0), (3.2, .24, .24))
        mesh.add_box((0, 5.45, 0), (1.1, 1.25, .5))
        mesh.add_cylinder((-.3, 5.45, -.29), .23, .10, segments=12, rotation=math.pi / 2)
        mesh.add_cylinder((.3, 5.45, -.29), .23, .10, segments=12, rotation=math.pi / 2)
        mesh.add_box((0, .2, 0), (1.25, .4, 1.25))
        return mesh, texture_bytes((65, 68, 65), (184, 58, 33))
    if kind == "wrecked-pickup":
        mesh.add_box((0, 1.0, 0), (5.2, 1.05, 2.35), rotation=-.05)
        mesh.add_box((.55, 1.95, 0), (2.5, 1.25, 2.05), rotation=-.05)
        mesh.add_box((-1.9, 1.68, 0), (1.2, .55, 2.15), rotation=-.05)
        for x in (-1.7, 1.7):
            for z in (-1.28, 1.28):
                mesh.add_cylinder((x, .58, z), .56, .34, segments=12, rotation=math.pi / 2, cap_top=True, cap_bottom=True)
        mesh.add_box((-.9, 2.25, -1.03), (.9, .6, .08), rotation=-.05)
        return mesh, texture_bytes((89, 62, 45), (42, 40, 36))
    raise ValueError(f"unknown world detail kind: {kind}")


def pack_floats(values: list[float]) -> bytes:
    return struct.pack(f"<{len(values)}f", *values)


def pack_indices(values: list[int]) -> bytes:
    return struct.pack(f"<{len(values)}I", *values)


def write_glb(kind: str, destination: Path) -> None:
    mesh, image = make_mesh(kind)
    binary = bytearray()
    views: list[dict] = []

    def append_buffer(data: bytes, target: int | None = None) -> int:
        offset = align4(len(binary))
        binary.extend(b"\0" * (offset - len(binary)))
        binary.extend(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            view["target"] = target
        views.append(view)
        return len(views) - 1

    position_view = append_buffer(pack_floats(mesh.positions), 34962)
    normal_view = append_buffer(pack_floats(mesh.normals), 34962)
    uv_view = append_buffer(pack_floats(mesh.uvs), 34962)
    index_view = append_buffer(pack_indices(mesh.indices), 34963)
    image_view = append_buffer(image)

    positions = list(zip(*(iter(mesh.positions),) * 3))
    mins = [min(point[index] for point in positions) for index in range(3)]
    maxs = [max(point[index] for point in positions) for index in range(3)]
    accessors = [
        {"bufferView": position_view, "componentType": 5126, "count": len(mesh.positions) // 3, "type": "VEC3", "min": mins, "max": maxs},
        {"bufferView": normal_view, "componentType": 5126, "count": len(mesh.normals) // 3, "type": "VEC3"},
        {"bufferView": uv_view, "componentType": 5126, "count": len(mesh.uvs) // 2, "type": "VEC2"},
        {"bufferView": index_view, "componentType": 5125, "count": len(mesh.indices), "type": "SCALAR"},
    ]
    document = {
        "asset": {
            "version": "2.0",
            "generator": "Wasteland Survivor authored world detail",
            "extras": {"author": "Phantom", "project": "Wasteland Survivor", "source": "Nightfall Files"},
        },
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": f"{kind}-mesh"}],
        "meshes": [{"name": kind, "primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}, "indices": 3, "material": 0}]}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
        "accessors": accessors,
        "images": [{"bufferView": image_view, "mimeType": "image/jpeg", "name": f"{kind}-texture"}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
        "textures": [{"sampler": 0, "source": 0}],
        "materials": [{"name": f"{kind}-material", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": .18, "roughnessFactor": .78}}],
    }
    json_chunk = json.dumps(document, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    binary_chunk = bytes(binary) + b"\0" * ((4 - len(binary) % 4) % 4)
    header = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(json_chunk) + 8 + len(binary_chunk))
    output = header + struct.pack("<II", len(json_chunk), 0x4E4F534A) + json_chunk + struct.pack("<II", len(binary_chunk), 0x004E4942) + binary_chunk
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    outputs = {
        "water-tower": args.output_root / "water-tower-meshy-v1.glb",
        "rail-signal": args.output_root / "props" / "rail-signal-v1.glb",
        "wrecked-pickup": args.output_root / "props" / "wrecked-pickup-v1.glb",
    }
    for kind, destination in outputs.items():
        write_glb(kind, destination)
        print(f"{kind}\t{destination}\t{destination.stat().st_size} bytes")


if __name__ == "__main__":
    main()
