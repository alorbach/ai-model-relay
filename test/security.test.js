'use strict';

const assert = require('assert');
const security = require('../src/security');

assert.strictEqual(security.normalizeOrigin('https://example.com/path'), 'https://example.com');
assert.strictEqual(security.normalizeOrigin('http://localhost:8888/wp-admin/'), 'http://localhost:8888');
assert.strictEqual(security.normalizeOrigin('file:///tmp/test'), '');
assert.ok(/^\d{6}$/.test(security.createPairingCode()));
assert.ok(security.createToken().length > 20);
assert.ok(security.timingSafeEqual('123456', '123456'));
assert.ok(!security.timingSafeEqual('123456', '123457'));
assert.ok(!security.timingSafeEqual('1', '123456'));

let now = 1000;
const limiter = security.createPairingLimiter({ maxFailures: 5, windowMs: 60000, now: () => now });
assert.ok(limiter.allow());
for (let i = 0; i < 5; i++) limiter.recordFailure();
assert.ok(!limiter.allow());
assert.ok(limiter.retryAfterMs() > 0);
now = 61001;
assert.ok(limiter.allow());
limiter.recordFailure();
limiter.reset();
assert.ok(limiter.allow());

console.log('security tests passed');
