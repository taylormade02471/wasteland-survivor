const PHONE_CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;
const PHONE_RESEND_COOLDOWN_MS = 30 * 1000;
const PHONE_MAX_ATTEMPTS = 5;
const LOCAL_PIN_LOCK_MS = 30 * 1000;

const whole = value => Math.max(0, Math.floor(Number(value) || 0));

export function normalizePhoneNumber(value, defaultCountryCode = "+1") {
  const source = String(value || "").trim();
  if (!source) return null;
  const hasPlus = source.startsWith("+");
  let digits = source.replace(/\D/g, "");
  if (!hasPlus && digits.length === 10) digits = `${String(defaultCountryCode).replace(/\D/g, "")}${digits}`;
  else if (!hasPlus && digits.length === 11 && digits.startsWith("1")) digits = `1${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

export function maskPhoneNumber(value) {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return "Phone unavailable";
  const digits = normalized.slice(1);
  const countryLength = digits.length === 11 && digits.startsWith("1") ? 1 : Math.max(1, digits.length - 10);
  const country = digits.slice(0, countryLength);
  return `+${country} ••• ••• ${digits.slice(-4)}`;
}

export function beginPhoneChallenge(phoneNumber, now = Date.now()) {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) throw new Error("Enter a valid mobile number");
  const startedAt = whole(now);
  return Object.freeze({
    status: "code-sent",
    phoneHint: maskPhoneNumber(normalized),
    startedAt,
    resendAt: startedAt + PHONE_RESEND_COOLDOWN_MS,
    expiresAt: startedAt + PHONE_CHALLENGE_LIFETIME_MS,
    attempts: 0,
  });
}

export function mayResendPhoneChallenge(state, now = Date.now()) {
  return state?.status === "code-sent" && whole(now) >= whole(state.resendAt) && whole(now) <= whole(state.expiresAt);
}

export function failPhoneChallenge(state, now = Date.now()) {
  if (!state || state.status !== "code-sent") return state;
  if (whole(now) > whole(state.expiresAt)) return Object.freeze({ ...state, status: "expired" });
  const attempts = whole(state.attempts) + 1;
  return Object.freeze({ ...state, attempts, status: attempts >= PHONE_MAX_ATTEMPTS ? "locked" : "code-sent" });
}

export function finishPhoneChallenge(state, now = Date.now()) {
  if (state?.status === "verified") throw new Error("This verification was already used");
  if (state?.status === "locked") throw new Error("This verification is locked after too many attempts");
  if (!state || state.status === "expired" || whole(now) > whole(state.expiresAt)) throw new Error("This verification code expired");
  if (state.status !== "code-sent") throw new Error("No phone verification is active");
  return Object.freeze({ ...state, status: "verified", verifiedAt: whole(now) });
}

export function buildPhoneLinkRequest({ idToken, profile = {} } = {}) {
  const progress = profile.progress && typeof profile.progress === "object" ? profile.progress : {};
  const stats = profile.stats && typeof profile.stats === "object" ? profile.stats : {};
  return {
    idToken: String(idToken || ""),
    deviceProfileId: String(profile.profileId || ""),
    player: {
      playerTag: String(profile.playerTag || ""),
      displayName: String(profile.name || "Survivor"),
      avatarType: String(profile.avatarType || "scout"),
      level: Math.max(1, whole(profile.level || progress.playerLevel || 1)),
      online: true,
      stats: {
        kills: whole(stats.kills ?? progress.kills),
        deaths: whole(stats.deaths ?? progress.deaths),
        wins: whole(stats.wins ?? progress.wins),
        matches: whole(stats.matches ?? progress.matches),
      },
      progress,
    },
  };
}

export function createRestoredLocalProfile({ player = {}, pinDigest, phoneHint, session, deviceCredential, profileId } = {}) {
  return {
    profileId: String(profileId || ""),
    name: String(player.displayName || "Survivor"),
    birthDate: "",
    age: null,
    avatarType: String(player.avatarType || "scout"),
    parentPhoneHint: "",
    youthAccount: false,
    pinDigest: String(pinDigest || ""),
    deviceId: "",
    ageVerifiedAt: null,
    linkedAccount: true,
    phoneHint: String(phoneHint || "Phone verified"),
    progress: player.progress || null,
    backendPlayerId: player.id,
    playerTag: player.playerTag,
    backendDeviceCredential: deviceCredential,
    backendSession: session,
  };
}

export function beginLocalPinAttempts(profileId) {
  return Object.freeze({ profileId: String(profileId || ""), failures: 0, lockedUntil: 0 });
}

export function recordLocalPinAttempt(state, matched, now = Date.now()) {
  const current = state || beginLocalPinAttempts("");
  const timestamp = whole(now);
  if (whole(current.lockedUntil) > timestamp) throw new Error("This local profile is temporarily locked");
  if (matched) return Object.freeze({ ...current, failures: 0, lockedUntil: 0 });
  const failures = whole(current.failures) + 1;
  return Object.freeze({
    ...current,
    failures: failures >= PHONE_MAX_ATTEMPTS ? 0 : failures,
    lockedUntil: failures >= PHONE_MAX_ATTEMPTS ? timestamp + LOCAL_PIN_LOCK_MS : 0,
  });
}

export function sanitizeLocalProfile(profile = {}) {
  const {
    contact,
    email,
    phone,
    providerUid,
    pin,
    parentContact,
    parentPhone,
    ...safe
  } = profile;
  const legacyParentPhone = parentPhone || parentContact;
  if (!safe.parentPhoneHint && normalizePhoneNumber(legacyParentPhone)) safe.parentPhoneHint = maskPhoneNumber(legacyParentPhone);
  return safe;
}

export function mergeVerifiedLocalProfile({ draft = {}, restored = {}, deviceId } = {}) {
  return sanitizeLocalProfile({
    ...draft,
    ...restored,
    birthDate: draft.birthDate || restored.birthDate || "",
    age: Number.isFinite(draft.age) ? draft.age : restored.age ?? null,
    ageVerifiedAt: draft.ageVerifiedAt || restored.ageVerifiedAt || null,
    pinDigest: draft.pinDigest || restored.pinDigest || "",
    deviceId: String(deviceId || draft.deviceId || restored.deviceId || ""),
  });
}

export const PHONE_ACCOUNT_LIMITS = Object.freeze({
  challengeLifetimeMs: PHONE_CHALLENGE_LIFETIME_MS,
  resendCooldownMs: PHONE_RESEND_COOLDOWN_MS,
  maxAttempts: PHONE_MAX_ATTEMPTS,
  localPinLockMs: LOCAL_PIN_LOCK_MS,
});
