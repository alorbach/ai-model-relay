'use strict';

const assert = require('assert');
const securePairingCode = require('../src/secure-pairing-code');

function mockStorage(options = {}) {
	const secretPrefix = options.secretPrefix || 'encrypted:';
	return {
		isAsyncEncryptionAvailable: async () => options.available !== false,
		getSelectedStorageBackend: () => options.backend || 'mock-secret-store',
		encryptStringAsync: async (value) => Buffer.from(secretPrefix + value, 'utf8'),
		decryptStringAsync: async (bytes) => ({
			result: bytes.toString('utf8').replace(options.decryptPrefix || secretPrefix, ''),
			shouldReEncrypt: options.shouldReEncrypt === true,
		}),
	};
}

(async () => {
	assert.ok(securePairingCode.isValidPairingCode('864209'));
	assert.ok(!securePairingCode.isValidPairingCode('12345'));
	assert.ok(!securePairingCode.isValidPairingCode('1234567'));
	assert.ok(!securePairingCode.isValidPairingCode('abcdef'));

	const storage = mockStorage();
	const ciphertext = await securePairingCode.encryptPairingCode('864209', storage, 'win32');
	assert.ok(ciphertext);
	assert.ok(!ciphertext.includes('864209'));
	const loaded = await securePairingCode.decryptPairingCode(ciphertext, storage, 'win32');
	assert.strictEqual(loaded.pairingCode, '864209');
	assert.strictEqual(loaded.ciphertext, ciphertext);

	const rotatingStorage = mockStorage({ shouldReEncrypt: true, secretPrefix: 'rotated:', decryptPrefix: 'encrypted:' });
	const rotated = await securePairingCode.decryptPairingCode(
		Buffer.from('encrypted:864209').toString('base64'),
		rotatingStorage,
		'win32',
	);
	assert.strictEqual(rotated.pairingCode, '864209');
	assert.notStrictEqual(rotated.ciphertext, Buffer.from('encrypted:864209').toString('base64'));

	assert.ok(!(await securePairingCode.isSecureStorageAvailable(mockStorage({ available: false }), 'win32')));
	assert.ok(!(await securePairingCode.isSecureStorageAvailable(mockStorage({ backend: 'basic_text' }), 'linux')));
	await assert.rejects(() => securePairingCode.encryptPairingCode('12345', storage, 'win32'), /exactly six digits/);
	await assert.rejects(() => securePairingCode.encryptPairingCode('864209', mockStorage({ available: false }), 'win32'), /secure storage is unavailable/);

	console.log('secure pairing-code tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
