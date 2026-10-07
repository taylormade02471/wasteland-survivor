import { maskPhoneNumber, normalizePhoneNumber } from "./phone-account.mjs";

const DEFAULT_FIREBASE_SDK_VERSION = "11.10.0";

async function defaultSdkLoader(version = DEFAULT_FIREBASE_SDK_VERSION) {
  const base = `https://www.gstatic.com/firebasejs/${encodeURIComponent(version)}`;
  const [appSdk, authSdk] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
  ]);
  return { ...appSdk, ...authSdk };
}

export function createFirebasePhoneAuthProvider({ config = {}, sdkLoader = defaultSdkLoader, environment = "production" } = {}) {
  if (environment === "production" && config.authEmulatorUrl) throw new Error("The phone auth emulator cannot run in production");
  if (!config.enabled || !config.firebaseConfig?.projectId || !config.firebaseConfig?.apiKey || !config.firebaseConfig?.authDomain) {
    throw new Error("Verified phone sign-in is not configured");
  }

  let authPromise;
  async function authContext() {
    if (!authPromise) authPromise = Promise.resolve(sdkLoader(config.sdkVersion)).then(sdk => {
      const existing = typeof sdk.getApps === "function"
        ? sdk.getApps().find(app => app.name === "wasteland-survivor-phone")
        : null;
      const app = existing || sdk.initializeApp(config.firebaseConfig, "wasteland-survivor-phone");
      const auth = sdk.getAuth(app);
      if (config.authEmulatorUrl) sdk.connectAuthEmulator(auth, config.authEmulatorUrl, { disableWarnings: true });
      if (typeof sdk.useDeviceLanguage === "function") sdk.useDeviceLanguage(auth);
      return { auth, sdk };
    });
    return authPromise;
  }

  return Object.freeze({
    async sendCode({ phoneNumber, recaptchaContainer }) {
      const normalized = normalizePhoneNumber(phoneNumber);
      if (!normalized) throw new Error("Enter a valid mobile number");
      const { auth, sdk } = await authContext();
      const verifier = new sdk.RecaptchaVerifier(auth, recaptchaContainer, { size: "invisible" });
      try {
        const confirmation = await sdk.signInWithPhoneNumber(auth, normalized, verifier);
        let consumed = false;
        return Object.freeze({
          phoneHint: maskPhoneNumber(normalized),
          async confirm(code) {
            if (consumed) throw new Error("This verification was already used");
            const credential = await confirmation.confirm(String(code || "").trim());
            const idToken = await credential.user.getIdToken(true);
            consumed = true;
            return idToken;
          },
          dispose() { verifier.clear(); },
        });
      } catch (error) {
        verifier.clear();
        throw error;
      }
    },
  });
}

export async function loadPhoneAuthProvider({ fetchImpl = fetch, environment = "production", sdkLoader } = {}) {
  const response = await fetchImpl("/api/phone/config", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Verified phone sign-in is unavailable");
  return createFirebasePhoneAuthProvider({ config: await response.json(), environment, sdkLoader });
}
