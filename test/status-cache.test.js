'use strict';

const assert = require('assert');
const { createStatusCache } = require('../src/status-cache');

function backendsNamed(name, refresh) {
	return {
		list: () => [{
			id: 'codex-cli',
			checkStatus: () => ({ success: true, message: name }),
			capabilities: () => ({ details: { name }, features: { chat: true } }),
		}],
		capabilities: () => [{ id: name }],
		refresh,
	};
}

(async () => {
	let resolveOld;
	const oldRefreshStarted = new Promise((resolve) => { resolveOld = resolve; });
	const context = {
		backends: backendsNamed('old', () => {
			resolveOld();
			return new Promise((resolve) => setTimeout(resolve, 40));
		}),
		codex: {},
		musicAnalysis: { capabilities: () => ({ enabled: false }) },
		mediaAnalysis: { capabilities: () => ({ enabled: false }) },
		video: { capabilities: () => ({ enabled: false }) },
		jobManager: { snapshot: () => ({ running_count: 0 }) },
	};
	const published = [];
	const cache = createStatusCache(context, (status) => published.push(status.message));
	const pending = cache.refresh();
	await oldRefreshStarted;
	context.backends = backendsNamed('new', () => Promise.resolve());
	await pending;
	assert.ok(published.includes('new'));
	assert.ok(!published.includes('old'));
	console.log('status cache tests passed');
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
