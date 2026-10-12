import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = path.join(repo, "public", "assets", "nightfall", "aaa", "characters", "meshy");
const files = [
  "scout-meshy-v1.glb",
  "ranger-meshy-v2.glb",
  "heavy-meshy-v1.glb",
  "tech-runner-meshy-v1.glb",
  "field-medic-meshy-v1.glb",
  "warden-meshy-v1.glb",
];

const align4 = value => (value + 3) & ~3;

function parseGlb(filePath) {
  const source = fs.readFileSync(filePath);
  if (source.toString("utf8", 0, 4) !== "glTF") throw new Error(`${filePath} is not GLB`);
  const jsonLength = source.readUInt32LE(12);
  const json = JSON.parse(source.toString("utf8", 20, 20 + jsonLength).trim());
  const binHeader = 20 + align4(jsonLength);
  const binLength = source.readUInt32LE(binHeader);
  const bin = Buffer.from(source.subarray(binHeader + 8, binHeader + 8 + binLength));
  return { json, bin };
}

function encodeGlb(json, bin) {
  const jsonBytes = Buffer.from(JSON.stringify(json).padEnd(align4(Buffer.byteLength(JSON.stringify(json))), " "));
  const binBytes = Buffer.concat([bin, Buffer.alloc(align4(bin.length) - bin.length)]);
  const totalLength = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBytes.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonBytes, binHeader, binBytes]);
}

function appendView(json, chunks, bytes, target = undefined) {
  const offset = align4(chunks.reduce((sum, item) => sum + item.length, 0));
  const padding = offset - chunks.reduce((sum, item) => sum + item.length, 0);
  if (padding) chunks.push(Buffer.alloc(padding));
  chunks.push(bytes);
  const view = { buffer: 0, byteOffset: offset, byteLength: bytes.length };
  if (target) view.target = target;
  const index = json.bufferViews.push(view) - 1;
  return index;
}

function addAccessor(json, view, count, type, componentType, min, max) {
  const accessor = { bufferView: view, componentType, count, type };
  if (min) accessor.min = min;
  if (max) accessor.max = max;
  return json.accessors.push(accessor) - 1;
}

function quaternion(axis, angle) {
  const half = angle / 2;
  const s = Math.sin(half);
  const c = Math.cos(half);
  return axis === "x" ? [s, 0, 0, c] : axis === "y" ? [0, s, 0, c] : [0, 0, s, c];
}

function addClip(json, chunks, name, spineAngles, legAngles) {
  const times = Buffer.alloc(12);
  [0, 1, 2].forEach((value, index) => times.writeFloatLE(value, index * 4));
  const timeView = appendView(json, chunks, times);
  const timeAccessor = addAccessor(json, timeView, 3, "SCALAR", 5126, [0], [2]);
  const channels = [];
  const samplers = [];
  const addRotation = (node, angles, axis) => {
    const values = Buffer.alloc(48);
    angles.forEach((angle, index) => quaternion(axis, angle).forEach((value, component) => values.writeFloatLE(value, (index * 4 + component) * 4)));
    const valueView = appendView(json, chunks, values);
    const valueAccessor = addAccessor(json, valueView, 3, "VEC4", 5126);
    const sampler = samplers.push({ input: timeAccessor, output: valueAccessor, interpolation: "LINEAR" }) - 1;
    channels.push({ sampler, target: { node, path: "rotation" } });
  };
  addRotation(2, spineAngles, "z");
  addRotation(3, legAngles, "x");
  json.animations.push({ name, samplers, channels });
}

function rigFile(fileName) {
  const filePath = path.join(assetDir, fileName);
  const { json, bin } = parseGlb(filePath);
  if (json.skins?.some(skin => skin.name === "NightfallCharacterSkin")) return;
  const chunks = [bin];
  json.bufferViews ||= [];
  json.accessors ||= [];
  json.nodes ||= [];
  json.skins ||= [];
  json.animations ||= [];
  const primitive = json.meshes?.[0]?.primitives?.[0];
  const positionAccessor = primitive?.attributes?.POSITION;
  if (positionAccessor == null) throw new Error(`${fileName} has no POSITION accessor`);
  const accessor = json.accessors[positionAccessor];
  const count = accessor.count;
  const positionView = json.bufferViews[accessor.bufferView];
  const positionStart = (positionView.byteOffset || 0) + (accessor.byteOffset || 0);
  const stride = positionView.byteStride || 12;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < count; index += 1) {
    const y = bin.readFloatLE(positionStart + index * stride + 4);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const span = Math.max(.001, maxY - minY);
  const joints = Buffer.alloc(count * 8);
  const weights = Buffer.alloc(count * 16);
  for (let index = 0; index < count; index += 1) {
    const y = bin.readFloatLE(positionStart + index * stride + 4);
    const ratio = (y - minY) / span;
    const joint = ratio < .38 ? 2 : ratio < .68 ? 1 : 0;
    joints.writeUInt16LE(joint, index * 8);
    weights.writeFloatLE(1, index * 16);
  }
  const jointView = appendView(json, chunks, joints, 34962);
  const weightView = appendView(json, chunks, weights, 34962);
  primitive.attributes.JOINTS_0 = addAccessor(json, jointView, count, "VEC4", 5123, [0, 0, 0, 0], [2, 0, 0, 0]);
  primitive.attributes.WEIGHTS_0 = addAccessor(json, weightView, count, "VEC4", 5126, [0, 0, 0, 0], [1, 0, 0, 0]);
  const meshNode = json.nodes.find(node => node.mesh === 0) || json.nodes[0];
  meshNode.skin = 0;
  const jointRoot = json.nodes.length;
  json.nodes.push({ name: "rig:root" }, { name: "rig:spine", translation: [0, .9, 0] }, { name: "rig:legs", translation: [0, .45, 0] });
  meshNode.children = [...(meshNode.children || []), jointRoot, jointRoot + 1, jointRoot + 2];
  const inverse = Buffer.alloc(3 * 64);
  const writeMatrix = (index, y) => {
    const base = index * 64;
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -y, 0, 1].forEach((value, offset) => inverse.writeFloatLE(value, base + offset * 4));
  };
  writeMatrix(0, 0);
  writeMatrix(1, .9);
  writeMatrix(2, .45);
  const inverseView = appendView(json, chunks, inverse);
  const inverseAccessor = addAccessor(json, inverseView, 3, "MAT4", 5126);
  json.skins.push({ name: "NightfallCharacterSkin", joints: [jointRoot, jointRoot + 1, jointRoot + 2], inverseBindMatrices: inverseAccessor });
  addClip(json, chunks, "Idle", [.02, -.02, .02], [.01, -.01, .01]);
  addClip(json, chunks, "Run", [.16, -.16, .16], [.45, -.45, .45]);
  addClip(json, chunks, "Fire", [.02, .02, -.08], [.02, .02, .02]);
  json.buffers[0].byteLength = chunks.reduce((sum, item) => sum + item.length, 0);
  fs.writeFileSync(filePath, encodeGlb(json, Buffer.concat(chunks)));
}

for (const fileName of files) rigFile(fileName);
