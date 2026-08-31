'use strict';

function readImageDimensions(bytes) {
	if (!bytes || !Buffer.isBuffer(bytes) || !bytes.length) {
		return null;
	}
	if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
	}
	if (bytes[0] === 0xff && bytes[1] === 0xd8) {
		let offset = 2;
		while (offset + 9 < bytes.length) {
			if (bytes[offset] !== 0xff) {
				break;
			}
			const marker = bytes[offset + 1];
			if (marker === 0xc0 || marker === 0xc2 || marker === 0xc1) {
				return {
					width: bytes.readUInt16BE(offset + 7),
					height: bytes.readUInt16BE(offset + 5),
				};
			}
			const segmentLength = bytes.readUInt16BE(offset + 2);
			if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) {
				break;
			}
			offset += 2 + segmentLength;
		}
	}
	if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
		if (bytes.toString('ascii', 12, 16) === 'VP8 ' && bytes.length >= 30) {
			return {
				width: bytes.readUInt16LE(26) & 0x3fff,
				height: bytes.readUInt16LE(28) & 0x3fff,
			};
		}
		if (bytes.toString('ascii', 12, 16) === 'VP8L' && bytes.length >= 25) {
			const bits = bytes.readUInt32LE(21);
			return {
				width: (bits & 0x3fff) + 1,
				height: ((bits >> 14) & 0x3fff) + 1,
			};
		}
	}
	return null;
}

module.exports = {
	readImageDimensions,
};
