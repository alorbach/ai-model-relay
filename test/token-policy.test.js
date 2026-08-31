'use strict';

const assert = require('assert');
const { JOB_MAX_TOKENS, TINY_MAX_TOKENS_CEILING, TOKEN_DEFAULT_MIN, TOKEN_DEFAULT_MAX, normalizeTokenDefaults, resolveMaxTokens } = require('../src/token-policy');

assert.strictEqual(JOB_MAX_TOKENS.chat, 8192);
assert.strictEqual(JOB_MAX_TOKENS['media.analyze'], 4096);
assert.strictEqual(TINY_MAX_TOKENS_CEILING, 512);
assert.strictEqual(TOKEN_DEFAULT_MIN, 512);
assert.strictEqual(TOKEN_DEFAULT_MAX, 128000);

assert.deepStrictEqual(normalizeTokenDefaults({ chat: '16384', 'media.analyze': 512, extra: 1 }), { chat: 16384, 'media.analyze': 512 });
assert.deepStrictEqual(normalizeTokenDefaults({ chat: 511, 'media.analyze': 128001 }), { chat: '', 'media.analyze': '' });

assert.strictEqual(resolveMaxTokens('chat', undefined, {}), 8192);
assert.strictEqual(resolveMaxTokens('chat', 256, {}), 8192);
assert.strictEqual(resolveMaxTokens('chat', 0, {}), 8192);
assert.strictEqual(resolveMaxTokens('chat', 'abc', {}), 8192);
assert.strictEqual(resolveMaxTokens('chat', Symbol('not numeric'), {}), 8192);
assert.strictEqual(resolveMaxTokens('chat', '4096', {}), 4096);
assert.strictEqual(resolveMaxTokens('chat', 4096, {}), 4096);
assert.strictEqual(resolveMaxTokens('media.analyze', undefined, {}), 4096);
assert.strictEqual(resolveMaxTokens('unknown', undefined, {}), 8192);
assert.strictEqual(resolveMaxTokens('toString', undefined, {}), 8192);
assert.strictEqual(resolveMaxTokens('chat', TINY_MAX_TOKENS_CEILING, {}), TINY_MAX_TOKENS_CEILING);
assert.strictEqual(resolveMaxTokens('chat', 4096.9, {}), 4096);
assert.strictEqual(resolveMaxTokens('chat', undefined, { chat: 16384 }), 16384);
assert.strictEqual(resolveMaxTokens('chat', 256, { token_defaults: { chat: 16384 } }), 16384);
assert.strictEqual(resolveMaxTokens('media.analyze', undefined, { 'media.analyze': 32768 }), 32768);
assert.strictEqual(resolveMaxTokens('chat', 8192, { chat: 16384 }), 8192);
assert.strictEqual(resolveMaxTokens('chat', 128000, { chat: 16384 }), 128000);
assert.strictEqual(resolveMaxTokens('chat', undefined, { chat: 511 }), 8192);

console.log('token policy tests passed');
