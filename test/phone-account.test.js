const assert = require("node:assert/strict");
const test = require("node:test");

test("normalizes US mobile numbers and reveals only a masked hint", async () => {
  const { maskPhoneNumber, normalizePhoneNumber } = await import("../public/phone-account.mjs");

  assert.equal(normalizePhoneNumber("(615) 555-0123"), "+16155550123");
  assert.equal(normalizePhoneNumber("+44 7700 900123"), "+447700900123");
  assert.equal(normalizePhoneNumber("123"), null);
  assert.equal(maskPhoneNumber("+16155550123"), "+1 ••• ••• 0123");
});

test("phone challenge state enforces resend cooldown, expiry, attempts, and single use without retaining the number", async () => {
  const {
    beginPhoneChallenge,
    failPhoneChallenge,
    finishPhoneChallenge,
    mayResendPhoneChallenge,
  } = await import("../public/phone-account.mjs");

  let state = beginPhoneChallenge("+16155550123", 1_000);
  assert.equal(state.phoneHint, "+1 ••• ••• 0123");
  assert.equal(JSON.stringify(state).includes("6155550123"), false);
  assert.equal(mayResendPhoneChallenge(state, 30_999), false);
  assert.equal(mayResendPhoneChallenge(state, 31_000), true);

  for (let attempt = 0; attempt < 5; attempt += 1) state = failPhoneChallenge(state, 1_100 + attempt);
  assert.equal(state.status, "locked");
  assert.throws(() => finishPhoneChallenge(state, 1_200), /locked/i);

  const expired = beginPhoneChallenge("+16155550123", 2_000);
  assert.throws(() => finishPhoneChallenge(expired, 302_001), /expired/i);

  const verified = finishPhoneChallenge(beginPhoneChallenge("+16155550123", 3_000), 3_500);
  assert.equal(verified.status, "verified");
  assert.throws(() => finishPhoneChallenge(verified, 3_600), /already used/i);
});

test("phone-link request and restored local profile exclude PINs, raw phone numbers, provider UIDs, and tokens", async () => {
  const { buildPhoneLinkRequest, createRestoredLocalProfile } = await import("../public/phone-account.mjs");
  const localProfile = {
    profileId: "device-profile-2",
    playerTag: "WS-A1B2C3D4",
    name: "Night Ranger",
    avatarType: "ranger",
    birthDate: "2000-01-01",
    pin: "1234",
    pinDigest: "local-digest",
    phone: "+16155550123",
    email: "private@example.com",
    providerUid: "private-provider-uid",
  };

  const request = buildPhoneLinkRequest({ idToken: "firebase-id-token", profile: localProfile });
  assert.deepEqual(request, {
    idToken: "firebase-id-token",
    deviceProfileId: "device-profile-2",
    player: {
      playerTag: "WS-A1B2C3D4",
      displayName: "Night Ranger",
      avatarType: "ranger",
      level: 1,
      online: true,
      stats: { kills: 0, deaths: 0, wins: 0, matches: 0 },
      progress: {},
    },
  });

  const restored = createRestoredLocalProfile({
    player: { id: "player-1", playerTag: "WS-A1B2C3D4", displayName: "Night Ranger", avatarType: "ranger", progress: { wave: 8 } },
    pinDigest: "new-device-digest",
    phoneHint: "+1 ••• ••• 0123",
    session: "session-token",
    deviceCredential: "device-token",
    profileId: "device-profile-2",
  });
  assert.equal(restored.playerTag, "WS-A1B2C3D4");
  assert.equal(restored.pinDigest, "new-device-digest");
  assert.equal(restored.phoneHint, "+1 ••• ••• 0123");
  assert.equal(restored.backendSession, "session-token");
  assert.equal(JSON.stringify(restored).includes("firebase-id-token"), false);
  assert.equal(JSON.stringify(restored).includes("private-provider-uid"), false);
  assert.equal(JSON.stringify(restored).includes("6155550123"), false);
  assert.equal(restored.pin, undefined);
});

test("local PIN attempts lock only the current device profile and never retain a PIN", async () => {
  const { beginLocalPinAttempts, recordLocalPinAttempt } = await import("../public/phone-account.mjs");
  let state = beginLocalPinAttempts("profile-1");
  for (let attempt = 0; attempt < 4; attempt += 1) state = recordLocalPinAttempt(state, false, 1_000 + attempt);
  assert.equal(state.lockedUntil, 0);
  state = recordLocalPinAttempt(state, false, 1_100);
  assert.equal(state.lockedUntil, 31_100);
  assert.equal(JSON.stringify(state).includes("1234"), false);
  assert.throws(() => recordLocalPinAttempt(state, true, 2_000), /temporarily locked/i);
  assert.equal(recordLocalPinAttempt(state, true, 31_101).failures, 0);
});

test("legacy local profiles discard email, raw phone, provider UID, and plaintext PIN fields", async () => {
  const { sanitizeLocalProfile } = await import("../public/phone-account.mjs");
  const migrated = sanitizeLocalProfile({
    profileId: "profile-1",
    name: "Kyle",
    contact: "private@example.com",
    email: "private@example.com",
    phone: "+16155550123",
    parentPhone: "+16155550124",
    providerUid: "firebase-user-1",
    pin: "1234",
    pinDigest: "safe-local-digest",
    parentContact: "+16155550124",
  });
  assert.deepEqual(migrated, {
    profileId: "profile-1",
    name: "Kyle",
    pinDigest: "safe-local-digest",
    parentPhoneHint: "+1 ••• ••• 0124",
  });
});

test("verified account result preserves private local age fields without reintroducing account secrets", async () => {
  const { mergeVerifiedLocalProfile } = await import("../public/phone-account.mjs");
  const merged = mergeVerifiedLocalProfile({
    draft: {
      profileId: "device-profile-1",
      name: "Kyle",
      birthDate: "2000-01-01",
      age: 26,
      ageVerifiedAt: "2026-10-07T00:00:00.000Z",
      pinDigest: "local-digest",
      phone: "+16155550123",
    },
    restored: {
      profileId: "device-profile-1",
      name: "Kyle",
      birthDate: "",
      age: null,
      phoneHint: "+1 ••• ••• 0123",
      backendSession: "session-token",
    },
    deviceId: "device-1",
  });
  assert.equal(merged.birthDate, "2000-01-01");
  assert.equal(merged.age, 26);
  assert.equal(merged.ageVerifiedAt, "2026-10-07T00:00:00.000Z");
  assert.equal(merged.pinDigest, "local-digest");
  assert.equal(merged.phone, undefined);
  assert.equal(merged.deviceId, "device-1");
});
