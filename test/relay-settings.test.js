'use strict';

const assert = require('assert');
const security = require('../src/security');
const relaySettings = require('../src/relay-settings');
const { resolveMaxTokens } = require('../src/token-policy');

const originalReadState = security.readState;
const originalWriteState = security.writeState;
const originalUpdateState = security.updateState;
let state = {};

try {
	security.readState = () => JSON.parse(JSON.stringify(state));
	security.writeState = (next) => { state = JSON.parse(JSON.stringify(next)); };
	security.updateState = (mutator) => {
		const next = mutator(JSON.parse(JSON.stringify(state)));
		state = JSON.parse(JSON.stringify(next));
		return state;
	};

	const initial = relaySettings.settings();
	assert.deepStrictEqual(initial.cli_paths, {
		'codex-cli': '',
		'grok-cli': '',
		'antigravity-cli': '',
		'cursor-cli': '',
		'cli-process': '',
	});
	assert.deepStrictEqual(initial.token_defaults, { chat: '', 'media.analyze': '' });

	const saved = relaySettings.saveSettings({
		defaults: { chat: 'model-relay:antigravity-cli:auto' },
		cli_paths: {
			'antigravity-cli': '  C:\\Tools\\agy.exe  ',
			'grok-cli': 42,
			unexpected: 'ignored',
		},
	});
	assert.strictEqual(saved.defaults.chat, 'model-relay:antigravity-cli:auto');
	assert.strictEqual(saved.cli_paths['antigravity-cli'], 'C:\\Tools\\agy.exe');
	assert.strictEqual(saved.cli_paths['grok-cli'], '');
	assert.strictEqual(Object.prototype.hasOwnProperty.call(saved.cli_paths, 'unexpected'), false);
	assert.strictEqual(state.relay.cli_paths['antigravity-cli'], 'C:\\Tools\\agy.exe');
	assert.deepStrictEqual(saved.token_defaults, { chat: '', 'media.analyze': '' });
	assert.deepStrictEqual(state.relay.token_defaults, {});

	const tokenOverrides = relaySettings.saveSettings({ token_defaults: { chat: '16384', 'media.analyze': 512 } });
	assert.deepStrictEqual(tokenOverrides.token_defaults, { chat: 16384, 'media.analyze': 512 });
	assert.deepStrictEqual(state.relay.token_defaults, { chat: 16384, 'media.analyze': 512 });
	const invalidTokens = relaySettings.saveSettings({ token_defaults: { chat: 'not-a-number', 'media.analyze': 128001 } });
	assert.deepStrictEqual(invalidTokens.token_defaults, { chat: 16384, 'media.analyze': 512 });
	const clearedToken = relaySettings.saveSettings({ token_defaults: { chat: '', 'media.analyze': '   ' } });
	assert.deepStrictEqual(clearedToken.token_defaults, { chat: '', 'media.analyze': '' });
	assert.deepStrictEqual(state.relay.token_defaults, {});

	const preserved = relaySettings.saveSettings({ defaults: { chat: 'model-relay:codex:auto' } });
	assert.strictEqual(preserved.cli_paths['antigravity-cli'], 'C:\\Tools\\agy.exe');

	const pathsOnly = relaySettings.saveSettings({ cli_paths: { 'antigravity-cli': 'C:\\Tools\\agy.exe', 'codex-cli': 'C:\\Tools\\codex.exe' } });
	assert.strictEqual(pathsOnly.defaults.chat, 'model-relay:codex:auto');
	assert.strictEqual(pathsOnly.cli_paths['codex-cli'], 'C:\\Tools\\codex.exe');
	state = { relay: { token_defaults: { chat: 32768, 'media.analyze': Number.NaN, unexpected: 9999 } } };
	assert.deepStrictEqual(relaySettings.settings().token_defaults, { chat: 32768, 'media.analyze': '' });
	assert.strictEqual(resolveMaxTokens('chat'), 32768);
	assert.strictEqual(resolveMaxTokens('media.analyze'), 4096);

	const previousXaiKey = process.env.XAI_API_KEY;
	const previousRelayXaiKey = process.env.AI_MODEL_RELAY_XAI_API_KEY;
	try {
		delete process.env.XAI_API_KEY;
		delete process.env.AI_MODEL_RELAY_XAI_API_KEY;
		state = {};
		assert.strictEqual(relaySettings.settings().defaults.videos, 'model-relay:openai-videos:sora-2');
		process.env.XAI_API_KEY = 'test-xai-key';
		state = {};
		assert.strictEqual(relaySettings.settings().defaults.videos, 'model-relay:xai:imagine-video');
	} finally {
		if (previousXaiKey === undefined) delete process.env.XAI_API_KEY;
		else process.env.XAI_API_KEY = previousXaiKey;
		if (previousRelayXaiKey === undefined) delete process.env.AI_MODEL_RELAY_XAI_API_KEY;
		else process.env.AI_MODEL_RELAY_XAI_API_KEY = previousRelayXaiKey;
	}

	const previousConcurrent = process.env.ALORBACH_CODEX_MAX_CONCURRENT_JOBS;
	const previousChatTimeout = process.env.ALORBACH_CODEX_CHAT_TIMEOUT_MS;
	try {
		delete process.env.XAI_API_KEY;
		delete process.env.AI_MODEL_RELAY_XAI_API_KEY;
		delete process.env.ALORBACH_CODEX_MAX_CONCURRENT_JOBS;
		delete process.env.ALORBACH_CODEX_CHAT_TIMEOUT_MS;
		state = {};
		const secret = 'xai-super-secret-key-9999';
		const savedProviders = relaySettings.saveSettings({
			runtime: { max_concurrent_jobs: 4, timeouts: { codex_chat_ms: 120000 } },
			providers: { xai: { api_key: secret, base_url: 'https://api.example.xai/v1', models: 'grok-4.6' } },
		});
		assert.strictEqual(savedProviders.runtime.max_concurrent_jobs, 4);
		assert.strictEqual(savedProviders.runtime.timeouts.codex_chat_ms, 120000);
		assert.strictEqual(savedProviders.providers.xai.api_key, secret);
		assert.strictEqual(savedProviders.defaults.videos, 'model-relay:xai:imagine-video');
		const published = relaySettings.publicSettings();
		assert.deepStrictEqual(published.providers.xai.api_key, { configured: true, suffix: '9999' });
		assert.strictEqual(published.providers.xai.base_url, 'https://api.example.xai/v1');
		assert.ok(!JSON.stringify(published).includes(secret));
		assert.strictEqual(relaySettings.resolved().runtime.max_concurrent_jobs, 4);
		assert.strictEqual(relaySettings.resolved().runtime.timeouts.codex_chat_ms, 120000);
		assert.strictEqual(relaySettings.driverOptions().xai.apiKey, secret);
		relaySettings.saveSettings({
			providers: {
				grok: { imagine_skill: '%USERPROFILE%\\.grok\\skills\\imagine\\SKILL.md' },
				antigravity: { state_dir: '%USERPROFILE%\\.gemini\\antigravity-cli' },
			},
		});
		const expandedHome = process.env.USERPROFILE || process.env.HOME || '';
		if (expandedHome) {
			assert.ok(relaySettings.driverOptions().grok.imagineSkillPath.startsWith(expandedHome));
			assert.ok(!relaySettings.driverOptions().grok.imagineSkillPath.includes('%USERPROFILE%'));
			assert.ok(relaySettings.driverOptions().antigravity.stateRoot.startsWith(expandedHome));
			assert.ok(!relaySettings.driverOptions().antigravity.stateRoot.includes('%USERPROFILE%'));
		}

		const kept = relaySettings.saveSettings({ providers: { xai: { api_key: '', base_url: 'https://api.example.xai/v1' } } });
		assert.strictEqual(kept.providers.xai.api_key, secret);
		const cleared = relaySettings.saveSettings({ providers: { xai: { clear_api_key: true } } });
		assert.strictEqual(cleared.providers.xai.api_key, '');
		assert.deepStrictEqual(relaySettings.publicSettings().providers.xai.api_key, { configured: false, suffix: '' });
		assert.ok(!JSON.stringify(relaySettings.publicSettings()).includes(secret));

		process.env.ALORBACH_CODEX_MAX_CONCURRENT_JOBS = '5';
		process.env.ALORBACH_CODEX_CHAT_TIMEOUT_MS = '90000';
		state = {};
		assert.strictEqual(relaySettings.resolved().runtime.max_concurrent_jobs, 5);
		assert.strictEqual(relaySettings.resolved().runtime.timeouts.codex_chat_ms, 90000);
		relaySettings.saveSettings({ runtime: { max_concurrent_jobs: 3, timeouts: { codex_chat_ms: 111000 } } });
		assert.strictEqual(relaySettings.resolved().runtime.max_concurrent_jobs, 3);
		assert.strictEqual(relaySettings.resolved().runtime.timeouts.codex_chat_ms, 111000);
		relaySettings.saveSettings({ runtime: { max_concurrent_jobs: '', timeouts: { codex_chat_ms: '' } } });
		assert.strictEqual(relaySettings.resolved().runtime.max_concurrent_jobs, 5);
		assert.strictEqual(relaySettings.resolved().runtime.timeouts.codex_chat_ms, 90000);
	} finally {
		if (previousXaiKey === undefined) delete process.env.XAI_API_KEY;
		else process.env.XAI_API_KEY = previousXaiKey;
		if (previousRelayXaiKey === undefined) delete process.env.AI_MODEL_RELAY_XAI_API_KEY;
		else process.env.AI_MODEL_RELAY_XAI_API_KEY = previousRelayXaiKey;
		if (previousConcurrent === undefined) delete process.env.ALORBACH_CODEX_MAX_CONCURRENT_JOBS;
		else process.env.ALORBACH_CODEX_MAX_CONCURRENT_JOBS = previousConcurrent;
		if (previousChatTimeout === undefined) delete process.env.ALORBACH_CODEX_CHAT_TIMEOUT_MS;
		else process.env.ALORBACH_CODEX_CHAT_TIMEOUT_MS = previousChatTimeout;
	}

	console.log('relay settings tests passed');
} finally {
	security.readState = originalReadState;
	security.writeState = originalWriteState;
	security.updateState = originalUpdateState;
}
