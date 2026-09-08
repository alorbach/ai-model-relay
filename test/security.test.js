'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const testStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-model-relay-security-test-'));
process.env.AI_MODEL_RELAY_STATE_DIR = testStateDir;
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

security.writeState({ version: 1, pairings: { 'https://example.test': { token: 'old-token' } } });
const originalRenameSync = fs.renameSync;
let forcedReplacementConflict = true;
fs.renameSync = (source, destination) => {
	if (destination === security.statePath && forcedReplacementConflict && fs.existsSync(security.statePath)) {
		forcedReplacementConflict = false;
		const error = new Error('simulated Windows destination conflict');
		error.code = 'EPERM';
		throw error;
	}
	return originalRenameSync(source, destination);
};
security.writeState({ version: 2, pairings: { 'https://example.test': { token: 'new-token' } } });
fs.renameSync = originalRenameSync;
assert.strictEqual(security.readState().version, 2);
assert.strictEqual(security.readState().pairings['https://example.test'].token, 'new-token');
const stateBackupPath = `${security.statePath}.bak`;
fs.renameSync(security.statePath, stateBackupPath);
assert.strictEqual(security.readState().version, 2, 'a backup remains readable if the process stops during replacement');
fs.renameSync(stateBackupPath, security.statePath);

const stateBeforeFailedWrite = security.readState();
fs.renameSync = (source, destination) => {
	if (destination === security.statePath) {
		const error = new Error('simulated state replacement failure');
		error.code = 'EACCES';
		throw error;
	}
	return originalRenameSync(source, destination);
};
assert.throws(() => security.writeState({ version: 3 }), /simulated state replacement failure/);
fs.renameSync = originalRenameSync;
assert.deepStrictEqual(security.readState(), stateBeforeFailedWrite);
assert.strictEqual(fs.readdirSync(testStateDir).some((entry) => entry.endsWith('.tmp')), false);

security.writeState({ version: 4, pairings: { 'https://keep.test': { token: 'keep' } }, extra: 'preserved' });
security.savePairing('https://new.test', 'new-token');
assert.strictEqual(security.readState().extra, 'preserved');
assert.strictEqual(security.readState().pairings['https://keep.test'].token, 'keep');
assert.strictEqual(security.readState().pairings['https://new.test'].token, 'new-token');
security.removePairing('https://new.test');
assert.strictEqual(security.readState().pairings['https://new.test'], undefined);
assert.strictEqual(security.readState().pairings['https://keep.test'].token, 'keep');

const lockPath = `${security.statePath}.lock`;
fs.mkdirSync(lockPath, { recursive: true });
fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({ pid: process.pid, createdAt: Date.now() - 120000 }));
const staleTime = new Date(Date.now() - 120000);
fs.utimesSync(lockPath, staleTime, staleTime);
security.writeState({ version: 5, recovered: true });
assert.strictEqual(security.readState().version, 5);
assert.strictEqual(security.readState().recovered, true);

fs.mkdirSync(lockPath, { recursive: true });
fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({ pid: 2147483646, createdAt: Date.now() }));
security.writeState({ version: 6, dead_owner: true });
assert.strictEqual(security.readState().version, 6);

console.log('security tests passed');
