const DEFAULT_FIREBASE_SDK_VERSION = "11.10.0";
const PROVIDERS = Object.freeze({ google: "Google", microsoft: "Microsoft" });

const text = (value, maximum = 160) => String(value || "").trim().slice(0, maximum);

export function normalizeProviderIdentity(provider, user = {}) {
  const key = String(provider || "").trim().toLowerCase();
  if (!Object.hasOwn(PROVIDERS, key)) throw new Error("Only Google or Microsoft sign-in is supported.");
  const providerUid = text(user.uid, 128);
  if (!providerUid) throw new Error(`${PROVIDERS[key]} did not return a verified account identity.`);
  return {
    provider: key,
    providerUid,
    providerName: text(user.displayName, 80),
    providerEmail: text(user.email, 160),
  };
}

export function providerUnavailableMessage(provider) {
  const label = PROVIDERS[String(provider || "").toLowerCase()] || "Provider";
  return `${label} sign-in is not configured on this server. Enter a name and birthday to use a local profile.`;
}

export function buildProviderAccountRequest({ idToken, identity = {}, profile = {} } = {}) {
  const progress = profile.progress && typeof profile.progress === "object" ? profile.progress : {};
  const stats = profile.stats && typeof profile.stats === "object" ? profile.stats : {};
  return {
    idToken: text(idToken, 4096),
    authProvider: text(identity.provider, 16),
    deviceProfileId: text(profile.profileId, 80),
    deviceCredential: text(profile.backendDeviceCredential, 256),
    player: {
      playerTag: text(profile.playerTag, 24),
      displayName: text(profile.name || identity.providerName, 24) || "Survivor",
      birthDate: text(profile.birthDate, 10),
      avatarType: text(profile.avatarType || "scout", 16),
      providerEmail: text(identity.providerEmail, 160),
      providerName: text(identity.providerName, 80),
      level: Math.max(1, Math.floor(Number(profile.level || progress.playerLevel) || 1)),
      online: true,
      stats: {
        kills: Math.max(0, Math.floor(Number(stats.kills ?? progress.kills) || 0)),
        deaths: Math.max(0, Math.floor(Number(stats.deaths ?? progress.deaths) || 0)),
        wins: Math.max(0, Math.floor(Number(stats.wins ?? progress.wins) || 0)),
        matches: Math.max(0, Math.floor(Number(stats.matches ?? progress.matches) || 0)),
      },
      progress,
    },
  };
}

async function defaultSdkLoader(version = DEFAULT_FIREBASE_SDK_VERSION) {
  const base = `https://www.gstatic.com/firebasejs/${encodeURIComponent(version)}`;
  const [appSdk, authSdk] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
  ]);
  return { ...appSdk, ...authSdk };
}

export function createFirebaseSocialAuth({ config = {}, sdkLoader = defaultSdkLoader } = {}) {
  if (!config.enabled || !config.firebaseConfig?.projectId || !config.firebaseConfig?.apiKey || !config.firebaseConfig?.authDomain) {
    throw new Error("Provider sign-in is not configured. Use a local profile instead.");
  }
  let authPromise;
  async function authContext() {
    if (!authPromise) authPromise = Promise.resolve(sdkLoader(config.sdkVersion)).then(sdk => {
      const existing = typeof sdk.getApps === "function"
        ? sdk.getApps().find(app => app.name === "wasteland-survivor-social")
        : null;
      const app = existing || sdk.initializeApp(config.firebaseConfig, "wasteland-survivor-social");
      return { auth: sdk.getAuth(app), sdk };
    });
    return authPromise;
  }
  return Object.freeze({
    async signIn(provider) {
      const { auth, sdk } = await authContext();
      const key = String(provider || "").toLowerCase();
      const authProvider = key === "google"
        ? new sdk.GoogleAuthProvider()
        : key === "microsoft"
          ? new sdk.OAuthProvider("microsoft.com")
          : null;
      if (!authProvider) throw new Error("Only Google or Microsoft sign-in is supported.");
      const result = await sdk.signInWithPopup(auth, authProvider);
      const idToken = await result.user.getIdToken(true);
      return { idToken, identity: normalizeProviderIdentity(key, result.user) };
    },
  });
}

export async function loadSocialAuthProvider({ fetchImpl = fetch, configPath = "/api/auth/config", sdkLoader } = {}) {
  const response = await fetchImpl(configPath, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Provider sign-in configuration is unavailable. Use a local profile instead.");
  return createFirebaseSocialAuth({ config: await response.json(), sdkLoader });
}
