const assert = require("node:assert/strict");
const test = require("node:test");

test("Firebase browser provider sends a normalized phone through invisible reCAPTCHA and returns only an ID token", async () => {
  const { createFirebasePhoneAuthProvider } = await import("../public/phone-auth-provider.mjs");
  const calls = [];
  class RecaptchaVerifier {
    constructor(auth, container, options) { calls.push(["recaptcha", auth, container, options.size]); }
    clear() { calls.push(["clear"]); }
  }
  const sdk = {
    initializeApp: config => ({ config }),
    getApps: () => [],
    getApp: () => null,
    getAuth: app => ({ app }),
    RecaptchaVerifier,
    signInWithPhoneNumber: async (auth, phoneNumber) => {
      calls.push(["send", auth.app.config.projectId, phoneNumber]);
      return { confirm: async code => ({ user: { getIdToken: async forceRefresh => `${code}:${forceRefresh}` } }) };
    },
    connectAuthEmulator: () => { throw new Error("emulator should not be used in production"); },
  };
  const provider = createFirebasePhoneAuthProvider({
    config: { enabled: true, firebaseConfig: { projectId: "project-1", apiKey: "public-api-key", authDomain: "example.firebaseapp.com" } },
    sdkLoader: async () => sdk,
    environment: "production",
  });

  const challenge = await provider.sendCode({ phoneNumber: "(615) 555-0123", recaptchaContainer: "phoneRecaptcha" });
  assert.equal(challenge.phoneHint, "+1 ••• ••• 0123");
  assert.equal(await challenge.confirm("654321"), "654321:true");
  challenge.dispose();
  assert.deepEqual(calls, [
    ["recaptcha", calls[0][1], "phoneRecaptcha", "invisible"],
    ["send", "project-1", "+16155550123"],
    ["clear"],
  ]);
});

test("browser provider fails closed without public Firebase configuration and never enables the emulator in production", async () => {
  const { createFirebasePhoneAuthProvider } = await import("../public/phone-auth-provider.mjs");
  assert.throws(() => createFirebasePhoneAuthProvider({ config: { enabled: false } }), /not configured/i);
  assert.throws(() => createFirebasePhoneAuthProvider({
    config: { enabled: true, firebaseConfig: { projectId: "project-1" }, authEmulatorUrl: "http://127.0.0.1:9099" },
    environment: "production",
  }), /emulator.*production/i);
});
