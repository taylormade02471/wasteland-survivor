import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProviderAccountRequest,
  normalizeProviderIdentity,
  providerUnavailableMessage,
} from "../public/social-auth.mjs";

test("provider identity keeps verified name and email separate from the player birthday", () => {
  const identity = normalizeProviderIdentity("google", {
    uid: "google-user-123",
    displayName: "Night Ranger",
    email: "night@example.test",
  });
  assert.deepEqual(identity, {
    provider: "google",
    providerUid: "google-user-123",
    providerName: "Night Ranger",
    providerEmail: "night@example.test",
  });
});

test("provider account request requires the provider token and carries the entered birthday", () => {
  const request = buildProviderAccountRequest({
    idToken: "firebase-id-token",
    identity: normalizeProviderIdentity("microsoft", { uid: "ms-user-7", displayName: "Warden" }),
    profile: { profileId: "device-1", name: "Warden", birthDate: "1990-02-03", avatarType: "heavy" },
  });
  assert.equal(request.idToken, "firebase-id-token");
  assert.equal(request.authProvider, "microsoft");
  assert.equal(request.deviceProfileId, "device-1");
  assert.equal(request.player.displayName, "Warden");
  assert.equal(request.player.birthDate, "1990-02-03");
  assert.equal(request.player.providerEmail, "");
});

test("unconfigured provider sign-in directs the player to local profile setup", () => {
  assert.match(providerUnavailableMessage("google"), /local profile/i);
  assert.match(providerUnavailableMessage("microsoft"), /local profile/i);
});
