const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

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

function startServer(port, dataFile, extraEnv = {}) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_FILE: dataFile,
      NODE_ENV: "test",
      PHONE_AUTH_TEST_MODE: "true",
      PHONE_AUTH_TEST_TOKENS: JSON.stringify({
        "fictional-token-1": { uid: "firebase-user-1", phoneNumber: "+16155550123" },
        "fictional-token-2": { uid: "firebase-user-1", phoneNumber: "+16155550123" },
        "fictional-token-unlinked": { uid: "firebase-user-2", phoneNumber: "+16155550124" },
        "fictional-token-attacker-1": { uid: "firebase-attacker-1", phoneNumber: "+16155550125" },
        "fictional-token-attacker-2": { uid: "firebase-attacker-2", phoneNumber: "+16155550126" },
        "fictional-token-other": { uid: "firebase-user-3", phoneNumber: "+16155550127" },
        "fictional-token-victim-restore": { uid: "firebase-user-1", phoneNumber: "+16155550123" },
      }),
      ...extraEnv,
    },
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

async function post(port, pathname, body) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function get(port, pathname) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
  const type = response.headers.get("content-type") || "";
  return {
    status: response.status,
    headers: response.headers,
    body: type.includes("application/json") ? await response.json() : await response.text(),
  };
}

test("verified phone identity restores the same player tag on a second device without exposing private data", async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-phone-account-"));
  const dataFile = path.join(tempDirectory, "state.json");
  const port = await availablePort();
  const server = await startServer(port, dataFile);
  t.after(() => {
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const first = await post(port, "/api/account/phone", {
    idToken: "fictional-token-1",
    deviceProfileId: "device-profile-1",
    pin: "1234",
    player: {
      playerTag: "WS-A1B2C3D4",
      displayName: "Night Ranger",
      avatarType: "ranger",
      phone: "+16155550123",
      email: "private@example.com",
      pinDigest: "must-not-leave-device",
    },
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.restored, false);
  assert.equal(first.body.player.playerTag, "WS-A1B2C3D4");
  assert.equal(first.body.phoneHint, "+1 ••• ••• 0123");
  assert.equal(JSON.stringify(first.body).includes("firebase-user-1"), false);
  assert.equal(JSON.stringify(first.body).includes("6155550123"), false);
  assert.equal(JSON.stringify(first.body).includes("1234"), false);

  const second = await post(port, "/api/account/phone", {
    idToken: "fictional-token-2",
    deviceProfileId: "device-profile-2",
    pin: "9876",
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.restored, true);
  assert.equal(second.body.player.playerTag, first.body.player.playerTag);
  assert.notEqual(second.body.deviceCredential, first.body.deviceCredential);

  const replay = await post(port, "/api/account/phone", { idToken: "fictional-token-2", deviceProfileId: "device-profile-3" });
  assert.equal(replay.status, 401);

  const unlinked = await post(port, "/api/account/phone", { idToken: "fictional-token-unlinked", deviceProfileId: "device-profile-4" });
  assert.equal(unlinked.status, 404);
  assert.equal(unlinked.body.error, "No player is linked to that verified phone");

  const stored = fs.readFileSync(dataFile, "utf8");
  assert.equal(stored.includes("+16155550123"), false);
  assert.equal(stored.includes("private@example.com"), false);
  assert.equal(stored.includes("must-not-leave-device"), false);
  assert.equal(stored.includes("\"1234\""), false);

  const unverifiedCreate = await post(port, "/api/players", { deviceProfileId: "unverified-device", displayName: "Bypass" });
  assert.equal(unverifiedCreate.status, 401);
  assert.equal(unverifiedCreate.body.error, "Verified phone account required");

  assert.equal((await post(port, "/api/link/claim", {})).status, 404);
  assert.equal((await post(port, "/api/recovery/request", {})).status, 404);
});

test("production-style server without Firebase configuration fails closed", async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-phone-unconfigured-"));
  const port = await availablePort();
  const server = await startServer(port, path.join(tempDirectory, "state.json"), {
    NODE_ENV: "production",
    SESSION_SECRET: "production-test-secret-at-least-24-characters",
    PHONE_AUTH_TEST_MODE: "false",
    PHONE_AUTH_TEST_TOKENS: "{}",
  });
  t.after(() => {
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });
  const result = await post(port, "/api/account/phone", { idToken: "anything", deviceProfileId: "device-profile" });
  assert.equal(result.status, 503);
  assert.equal(result.body.error, "Verified phone sign-in is not configured");
  assert.equal(result.body.developmentCode, undefined);
});

test("a different verified UID cannot claim an existing player or device profile", async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-phone-takeover-"));
  const port = await availablePort();
  const server = await startServer(port, path.join(tempDirectory, "state.json"));
  t.after(() => {
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const victim = await post(port, "/api/account/phone", {
    idToken: "fictional-token-1",
    deviceProfileId: "victim-device",
    player: { displayName: "Victim", avatarType: "ranger" },
  });
  assert.equal(victim.status, 200);

  const noProof = await post(port, "/api/account/phone", {
    idToken: "fictional-token-attacker-1",
    deviceProfileId: "victim-device",
    player: { displayName: "Attacker", avatarType: "scout" },
  });
  assert.equal(noProof.status, 401);
  assert.match(noProof.body.error, /device ownership/i);

  const ownedButAlreadyLinked = await fetch(`http://127.0.0.1:${port}/api/account/phone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${victim.body.session}`,
    },
    body: JSON.stringify({
      idToken: "fictional-token-attacker-2",
      deviceProfileId: "victim-device",
      player: { displayName: "Attacker", avatarType: "scout" },
    }),
  });
  const ownedBody = await ownedButAlreadyLinked.json();
  assert.equal(ownedButAlreadyLinked.status, 409);
  assert.match(ownedBody.error, /already linked/i);

  const other = await post(port, "/api/account/phone", {
    idToken: "fictional-token-other",
    deviceProfileId: "other-device",
    player: { displayName: "Other", avatarType: "heavy" },
  });
  assert.equal(other.status, 200);

  const aliasTakeover = await post(port, "/api/account/phone", {
    idToken: "fictional-token-victim-restore",
    deviceProfileId: "other-device",
  });
  assert.equal(aliasTakeover.status, 409);
  assert.match(aliasTakeover.body.error, /different player/i);

  const serialized = JSON.stringify({ noProof: noProof.body, owned: ownedBody, alias: aliasTakeover.body });
  assert.equal(serialized.includes("fictional-token"), false);
  assert.equal(serialized.includes(victim.body.deviceCredential), false);
});

test("configured phone auth publishes only the required Firebase and reCAPTCHA CSP origins", async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-phone-csp-"));
  const port = await availablePort();
  const server = await startServer(port, path.join(tempDirectory, "state.json"), {
    FIREBASE_WEB_API_KEY: "public-browser-key",
    FIREBASE_AUTH_DOMAIN: "wasteland-test.firebaseapp.com",
    FIREBASE_PROJECT_ID: "wasteland-test",
    FIREBASE_APP_ID: "test-app-id",
  });
  t.after(() => {
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const config = await get(port, "/api/phone/config");
  assert.equal(config.status, 200);
  assert.deepEqual(config.body.firebaseConfig, {
    apiKey: "public-browser-key",
    authDomain: "wasteland-test.firebaseapp.com",
    projectId: "wasteland-test",
    appId: "test-app-id",
  });

  const page = await get(port, "/");
  assert.equal(page.status, 200);
  const csp = page.headers.get("content-security-policy");
  assert.match(csp, /script-src 'self' https:\/\/cdn\.jsdelivr\.net https:\/\/www\.gstatic\.com https:\/\/www\.google\.com/);
  assert.match(csp, /connect-src 'self' ws: wss: https:\/\/wasteland-test\.firebaseapp\.com https:\/\/identitytoolkit\.googleapis\.com https:\/\/securetoken\.googleapis\.com https:\/\/www\.googleapis\.com https:\/\/www\.google\.com https:\/\/recaptcha\.google\.com/);
  assert.match(csp, /frame-src 'self' https:\/\/wasteland-test\.firebaseapp\.com https:\/\/www\.google\.com https:\/\/recaptcha\.google\.com/);
  assert.doesNotMatch(csp, /\*\.google|https:\s|;\s*\*/);
});

test("unconfigured phone auth keeps Google and Firebase origins out of the CSP", async t => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-phone-csp-off-"));
  const port = await availablePort();
  const server = await startServer(port, path.join(tempDirectory, "state.json"), {
    NODE_ENV: "production",
    SESSION_SECRET: "production-test-secret-at-least-24-characters",
    PHONE_AUTH_TEST_MODE: "false",
    PHONE_AUTH_TEST_TOKENS: "{}",
  });
  t.after(() => {
    server.kill();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const page = await get(port, "/");
  const csp = page.headers.get("content-security-policy");
  assert.doesNotMatch(csp, /gstatic|googleapis|recaptcha|firebaseapp/);
});
