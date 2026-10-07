const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { WebSocket, WebSocketServer } = require("ws");
const { createBackendStore } = require("./backend/firestore-store");
const { DeviceLinkService, RateLimiter, RecoveryService, SessionService, hash } = require("./backend/security");
const { ChestAccess } = require("./backend/chest-access");

const port = Number(process.env.PORT || 8080);
const publicDirectory = path.join(__dirname, "public");
const rooms = new Map();
const clients = new Map();
const readyMatches = new Map();
const matchCountdownMs = 15000;
let matchmakingRules;
const matchmakingRulesReady = import("./public/matchmaking-rules.mjs").then(module => { matchmakingRules = module; });
const chestAccess = new ChestAccess(2);
const store = createBackendStore({ rootDirectory: __dirname });
const adminToken = process.env.ADMIN_TOKEN || "";
const sessionSecret = process.env.SESSION_SECRET || "wasteland-local-session-secret-change-before-production";
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required in production");
const sessions = new SessionService(sessionSecret);
const recovery = new RecoveryService();
const deviceLinks = new DeviceLinkService();
const sensitiveLimiter = new RateLimiter({ limit: 8, windowMs: 60000, blockMs: 300000 });
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};
const roomPattern = /^(wasteland|toxic|ice|inferno)-(?:solo|ctf-(?:4|6)|teams-(?:1v1|2v2|3v3))$/;

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function roomCapacity(room) {
  const teamRoom = matchmakingRules.parseTeamRoomId(room);
  if (teamRoom) return teamRoom.capacity;
  const parts = room.split("-");
  if (parts[1] === "ctf") return Number(parts[2] || 4);
  return 4;
}

function activeRoomSummary() {
  return [...rooms.entries()].map(([id, room]) => ({ id, players: room.size, capacity: roomCapacity(id) }));
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function readJson(request, response, callback) {
  let body = "";
  request.on("data", chunk => {
    body += chunk;
    if (body.length > 32768) request.destroy();
  });
  request.on("end", () => {
    try { callback(JSON.parse(body || "{}")); }
    catch { json(response, 400, { error: "Invalid JSON" }); }
  });
}

function adminAuthorized(request) {
  if (!adminToken) return false;
  return request.headers.authorization === `Bearer ${adminToken}`;
}

function requestKey(request, suffix = "") {
  return `${request.socket.remoteAddress || "unknown"}:${suffix}`;
}

function enforceRateLimit(request, response, suffix) {
  const result = sensitiveLimiter.check(requestKey(request, suffix));
  if (result.allowed) return true;
  response.writeHead(429, { "Content-Type": "application/json; charset=utf-8", "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)) });
  response.end(JSON.stringify({ error: "Too many attempts", retryAfterMs: result.retryAfterMs }));
  return false;
}

function sessionPlayer(request) {
  const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = sessions.verify(token);
  return payload ? store.playerById(payload.sub) : null;
}

function publicPlayer(player) {
  if (!player) return null;
  const { deviceProfileId, deviceCredentialHash, deviceCredentialHashes, ...safe } = player;
  return safe;
}

function handleApi(request, response, requestUrl) {
  if (!requestUrl.pathname.startsWith("/api/")) return false;
  if (request.method === "GET" && requestUrl.pathname === "/api/status") {
    json(response, 200, { ok: true, rooms: activeRoomSummary(), uptimeSeconds: Math.floor(process.uptime()), persistence: true, storage: store.storageType });
    return true;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/players/search") {
    json(response, 200, { players: store.findPlayer(requestUrl.searchParams.get("q") || "") });
    return true;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/players") {
    if (!enforceRateLimit(request, response, "players")) return true;
    readJson(request, response, body => {
      try {
        const existing = store.playerByDeviceProfileId(body.deviceProfileId);
        if (existing && !store.verifyDeviceCredential(existing.id, hash(body.deviceCredential || ""))) {
          json(response, 401, { error: "Device credential required" }); return;
        }
        const player = store.upsertPlayer(body);
        let deviceCredential = null;
        if (!existing) {
          deviceCredential = crypto.randomBytes(32).toString("base64url");
          store.setDeviceCredential(player.id, hash(deviceCredential));
        }
        json(response, 200, { player: publicPlayer(player), session: sessions.issue(player.id), deviceCredential });
      }
      catch (error) { json(response, 400, { error: error.message }); }
    });
    return true;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/friends") {
    const actor = sessionPlayer(request);
    if (!actor) { json(response, 401, { error: "Player session required" }); return true; }
    readJson(request, response, body => {
      try { json(response, 201, { friendship: store.addFriend(actor.id, body.friendId) }); }
      catch (error) { json(response, 400, { error: error.message }); }
    });
    return true;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/link/create") {
    const actor = sessionPlayer(request);
    if (!actor) { json(response, 401, { error: "Player session required" }); return true; }
    const link = deviceLinks.create(actor.id);
    store.audit("device-link.created", { playerId: actor.id }); store.persist();
    json(response, 201, { playerTag: actor.playerTag, code: link.code, expiresAt: new Date(link.expiresAt).toISOString() });
    return true;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/link/claim") {
    if (!enforceRateLimit(request, response, "device-link")) return true;
    readJson(request, response, body => {
      const player = store.findPlayer(body.playerTag || "").find(candidate => candidate.playerTag.toLowerCase() === String(body.playerTag || "").trim().toLowerCase());
      if (!player || !deviceLinks.claim(player.id, body.code)) {
        json(response, 400, { error: "Invalid or expired link code" }); return;
      }
      const deviceCredential = crypto.randomBytes(32).toString("base64url");
      store.setDeviceCredential(player.id, hash(deviceCredential));
      store.audit("device-link.claimed", { playerId: player.id }); store.persist();
      json(response, 200, { player: publicPlayer(store.playerById(player.id)), session: sessions.issue(player.id), deviceCredential });
    });
    return true;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/invites") {
    const actor = sessionPlayer(request);
    if (!actor) { json(response, 401, { error: "Player session required" }); return true; }
    readJson(request, response, body => {
      try { json(response, 201, { invite: store.createInvite({ ...body, fromPlayerId: actor.id }) }); }
      catch (error) { json(response, 400, { error: error.message }); }
    });
    return true;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/matches") {
    const actor = sessionPlayer(request);
    if (!actor) { json(response, 401, { error: "Player session required" }); return true; }
    readJson(request, response, body => {
      try { json(response, 201, { match: store.recordMatch({ ...body, players: [...new Set([actor.id, ...(body.players || [])])] }) }); }
      catch (error) { json(response, 400, { error: error.message }); }
    });
    return true;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/recovery/request") {
    if (!enforceRateLimit(request, response, "recovery-request")) return true;
    readJson(request, response, body => {
      const player = store.findPlayer(body.playerTag || "")[0];
      const result = { accepted: true, delivery: "not-configured" };
      if (player) {
        const challenge = recovery.create(player.id);
        store.audit("recovery.requested", { playerId: player.id }); store.persist();
        if (process.env.NODE_ENV !== "production") result.developmentToken = challenge.token;
      }
      json(response, 202, result);
    });
    return true;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/recovery/verify") {
    if (!enforceRateLimit(request, response, "recovery-verify")) return true;
    readJson(request, response, body => {
      const verified = recovery.consume(body.token);
      if (!verified) { json(response, 400, { error: "Invalid or expired recovery token" }); return; }
      json(response, 200, { session: sessions.issue(verified.playerId) });
    });
    return true;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/admin/dashboard") {
    if (!adminAuthorized(request)) json(response, 401, { error: "Administrator token required" });
    else json(response, 200, store.dashboard(activeRoomSummary()));
    return true;
  }
  json(response, 404, { error: "API endpoint not found" });
  return true;
}

function removeClient(socket) {
  const client = clients.get(socket);
  if (!client) return;
  clients.delete(socket);
  const room = rooms.get(client.room);
  if (!room) return;
  const chestStatus = chestAccess.leave(client.room, client.id);
  room.delete(client.id);
  const capacity = roomCapacity(client.room);
  const invalidatedPlan = readyMatches.delete(client.room);
  for (const peer of room.values()) send(peer, { type: "peer-left", id: client.id, capacity });
  if (invalidatedPlan) {
    for (const peer of room.values()) {
      send(peer, { type: "match-reset", reason: "player-left", departedId: client.id, humanPlayers: room.size, capacity });
    }
  }
  for (const peer of room.values()) send(peer, { type: "chest-status", ...chestStatus });
  if (!room.size) {
    rooms.delete(client.room);
  }
}

function emitMatchReady(roomName, room) {
  if (readyMatches.has(roomName)) return readyMatches.get(roomName);
  const teamRoom = matchmakingRules.parseTeamRoomId(roomName);
  if (!teamRoom) return null;
  const payload = {
    type: "match-ready",
    ...matchmakingRules.createMatchPlan(teamRoom.teamSize, [...room.keys()]),
    startsAt: Date.now() + matchCountdownMs,
  };
  readyMatches.set(roomName, payload);
  for (const peer of room.values()) send(peer, payload);
  return payload;
}

function joinRoom(socket, roomName) {
  if (!roomPattern.test(roomName)) return send(socket, { type: "error", message: "Invalid lobby" });
  removeClient(socket);
  let room = rooms.get(roomName);
  if (!room) {
    room = new Map();
    rooms.set(roomName, room);
  }
  const capacity = roomCapacity(roomName);
  if (readyMatches.has(roomName) || room.size >= capacity) return send(socket, { type: "room-full" });
  const id = crypto.randomUUID();
  const peers = [...room.keys()];
  room.set(id, socket);
  clients.set(socket, { id, room: roomName });
  send(socket, { type: "welcome", id, peers, capacity });
  for (const peer of room.values()) if (peer !== socket) send(peer, { type: "peer-joined", id, capacity });
  if (room.size === capacity) emitMatchReady(roomName, room);
}

function handleMessage(socket, raw) {
  if (raw.length > 30000) return;
  let message;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (message?.type === "join" && typeof message.room === "string") return joinRoom(socket, message.room);
  const sender = clients.get(socket);
  if (message?.type === "start-match" && sender) {
    const room = rooms.get(sender.room);
    if (room?.has(sender.id)) emitMatchReady(sender.room, room);
    return;
  }
  if (message?.type === "chest-enter" && sender) {
    const result = chestAccess.enter(sender.room, sender.id);
    send(socket, { type: "chest-access", ...result });
    const room = rooms.get(sender.room);
    for (const peer of room?.values() || []) send(peer, { type: "chest-status", occupants: result.occupants, capacity: result.capacity });
    return;
  }
  if (message?.type === "chest-leave" && sender) {
    const result = chestAccess.leave(sender.room, sender.id);
    const room = rooms.get(sender.room);
    for (const peer of room?.values() || []) send(peer, { type: "chest-status", ...result });
    return;
  }
  if (message?.type !== "signal" || typeof message.to !== "string" || !message.data) return;
  if (!sender) return;
  const room = rooms.get(sender.room);
  const recipient = room?.get(message.to);
  if (recipient) send(recipient, { type: "signal", from: sender.id, data: message.data });
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (handleApi(request, response, requestUrl)) return;
  if (requestUrl.pathname === "/room-status") {
    const roomName = requestUrl.searchParams.get("room") || "";
    if (!roomPattern.test(roomName)) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Invalid room" }));
      return;
    }
    const room = rooms.get(roomName);
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ room: roomName, players: room?.size || 0, capacity: roomCapacity(roomName) }));
    return;
  }
  if (requestUrl.pathname === "/healthz") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, persistence: true, storage: store.storageType, rooms: rooms.size }));
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(publicDirectory, `.${pathname}`);
  if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }
  fs.readFile(filePath, (error, file) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; media-src 'self' blob:",
      "Permissions-Policy": "microphone=(self), geolocation=(), camera=()",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    response.end(file);
  });
}

const server = http.createServer(serveStatic);
const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 32768 });

server.on("upgrade", (request, socket, head) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (requestUrl.pathname !== "/signal") return socket.destroy();
  const origin = request.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.host) return socket.destroy();
    } catch {
      return socket.destroy();
    }
  }
  websocketServer.handleUpgrade(request, socket, head, websocket => websocketServer.emit("connection", websocket));
});

websocketServer.on("connection", socket => {
  socket.on("message", raw => handleMessage(socket, raw));
  socket.on("close", () => removeClient(socket));
  socket.on("error", () => removeClient(socket));
});

Promise.all([store.ready, matchmakingRulesReady])
  .then(() => server.listen(port, "0.0.0.0", () => console.log(`Wasteland Survivor listening on ${port} with ${store.storageType} storage`)))
  .catch(error => {
    console.error("Backend storage failed to initialize", error);
    process.exitCode = 1;
  });
