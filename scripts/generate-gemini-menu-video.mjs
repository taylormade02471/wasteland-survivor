import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "veo-3.1-fast-generate-preview";
const POLL_INTERVAL_MS = 10_000;
const MAX_WAIT_MS = 20 * 60_000;

function getArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function mimeTypeFor(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "image/png";
}

async function googleRequest(path, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not available in this process.");
  const response = await fetch(`${BASE_URL}/${path}`, {
    ...options,
    headers: {
      "x-goog-api-key": apiKey,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google video request failed (${response.status}): ${detail.slice(0, 1200)}`);
  }
  return response;
}

async function downloadVideo(uri, destination) {
  const apiKey = process.env.GEMINI_API_KEY;
  const response = await fetch(uri, {
    headers: { "x-goog-api-key": apiKey },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Google video download failed (${response.status}).`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

const imagePath = resolve(getArg("image", "public/assets/nightfall/backgrounds/nightfall-six-survivors-v2.png"));
const outputPath = resolve(getArg("output", "public/assets/nightfall/video/nightfall-water-walk-v1.mp4"));
const model = getArg("model", DEFAULT_MODEL);
const prompt = getArg("prompt", [
  "Cinematic realistic 3D game footage using the supplied frame as the exact opening composition.",
  "The central survivor walks forward alone through shallow radioactive floodwater while the other five survivors remain farther behind and subtly fall out of focus.",
  "Heavy boots push through the water with believable splashes and ripples. Wet fabric, armor straps, smoke, ash, toxic green mist, distant fires, and water reflections move naturally.",
  "The camera performs a very slow stable backward tracking move at chest height, keeping the central survivor framed for a premium action-game menu.",
  "Preserve the survivor's identity, clothing, equipment, proportions, ruined city, bright storm-break lighting, and teen-safe tone.",
  "No dialogue, no captions, no logo, no UI, no new people, no disappearing characters, no camera shake, no cuts, no gore.",
  "End on a composition and body stride visually close to the opening so the clip can crossfade into a seamless looping hero background.",
].join(" "));

const imageBytes = await readFile(imagePath);
const requestBody = {
  instances: [{
    prompt,
    image: {
      mimeType: mimeTypeFor(imagePath),
      bytesBase64Encoded: imageBytes.toString("base64"),
    },
  }],
  parameters: {
    aspectRatio: "16:9",
    durationSeconds: 8,
    sampleCount: 1,
    personGeneration: "allow_adult",
    resolution: "720p",
  },
};

console.log(`Submitting ${basename(imagePath)} to ${model}...`);
const submitResponse = await googleRequest(`models/${model}:predictLongRunning`, {
  method: "POST",
  body: JSON.stringify(requestBody),
});
let operation = await submitResponse.json();
if (!operation.name) throw new Error(`Google did not return an operation name: ${JSON.stringify(operation)}`);

const deadline = Date.now() + MAX_WAIT_MS;
while (!operation.done && Date.now() < deadline) {
  await new Promise(resolveDelay => setTimeout(resolveDelay, POLL_INTERVAL_MS));
  const pollResponse = await googleRequest(operation.name);
  operation = await pollResponse.json();
  process.stdout.write(".");
}
process.stdout.write("\n");

if (!operation.done) throw new Error(`Video generation exceeded ${MAX_WAIT_MS / 60_000} minutes. Operation: ${operation.name}`);
if (operation.error) throw new Error(`Google video generation failed: ${JSON.stringify(operation.error)}`);

const sample = operation.response?.generateVideoResponse?.generatedSamples?.[0];
const videoUri = sample?.video?.uri;
if (!videoUri) throw new Error(`Completed operation contained no downloadable video: ${JSON.stringify(operation)}`);

await downloadVideo(videoUri, outputPath);
const receiptPath = outputPath.replace(/\.mp4$/i, ".generation.json");
await writeFile(receiptPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  model,
  operationName: operation.name,
  sourceImage: imagePath,
  output: outputPath,
  prompt,
}, null, 2));

console.log(`Saved video: ${outputPath}`);
console.log(`Saved receipt: ${receiptPath}`);
