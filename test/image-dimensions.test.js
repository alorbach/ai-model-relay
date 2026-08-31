'use strict';

const assert = require('assert');
const { readImageDimensions } = require('../src/image-dimensions');

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');

function buildJpeg(width, height) {
	const buffer = Buffer.alloc(16);
	buffer[0] = 0xff;
	buffer[1] = 0xd8;
	buffer[2] = 0xff;
	buffer[3] = 0xc0;
	buffer.writeUInt16BE(17, 4);
	buffer[6] = 8;
	buffer.writeUInt16BE(height, 7);
	buffer.writeUInt16BE(width, 9);
	buffer[11] = 0xff;
	buffer[12] = 0xd9;
	return buffer;
}

assert.deepStrictEqual(readImageDimensions(tinyPng), { width: 1, height: 1 });
assert.deepStrictEqual(readImageDimensions(buildJpeg(1672, 941)), { width: 1672, height: 941 });
assert.strictEqual(readImageDimensions(Buffer.from('not-an-image')), null);

console.log('image-dimensions tests passed');
