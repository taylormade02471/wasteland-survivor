const crypto = require("crypto");

const tokenHash = token => crypto.createHash("sha256").update(String(token || "")).digest("hex");

function maskPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new PhoneAuthError("verified-phone-required", "A verified phone credential is required");
  const countryLength = digits.length === 11 && digits.startsWith("1") ? 1 : Math.max(1, digits.length - 10);
  return `+${digits.slice(0, countryLength)} ••• ••• ${digits.slice(-4)}`;
}

class PhoneAuthError extends Error {
  constructor(code, message, status = 401) {
    super(message);
    this.name = "PhoneAuthError";
    this.code = code;
    this.status = status;
  }
}

class PhoneAuthService {
  constructor({ configured = false, verifyIdToken, now = Date.now, maximumAuthAgeSeconds = 600 } = {}) {
    this.configured = Boolean(configured);
    this.verifyIdToken = verifyIdToken;
    this.now = now;
    this.maximumAuthAgeSeconds = maximumAuthAgeSeconds;
    this.consumed = new Map();
  }

  async verify(idToken) {
    if (!this.configured || typeof this.verifyIdToken !== "function") {
      throw new PhoneAuthError("phone-auth-unavailable", "Verified phone sign-in is not configured", 503);
    }
    const token = String(idToken || "");
    if (!token) throw new PhoneAuthError("phone-token-required", "A verified phone credential is required");
    const key = tokenHash(token);
    const currentSeconds = Math.floor(this.now() / 1000);
    for (const [hash, expiresAt] of this.consumed) if (expiresAt < currentSeconds) this.consumed.delete(hash);
    if (this.consumed.has(key)) throw new PhoneAuthError("phone-token-used", "This verified phone credential was already used");

    let decoded;
    try { decoded = await this.verifyIdToken(token); }
    catch { throw new PhoneAuthError("phone-token-invalid", "The phone verification could not be confirmed"); }
    const providerUid = typeof decoded?.uid === "string" ? decoded.uid.trim() : "";
    const expiresAt = Number(decoded?.exp);
    const authenticatedAt = Number(decoded?.auth_time);
    if (!providerUid || providerUid.length > 128) throw new PhoneAuthError("phone-token-invalid", "The phone verification identity is invalid");
    if (!Number.isFinite(expiresAt) || expiresAt < currentSeconds) throw new PhoneAuthError("phone-token-expired", "The phone verification expired");
    if (!Number.isFinite(authenticatedAt) || currentSeconds - authenticatedAt > this.maximumAuthAgeSeconds || authenticatedAt > currentSeconds + 60) {
      throw new PhoneAuthError("phone-token-stale", "The phone verification is too old");
    }
    const phoneHint = maskPhoneNumber(decoded.phone_number);
    if (decoded.firebase?.sign_in_provider !== "phone") {
      throw new PhoneAuthError("phone-provider-required", "A fresh phone sign-in is required");
    }
    this.consumed.set(key, expiresAt);
    return { providerUid, phoneHint };
  }
}

function testVerifier(env, now = Date.now) {
  let tokens;
  try { tokens = JSON.parse(env.PHONE_AUTH_TEST_TOKENS || "{}"); }
  catch { throw new Error("PHONE_AUTH_TEST_TOKENS must be valid JSON"); }
  return async token => {
    const record = tokens[String(token || "")];
    if (!record?.uid || !record?.phoneNumber) throw new Error("Unknown fictional phone token");
    const currentSeconds = Math.floor(now() / 1000);
    return { uid: record.uid, phone_number: record.phoneNumber, auth_time: currentSeconds, exp: currentSeconds + 3600, jti: tokenHash(token), firebase: { sign_in_provider: "phone" } };
  };
}

function createPhoneAuthService(env = process.env) {
  const production = env.NODE_ENV === "production";
  const testMode = env.PHONE_AUTH_TEST_MODE === "true";
  if (production && testMode) throw new Error("Phone auth test mode cannot run in production");
  if (testMode) return new PhoneAuthService({ configured: true, verifyIdToken: testVerifier(env) });
  if (env.FIREBASE_PHONE_AUTH_ENABLED !== "true" || !env.FIREBASE_PROJECT_ID) return new PhoneAuthService({ configured: false });

  const { applicationDefault, getApp, getApps, initializeApp } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const app = getApps().find(candidate => candidate.name === "wasteland-phone-auth")
    || initializeApp({ credential: applicationDefault(), projectId: env.FIREBASE_PROJECT_ID }, "wasteland-phone-auth");
  return new PhoneAuthService({ configured: true, verifyIdToken: token => getAuth(app).verifyIdToken(token, true) });
}

module.exports = { PhoneAuthError, PhoneAuthService, createPhoneAuthService, maskPhoneNumber };
