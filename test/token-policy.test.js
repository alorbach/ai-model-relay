'use strict';

const assert = require('assert');
const { JOB_MAX_TOKENS, TINY_MAX_TOKENS_CEILING, resolveMaxTokens } = require('../src/token-policy');

assert.strictEqual(JOB_MAX_TOKENS.chat, 8192);
assert.strictEqual(JOB_MAX_TOKENS['media.analyze'], 4096);
assert.strictEqual(TINY_MAX_TOKENS_CEILING, 512);

assert.strictEqual(resolveMaxTokens('chat'), 8192);
assert.strictEqual(resolveMaxTokens('chat', 256), 8192);
assert.strictEqual(resolveMaxTokens('chat', 0), 8192);
assert.strictEqual(resolveMaxTokens('chat', 'abc'), 8192);
assert.strictEqual(resolveMaxTokens('chat', Symbol('not numeric')), 8192);
assert.strictEqual(resolveMaxTokens('chat', '4096'), 4096);
assert.strictEqual(resolveMaxTokens('chat', 4096), 4096);
assert.strictEqual(resolveMaxTokens('media.analyze'), 4096);
assert.strictEqual(resolveMaxTokens('unknown'), 8192);
assert.strictEqual(resolveMaxTokens('toString'), 8192);
assert.strictEqual(resolveMaxTokens('chat', TINY_MAX_TOKENS_CEILING), TINY_MAX_TOKENS_CEILING);
assert.strictEqual(resolveMaxTokens('chat', 4096.9), 4096);

console.log('token policy tests passed');
