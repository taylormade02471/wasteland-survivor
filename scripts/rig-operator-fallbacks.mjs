import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = path.join(repo, "public", "assets", "nightfall", "characters", "3d");
const files = ["scout", "ranger", "heavy", "tech", "medic", "warden"].map(id => `${id}-operator-v1.glb`);
const align4 = value => (value + 3) & ~3;

function parse(filePath) {
  const source = fs.readFileSync(filePath);
  const length = source.readUInt32LE(12);
  const json = JSON.parse(source.toString("utf8", 20, 20 + length).trim());
  const binOffset = 20 + align4(length);
  const binLength = source.readUInt32LE(binOffset);
  return { json, bin: Buffer.from(source.subarray(binOffset + 8, binOffset + 8 + binLength)) };
}

function encode(json, bin) {
  const rawJson = JSON.stringify(json);
  const jsonBytes = Buffer.from(rawJson.padEnd(align4(Buffer.byteLength(rawJson)), " "));
  const binBytes = Buffer.concat([bin, Buffer.alloc(align4(bin.length) - bin.length)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + binBytes.length, 8);
  const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(jsonBytes.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binBytes.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonBytes, binHeader, binBytes]);
}

function matrixFromNode(node = {}) {
  if (node.matrix) return [...node.matrix];
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const tx = node.translation?.[0] || 0, ty = node.translation?.[1] || 0, tz = node.translation?.[2] || 0;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * sx, (2 * (xy + wz)) * sx, (2 * (xz - wy)) * sx, 0,
    (2 * (xy - wz)) * sy, (1 - 2 * (xx + zz)) * sy, (2 * (yz + wx)) * sy, 0,
    (2 * (xz + wy)) * sz, (2 * (yz - wx)) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function inverseMatrix(m) {
  const out = new Array(16);
  const [a, b, c, d, e, f, g, h, i, j, k, l, m4, n, o, p] = m;
  const q = a * f - b * e, r = a * g - c * e, s = a * h - d * e, t = b * g - c * f, u = b * h - d * f, v = c * h - d * g;
  const w = i * n - j * m4, x = i * o - k * m4, y = i * p - l * m4, z = j * o - k * n, aa = j * p - l * n, ab = k * p - l * o;
  const determinant = q * ab - r * aa + s * z + t * y - u * x + v * w;
  if (!determinant) return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  out[0] = (f * ab - g * aa + h * z) / determinant; out[1] = (-b * ab + c * aa - d * z) / determinant;
  out[2] = (n * v - o * u + p * t) / determinant; out[3] = (-j * v + k * u - l * t) / determinant;
  out[4] = (-e * ab + g * y - h * x) / determinant; out[5] = (a * ab - c * y + d * x) / determinant;
  out[6] = (-n * r + o * q - p * s) / determinant; out[7] = (j * r - k * q + l * s) / determinant;
  out[8] = (e * aa - f * y + h * w) / determinant; out[9] = (-a * aa + b * y - d * w) / determinant;
  out[10] = (m4 * u - o * t + p * r) / determinant; out[11] = (-i * u + k * t - l * r) / determinant;
  out[12] = (-e * z + f * x - g * w) / determinant; out[13] = (a * z - b * x + c * w) / determinant;
  out[14] = (-m4 * v + n * u - o * t) / determinant; out[15] = (i * v - j * u + k * t) / determinant;
  return out;
}

function append(json, chunks, bytes, target) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const offset = align4(length);
  if (offset > length) chunks.push(Buffer.alloc(offset - length));
  chunks.push(bytes);
  const view = { buffer: 0, byteOffset: offset, byteLength: bytes.length };
  if (target) view.target = target;
  return json.bufferViews.push(view) - 1;
}

function accessor(json, view, count, type, componentType) {
  return json.accessors.push({ bufferView: view, count, type, componentType }) - 1;
}

function addClip(json, chunks, name, jointIndices, axis, angles) {
  const times = Buffer.alloc(12);
  [0, 1, 2].forEach((value, index) => times.writeFloatLE(value, index * 4));
  const input = accessor(json, append(json, chunks, times), 3, "SCALAR", 5126);
  const samplers = [], channels = [];
  for (const joint of jointIndices.slice(0, 2)) {
    const values = Buffer.alloc(48);
    angles.forEach((angle, index) => {
      const half = angle / 2, s = Math.sin(half), c = Math.cos(half);
      const quaternion = axis === "x" ? [s, 0, 0, c] : [0, 0, s, c];
      quaternion.forEach((value, component) => values.writeFloatLE(value, (index * 4 + component) * 4));
    });
    const output = accessor(json, append(json, chunks, values), 3, "VEC4", 5126);
    const sampler = samplers.push({ input, output, interpolation: "LINEAR" }) - 1;
    channels.push({ sampler, target: { node: joint, path: "rotation" } });
  }
  json.animations.push({ name, samplers, channels });
}

function rig(fileName) {
  const filePath = path.join(assetDir, fileName);
  const { json, bin } = parse(filePath);
  if (json.skins?.some(skin => skin.name === "NightfallOperatorSkin")) return;
  json.accessors ||= []; json.bufferViews ||= []; json.skins ||= []; json.animations ||= [];
  const meshNodes = json.nodes.map((node, index) => ({ node, index })).filter(item => item.node.mesh != null);
  const rootIndex = json.scenes?.[0]?.nodes?.[0] ?? json.nodes.length - 1;
  const chunks = [bin];
  const jointIndices = [];
  const skinIndices = [];
  for (const { node } of meshNodes) {
    const jointIndex = json.nodes.length;
    json.nodes.push({ name: `rig:${node.name || `mesh-${node.mesh}`}`, ...Object.fromEntries(["matrix", "translation", "rotation", "scale"].filter(key => node[key] != null).map(key => [key, node[key]])) });
    json.nodes[rootIndex].children = [...(json.nodes[rootIndex].children || []), jointIndex];
    jointIndices.push(jointIndex);
    const matrix = Buffer.alloc(64);
    inverseMatrix(matrixFromNode(node)).forEach((value, offset) => matrix.writeFloatLE(value, offset * 4));
    const inverse = accessor(json, append(json, chunks, matrix), 1, "MAT4", 5126);
    const skinIndex = json.skins.push({ name: `NightfallOperatorSkin:${node.name || node.mesh}`, joints: [jointIndex], inverseBindMatrices: inverse }) - 1;
    skinIndices.push(skinIndex);
  }
  meshNodes.forEach(({ node }, meshPosition) => {
    node.skin = skinIndices[meshPosition];
    const mesh = json.meshes[node.mesh];
    for (const primitive of mesh.primitives || []) {
      const position = json.accessors[primitive.attributes.POSITION];
      const joints = Buffer.alloc(position.count * 8);
      const weights = Buffer.alloc(position.count * 16);
      for (let index = 0; index < position.count; index += 1) {
        joints.writeUInt16LE(0, index * 8);
        weights.writeFloatLE(1, index * 16);
      }
      primitive.attributes.JOINTS_0 = accessor(json, append(json, chunks, joints, 34962), position.count, "VEC4", 5123);
      primitive.attributes.WEIGHTS_0 = accessor(json, append(json, chunks, weights, 34962), position.count, "VEC4", 5126);
    }
  });
  const named = fragment => meshNodes.filter(({ node }) => String(node.name || "").toLowerCase().includes(fragment)).map((_, index) => jointIndices[index]);
  addClip(json, chunks, "Idle", named("torso").concat(jointIndices), "z", [.02, -.02, .02]);
  addClip(json, chunks, "Run", named("leg").concat(named("torso"), jointIndices), "x", [.25, -.25, .25]);
  addClip(json, chunks, "Fire", named("arm").concat(named("torso"), jointIndices), "z", [.03, -.05, .03]);
  json.buffers[0].byteLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  fs.writeFileSync(filePath, encode(json, Buffer.concat(chunks)));
}

for (const fileName of files) rig(fileName);
