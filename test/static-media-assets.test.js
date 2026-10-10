import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function startServer(port, dataFile) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, PORT: String(port), DATA_FILE: dataFile, NODE_ENV: "test" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server startup timed out\n${output}`)), 5000);
    child.stdout.on("data", () => {
      if (!output.includes("Wasteland Survivor listening")) return;
      clearTimeout(timeout);
      resolve(child);
    });
    child.once("exit", code => {
      clearTimeout(timeout);
      reject(new Error(`server exited with ${code}\n${output}`));
    });
  });
}

test("static media keeps browser-playable audio and video content types", async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-static-media-"));
  const port = await availablePort();
  const server = await startServer(port, path.join(tempDirectory, "state.json"));
  t.after(() => {
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const media = [
    ["/assets/nightfall/audio/nightfall-ambient-v1.mp3", "audio/mpeg"],
    ["/assets/nightfall/video/nightfall-water-walk-v1.mp4", "video/mp4"],
    ["/assets/nightfall/characters/3d/scout-operator-v1.glb", "model/gltf-binary"],
  ];
  for (const [pathname, type] of media) {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get("content-type") || "", new RegExp(`^${type}`), pathname);
  }
});
