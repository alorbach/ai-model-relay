'use strict';

const assert = require('assert');
const security = require('../src/security');

assert.strictEqual(security.normalizeOrigin('https://example.com/path'), 'https://example.com');
assert.strictEqual(security.normalizeOrigin('http://localhost:8888/wp-admin/'), 'http://localhost:8888');
assert.strictEqual(security.normalizeOrigin('file:///tmp/test'), '');
assert.ok(/^\d{6}$/.test(security.createPairingCode()));
assert.ok(security.createToken().length > 20);

console.log('security tests passed');
