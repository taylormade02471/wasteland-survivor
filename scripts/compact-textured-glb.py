"""Create a smaller, still textured GLB for a responsive menu preview.

The source GLBs keep their full-resolution textures for gameplay. This tool
only rewrites embedded image buffer views, preserving the original geometry
and material graph while reducing the first-screen download.
"""

from __future__ import annotations

import argparse
import io
import json
import struct
from pathlib import Path

from PIL import Image


JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise ValueError(f"not a GLB: {path}")
    offset = 12
    document = None
    binary = None
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8 : offset + 8 + length]
        if chunk_type == JSON_CHUNK:
            document = json.loads(chunk.decode("utf-8"))
        elif chunk_type == BIN_CHUNK:
            binary = chunk
        offset += 8 + length
    if document is None or binary is None:
        raise ValueError(f"incomplete GLB: {path}")
    return document, binary


def encode_json(document: dict) -> bytes:
    raw = json.dumps(document, separators=(",", ":")).encode("utf-8")
    return raw + b" " * ((4 - len(raw) % 4) % 4)


def encode_bin(binary: bytes) -> bytes:
    return binary + b"\0" * ((4 - len(binary) % 4) % 4)


def compact(source: Path, destination: Path, max_edge: int, quality: int) -> tuple[int, int]:
    document, binary = read_glb(source)
    image_views = []
    for image in document.get("images", []):
        view_index = image.get("bufferView")
        if view_index is None:
            continue
        view = document["bufferViews"][view_index]
        image_views.append((view_index, view.get("byteOffset", 0), view["byteLength"]))
    image_views.sort(key=lambda item: item[1])

    rebuilt = bytearray()
    cursor = 0
    for view_index, start, length in image_views:
        rebuilt.extend(binary[cursor:start])
        original = binary[start : start + length]
        with Image.open(io.BytesIO(original)) as image:
            image = image.convert("RGB")
            image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
            encoded = io.BytesIO()
            image.save(encoded, format="JPEG", quality=quality, optimize=True, progressive=True)
            replacement = encoded.getvalue()
        view = document["bufferViews"][view_index]
        view["byteOffset"] = len(rebuilt)
        view["byteLength"] = len(replacement)
        rebuilt.extend(replacement)
        cursor = start + length
    rebuilt.extend(binary[cursor:])
    binary = bytes(rebuilt)
    document["buffers"][0]["byteLength"] = len(binary)

    json_chunk = encode_json(document)
    bin_chunk = encode_bin(binary)
    total_length = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    output = b"glTF" + struct.pack("<II", 2, total_length)
    output += struct.pack("<II", len(json_chunk), JSON_CHUNK) + json_chunk
    output += struct.pack("<II", len(bin_chunk), BIN_CHUNK) + bin_chunk
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(output)
    return len(source.read_bytes()), len(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--max-edge", type=int, default=768)
    parser.add_argument("--quality", type=int, default=78)
    args = parser.parse_args()
    before, after = compact(args.source, args.destination, args.max_edge, args.quality)
    print(f"{args.destination}: {before} -> {after} bytes")


if __name__ == "__main__":
    main()
