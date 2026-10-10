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

async function roomStatus(port, room) {
  const response = await fetch(`http://127.0.0.1:${port}/room-status?room=${encodeURIComponent(room)}`);
  assert.equal(response.status, 200);
  return response.json();
}

function closeClient(client) {
  if (!client || client.socket.readyState === WebSocket.CLOSED) return Promise.resolve();
  return new Promise(resolve => {
    client.socket.once("close", resolve);
    client.socket.close();
  });
}

test("rejecting a join into an active room preserves the current client's source membership", async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-join-reconnect-"));
  const port = await availablePort();
  const server = await startServer(port, path.join(tempDirectory, "state.json"));
  const clients = [];
  t.after(async () => {
    await Promise.all(clients.map(closeClient));
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const sourceRoom = "immersive-teams-4v4";
  const activeDestination = "immersive-ffa-6";
  const sourceClient = await connectClient(port, sourceRoom);
  const destinationClient = await connectClient(port, activeDestination);
  clients.push(sourceClient, destinationClient);

  destinationClient.socket.send(JSON.stringify({ type: "start-match" }));
  const destinationPlan = await waitForMessage(destinationClient, "match-ready");
  assert.equal(destinationPlan.mode, "ffa");

  sourceClient.socket.send(JSON.stringify({ type: "join", room: activeDestination }));
  await waitForMessage(sourceClient, "room-full");
  await wait(100);

  assert.equal((await roomStatus(port, sourceRoom)).players, 1);
  assert.equal((await roomStatus(port, activeDestination)).players, 1);
});

test("server starts a six-player FFA with individual slots and no team assignment", async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-ffa-full-"));
  const port = await availablePort();
  const server = await startServer(port, path.join(tempDirectory, "state.json"));
  const clients = [];
  t.after(async () => {
    await Promise.all(clients.map(closeClient));
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  for (let index = 0; index < 6; index += 1) clients.push(await connectClient(port, "immersive-ffa-6"));
  const plans = await Promise.all(clients.map(client => waitForMessage(client, "match-ready")));
  const plan = plans[0];

  assert.ok(plans.every(candidate => candidate.startsAt === plan.startsAt));
  assert.equal(plan.mode, "ffa");
  assert.equal(plan.capacity, 6);
  assert.equal(plan.humanPlayers, 6);
  assert.equal(plan.botPlayers, 0);
  assert.equal(plan.slots.length, 6);
  assert.ok(plan.slots.every(slot => slot.playerType === "human" && slot.team === "free-for-all"));
  assert.ok(plan.slots.every(slot => slot.team !== "alpha" && slot.team !== "bravo"));
  assert.equal(new Set(plan.slots.map(slot => slot.playerId)).size, 6);
});

test("an underfilled FFA waits 45 seconds before filling five bot seats", { timeout: 50_000 }, async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-ffa-underfill-"));
  const port = await availablePort();
  const server = await startServer(port, path.join(tempDirectory, "state.json"));
  const clients = [];
  t.after(async () => {
    await Promise.all(clients.map(closeClient));
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const solo = await connectClient(port, "immersive-ffa-6");
  clients.push(solo);
  await wait(250);
  assert.equal(solo.messages.some(message => message.type === "match-ready"), false);

  const plan = await waitForMessage(solo, "match-ready", () => true, 46_000);
  assert.equal(plan.mode, "ffa");
  assert.equal(plan.capacity, 6);
  assert.equal(plan.humanPlayers, 1);
  assert.equal(plan.botPlayers, 5);
  assert.equal(plan.slots.filter(slot => slot.playerType === "human").length, 1);
  assert.equal(plan.slots.filter(slot => slot.playerType === "bot").length, 5);
  assert.ok(plan.slots.every(slot => slot.team === "free-for-all"));
  assert.ok(plan.slots.every(slot => slot.team !== "alpha" && slot.team !== "bravo"));
  assert.ok(plan.startsAt >= Date.now() + 13_000);
});

test("lobby reaches match-ready, a fifteen-second countdown, active room, and return to lobby", async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-lifecycle-"));
  const port = await availablePort();
  const server = await startServer(port, path.join(tempDirectory, "state.json"));
  const clients = [];
  t.after(async () => {
    await Promise.all(clients.map(closeClient));
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const { reduceClientMatchLifecycle } = await import("../public/matchmaking-client.mjs");
  const { resolveMatchCountdown } = await import("../public/matchmaking-rules.mjs");
  const room = "immersive-teams-4v4";
  const first = await connectClient(port, room);
  const second = await connectClient(port, room);
  clients.push(first, second);
  assert.equal((await roomStatus(port, room)).players, 2);

  first.socket.send(JSON.stringify({ type: "start-match" }));
  const [firstPlan, secondPlan] = await Promise.all([
    waitForMessage(first, "match-ready"),
    waitForMessage(second, "match-ready"),
  ]);
  assert.equal(firstPlan.startsAt, secondPlan.startsAt);
  assert.ok(firstPlan.startsAt >= Date.now() + 13_000);

  const countdownTransition = reduceClientMatchLifecycle({
    phase: "loadout",
    activeMatchPlan: null,
    awaitingRematch: true,
  }, firstPlan);
  assert.equal(countdownTransition.action, "start-countdown");
  assert.equal(resolveMatchCountdown(firstPlan.startsAt, firstPlan.startsAt - 15_000).secondsRemaining, 15);
  assert.equal(resolveMatchCountdown(firstPlan.startsAt, firstPlan.startsAt).expired, true);
  assert.equal((await roomStatus(port, room)).players, 2);

  await closeClient(second);
  const reset = await waitForMessage(first, "match-reset");
  assert.equal(reset.awaitingRematch, true);
  assert.equal((await roomStatus(port, room)).players, 1);

  await closeClient(first);
  await wait(100);
  assert.equal((await roomStatus(port, room)).players, 0);
});

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

  const room = "immersive-teams-4v4";
  const incumbent = await connectClient(port, room);
  const departed = await connectClient(port, room);
  clients.push(incumbent, departed);
  incumbent.socket.send(JSON.stringify({ type: "start-match" }));
  const [initialIncumbentPlan, initialDepartedPlan] = await Promise.all([
    waitForMessage(incumbent, "match-ready"),
    waitForMessage(departed, "match-ready"),
  ]);
  assert.equal(initialIncumbentPlan.startsAt, initialDepartedPlan.startsAt);
  assert.ok(initialIncumbentPlan.startsAt >= Date.now() + 13_000);
  assert.equal(initialIncumbentPlan.generation, 1);
  assert.equal(initialIncumbentPlan.humanPlayers, 2);
  assert.equal(initialIncumbentPlan.botPlayers, 6);

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
  assert.equal(freshIncumbentPlan.botPlayers, 6);
  assert.ok(freshIncumbentPlan.slots.some(slot => slot.playerId === replacement.id));
  assert.ok(freshIncumbentPlan.slots.every(slot => slot.playerId !== departed.id));

  await closeClient(incumbent);
  await closeClient(replacement);
  const soloStarter = await connectClient(port, "immersive-teams-4v4");
  clients.push(soloStarter);
  soloStarter.socket.send(JSON.stringify({ type: "start-match" }));
  const underfilledPlan = await waitForMessage(soloStarter, "match-ready");
  assert.equal(underfilledPlan.generation, 1);
  assert.equal(underfilledPlan.humanPlayers, 1);
  assert.equal(underfilledPlan.botPlayers, 7);
});
