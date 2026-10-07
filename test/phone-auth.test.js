const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { PhoneAuthError, PhoneAuthService, createPhoneAuthService } = require("../backend/phone-auth");
const { BackendStore } = require("../backend/store");

function decodedPhoneToken() {
  return {
    uid: "firebase-user-1",
    phone_number: "+16155550123",
    auth_time: 100,
    exp: 1_000,
    firebase: { sign_in_provider: "phone" },
  };
}

function acceptTokenUse() {
  return async () => true;
}

test("verified provider token yields a private UID and masked hint and is single use", async () => {
  const service = new PhoneAuthService({
    configured: true,
    verifyIdToken: async token => ({
      uid: "firebase-user-1",
      phone_number: "+16155550123",
      jti: token,
      auth_time: 100,
      exp: 1_000,
      firebase: { sign_in_provider: "phone" },
    }),
    consumeTokenUse: acceptTokenUse(),
    now: () => 200_000,
  });

  assert.deepEqual(await service.verify("id-token-1"), {
    providerUid: "firebase-user-1",
    phoneHint: "+1 ••• ••• 0123",
  });
  await assert.rejects(service.verify("id-token-1"), /already used/i);
});

test("phone auth fails closed when unconfigured and rejects stale or incomplete credentials", async () => {
  const unavailable = new PhoneAuthService({ configured: false });
  await assert.rejects(unavailable.verify("anything"), error => error instanceof PhoneAuthError && error.code === "phone-auth-unavailable");

  const stale = new PhoneAuthService({
    configured: true,
    verifyIdToken: async () => ({ uid: "firebase-user-1", phone_number: "+16155550123", auth_time: 1, exp: 50 }),
    consumeTokenUse: acceptTokenUse(),
    now: () => 100_000,
  });
  await assert.rejects(stale.verify("stale"), /expired/i);

  const noPhone = new PhoneAuthService({
    configured: true,
    verifyIdToken: async () => ({ uid: "firebase-user-1", auth_time: 100, exp: 1_000 }),
    consumeTokenUse: acceptTokenUse(),
    now: () => 200_000,
  });
  await assert.rejects(noPhone.verify("no-phone"), /phone/i);
});

test("phone auth rejects a token that did not sign in through the phone provider", async () => {
  const service = new PhoneAuthService({
    configured: true,
    verifyIdToken: async () => ({
      uid: "firebase-user-1",
      phone_number: "+16155550123",
      auth_time: 100,
      exp: 1_000,
      firebase: { sign_in_provider: "password" },
    }),
    consumeTokenUse: acceptTokenUse(),
    now: () => 200_000,
  });
  await assert.rejects(service.verify("email-token"), /phone sign-in/i);
});

test("test token adapter cannot activate in production", async () => {
  assert.throws(() => createPhoneAuthService({
    NODE_ENV: "production",
    PHONE_AUTH_TEST_MODE: "true",
    PHONE_AUTH_TEST_TOKENS: JSON.stringify({ "test-token": { uid: "test-user", phoneNumber: "+16155550123" } }),
  }), /test mode.*production/i);

  const service = createPhoneAuthService({
    NODE_ENV: "test",
    PHONE_AUTH_TEST_MODE: "true",
    PHONE_AUTH_TEST_TOKENS: JSON.stringify({ "test-token": { uid: "test-user", phoneNumber: "+16155550123" } }),
  }, { consumeTokenUse: async () => true });
  assert.deepEqual(await service.verify("test-token"), { providerUid: "test-user", phoneHint: "+1 ••• ••• 0123" });
});

test("concurrent verification of one token fulfills exactly once", async () => {
  let persistentClaims = 0;
  const service = new PhoneAuthService({
    configured: true,
    verifyIdToken: async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return decodedPhoneToken();
    },
    consumeTokenUse: async () => {
      persistentClaims += 1;
      return true;
    },
    now: () => 200_000,
  });

  const results = await Promise.allSettled([service.verify("same-token"), service.verify("same-token")]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected" && result.reason?.code === "phone-token-used").length, 1);
  assert.equal(persistentClaims, 1);
});

test("token consumption survives a file-store restart without persisting the raw token", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wasteland-phone-token-"));
  const filePath = path.join(directory, "state.json");
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const options = backend => ({
    configured: true,
    verifyIdToken: async () => decodedPhoneToken(),
    consumeTokenUse: claim => backend.consumePhoneAuthToken(claim),
    now: () => 200_000,
  });

  const firstStore = new BackendStore(filePath);
  await new PhoneAuthService(options(firstStore)).verify("restart-token-secret");
  const reopenedStore = new BackendStore(filePath);
  const restartedService = new PhoneAuthService(options(reopenedStore));

  await assert.rejects(restartedService.verify("restart-token-secret"), error => error?.code === "phone-token-used");
  assert.equal(fs.readFileSync(filePath, "utf8").includes("restart-token-secret"), false);
});
