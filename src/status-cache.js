'use strict';

function createStatusCache(context, onUpdate = () => {}) {
	let refreshing = null;
	let refreshId = 0;
	let refreshState = { active: true, id: refreshId, started_at: null, completed_at: null, error: null };
	const initialCodexDriver = context.backends.list ? context.backends.list().find((driver) => driver.id === 'codex-cli') : null;
	const initialCodexCapabilities = initialCodexDriver && initialCodexDriver.capabilities ? initialCodexDriver.capabilities() : {};
	let status = { success: false, message: 'Checking local model providers in background.', details: { checking: true }, bridge: {}, asr: context.codex.asrStatus ? context.codex.asrStatus() : {}, jobs: context.jobManager.snapshot(), checking: true, last_checked: null, refresh: refreshState };
	let capabilities = { success: true, codex: initialCodexCapabilities.details || { checking: true }, asr: context.codex.asrStatus ? context.codex.asrStatus() : {}, features: initialCodexCapabilities.features || {}, backends: context.backends.capabilities(), video: context.video.capabilities ? context.video.capabilities() : { enabled: false }, media_analysis: context.mediaAnalysis.capabilities ? context.mediaAnalysis.capabilities() : { enabled: false }, checking: true, last_checked: null, refresh: refreshState };
	function sync() {
		capabilities = {
			...capabilities,
			asr: context.codex.asrStatus ? context.codex.asrStatus() : {},
			backends: context.backends.capabilities(),
			video: context.video.capabilities ? context.video.capabilities() : { enabled: false },
			media_analysis: context.mediaAnalysis.capabilities ? context.mediaAnalysis.capabilities() : { enabled: false },
		};
		onUpdate(status, capabilities);
		return capabilities;
	}
	function refresh() {
		if (refreshing) return refreshing;
		refreshState = { active: true, id: ++refreshId, started_at: new Date().toISOString(), completed_at: null, error: null };
		status = { ...status, checking: true, refresh: refreshState }; capabilities = { ...capabilities, checking: true, refresh: refreshState }; onUpdate(status, capabilities);
		refreshing = Promise.resolve(context.backends.refresh ? context.backends.refresh() : context.backends.capabilities()).then(() => {
			const codexDriver = context.backends.list ? context.backends.list().find((driver) => driver.id === 'codex-cli') : context.backends.getDriver('chat', { provider: 'codex-cli' });
			if (!codexDriver) throw new Error('Codex CLI driver is unavailable.');
			const codexStatus = codexDriver.checkStatus();
			const codexCapabilities = codexDriver.capabilities();
			const now = new Date().toISOString();
			refreshState = { ...refreshState, active: false, completed_at: now };
			status = { ...codexStatus, bridge: status.bridge, asr: context.codex.asrStatus ? context.codex.asrStatus() : {}, jobs: context.jobManager.snapshot(), checking: false, last_checked: now, refresh: refreshState };
			capabilities = { ...capabilities, codex: codexCapabilities.details || {}, asr: context.codex.asrStatus ? context.codex.asrStatus() : {}, features: codexCapabilities.features || {}, backends: context.backends.capabilities(), video: context.video.capabilities ? context.video.capabilities() : { enabled: false }, media_analysis: context.mediaAnalysis.capabilities ? context.mediaAnalysis.capabilities() : { enabled: false }, checking: false, last_checked: now, refresh: refreshState };
			onUpdate(status, capabilities);
		}).catch((error) => { const now = new Date().toISOString(); refreshState = { ...refreshState, active: false, completed_at: now, error: error.message || 'Provider refresh failed.' }; status = { ...status, checking: false, message: refreshState.error, refresh: refreshState }; capabilities = { ...capabilities, checking: false, refresh: refreshState }; onUpdate(status, capabilities); }).finally(() => { refreshing = null; });
		return refreshing;
	}
	return { capabilities: () => capabilities, refresh, sync, status: () => ({ ...status, jobs: context.jobManager.snapshot() }) };
}

module.exports = { createStatusCache };
