const assert = require("node:assert/strict");
const test = require("node:test");
const { DeviceLinkService, RateLimiter, RecoveryService, SessionService } = require("../backend/security");
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
test("recovery challenges are hashed, single-use, and expire", () => {
  const recovery = new RecoveryService(1000);
  const challenge = recovery.create("player-1", 100);
  assert.equal(recovery.consume(challenge.token, 500).playerId, "player-1");
  assert.equal(recovery.consume(challenge.token, 501), null);
  assert.equal(recovery.consume(recovery.create("player-2", 100).token, 1101), null);
});
test("device link codes are six digits, single-use, replaced, and expire", () => {
  const links = new DeviceLinkService(1000);
  const first = links.create("player-1", 100);
  assert.match(first.code, /^\d{6}$/);
  const second = links.create("player-1", 200);
  assert.equal(links.claim("player-1", first.code, 300), false);
  assert.equal(links.claim("player-1", second.code, 300), true);
  assert.equal(links.claim("player-1", second.code, 301), false);
  assert.equal(links.claim("player-2", links.create("player-2", 100).code, 1101), false);
});
