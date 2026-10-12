const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { WebSocket, WebSocketServer } = require("ws");
const { createBackendStore } = require("./backend/firestore-store");
const { RateLimiter, SessionService, hash } = require("./backend/security");
const { PhoneAuthError, createPhoneAuthService } = require("./backend/phone-auth");
const { ChestAccess } = require("./backend/chest-access");

const port = Number(process.env.PORT || 8080);
const publicDirectory = path.join(__dirname, "public");
const rooms = new Map();
const clients = new Map();
const roomMatchStates = new Map();
const matchCountdownMs = 15000;
let matchmakingRules;
const matchmakingRulesReady = import("./public/matchmaking-rules.mjs").then(module => { matchmakingRules = module; });
const chestAccess = new ChestAccess(2);
const store = createBackendStore({ rootDirectory: __dirname });
const adminToken = process.env.ADMIN_TOKEN || "";
// A production secret keeps sessions durable across function instances. When a
// preview is missing that configuration, keep the game reachable with a
// process-local secret rather than crashing the entire public app at startup.
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(48).toString("base64url");
const sessions = new SessionService(sessionSecret);
const phoneAuth = createPhoneAuthService(process.env, { consumeTokenUse: claim => store.consumePhoneAuthToken(claim) });
const sensitiveLimiter = new RateLimiter({ limit: 8, windowMs: 60000, blockMs: 300000 });
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".glb": "model/gltf-binary"
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

function matchStateFor(roomName) {
  if (!matchmakingRules.parseTeamRoomId(roomName)) return null;
  let state = roomMatchStates.get(roomName);
  if (!state) {
    state = { phase: "forming", generation: 0, readyPlayerIds: new Set(), payload: null };
    roomMatchStates.set(roomName, state);
  }
  return state;
}

function notifyMatchWaiting(roomName, room, reason = "waiting-for-players") {
  const state = roomMatchStates.get(roomName);
  if (!state || state.phase !== "awaiting-rematch") return;
  const payload = {
    type: "match-waiting",
    reason,
    awaitingRematch: true,
    readyPlayers: state.readyPlayerIds.size,
    humanPlayers: room.size,
    capacity: roomCapacity(roomName),
  };
  for (const peer of room.values()) send(peer, payload);
}

function activeRoomSummary() {
  return [...rooms.entries()].map(([id, room]) => ({ id, players: room.size, capacity: roomCapacity(id) }));
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function normalizeMediaBase(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const base = raw.replace(/\/+$/, "");
  const isBucketName = candidate => /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(candidate);
  if (base.startsWith("gs://")) {
    try {
      const url = new URL(base);
      if (!isBucketName(url.hostname) || url.username || url.password || url.port || url.search || url.hash) return "";
      return `https://storage.googleapis.com/${url.hostname}${url.pathname}`.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }
  if (isBucketName(base)) return `https://storage.googleapis.com/${base}`;
  try {
    const url = new URL(base);
    return url.protocol === "https:" ? url.toString().replace(/\/+$/, "") : "";
  } catch {
    return "";
  }
}

function mediaConfig() {
  const requestedVersion = String(process.env.GAME_MEDIA_VERSION || "nightfall-v2").trim() || "nightfall-v2";
  const version = requestedVersion.toLowerCase() === "nightfall-v1" ? "nightfall-v2" : requestedVersion;
  const configuredBaseUrl = normalizeMediaBase(
    process.env.GAME_MEDIA_BASE_URL ||
      process.env.PUBLIC_MEDIA_BASE_URL ||
      process.env.GOOGLE_CLOUD_STORAGE_BASE_URL ||
      process.env.GOOGLE_CLOUD_STORAGE_BUCKET ||
      process.env.GENMEDIA_BUCKET,
  );
  const baseUrl = configuredBaseUrl.replace(/\/nightfall-v\d+$/i, `/${version}`);
  return { baseUrl, version, external: Boolean(baseUrl), fallback: "/assets" };
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

function sessionPlayerId(request) {
  const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = sessions.verify(token);
  return payload?.sub || "";
}

function sessionPlayer(request) {
  const playerId = sessionPlayerId(request);
  return playerId ? store.playerById(playerId) : null;
}

function publicPlayer(player) {
  if (!player) return null;
  const { deviceProfileId, deviceProfileIds, deviceCredentialHash, deviceCredentialHashes, ...safe } = player;
  return safe;
}

function configuredFirebaseAuthDomain() {
  const raw = String(process.env.FIREBASE_AUTH_DOMAIN || "").trim();
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(raw)) return null;
  try {
    const parsed = new URL(`https://${raw}`);
    if (!parsed.hostname || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) return null;
    return { domain: parsed.host, origin: parsed.origin };
  } catch {
    return null;
  }
}

function phoneClientConfig() {
  const authDomain = configuredFirebaseAuthDomain();
  const enabled = phoneAuth.configured
    && Boolean(process.env.FIREBASE_WEB_API_KEY)
    && Boolean(authDomain)
    && Boolean(process.env.FIREBASE_PROJECT_ID);
  if (!enabled) return { enabled: false };
  const result = {
    enabled: true,
    sdkVersion: process.env.FIREBASE_WEB_SDK_VERSION || "11.10.0",
    firebaseConfig: {
      apiKey: process.env.FIREBASE_WEB_API_KEY,
      authDomain: authDomain.domain,
      projectId: process.env.FIREBASE_PROJECT_ID,
      appId: process.env.FIREBASE_APP_ID || undefined,
    },
  };
  if (process.env.NODE_ENV !== "production" && process.env.FIREBASE_AUTH_EMULATOR_URL) result.authEmulatorUrl = process.env.FIREBASE_AUTH_EMULATOR_URL;
  return result;
}

function contentSecurityPolicy() {
  const config = phoneClientConfig();
  const scripts = ["'self'", "https://cdn.jsdelivr.net"];
  const connections = ["'self'", "ws:", "wss:", "https://storage.googleapis.com"];
  const directives = ["default-src 'self'"];
  if (config.enabled) {
    const authOrigin = `https://${config.firebaseConfig.authDomain}`;
    scripts.push("https://www.gstatic.com", "https://www.google.com");
    connections.push(
      authOrigin,
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://www.googleapis.com",
      "https://www.google.com",
      "https://recaptcha.google.com",
    );
    directives.push(`script-src ${scripts.join(" ")}`);
    directives.push("style-src 'self'");
    directives.push(`connect-src ${connections.join(" ")}`);
    directives.push("img-src 'self' data: https://storage.googleapis.com");
    directives.push("media-src 'self' blob: https://storage.googleapis.com");
    directives.push(`frame-src 'self' ${authOrigin} https://www.google.com https://recaptcha.google.com`);
    return directives.join("; ");
  }
  directives.push(`script-src ${scripts.join(" ")}`);
  directives.push("style-src 'self'");
  directives.push(`connect-src ${connections.join(" ")}`);
  directives.push("img-src 'self' data: https://storage.googleapis.com");
  directives.push("media-src 'self' blob: https://storage.googleapis.com");
  return directives.join("; ");
}

function handleApi(request, response, requestUrl) {
  if (!requestUrl.pathname.startsWith("/api/")) return false;
  if ((request.method === "GET" || request.method === "HEAD") && requestUrl.pathname === "/api/media-config") {
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    });
    response.end(JSON.stringify(mediaConfig()));
    return true;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/status") {
    json(response, 200, { ok: true, rooms: activeRoomSummary(), uptimeSeconds: Math.floor(process.uptime()), persistence: true, storage: store.storageType });
    return true;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/phone/config") {
    json(response, 200, phoneClientConfig());
    return true;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/account/phone") {
    if (!enforceRateLimit(request, response, "phone-account")) return true;
    readJson(request, response, async body => {
      try {
        const verified = await phoneAuth.verify(body.idToken);
        const deviceCredential = crypto.randomBytes(32).toString("base64url");
        const source = body.player && typeof body.player === "object" ? body.player : {};
        const linked = await store.linkVerifiedPhoneAccount({
          providerUid: verified.providerUid,
          phoneHint: verified.phoneHint,
          deviceProfileId: body.deviceProfileId,
          ownershipCredentialHash: hash(body.deviceCredential || ""),
          sessionPlayerId: sessionPlayerId(request),
          newDeviceCredentialHash: hash(deviceCredential),
          player: {
            playerTag: source.playerTag,
            displayName: source.displayName,
            avatarType: source.avatarType,
            level: source.level,
            online: true,
            stats: source.stats,
            progress: source.progress,
          },
        });
        json(response, 200, {
          restored: linked.restored,
          player: publicPlayer(linked.player),
          phoneHint: linked.phoneHint,
          session: sessions.issue(linked.player.id),
          deviceCredential,
        });
      } catch (error) {
        if (error instanceof PhoneAuthError || Number.isInteger(error?.status)) json(response, error.status, { error: error.message, code: error.code });
        else json(response, /required|known player/i.test(error.message) ? 400 : 409, { error: error.message });
      }
    });
    return true;
  }
  if (requestUrl.pathname === "/api/account/preferences" && request.method === "GET") {
    const actorId = sessionPlayerId(request);
    if (!actorId) { json(response, 401, { error: "Player session required" }); return true; }
    Promise.resolve(store.privatePreferencesForPlayer(actorId))
      .then(preferences => preferences
        ? json(response, 200, { preferences })
        : json(response, 401, { error: "Player session required" }))
      .catch(error => json(response, Number.isInteger(error?.status) ? error.status : 503, { error: error.message }));
    return true;
  }
  if (requestUrl.pathname === "/api/account/preferences" && request.method === "PUT") {
    const actorId = sessionPlayerId(request);
    if (!actorId) { json(response, 401, { error: "Player session required" }); return true; }
    readJson(request, response, async body => {
      try {
        const preferences = await store.setPrivatePreferences(actorId, body);
        json(response, 200, { preferences });
      } catch (error) {
        json(response, Number.isInteger(error?.status) ? error.status : 400, { error: error.message });
      }
    });
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
        if (!existing) {
          json(response, 401, { error: "Verified phone account required" }); return;
        }
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
  const matchState = roomMatchStates.get(client.room);
  const invalidatedPlan = matchState?.phase === "active" && Boolean(matchState.payload);
  if (matchState) {
    matchState.readyPlayerIds.clear();
    if (invalidatedPlan) {
      matchState.phase = "awaiting-rematch";
      matchState.payload = null;
    }
  }
  for (const peer of room.values()) send(peer, { type: "peer-left", id: client.id, capacity });
  if (invalidatedPlan) {
    for (const peer of room.values()) {
      send(peer, { type: "match-reset", reason: "player-left", departedId: client.id, humanPlayers: room.size, capacity, awaitingRematch: true });
    }
  } else if (matchState?.phase === "awaiting-rematch") {
    notifyMatchWaiting(client.room, room, "roster-changed");
  }
  for (const peer of room.values()) send(peer, { type: "chest-status", ...chestStatus });
  if (!room.size) {
    rooms.delete(client.room);
    roomMatchStates.delete(client.room);
  }
}

function emitMatchReady(roomName, room) {
  const matchState = matchStateFor(roomName);
  if (!matchState) return null;
  if (matchState.phase === "active" && matchState.payload) return matchState.payload;
  const teamRoom = matchmakingRules.parseTeamRoomId(roomName);
  matchState.generation++;
  const payload = {
    type: "match-ready",
    generation: matchState.generation,
    ...matchmakingRules.createMatchPlan(teamRoom.teamSize, [...room.keys()]),
    startsAt: Date.now() + matchCountdownMs,
  };
  matchState.phase = "active";
  matchState.readyPlayerIds.clear();
  matchState.payload = payload;
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
  const matchState = matchStateFor(roomName);
  if (matchState?.phase === "active" || room.size >= capacity) return send(socket, { type: "room-full" });
  const id = crypto.randomUUID();
  const peers = [...room.keys()];
  room.set(id, socket);
  clients.set(socket, { id, room: roomName });
  if (matchState?.phase === "awaiting-rematch") matchState.readyPlayerIds.clear();
  send(socket, { type: "welcome", id, peers, capacity, awaitingRematch: matchState?.phase === "awaiting-rematch" });
  for (const peer of room.values()) if (peer !== socket) send(peer, { type: "peer-joined", id, capacity });
  if (matchState?.phase === "awaiting-rematch") notifyMatchWaiting(roomName, room, "roster-changed");
  else if (matchState?.phase === "forming" && room.size === capacity) emitMatchReady(roomName, room);
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
    if (!room?.has(sender.id)) return;
    const matchState = matchStateFor(sender.room);
    if (!matchState || matchState.phase === "active") return;
    if (matchState.phase === "awaiting-rematch") {
      matchState.readyPlayerIds.add(sender.id);
      if (matchState.readyPlayerIds.size === room.size) emitMatchReady(sender.room, room);
      else notifyMatchWaiting(sender.room, room, "player-ready");
      return;
    }
    emitMatchReady(sender.room, room);
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
      "Content-Security-Policy": contentSecurityPolicy(),
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
