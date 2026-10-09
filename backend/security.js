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

module.exports = { RateLimiter, SessionService, hash };
