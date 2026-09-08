'use strict';

const assert = require('assert');
const video = require('../src/video');

assert.strictEqual(video.resolveVideoModel('sora-2'), 'sora-2');
assert.strictEqual(video.resolveVideoModel('sora-2-pro'), 'sora-2-pro');
assert.strictEqual(video.resolveVideoModel('model-relay:openai-videos:sora-2-pro'), 'sora-2-pro');
assert.strictEqual(video.resolveVideoModel('openai-video:sora-2-pro'), 'sora-2-pro');
assert.strictEqual(video.resolveVideoModel('model-relay:openai-videos:sora-2'), 'sora-2');
assert.strictEqual(video.resolveVideoModel('unknown-model'), '');
assert.strictEqual(video.resolveVideoModel('model-relay:openai-videos:sora-3'), '');
assert.notStrictEqual(video.resolveVideoModel('model-relay:openai-videos:sora-2-pro'), 'sora-2');

console.log('video tests passed');
