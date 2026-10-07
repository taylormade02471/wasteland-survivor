const assert = require("node:assert/strict");
const test = require("node:test");
const { RateLimiter, SessionService } = require("../backend/security");
test("sessions are signed, expire, and reject tampering", () => {
  const sessions = new SessionService("a-long-development-secret-value", 1000);
  const token = sessions.issue("player-1", 100);
  assert.equal(sessions.verify(token, 500).sub, "player-1");
  assert.equal(sessions.verify(token + "x", 500), null);
  assert.equal(sessions.verify(token, 1101), null);
});
test("rate limiter blocks repeated attempts and resets after its windows", () => {
  const limiter = new RateLimiter({ limit: 2, windowMs: 1000, blockMs: 2000 });
  assert.equal(limiter.check("ip", 0).allowed, true);
  assert.equal(limiter.check("ip", 1).allowed, true);
  assert.equal(limiter.check("ip", 2).allowed, false);
  assert.equal(limiter.check("ip", 2003).allowed, true);
});
