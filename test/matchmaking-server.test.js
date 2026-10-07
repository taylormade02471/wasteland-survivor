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

test("server queues a replacement until every current player readies for the rematch", async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-matchmaking-"));
  const port = await availablePort();
  const server = await startServer(port, path.join(tempDirectory, "state.json"));
  const clients = [];
  t.after(async () => {
    await Promise.all(clients.map(closeClient));
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const room = "ice-teams-1v1";
  const incumbent = await connectClient(port, room);
  const departed = await connectClient(port, room);
  clients.push(incumbent, departed);
  const [initialIncumbentPlan, initialDepartedPlan] = await Promise.all([
    waitForMessage(incumbent, "match-ready"),
    waitForMessage(departed, "match-ready"),
  ]);
  assert.equal(initialIncumbentPlan.startsAt, initialDepartedPlan.startsAt);
  assert.ok(initialIncumbentPlan.startsAt >= Date.now() + 13_000);
  assert.equal(initialIncumbentPlan.generation, 1);
  assert.equal(initialIncumbentPlan.humanPlayers, 2);
  assert.equal(initialIncumbentPlan.botPlayers, 0);

  incumbent.socket.send(JSON.stringify({ type: "start-match" }));
  await wait(75);
  assert.equal(incumbent.messages.filter(message => message.type === "match-ready").length, 1);
  assert.equal(departed.messages.filter(message => message.type === "match-ready").length, 1);

  await closeClient(departed);
  const reset = await waitForMessage(incumbent, "match-reset");
  assert.equal(reset.departedId, departed.id);
  assert.equal(reset.humanPlayers, 1);
  assert.equal(reset.awaitingRematch, true);

  const replacement = await connectClient(port, room);
  clients.push(replacement);
  assert.equal(replacement.messages[0].type, "welcome");
  await wait(100);
  assert.equal(incumbent.messages.filter(message => message.type === "match-ready").length, 1);
  assert.equal(replacement.messages.filter(message => message.type === "match-ready").length, 0);

  replacement.socket.send(JSON.stringify({ type: "start-match" }));
  const waiting = await waitForMessage(replacement, "match-waiting", message => message.readyPlayers === 1);
  assert.equal(waiting.humanPlayers, 2);
  await wait(100);
  assert.equal(incumbent.messages.filter(message => message.type === "match-ready").length, 1);
  assert.equal(replacement.messages.filter(message => message.type === "match-ready").length, 0);

  incumbent.socket.send(JSON.stringify({ type: "start-match" }));
  const [freshIncumbentPlan, freshReplacementPlan] = await Promise.all([
    waitForMessage(incumbent, "match-ready", message => message.generation === 2),
    waitForMessage(replacement, "match-ready", message => message.generation === 2),
  ]);
  assert.equal(freshIncumbentPlan.startsAt, freshReplacementPlan.startsAt);
  assert.equal(freshIncumbentPlan.humanPlayers, 2);
  assert.equal(freshIncumbentPlan.botPlayers, 0);
  assert.ok(freshIncumbentPlan.slots.some(slot => slot.playerId === replacement.id));
  assert.ok(freshIncumbentPlan.slots.every(slot => slot.playerId !== departed.id));

  const soloStarter = await connectClient(port, "toxic-teams-2v2");
  clients.push(soloStarter);
  soloStarter.socket.send(JSON.stringify({ type: "start-match" }));
  const underfilledPlan = await waitForMessage(soloStarter, "match-ready");
  assert.equal(underfilledPlan.generation, 1);
  assert.equal(underfilledPlan.humanPlayers, 1);
  assert.equal(underfilledPlan.botPlayers, 3);
});
