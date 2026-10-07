const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { WebSocket } = require("ws");

const root = path.resolve(__dirname, "..");
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

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
    cwd: root,
    env: { ...process.env, PORT: String(port), DATA_FILE: dataFile, NODE_ENV: "test" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server startup timed out\n${output}`)), 4000);
    const inspect = () => {
      if (!output.includes("Wasteland Survivor listening")) return;
      clearTimeout(timeout);
      resolve(child);
    };
    child.stdout.on("data", inspect);
    child.once("exit", code => {
      clearTimeout(timeout);
      reject(new Error(`server exited with ${code}\n${output}`));
    });
  });
}

function connectClient(port, room) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/signal`);
    const events = new EventEmitter();
    const messages = [];
    const timeout = setTimeout(() => reject(new Error(`client did not join ${room}`)), 3000);
    const client = { socket, messages, events, id: null };
    socket.once("error", reject);
    socket.once("open", () => socket.send(JSON.stringify({ type: "join", room })));
    socket.on("message", raw => {
      const message = JSON.parse(raw);
      messages.push(message);
      events.emit("message", message);
      if (message.type === "welcome") {
        clearTimeout(timeout);
        client.id = message.id;
        resolve(client);
      }
    });
  });
}

function waitForMessage(client, type, predicate = () => true, timeoutMs = 3000) {
  const existing = client.messages.find(message => message.type === type && predicate(message));
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.events.off("message", inspect);
      reject(new Error(`timed out waiting for ${type}: ${JSON.stringify(client.messages)}`));
    }, timeoutMs);
    const inspect = message => {
      if (message.type !== type || !predicate(message)) return;
      clearTimeout(timeout);
      client.events.off("message", inspect);
      resolve(message);
    };
    client.events.on("message", inspect);
  });
}

function closeClient(client) {
  if (!client || client.socket.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise(resolve => {
    client.socket.once("close", resolve);
    client.socket.close();
  });
}

test("server synchronizes starts and rebuilds a ready room after disconnect", async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-matchmaking-"));
  const port = await availablePort();
  const server = await startServer(port, path.join(tempDirectory, "state.json"));
  const clients = [];
  t.after(async () => {
    await Promise.all(clients.map(closeClient));
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const fullOne = await connectClient(port, "ice-teams-1v1");
  const fullTwo = await connectClient(port, "ice-teams-1v1");
  clients.push(fullOne, fullTwo);
  const [fullReadyOne, fullReadyTwo] = await Promise.all([
    waitForMessage(fullOne, "match-ready"),
    waitForMessage(fullTwo, "match-ready"),
  ]);
  assert.equal(fullReadyOne.startsAt, fullReadyTwo.startsAt);
  assert.ok(fullReadyOne.startsAt >= Date.now() + 13_000);
  assert.equal(fullReadyOne.humanPlayers, 2);
  assert.equal(fullReadyOne.botPlayers, 0);
  fullOne.socket.send(JSON.stringify({ type: "start-match" }));
  await wait(75);
  assert.equal(fullOne.messages.filter(message => message.type === "match-ready").length, 1);
  assert.equal(fullTwo.messages.filter(message => message.type === "match-ready").length, 1);

  const room = "toxic-teams-2v2";
  const originalOne = await connectClient(port, room);
  const departed = await connectClient(port, room);
  clients.push(originalOne, departed);
  originalOne.socket.send(JSON.stringify({ type: "start-match" }));
  const originalPlan = await waitForMessage(originalOne, "match-ready");
  assert.equal(originalPlan.humanPlayers, 2);

  await closeClient(departed);
  const reset = await waitForMessage(originalOne, "match-reset");
  assert.equal(reset.departedId, departed.id);
  assert.equal(reset.humanPlayers, 1);

  const replacement = await connectClient(port, room);
  clients.push(replacement);
  assert.equal(replacement.messages[0].type, "welcome");
  originalOne.socket.send(JSON.stringify({ type: "start-match" }));
  const freshPlan = await waitForMessage(originalOne, "match-ready", message => message.startsAt !== originalPlan.startsAt);
  const replacementPlan = await waitForMessage(replacement, "match-ready");
  assert.equal(freshPlan.startsAt, replacementPlan.startsAt);
  assert.equal(freshPlan.humanPlayers, 2);
  assert.ok(freshPlan.slots.some(slot => slot.playerId === replacement.id));
  assert.ok(freshPlan.slots.every(slot => slot.playerId !== departed.id));
});
