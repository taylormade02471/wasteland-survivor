import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = path.join(repo, "public", "assets", "nightfall", "aaa", "enemies", "meshy");
const files = [
  "mutated-creature-meshy-v1.glb", "shooter-meshy-v1.glb", "marksman-meshy-v1.glb", "shield-soldier-meshy-v1.glb",
  "heavy-gunner-meshy-v1.glb", "drone-meshy-v1.glb", "mutant-meshy-v1.glb", "boss-commander-meshy-v1.glb",
];
const align4 = value => (value + 3) & ~3;

function parse(filePath) {
  const source = fs.readFileSync(filePath); const jsonLength = source.readUInt32LE(12);
  const json = JSON.parse(source.toString("utf8", 20, 20 + jsonLength).trim());
  const binOffset = 20 + align4(jsonLength); const binLength = source.readUInt32LE(binOffset);
  return { json, bin: Buffer.from(source.subarray(binOffset + 8, binOffset + 8 + binLength)) };
}

function encode(json, bin) {
  const raw = JSON.stringify(json); const jsonBytes = Buffer.from(raw.padEnd(align4(Buffer.byteLength(raw)), " "));
  const binBytes = Buffer.concat([bin, Buffer.alloc(align4(bin.length) - bin.length)]); const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + binBytes.length, 8);
  const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(jsonBytes.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binBytes.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonBytes, binHeader, binBytes]);
}

function append(json, chunks, bytes, target) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0); const offset = align4(length);
  if (offset > length) chunks.push(Buffer.alloc(offset - length)); chunks.push(bytes);
  const view = { buffer: 0, byteOffset: offset, byteLength: bytes.length }; if (target) view.target = target;
  return json.bufferViews.push(view) - 1;
}

function addAccessor(json, view, count, type, componentType, min, max) {
  const value = { bufferView: view, count, type, componentType }; if (min) value.min = min; if (max) value.max = max;
  return json.accessors.push(value) - 1;
}

function quaternion(axis, angle) {
  const half = angle / 2, s = Math.sin(half), c = Math.cos(half);
  return axis === "x" ? [s, 0, 0, c] : axis === "y" ? [0, s, 0, c] : [0, 0, s, c];
}

function addClip(json, chunks, name, joints, axis, angles) {
  const times = Buffer.alloc(12); [0, 1, 2].forEach((value, index) => times.writeFloatLE(value, index * 4));
  const input = addAccessor(json, append(json, chunks, times), 3, "SCALAR", 5126, [0], [2]); const samplers = []; const channels = [];
  for (const joint of joints) {
    const values = Buffer.alloc(48); angles.forEach((angle, index) => quaternion(axis, angle).forEach((value, component) => values.writeFloatLE(value, (index * 4 + component) * 4)));
    const output = addAccessor(json, append(json, chunks, values), 3, "VEC4", 5126);
    const sampler = samplers.push({ input, output, interpolation: "LINEAR" }) - 1; channels.push({ sampler, target: { node: joint, path: "rotation" } });
  }
  json.animations.push({ name, samplers, channels });
}

function rig(fileName) {
  const filePath = path.join(assetDir, fileName); const { json, bin } = parse(filePath);
  if (json.skins?.some(skin => skin.name === "NightfallEnemySkin")) return;
  json.accessors ||= []; json.bufferViews ||= []; json.nodes ||= []; json.skins ||= []; json.animations ||= [];
  const primitive = json.meshes?.[0]?.primitives?.[0]; const positionAccessor = primitive?.attributes?.POSITION;
  if (positionAccessor == null) throw new Error(`${fileName} has no position accessor`);
  const position = json.accessors[positionAccessor]; const view = json.bufferViews[position.bufferView];
  const start = (view.byteOffset || 0) + (position.byteOffset || 0); const stride = view.byteStride || 12; let minY = Infinity; let maxY = -Infinity;
  for (let index = 0; index < position.count; index += 1) { const y = bin.readFloatLE(start + index * stride + 4); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const span = Math.max(.001, maxY - minY); const joints = Buffer.alloc(position.count * 8); const weights = Buffer.alloc(position.count * 16); const chunks = [bin];
  for (let index = 0; index < position.count; index += 1) {
    const ratio = (bin.readFloatLE(start + index * stride + 4) - minY) / span; const joint = ratio < .38 ? 2 : ratio < .7 ? 1 : 0;
    joints.writeUInt16LE(joint, index * 8); weights.writeFloatLE(1, index * 16);
  }
  primitive.attributes.JOINTS_0 = addAccessor(json, append(json, chunks, joints, 34962), position.count, "VEC4", 5123, [0, 0, 0, 0], [2, 0, 0, 0]);
  primitive.attributes.WEIGHTS_0 = addAccessor(json, append(json, chunks, weights, 34962), position.count, "VEC4", 5126, [0, 0, 0, 0], [1, 0, 0, 0]);
  const meshNode = json.nodes.findIndex(node => node.mesh === 0); const rootNode = json.nodes.length;
  json.nodes.push({ name: "rig:root" }, { name: "rig:spine", translation: [0, .8, 0] }, { name: "rig:legs", translation: [0, .4, 0] });
  const parent = json.scenes?.[0]?.nodes?.[0]; if (parent != null) json.nodes[parent].children = [...(json.nodes[parent].children || []), rootNode, rootNode + 1, rootNode + 2];
  const inverse = Buffer.alloc(3 * 64); [0, .8, .4].forEach((y, index) => { [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -y, 0, 1].forEach((value, offset) => inverse.writeFloatLE(value, (index * 16 + offset) * 4)); });
  const inverseAccessor = addAccessor(json, append(json, chunks, inverse), 3, "MAT4", 5126);
  json.skins.push({ name: "NightfallEnemySkin", joints: [rootNode, rootNode + 1, rootNode + 2], inverseBindMatrices: inverseAccessor });
  json.nodes[meshNode].skin = 0;
  addClip(json, chunks, "Idle", [rootNode + 1], "z", [.02, -.02, .02]);
  addClip(json, chunks, "Move", [rootNode + 1, rootNode + 2], "x", [.18, -.18, .18]);
  addClip(json, chunks, "Attack", [rootNode + 1], "x", [.02, -.14, .02]);
  addClip(json, chunks, "Hit", [rootNode], "z", [.06, -.06, .06]);
  json.buffers[0].byteLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0); fs.writeFileSync(filePath, encode(json, Buffer.concat(chunks)));
}

for (const file of files) rig(file);
