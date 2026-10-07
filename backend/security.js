const crypto = require("crypto");

const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const hash = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const safeEqual = (left, right) => {
  const a = Buffer.from(String(left)), b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

class SessionService {
  constructor(secret, lifetimeMs = 60 * 60 * 1000) {
    if (!secret || secret.length < 24) throw new Error("SESSION_SECRET must contain at least 24 characters");
    this.secret = secret;
    this.lifetimeMs = lifetimeMs;
  }
  issue(playerId, now = Date.now()) {
    const payload = encode({ sub: playerId, iat: now, exp: now + this.lifetimeMs, nonce: crypto.randomBytes(8).toString("hex") });
    const signature = crypto.createHmac("sha256", this.secret).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }
  verify(token, now = Date.now()) {
    const [payload, signature, extra] = String(token || "").split(".");
    if (!payload || !signature || extra) return null;
    const expected = crypto.createHmac("sha256", this.secret).update(payload).digest("base64url");
    if (!safeEqual(signature, expected)) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      return data.sub && Number.isFinite(data.exp) && data.exp >= now ? data : null;
    } catch { return null; }
  }
}

class RateLimiter {
  constructor({ limit = 20, windowMs = 60000, blockMs = 300000 } = {}) {
    this.limit = limit; this.windowMs = windowMs; this.blockMs = blockMs; this.entries = new Map();
  }
  check(key, now = Date.now()) {
    const id = String(key || "unknown");
    let entry = this.entries.get(id);
    if (!entry || now - entry.windowStartedAt >= this.windowMs) entry = { count: 0, windowStartedAt: now, blockedUntil: 0 };
    if (entry.blockedUntil > now) return { allowed: false, retryAfterMs: entry.blockedUntil - now };
    entry.count++;
    if (entry.count > this.limit) entry.blockedUntil = now + this.blockMs;
    this.entries.set(id, entry);
    return entry.blockedUntil > now ? { allowed: false, retryAfterMs: this.blockMs } : { allowed: true, remaining: this.limit - entry.count };
  }
}

class RecoveryService {
  constructor(lifetimeMs = 15 * 60 * 1000) { this.lifetimeMs = lifetimeMs; this.challenges = new Map(); }
  create(playerId, now = Date.now()) {
    const token = crypto.randomBytes(24).toString("base64url");
    this.challenges.set(hash(token), { playerId, expiresAt: now + this.lifetimeMs, used: false });
    return { token, expiresAt: now + this.lifetimeMs };
  }
  consume(token, now = Date.now()) {
    const key = hash(token), challenge = this.challenges.get(key);
    if (!challenge || challenge.used || challenge.expiresAt < now) return null;
    challenge.used = true;
    return { playerId: challenge.playerId };
  }
}

class DeviceLinkService {
  constructor(lifetimeMs = 5 * 60 * 1000) { this.lifetimeMs = lifetimeMs; this.links = new Map(); }
  create(playerId, now = Date.now()) {
    for (const [key, link] of this.links) if (link.playerId === playerId) this.links.delete(key);
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    this.links.set(hash(`${playerId}:${code}`), { playerId, expiresAt: now + this.lifetimeMs, used: false });
    return { code, expiresAt: now + this.lifetimeMs };
  }
  claim(playerId, code, now = Date.now()) {
    const link = this.links.get(hash(`${playerId}:${String(code || "")}`));
    if (!link || link.used || link.expiresAt < now) return false;
    link.used = true;
    return true;
  }
}

module.exports = { DeviceLinkService, RateLimiter, RecoveryService, SessionService, hash };
