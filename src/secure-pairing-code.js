'use strict';

function isValidPairingCode(value) {
	return /^\d{6}$/.test(String(value || ''));
}

async function isSecureStorageAvailable(safeStorage, platform = process.platform) {
	if (!safeStorage || typeof safeStorage.isAsyncEncryptionAvailable !== 'function') return false;
	try {
		if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
		if (platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
			return false;
		}
		return true;
	} catch (error) {
		return false;
	}
}

async function encryptPairingCode(code, safeStorage, platform = process.platform) {
	const normalized = String(code || '');
	if (!isValidPairingCode(normalized)) {
		throw new Error('Pairing code must contain exactly six digits.');
	}
	if (!(await isSecureStorageAvailable(safeStorage, platform))) {
		throw new Error('OS-backed secure storage is unavailable.');
	}
	const encrypted = await safeStorage.encryptStringAsync(normalized);
	if (!Buffer.isBuffer(encrypted) || !encrypted.length) {
		throw new Error('OS-backed secure storage returned an empty value.');
	}
	return encrypted.toString('base64');
}

async function decryptPairingCode(ciphertext, safeStorage, platform = process.platform) {
	if (!ciphertext) return { pairingCode: '', ciphertext: '' };
	if (!(await isSecureStorageAvailable(safeStorage, platform))) {
		throw new Error('OS-backed secure storage is unavailable.');
	}
	const bytes = Buffer.from(String(ciphertext), 'base64');
	if (!bytes.length || bytes.toString('base64') !== String(ciphertext)) {
		throw new Error('Saved pairing code data is invalid.');
	}
	const decrypted = await safeStorage.decryptStringAsync(bytes);
	const pairingCode = String(decrypted && decrypted.result || '');
	if (!isValidPairingCode(pairingCode)) {
		throw new Error('Saved pairing code could not be validated.');
	}
	let nextCiphertext = String(ciphertext);
	if (decrypted.shouldReEncrypt === true) {
		nextCiphertext = await encryptPairingCode(pairingCode, safeStorage, platform);
	}
	return { pairingCode, ciphertext: nextCiphertext };
}

module.exports = {
	decryptPairingCode,
	encryptPairingCode,
	isSecureStorageAvailable,
	isValidPairingCode,
};
