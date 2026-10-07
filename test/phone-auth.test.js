const assert = require("node:assert/strict");
const test = require("node:test");
const { PhoneAuthError, PhoneAuthService, createPhoneAuthService } = require("../backend/phone-auth");

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
    now: () => 100_000,
  });
  await assert.rejects(stale.verify("stale"), /expired/i);

  const noPhone = new PhoneAuthService({
    configured: true,
    verifyIdToken: async () => ({ uid: "firebase-user-1", auth_time: 100, exp: 1_000 }),
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
  });
  assert.deepEqual(await service.verify("test-token"), { providerUid: "test-user", phoneHint: "+1 ••• ••• 0123" });
});
