		const statusUrl = '/v1/status';
		const capabilitiesUrl = '/v1/capabilities';
		const asrSettingsUrl = '/v1/asr/settings';
		const asrSetupUrl = '/v1/asr/setup';
		const musicAnalysisSettingsUrl = '/v1/music-analysis/settings';
		const musicAnalysisSetupUrl = '/v1/music-analysis/setup';
		const upscaleSettingsUrl = '/v1/upscale/settings';
		const upscaleSetupUrl = '/v1/upscale/setup';
		const imageSettingsUrl = '/v1/image/settings';
		const imageSetupUrl = '/v1/image/setup';
		const relaySettingsUrl = '/v1/relay/settings';
		const claudeUsageUrl = '/v1/relay/providers/anthropic/usage';
		const pairingCodeSettingsUrl = '/v1/relay/pairing-code';
		const relayTestUrl = '/v1/relay/test';
		const liveImageCancelUrl = '/v1/relay/jobs/images/cancel';
		const jobEventsUrl = '/v1/status/events';
		let currentStatus = {};
		let currentCapabilities = {};
		let currentAsrSettings = null;
		let currentMusicAnalysisSettings = null;
		let currentUpscaleSettings = null;
		let currentImageSettings = null;
		let settingsLoaded = false;
		let fallbackPollTimer = null;
		let providerRefreshPollTimer = null;
		// Highest detection-run id seen in a status snapshot, and when that run started. A lower id is a late answer or a restarted
		// Relay (ids start over at 1); updateProviderRefreshState tells them apart.
		let providerRefreshLastSeenId = 0;
		let providerRefreshLastSeenStart = 0;
		// Highest run id seen finished since the Relay started; a later "active" answer for such a run is a late reply.
		let providerRefreshDoneId = 0;
		let providerRefreshDoneStart = 0;
		// Provider settings loading: one request at a time, retried (at most every relaySettingsRetryMs) while the form is empty.
		let relaySettingsLoading = false;
		let relaySettingsReloadQueued = false;
		let relaySettingsLastAttemptAt = 0;
		const relaySettingsRetryMs = 5000;
		const relaySettingsRetryMaxMs = 30000;
		// While the form has never loaded, a failed load schedules its own retry (5 s, 10 s, ... 30 s); one timer at most.
		let relaySettingsRetryTimer = null;
		let relaySettingsRetryDelay = relaySettingsRetryMs;
		// Counts successful settings saves. A settings GET that started before the latest save may carry the pre-save values.
		let relaySettingsSaveGeneration = 0;
		let relaySettingsQueuedOptions = null;
		// Request time limits: a request that hangs must not keep a busy flag set for ever.
		const settingsLoadTimeoutMs = 15000;
		const settingsPostTimeoutMs = 30000;
		const statusFetchTimeoutMs = 10000;
		// A failed status poll (a slow answer included) keeps the last good picture on screen until it has failed this many
		// times in a row, or for this long; only then does the page show the hard error state.
		const statusFailureHardCount = 3;
		const statusFailureHardMs = 30000;
		let statusRefreshPending = null;
		// The one connectivity model. The topbar pill, the #updated label, the Relay pill's reachability and the
		// "keep the last good picture or show the error state" decision are all derived from it (see connectionView).
		// lastGoodAt: last successful status answer or live event; lastSource: 'poll' or 'sse' for that answer;
		// failureCount / failureSince: the current unbroken streak of failed polls; sseLive: the event stream is open;
		// sseSince: when the stream last opened; polling: the fallback poll timer runs; lastError: message of the latest failure.
		const connectionState = { lastGoodAt: 0, lastSource: '', failureCount: 0, failureSince: 0, sseLive: false, sseSince: 0, polling: false, lastError: '' };
		let jobEvents = null;
		let jobEventsRetryTimer = null;
		const jobEventsRetryMinMs = 2000;
		const jobEventsRetryMaxMs = 30000;
		// The Relay sends a heartbeat every 15 s; a stream silent for longer than two of them is treated as stalled.
		const jobEventsStallMs = 35000;
		let jobEventsRetryDelay = jobEventsRetryMinMs;
		let liveFilter = 'all';
		let liveTypeFilter = 'all';
		let liveSearchQuery = '';
		let liveOutputWrap = true;
		let liveAutoScroll = true;
		let liveTypeOptionsSignature = '';
		let debugFailureMarkup = null;
		const debugFailureOpen = new Set();
		let selectedLiveRequestId = '';
		let livePinned = false;
		const cancellingLiveImageRequests = new Set();
		const seenLiveRequestIds = new Set();
		let currentRoute = 'overview';
		let pendingProviderFocus = '';
		let pendingTestFocus = null;
		const baseDocumentTitle = document.title;
		const themeStorageKey = 'relay-status-theme';
		let formSnapshots = { relay: '', runtime: '', asr: '', music: '', upscale: '', image: '' };
		// The last settings each local engine page loaded or saved; Discard re-renders the form from them.
		const engineBaselines = { asr: null, music: null, upscale: null, image: null };
		// Provider cards: the user's expand/collapse choice per provider id (absent means "use the default"), the last settings
		// payload the Relay returned (Discard re-renders from it), and the last Claude usage report (compact card summary).
		const providerCardOpen = new Map();
		let lastRelaySettingsPayload = null;
		// False until the provider form was rendered from a successful load. Until then the form is empty, so saving it would wipe
		// the stored executable paths and routing defaults; Refresh detection and every provider save refuse to run.
		let providerFormRendered = false;
		let lastClaudeUsage = null;
		const fields = {
			routeViews: Array.from(document.querySelectorAll('main > .view[data-view]')),
			navItems: Array.from(document.querySelectorAll('#sidebar-nav a[data-route]')),
			navBadges: Array.from(document.querySelectorAll('[data-nav-badge]')),
			pageTitle: document.getElementById('pageTitle'),
			sidebar: document.getElementById('sidebar'),
			sidebarBackdrop: document.getElementById('sidebarBackdrop'),
			menuToggle: document.getElementById('menuToggle'),
			themeButtons: Array.from(document.querySelectorAll('[data-theme-choice]')),
			overviewPort: document.getElementById('overviewPort'),
			overviewPairedCount: document.getElementById('overviewPairedCount'),
			overviewProviderGrid: document.getElementById('overviewProviderGrid'),
			overviewProviderSummary: document.getElementById('overviewProviderSummary'),
			overviewProviderSummarySub: document.getElementById('overviewProviderSummarySub'),
			asrPill: document.getElementById('asrPill'),
			liveJobList: document.getElementById('liveJobList'),
			liveJobSearch: document.getElementById('liveJobSearch'),
			liveTypeFilter: document.getElementById('liveTypeFilter'),
			liveWrapToggle: document.getElementById('liveWrapToggle'),
			liveFollowToggle: document.getElementById('liveFollowToggle'),
			liveDetailEmpty: document.getElementById('liveDetailEmpty'),
			liveDetailContent: document.getElementById('liveDetailContent'),
			liveDetailTitle: document.getElementById('liveDetailTitle'),
			liveDetailStatus: document.getElementById('liveDetailStatus'),
			liveDetailSubtitle: document.getElementById('liveDetailSubtitle'),
			liveDetailBody: document.getElementById('liveDetailBody'),
			liveDetailCopyId: document.getElementById('liveDetailCopyId'),
			liveDetailCancel: document.getElementById('liveDetailCancel'),
			persistentPairingCodeForm: document.getElementById('persistentPairingCodeForm'),
			persistentPairingCodeInput: document.getElementById('persistentPairingCodeInput'),
			pairingCodeStatus: document.getElementById('pairingCodeStatus'),
			pairingCodeMessage: document.getElementById('pairingCodeMessage'),
			saveFixedPairingCode: document.getElementById('saveFixedPairingCode'),
			disableFixedPairingCode: document.getElementById('disableFixedPairingCode'),
			debugHealthList: document.getElementById('debugHealthList'),
			debugFailureList: document.getElementById('debugFailureList'),
			debugHealthSummary: document.getElementById('debugHealthSummary'),
			debugHealthOverall: document.getElementById('debugHealthOverall'),
			rawStatusDetails: document.getElementById('rawStatusDetails'),
			rawStatusFilter: document.getElementById('rawStatusFilter'),
			updated: document.getElementById('updated'),
			lastEvent: document.getElementById('lastEvent'),
			renderError: document.getElementById('renderError'),
			connectionPill: document.getElementById('connectionPill'),
			bridgePill: document.getElementById('bridgePill'),
			codexPill: document.getElementById('codexPill'),
			jobCounts: document.getElementById('jobCounts'),
			version: document.getElementById('version'),
			maxConcurrent: document.getElementById('maxConcurrent'),
			codexCliVersion: document.getElementById('codexCliVersion'),
			codexBinary: document.getElementById('codexBinary'),
			detectedFeatures: document.getElementById('detectedFeatures'),
			backendDrivers: document.getElementById('backendDrivers'),
			providerSettings: document.getElementById('providerSettings'),
			relaySettingsForm: document.getElementById('relaySettingsForm'),
			relayDefaultSettings: document.getElementById('relayDefaultSettings'),
			relayTokenDefaults: document.getElementById('relayTokenDefaults'),
			relayRuntimeSettings: document.getElementById('relayRuntimeSettings'),
			relayRuntimeMessage: document.getElementById('relayRuntimeMessage'),
			saveRelayRuntimeSettings: document.getElementById('saveRelayRuntimeSettings'),
			relaySettingsMessage: document.getElementById('relaySettingsMessage'),
			refreshRelayProviders: document.getElementById('refreshRelayProviders'),
			reloadRelaySettings: document.getElementById('reloadRelaySettings'),
			saveRelaySettings: document.getElementById('saveRelaySettings'),
			discardRelaySettings: document.getElementById('discardRelaySettings'),
			relaySaveBar: document.getElementById('relaySaveBar'),
			relaySaveBarText: document.getElementById('relaySaveBarText'),
			discardRuntimeSettings: document.getElementById('discardRuntimeSettings'),
			runtimeSaveBar: document.getElementById('runtimeSaveBar'),
			runtimeSaveBarText: document.getElementById('runtimeSaveBarText'),
			providerChatTests: document.getElementById('providerChatTests'),
			runAllChatTests: document.getElementById('runAllChatTests'),
			cancelAllChatTests: document.getElementById('cancelAllChatTests'),
			chatRunAllSummary: document.getElementById('chatRunAllSummary'),
			chatRunAllCounts: document.getElementById('chatRunAllCounts'),
			chatRunAllProgress: document.getElementById('chatRunAllProgress'),
			chatSummaryBar: document.getElementById('chatSummaryBar'),
			testFocusNotice: document.getElementById('testFocusNotice'),
			providerImageTests: document.getElementById('providerImageTests'),
			providerVideoTests: document.getElementById('providerVideoTests'),
			providerAnalysisTests: document.getElementById('providerAnalysisTests'),
			providerAudioTests: document.getElementById('providerAudioTests'),
			providerTestTabButtons: Array.from(document.querySelectorAll('[data-provider-test-tab]')),
			providerTestTabPanels: Array.from(document.querySelectorAll('.provider-test-panel[role="tabpanel"]')),
			musicAnalysisSettingsForm: document.getElementById('musicAnalysisSettingsForm'),
			musicAnalysisSettings: document.getElementById('musicAnalysisSettings'),
			musicAnalysisSettingsMessage: document.getElementById('musicAnalysisSettingsMessage'),
			reloadMusicAnalysisSettings: document.getElementById('reloadMusicAnalysisSettings'),
			refreshMusicAnalysisRuntime: document.getElementById('refreshMusicAnalysisRuntime'),
			setupMusicAnalysis: document.getElementById('setupMusicAnalysis'),
			saveMusicAnalysisSettings: document.getElementById('saveMusicAnalysisSettings'),
			discardMusicAnalysisSettings: document.getElementById('discardMusicAnalysisSettings'),
			musicSaveBar: document.getElementById('musicSaveBar'),
			musicSaveBarText: document.getElementById('musicSaveBarText'),
			upscaleSettingsForm: document.getElementById('upscaleSettingsForm'),
			upscaleSettings: document.getElementById('upscaleSettings'),
			upscaleModelStates: document.getElementById('upscaleModelStates'),
			upscaleSettingsMessage: document.getElementById('upscaleSettingsMessage'),
			reloadUpscaleSettings: document.getElementById('reloadUpscaleSettings'),
			upscaleInstallActions: document.getElementById('upscaleInstallActions'),
			saveUpscaleSettings: document.getElementById('saveUpscaleSettings'),
			discardUpscaleSettings: document.getElementById('discardUpscaleSettings'),
			upscaleSaveBar: document.getElementById('upscaleSaveBar'),
			upscaleSaveBarText: document.getElementById('upscaleSaveBarText'),
			upscaleSetupLog: document.getElementById('upscaleSetupLog'),
			imageSettingsForm: document.getElementById('imageSettingsForm'),
			imageSettings: document.getElementById('imageSettings'),
			imageModelStates: document.getElementById('imageModelStates'),
			imageSettingsMessage: document.getElementById('imageSettingsMessage'),
			reloadImageSettings: document.getElementById('reloadImageSettings'),
			imageInstallActions: document.getElementById('imageInstallActions'),
			setupImageEnvironment: document.getElementById('setupImageEnvironment'),
			saveImageSettings: document.getElementById('saveImageSettings'),
			discardImageSettings: document.getElementById('discardImageSettings'),
			imageSaveBar: document.getElementById('imageSaveBar'),
			imageSaveBarText: document.getElementById('imageSaveBarText'),
			imageSetupLog: document.getElementById('imageSetupLog'),
			asrDetails: document.getElementById('asrDetails'),
			asrSettingsForm: document.getElementById('asrSettingsForm'),
			asrGeneralSettings: document.getElementById('asrGeneralSettings'),
			asrModelSettings: document.getElementById('asrModelSettings'),
			asrSettingsJson: document.getElementById('asrSettingsJson'),
			asrSettingsMessage: document.getElementById('asrSettingsMessage'),
			reloadAsrSettings: document.getElementById('reloadAsrSettings'),
			refreshAsrRuntime: document.getElementById('refreshAsrRuntime'),
			saveAsrSettings: document.getElementById('saveAsrSettings'),
			discardAsrSettings: document.getElementById('discardAsrSettings'),
			asrSaveBar: document.getElementById('asrSaveBar'),
			asrSaveBarText: document.getElementById('asrSaveBarText'),
			applyAsrSettingsJson: document.getElementById('applyAsrSettingsJson'),
			addAsrModel: document.getElementById('addAsrModel'),
			asrSetupLog: document.getElementById('asrSetupLog'),
			pairedSites: document.getElementById('pairedSites'),
			codexDetails: document.getElementById('codexDetails'),
			rawStatus: document.getElementById('rawStatus'),
			copyRawStatus: document.getElementById('copyRawStatus'),
			imageLightbox: document.getElementById('imageLightbox'),
			imageLightboxContent: document.getElementById('imageLightboxContent'),
			mediaLightboxVideo: document.getElementById('mediaLightboxVideo'),
			closeImageLightbox: document.getElementById('closeImageLightbox'),
		};

		const chatRunAll = { running: false, cancelled: false };
		const providerTestWaiters = new WeakMap();
		const providerTestPanels = new WeakMap();
		let pendingProviderTestRender = null;
		let providerTestStatusSerial = 0;
		// Provider-test tracker only: the job list from the last fresh status snapshot. The rest of the page never reads it,
		// so a failed status refresh cannot make old jobs look live.
		let providerTestLastKnownJobs = null;
		let providerTestLastFreshAt = 0;
		let providerTestFeedStale = false;
		let providerTestStaleSince = 0;
		const providerTestStatusTimeoutMs = 120000;
		const providerTestMissingMinMs = 45000;
		const providerTestMissingMinSnapshots = 3;
		const providerTestNotFoundMs = 60000;
		const providerTestPollMs = 5000;
		let providerTestPollInFlight = false;
		let providerTestLastPollAt = 0;

		// Routes: one per sidebar entry. Settings sections used to live under #settings/<section>;
		// those hashes (and #settings alone) still resolve, mapped to the section's own route.
		function routeIds() {
			return ['overview', 'live', 'providers', 'tests', 'runtime', 'asr', 'image', 'upscale', 'music', 'pairing', 'debug'];
		}

		function settingsRouteIds() {
			return ['providers', 'tests', 'runtime', 'asr', 'image', 'upscale', 'music', 'pairing'];
		}

		function isSettingsRoute(route) {
			return settingsRouteIds().includes(route);
		}

		function routeTitle(route) {
			const titles = { overview: 'Overview', live: 'Live', providers: 'Providers', tests: 'Tests', runtime: 'Runtime', asr: 'Local ASR', image: 'Local Image', upscale: 'CUDA Upscale', music: 'Music Analysis', pairing: 'Pairing', debug: 'Debug' };
			return titles[route] || titles.overview;
		}

		function safeDecode(value) {
			try {
				return decodeURIComponent(value);
			} catch (error) {
				return String(value);
			}
		}

		// The Tests route takes an optional test type and provider: #tests/<type>/<backend id>.
		function testTypeIds() {
			return ['chat', 'images', 'videos', 'analysis', 'audio'];
		}

		function normalizeTestType(value) {
			const aliases = { chat: 'chat', image: 'images', images: 'images', video: 'videos', videos: 'videos', analysis: 'analysis', 'video-analysis': 'analysis', 'media.analyze': 'analysis', audio: 'audio', transcribe: 'audio', 'music.analyze': 'audio' };
			const key = String(value || '').toLowerCase();
			return Object.prototype.hasOwnProperty.call(aliases, key) ? aliases[key] : '';
		}

		function testTabIdForType(type) {
			return 'provider-test-tab-' + normalizeTestType(type);
		}

		function testTypeForTabId(tabId) {
			return normalizeTestType(String(tabId || '').replace(/^provider-test-tab-/, ''));
		}

		function testTypeLabel(type) {
			const labels = { chat: 'chat', images: 'image', videos: 'video', analysis: 'video analysis', audio: 'audio' };
			return labels[normalizeTestType(type)] || 'provider';
		}

		function resolveRoute(hash) {
			const raw = String(hash || '').replace(/^#/, '');
			const parts = raw.split('/').filter(Boolean).map(safeDecode);
			const root = String(parts[0] || 'overview').toLowerCase();
			const result = { route: 'overview', liveRequestId: '', providerId: '', testType: '' };
			const applyTestParts = (offset) => {
				result.testType = normalizeTestType(parts[offset]);
				if (result.testType) result.providerId = parts[offset + 1] || '';
			};
			if (root === 'live') {
				result.route = 'live';
				result.liveRequestId = parts[1] || '';
				return result;
			}
			if (root === 'settings') {
				const section = String(parts[1] || '').toLowerCase();
				result.route = settingsRouteIds().includes(section) ? section : 'providers';
				if (result.route === 'providers') result.providerId = parts[2] || '';
				if (result.route === 'tests') applyTestParts(2);
				return result;
			}
			if (routeIds().includes(root)) {
				result.route = root;
				if (root === 'providers') result.providerId = parts[1] || '';
				if (root === 'tests') applyTestParts(1);
			}
			return result;
		}

		function hashForRoute(resolved) {
			const target = typeof resolved === 'string' ? { route: resolved, liveRequestId: '', providerId: '', testType: '' } : resolved;
			if (target.route === 'live' && target.liveRequestId) return 'live/' + encodeURIComponent(target.liveRequestId);
			if (target.route === 'providers' && target.providerId) return 'providers/' + encodeURIComponent(target.providerId);
			if (target.route === 'tests' && normalizeTestType(target.testType)) return 'tests/' + normalizeTestType(target.testType) + (target.providerId ? '/' + encodeURIComponent(target.providerId) : '');
			return target.route;
		}

		function parseHash() {
			return resolveRoute(location.hash);
		}

		function setHash(route, options = {}) {
			const next = route.startsWith('#') ? route : '#' + route;
			if (location.hash !== next) {
				if (options.replace === false) {
					location.hash = next;
				} else {
					history.replaceState(null, '', next);
				}
			}
		}

		// Theme preference: System (no attribute, follows prefers-color-scheme), Light, or Dark.
		function normalizeThemePreference(value) {
			return value === 'light' || value === 'dark' ? value : 'system';
		}

		function themeStorage() {
			try {
				return window.localStorage;
			} catch (error) {
				return null;
			}
		}

		function readThemePreference(storage) {
			try {
				return normalizeThemePreference(storage ? storage.getItem(themeStorageKey) : null);
			} catch (error) {
				return 'system';
			}
		}

		function saveThemePreference(storage, preference) {
			const next = normalizeThemePreference(preference);
			try {
				if (!storage) return false;
				if (next === 'system') storage.removeItem(themeStorageKey);
				else storage.setItem(themeStorageKey, next);
				return true;
			} catch (error) {
				return false;
			}
		}

		function applyThemePreference(root, preference) {
			const next = normalizeThemePreference(preference);
			if (next === 'system') root.removeAttribute('data-theme');
			else root.setAttribute('data-theme', next);
			return next;
		}

		function initTheme() {
			const root = document.documentElement;
			let preference = applyThemePreference(root, readThemePreference(themeStorage()));
			const showPreference = () => {
				fields.themeButtons.forEach((button) => {
					button.setAttribute('aria-pressed', button.getAttribute('data-theme-choice') === preference ? 'true' : 'false');
				});
			};
			showPreference();
			fields.themeButtons.forEach((button) => {
				button.addEventListener('click', () => {
					preference = applyThemePreference(root, button.getAttribute('data-theme-choice'));
					saveThemePreference(themeStorage(), preference);
					showPreference();
				});
			});
		}

		function navBadge(route) {
			return fields.navBadges.find((badge) => badge.getAttribute('data-nav-badge') === route) || null;
		}

		// Unsaved-edit tracking. An "edit" is a field whose current value differs from the baseline snapshot of the last loaded
		// settings. A reload renders the new settings, re-baselines from them and re-applies only those edits on top, so fields the
		// user did not touch always show the fresh values and a later Save cannot overwrite a change made elsewhere.
		function isPlainFormObject(value) {
			return !!value && typeof value === 'object' && !Array.isArray(value);
		}

		function diffFormEdits(baseline, current, path = [], edits = []) {
			if (isPlainFormObject(current) && isPlainFormObject(baseline)) {
				Object.keys(current).forEach((key) => diffFormEdits(baseline[key], current[key], path.concat(key), edits));
			} else if (Array.isArray(current) && Array.isArray(baseline) && current.length === baseline.length) {
				current.forEach((item, index) => diffFormEdits(baseline[index], item, path.concat(index), edits));
			} else if (JSON.stringify(current) !== JSON.stringify(baseline)) {
				edits.push({ path, value: current });
			}
			return edits;
		}

		function collectFormEdits(baselineJson, current) {
			if (!baselineJson) return [];
			try {
				const baseline = JSON.parse(baselineJson);
				return isPlainFormObject(baseline) && isPlainFormObject(current) ? diffFormEdits(baseline, current) : [];
			} catch (error) {
				return [];
			}
		}

		// Writes edits onto target and returns the ones that were applied. Without the create flag an edit is dropped when its field no
		// longer exists in target (the new settings do not have it any more).
		function applyFormEdits(target, edits, create) {
			const applied = [];
			(edits || []).forEach((edit) => {
				if (!edit || !Array.isArray(edit.path) || !edit.path.length || !isPlainFormObject(target)) return;
				let node = target;
				for (let index = 0; index < edit.path.length - 1; index += 1) {
					const key = edit.path[index];
					if (node === null || typeof node !== 'object') return;
					if (!Object.prototype.hasOwnProperty.call(node, key) || node[key] === null || typeof node[key] !== 'object') {
						if (!create || (node[key] !== undefined && node[key] !== null)) return;
						node[key] = typeof edit.path[index + 1] === 'number' ? [] : {};
					}
					node = node[key];
				}
				const last = edit.path[edit.path.length - 1];
				if (node === null || typeof node !== 'object') return;
				if (!create && !Object.prototype.hasOwnProperty.call(node, last)) return;
				node[last] = edit.value;
				applied.push(edit);
			});
			return applied;
		}

		function relayFormEdits(section) {
			try {
				return collectFormEdits(formSnapshots[section], collectRelaySettingsPayload(section));
			} catch (error) {
				return [];
			}
		}

		// Re-applies the edits of each section on top of the freshly rendered (and re-baselined) form. Returns how many fields were kept.
		function reapplyRelayEdits(editsBySection) {
			let kept = 0;
			Object.keys(editsBySection || {}).forEach((section) => {
				const edits = editsBySection[section];
				if (!edits || !edits.length) return;
				let merged = null;
				try { merged = collectRelaySettingsPayload(section); } catch (error) { return; }
				const applied = applyFormEdits(merged, edits, false);
				if (!applied.length) return;
				restoreRelaySection(section, merged);
				kept += applied.length;
			});
			if (kept) updateSettingsDirtyState();
			return kept;
		}

		function engineFormEdits(key, serialize) {
			try {
				return collectFormEdits(formSnapshots[key], serialize());
			} catch (error) {
				return [];
			}
		}

		// Local engine pages: the form was just rendered from the new settings and re-baselined; put the user's edits back by
		// rendering the new settings once more with only the edited fields replaced. Returns how many fields were kept.
		function reapplyEngineEdits(edits, serialize, render, settings) {
			if (!edits || !edits.length) return 0;
			let serialized = null;
			try { serialized = serialize(); } catch (error) { return 0; }
			const applied = applyFormEdits(serialized, edits, false);
			if (!applied.length) return 0;
			const merged = JSON.parse(JSON.stringify(settings || {}));
			applyFormEdits(merged, applied, true);
			render(merged);
			updateSettingsDirtyState();
			return applied.length;
		}

		// A local engine page cannot be saved or set up before its settings were loaded: the form is empty (or not rendered at all)
		// and would post blank values over the stored settings. engineBaselines[key] is set by the first successful load or save.
		function engineSettingsMissing(key, message, text) {
			if (engineBaselines[key]) return false;
			if (message) message.textContent = text;
			return true;
		}

		// A save response becomes the new baseline: renderSaved() renders it (and sets engineBaselines[key]), then only the fields
		// edited while the request was in flight (current value differs from what was sent) are put back on top, leaving the form
		// dirty. Returns how many fields were kept; values the server normalized are shown as saved.
		function applyEngineSaveResult(key, sent, serialize, renderSaved, renderMerged) {
			let edits = [];
			try { edits = collectFormEdits(JSON.stringify(sent), serialize()); } catch (error) { edits = []; }
			renderSaved();
			captureFormSnapshots([key]);
			return reapplyEngineEdits(edits, serialize, renderMerged, engineBaselines[key].settings);
		}

		function engineSavedText(kept) {
			return kept ? 'Saved - changes made while saving are still unsaved' : 'Saved';
		}

		function isFormDirty(key) {
			if (key === 'relay') {
				try {
					return formSnapshots.relay && JSON.stringify(collectRelaySettingsPayload('relay')) !== formSnapshots.relay;
				} catch (error) {
					return true;
				}
			}
			if (key === 'runtime') {
				try {
					return formSnapshots.runtime && JSON.stringify(collectRelaySettingsPayload('runtime')) !== formSnapshots.runtime;
				} catch (error) {
					return true;
				}
			}
			if (key === 'asr') {
				try {
					return formSnapshots.asr && JSON.stringify(serializeAsrSettingsForm()) !== formSnapshots.asr;
				} catch (error) {
					return true;
				}
			}
			if (key === 'music') {
				try {
					return formSnapshots.music && JSON.stringify(serializeMusicAnalysisSettings()) !== formSnapshots.music;
				} catch (error) {
					return false;
				}
			}
			if (key === 'upscale') {
				try {
					return formSnapshots.upscale && JSON.stringify(serializeUpscaleSettings()) !== formSnapshots.upscale;
				} catch (error) {
					return false;
				}
			}
			if (key === 'image') {
				try {
					return formSnapshots.image && JSON.stringify(serializeImageSettings()) !== formSnapshots.image;
				} catch (error) {
					return false;
				}
			}
			return false;
		}

		function updateSettingsDirtyState() {
			const dirtyRoutes = { providers: 'relay', runtime: 'runtime', asr: 'asr', music: 'music', upscale: 'upscale', image: 'image' };
			Object.keys(dirtyRoutes).forEach((route) => {
				const badge = navBadge(route);
				if (badge) badge.hidden = !isFormDirty(dirtyRoutes[route]);
			});
			// The sticky Save / Discard bars of Providers and Runtime appear only while their form differs from the last loaded settings.
			if (fields.relaySaveBar) fields.relaySaveBar.hidden = !isFormDirty('relay');
			if (fields.runtimeSaveBar) fields.runtimeSaveBar.hidden = !isFormDirty('runtime');
			if (fields.saveRelaySettings) fields.saveRelaySettings.disabled = !isFormDirty('relay');
			if (fields.saveRelayRuntimeSettings) fields.saveRelayRuntimeSettings.disabled = !isFormDirty('runtime');
			if (fields.saveAsrSettings) fields.saveAsrSettings.disabled = !isFormDirty('asr');
			if (fields.saveMusicAnalysisSettings) fields.saveMusicAnalysisSettings.disabled = !isFormDirty('music');
			if (fields.saveUpscaleSettings) fields.saveUpscaleSettings.disabled = !isFormDirty('upscale');
			if (fields.saveImageSettings) fields.saveImageSettings.disabled = !isFormDirty('image');
			// The local engine pages get the same sticky Save / Discard bar while their form differs from the loaded settings.
			if (fields.asrSaveBar) fields.asrSaveBar.hidden = !isFormDirty('asr');
			if (fields.musicSaveBar) fields.musicSaveBar.hidden = !isFormDirty('music');
			if (fields.upscaleSaveBar) fields.upscaleSaveBar.hidden = !isFormDirty('upscale');
			if (fields.imageSaveBar) fields.imageSaveBar.hidden = !isFormDirty('image');
		}

		function captureFormSnapshots(keys) {
			const targets = Array.isArray(keys) && keys.length ? keys : ['relay', 'runtime', 'asr', 'music', 'upscale', 'image'];
			if (targets.includes('relay')) {
				try {
					formSnapshots.relay = JSON.stringify(collectRelaySettingsPayload('relay'));
				} catch (error) {
					formSnapshots.relay = '';
				}
			}
			if (targets.includes('runtime')) {
				try {
					formSnapshots.runtime = JSON.stringify(collectRelaySettingsPayload('runtime'));
				} catch (error) {
					formSnapshots.runtime = '';
				}
			}
			if (targets.includes('asr')) {
				try {
					formSnapshots.asr = JSON.stringify(serializeAsrSettingsForm());
				} catch (error) {
					formSnapshots.asr = '';
				}
			}
			if (targets.includes('music')) {
				try {
					formSnapshots.music = JSON.stringify(serializeMusicAnalysisSettings());
				} catch (error) {
					formSnapshots.music = '';
				}
			}
			if (targets.includes('upscale')) {
				try {
					formSnapshots.upscale = JSON.stringify(serializeUpscaleSettings());
				} catch (error) {
					formSnapshots.upscale = '';
				}
			}
			if (targets.includes('image')) {
				try {
					formSnapshots.image = JSON.stringify(serializeImageSettings());
				} catch (error) {
					formSnapshots.image = '';
				}
			}
			updateSettingsDirtyState();
			// Stored values that are out of range show their non-blocking warning as soon as the settings are loaded.
			try {
				if (targets.includes('relay') && fields.relaySettingsForm) validateRelaySection('relay');
				if (targets.includes('runtime') && fields.relayRuntimeSettings) validateRelaySection('runtime');
			} catch (error) {}
		}

		function collectRelaySettingsPayload(section) {
			const defaults = {};
			const cli_paths = {};
			const token_defaults = {};
			const timeouts = {};
			fields.relayDefaultSettings.querySelectorAll('[data-relay-job]').forEach((select) => {
				defaults[select.getAttribute('data-relay-job')] = select.value;
			});
			fields.providerSettings.querySelectorAll('[data-relay-cli-path]').forEach((input) => {
				cli_paths[input.getAttribute('data-relay-cli-path')] = input.value.trim();
			});
			fields.relayTokenDefaults.querySelectorAll('[data-relay-token-default]').forEach((input) => {
				token_defaults[input.getAttribute('data-relay-token-default')] = input.value.trim();
			});
			(fields.relayRuntimeSettings ? fields.relayRuntimeSettings.querySelectorAll('[data-relay-timeout]') : []).forEach((input) => {
				timeouts[input.getAttribute('data-relay-timeout')] = input.value.trim();
			});
			const maxConcurrent = document.getElementById('relayMaxConcurrent');
			const enabledSelect = document.getElementById('relayOpenaiEnabled');
			const enabledValue = enabledSelect ? enabledSelect.value : '';
			const runtime = { timeouts };
			if (maxConcurrent) runtime.max_concurrent_jobs = maxConcurrent.value.trim();
			const codexImageToolValue = (document.getElementById('relayCodexImageTool') || {}).value === 'generations' ? 'generations' : 'image_gen';
			const payload = {
				defaults,
				cli_paths,
				token_defaults,
				runtime,
				codex_image_tool: codexImageToolValue,
				providers: {
					anthropic: {
						api_key: (document.getElementById('relayAnthropicApiKey') || {}).value || '',
						clear_api_key: !!(document.getElementById('relayAnthropicApiKeyClear') && document.getElementById('relayAnthropicApiKeyClear').checked),
						admin_api_key: (document.getElementById('relayAnthropicAdminKey') || {}).value || '',
						clear_admin_api_key: !!(document.getElementById('relayAnthropicAdminKeyClear') && document.getElementById('relayAnthropicAdminKeyClear').checked),
						base_url: (document.getElementById('relayAnthropicBaseUrl') || {}).value || '',
						models: (document.getElementById('relayAnthropicModels') || {}).value || '',
						monthly_limit_usd: ((document.getElementById('relayAnthropicMonthlyLimit') || {}).value || '').trim(),
						credit_balance_usd: ((document.getElementById('relayAnthropicCreditBalance') || {}).value || '').trim(),
						credit_balance_rebaseline: !!(document.getElementById('relayAnthropicCreditRebaseline') && document.getElementById('relayAnthropicCreditRebaseline').checked),
					},
					xai: {
						api_key: (document.getElementById('relayXaiApiKey') || {}).value || '',
						clear_api_key: !!(document.getElementById('relayXaiApiKeyClear') && document.getElementById('relayXaiApiKeyClear').checked),
						base_url: (document.getElementById('relayXaiBaseUrl') || {}).value || '',
						models: (document.getElementById('relayXaiModels') || {}).value || '',
					},
					openai_videos: {
						enabled: enabledValue === '' ? null : enabledValue === 'true',
						api_key: (document.getElementById('relayOpenaiApiKey') || {}).value || '',
						clear_api_key: !!(document.getElementById('relayOpenaiApiKeyClear') && document.getElementById('relayOpenaiApiKeyClear').checked),
					},
					api_key_chat: {
						api_key: (document.getElementById('relayApiKeyChatKey') || {}).value || '',
						clear_api_key: !!(document.getElementById('relayApiKeyChatKeyClear') && document.getElementById('relayApiKeyChatKeyClear').checked),
						base_url: (document.getElementById('relayApiKeyChatBaseUrl') || {}).value || '',
						provider_id: (document.getElementById('relayApiKeyChatProviderId') || {}).value || '',
						model: (document.getElementById('relayApiKeyChatModel') || {}).value || '',
					},
					cli_process: {
						args: (document.getElementById('relayCliProcessArgs') || {}).value || '',
					},
					grok: {
						imagine_skill: (document.getElementById('relayGrokImagineSkill') || {}).value || '',
					},
					antigravity: {
						state_dir: (document.getElementById('relayAntigravityStateDir') || {}).value || '',
					},
				},
			};
			if (section === 'runtime') return { runtime: payload.runtime };
			if (section === 'relay') {
				return {
					defaults: payload.defaults,
					cli_paths: payload.cli_paths,
					token_defaults: payload.token_defaults,
					providers: payload.providers,
					codex_image_tool: payload.codex_image_tool,
				};
			}
			return payload;
		}

		// Puts an edited routing default back. When the model is no longer offered (it became unavailable after a background reload)
		// the value is added as a disabled option, like renderRelaySettings does for saved values, so the edit stays visible
		// instead of being replaced by a blank select.
		function setRoutingSelectValue(select, value) {
			const wanted = value == null ? '' : String(value);
			if (wanted && select.options) {
				const known = Array.from(select.options).some((option) => option.value === wanted);
				if (!known) select.innerHTML = '<option value="' + escapeHtml(wanted) + '" selected disabled>Unavailable selection: ' + escapeHtml(wanted) + '</option>' + select.innerHTML;
			}
			select.value = wanted;
		}

		function restoreRelaySection(section, preserved) {
			if (!preserved) return;
			if (section === 'runtime') {
				const runtime = preserved.runtime || {};
				const maxConcurrent = document.getElementById('relayMaxConcurrent');
				if (maxConcurrent && runtime.max_concurrent_jobs != null) maxConcurrent.value = runtime.max_concurrent_jobs;
				const timeouts = runtime.timeouts || {};
				(fields.relayRuntimeSettings ? fields.relayRuntimeSettings.querySelectorAll('[data-relay-timeout]') : []).forEach((input) => {
					const key = input.getAttribute('data-relay-timeout');
					if (key && Object.prototype.hasOwnProperty.call(timeouts, key)) input.value = timeouts[key];
				});
				return;
			}
			const defaults = preserved.defaults || {};
			fields.relayDefaultSettings.querySelectorAll('[data-relay-job]').forEach((select) => {
				const job = select.getAttribute('data-relay-job');
				if (Object.prototype.hasOwnProperty.call(defaults, job)) setRoutingSelectValue(select, defaults[job]);
			});
			const cliPaths = preserved.cli_paths || {};
			fields.providerSettings.querySelectorAll('[data-relay-cli-path]').forEach((input) => {
				const key = input.getAttribute('data-relay-cli-path');
				if (Object.prototype.hasOwnProperty.call(cliPaths, key)) input.value = cliPaths[key];
			});
			const tokenDefaults = preserved.token_defaults || {};
			fields.relayTokenDefaults.querySelectorAll('[data-relay-token-default]').forEach((input) => {
				const key = input.getAttribute('data-relay-token-default');
				if (Object.prototype.hasOwnProperty.call(tokenDefaults, key)) input.value = tokenDefaults[key];
			});
			const providers = preserved.providers || {};
			const xai = providers.xai || {};
			const openai = providers.openai_videos || {};
			const apiKeyChat = providers.api_key_chat || {};
			const setValue = (id, value) => {
				const el = document.getElementById(id);
				if (el) el.value = value == null ? '' : value;
			};
			const setChecked = (id, value) => {
				const el = document.getElementById(id);
				if (el) el.checked = !!value;
			};
			const anthropicPreserved = providers.anthropic || {};
			setValue('relayAnthropicApiKey', anthropicPreserved.api_key);
			setChecked('relayAnthropicApiKeyClear', anthropicPreserved.clear_api_key);
			setValue('relayAnthropicAdminKey', anthropicPreserved.admin_api_key);
			setChecked('relayAnthropicAdminKeyClear', anthropicPreserved.clear_admin_api_key);
			setValue('relayAnthropicBaseUrl', anthropicPreserved.base_url);
			setValue('relayAnthropicModels', anthropicPreserved.models);
			setValue('relayAnthropicMonthlyLimit', anthropicPreserved.monthly_limit_usd);
			setValue('relayAnthropicCreditBalance', anthropicPreserved.credit_balance_usd);
			setChecked('relayAnthropicCreditRebaseline', anthropicPreserved.credit_balance_rebaseline);
			setValue('relayXaiApiKey', xai.api_key);
			setChecked('relayXaiApiKeyClear', xai.clear_api_key);
			setValue('relayXaiBaseUrl', xai.base_url);
			setValue('relayXaiModels', xai.models);
			const enabledSelect = document.getElementById('relayOpenaiEnabled');
			if (enabledSelect) enabledSelect.value = openai.enabled === true ? 'true' : (openai.enabled === false ? 'false' : '');
			setValue('relayOpenaiApiKey', openai.api_key);
			setChecked('relayOpenaiApiKeyClear', openai.clear_api_key);
			setValue('relayApiKeyChatKey', apiKeyChat.api_key);
			setChecked('relayApiKeyChatKeyClear', apiKeyChat.clear_api_key);
			setValue('relayApiKeyChatBaseUrl', apiKeyChat.base_url);
			setValue('relayApiKeyChatProviderId', apiKeyChat.provider_id);
			setValue('relayApiKeyChatModel', apiKeyChat.model);
			setValue('relayCliProcessArgs', (providers.cli_process && providers.cli_process.args) || '');
			setValue('relayGrokImagineSkill', (providers.grok && providers.grok.imagine_skill) || '');
			setValue('relayAntigravityStateDir', (providers.antigravity && providers.antigravity.state_dir) || '');
			const imageTool = document.getElementById('relayCodexImageTool');
			if (imageTool && Object.prototype.hasOwnProperty.call(preserved, 'codex_image_tool')) imageTool.value = preserved.codex_image_tool === 'generations' ? 'generations' : 'image_gen';
			syncSecretFields();
		}

		function ensureSettingsLoaded() {
			if (!settingsLoaded) {
				settingsLoaded = true;
				loadAsrSettings();
				loadMusicAnalysisSettings();
				loadUpscaleSettings();
				loadImageSettings();
				loadRelaySettings();
			}
		}

		function setDrawerOpen(open) {
			if (!fields.sidebar) return;
			fields.sidebar.classList.toggle('is-open', !!open);
			if (fields.sidebarBackdrop) fields.sidebarBackdrop.hidden = !open;
			if (fields.menuToggle) {
				fields.menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
				fields.menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
			}
		}

		// Expands or collapses one provider card and remembers the choice, so a re-render keeps it.
		function setProviderCardOpen(card, open) {
			if (!card) return;
			const toggle = card.querySelector('[data-provider-toggle]');
			const body = card.querySelector('[data-provider-body]');
			if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
			if (body) body.hidden = !open;
			card.setAttribute('data-expanded', open ? 'true' : 'false');
			const id = card.getAttribute('data-provider-id');
			if (id) providerCardOpen.set(id, !!open);
		}

		// Expands, scrolls to, and briefly highlights a provider card once the Providers view has rendered it.
		function applyProviderFocus() {
			const id = pendingProviderFocus;
			if (!id || currentRoute !== 'providers' || !fields.providerSettings) return false;
			const target = fields.providerSettings.querySelector('[data-provider-id="' + CSS.escape(id) + '"]');
			if (!target) return false;
			pendingProviderFocus = '';
			setProviderCardOpen(target, true);
			target.scrollIntoView({ block: 'center' });
			try {
				target.focus({ preventScroll: true });
			} catch (error) {}
			target.classList.remove('is-highlighted');
			void target.offsetWidth;
			target.classList.add('is-highlighted');
			setTimeout(() => target.classList.remove('is-highlighted'), 2600);
			return true;
		}

		function selectRoute(routeId, options = {}) {
			const next = routeIds().includes(routeId) ? routeId : 'overview';
			currentRoute = next;
			if (next !== 'providers') pendingProviderFocus = '';
			if (next !== 'tests') pendingTestFocus = null;
			for (const view of fields.routeViews) {
				view.hidden = view.getAttribute('data-view') !== next;
			}
			for (const item of fields.navItems) {
				if (item.getAttribute('data-route') === next) item.setAttribute('aria-current', 'page');
				else item.removeAttribute('aria-current');
			}
			const title = routeTitle(next);
			if (fields.pageTitle) fields.pageTitle.textContent = title;
			document.title = title + ' · ' + baseDocumentTitle;
			const drawerWasOpen = !!(fields.sidebar && fields.sidebar.classList.contains('is-open'));
			setDrawerOpen(false);
			if ((options.focus || drawerWasOpen) && fields.pageTitle) {
				fields.pageTitle.focus({ preventScroll: true });
			}
			if (!options.skipHash) {
				if (next === 'live') {
					livePinned = false;
					setHash('live');
					autoSelectLiveJob(currentStatus.jobs || {});
				} else {
					setHash(next);
				}
			}
			if (isSettingsRoute(next)) ensureSettingsLoaded();
			if (next === 'pairing') loadPairingSettings();
			return true;
		}

		function applyRoute(resolved, options = {}) {
			if (!selectRoute(resolved.route, { skipHash: true, focus: options.focus })) {
				return false;
			}
			if (resolved.route === 'live') {
				if (resolved.liveRequestId) {
					selectLiveJob(resolved.liveRequestId, { skipHash: true, pin: true });
				} else {
					livePinned = false;
					selectedLiveRequestId = '';
					autoSelectLiveJob(currentStatus.jobs || {});
				}
			}
			if (resolved.route === 'providers' && resolved.providerId) {
				pendingProviderFocus = resolved.providerId;
				applyProviderFocus();
			}
			if (resolved.route === 'tests') {
				if (resolved.testType) selectProviderTestTab(testTabIdForType(resolved.testType), { skipHash: true });
				if (resolved.testType && resolved.providerId) {
					pendingTestFocus = { type: resolved.testType, providerId: resolved.providerId };
					applyTestFocus();
				} else {
					pendingTestFocus = null;
					showTestFocusNotice('');
				}
			}
			return true;
		}

		function applyRouteFromHash(options = {}) {
			applyRoute(parseHash(), { focus: options.focus });
		}

		// target: a route or an old/new hash target such as "providers/codex-cli" or "settings/asr".
		function navigateTo(target) {
			const resolved = resolveRoute(target);
			if (!applyRoute(resolved)) return false;
			setHash(hashForRoute(resolved));
			return true;
		}

		function initNav() {
			fields.navItems.forEach((item, index) => {
				item.addEventListener('click', (event) => {
					if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
					event.preventDefault();
					navigateTo(item.getAttribute('data-route'));
				});
				item.addEventListener('keydown', (event) => {
					if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
					event.preventDefault();
					let nextIndex = index;
					if (event.key === 'Home') nextIndex = 0;
					else if (event.key === 'End') nextIndex = fields.navItems.length - 1;
					else nextIndex = (index + (event.key === 'ArrowDown' ? 1 : -1) + fields.navItems.length) % fields.navItems.length;
					fields.navItems[nextIndex].focus();
				});
			});
			if (fields.menuToggle) {
				fields.menuToggle.addEventListener('click', () => {
					const open = !fields.sidebar.classList.contains('is-open');
					setDrawerOpen(open);
					if (open && fields.navItems.length) {
						const current = fields.navItems.find((item) => item.getAttribute('aria-current') === 'page') || fields.navItems[0];
						current.focus();
					}
				});
			}
			if (fields.sidebarBackdrop) fields.sidebarBackdrop.addEventListener('click', () => setDrawerOpen(false));
			document.addEventListener('keydown', (event) => {
				if (event.key === 'Escape' && fields.sidebar.classList.contains('is-open')) {
					setDrawerOpen(false);
					if (fields.menuToggle) fields.menuToggle.focus();
				}
			});
			try {
				const wide = window.matchMedia('(min-width: 900px)');
				const closeOnWide = (event) => { if (event.matches) setDrawerOpen(false); };
				if (wide.addEventListener) wide.addEventListener('change', closeOnWide);
			} catch (error) {}
			window.addEventListener('hashchange', () => {
				applyRouteFromHash();
			});
			applyRouteFromHash();
		}

		// Segmented control of test types. A manual choice is mirrored in the hash (#tests/<type>); the initial and
		// route-driven selections pass skipHash.
		function selectProviderTestTab(tabId, options = {}) {
			const nextButton = fields.providerTestTabButtons.find((button) => button.id === tabId) || fields.providerTestTabButtons[0];
			if (!nextButton) return;
			const nextPanelId = nextButton.getAttribute('aria-controls');
			for (const button of fields.providerTestTabButtons) {
				const selected = button === nextButton;
				button.setAttribute('aria-selected', selected ? 'true' : 'false');
				button.tabIndex = selected ? 0 : -1;
			}
			for (const panel of fields.providerTestTabPanels) panel.hidden = panel.id !== nextPanelId;
			if (options.focus) nextButton.focus();
			if (!options.skipHash && currentRoute === 'tests') {
				pendingTestFocus = null;
				showTestFocusNotice('');
				setHash(hashForRoute({ route: 'tests', liveRequestId: '', providerId: '', testType: testTypeForTabId(nextButton.id) }));
			}
		}

		function testPanelForType(type) {
			const panelId = 'provider-test-panel-' + normalizeTestType(type);
			return fields.providerTestTabPanels.find((panel) => panel.id === panelId) || null;
		}

		function showTestFocusNotice(message) {
			const notice = fields.testFocusNotice;
			if (!notice) return;
			notice.textContent = message || '';
			notice.hidden = !message;
		}

		// Scrolls to and briefly highlights the test card(s) of one provider once the Tests view has rendered them. The route
		// is #tests/<type>/<backend id>; when settings have loaded and no ready card exists, a notice says so instead.
		function applyTestFocus() {
			const focus = pendingTestFocus;
			if (!focus || currentRoute !== 'tests') return false;
			const panel = testPanelForType(focus.type);
			if (!panel) {
				pendingTestFocus = null;
				return false;
			}
			const cards = Array.from(panel.querySelectorAll('[data-test-backend="' + CSS.escape(focus.providerId) + '"]'));
			if (!cards.length) {
				if (!lastRelaySettingsPayload) return false;
				pendingTestFocus = null;
				const backends = Array.isArray(lastRelaySettingsPayload.backends) ? lastRelaySettingsPayload.backends : [];
				const match = backends.find((backend) => backend && backend.id === focus.providerId);
				showTestFocusNotice('No ready ' + testTypeLabel(focus.type) + ' test is available for ' + String(match && match.label || focus.providerId) + '. Check that the provider is ready on the Providers page.');
				return false;
			}
			pendingTestFocus = null;
			showTestFocusNotice('');
			cards.forEach((card) => {
				card.classList.remove('is-highlighted');
				void card.offsetWidth;
				card.classList.add('is-highlighted');
				setTimeout(() => card.classList.remove('is-highlighted'), 2600);
			});
			cards[0].scrollIntoView({ block: 'center' });
			return true;
		}

		function initProviderTestTabs() {
			fields.providerTestTabButtons.forEach((button, index) => {
				button.addEventListener('click', () => selectProviderTestTab(button.id));
				button.addEventListener('keydown', (event) => {
					if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
					event.preventDefault();
					let nextIndex = index;
					if (event.key === 'Home') nextIndex = 0;
					else if (event.key === 'End') nextIndex = fields.providerTestTabButtons.length - 1;
					else nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + fields.providerTestTabButtons.length) % fields.providerTestTabButtons.length;
					selectProviderTestTab(fields.providerTestTabButtons[nextIndex].id, { focus: true });
				});
			});
			selectProviderTestTab('provider-test-tab-chat', { skipHash: true });
		}

		// Shows how many cards each test type has, so the segmented control tells you where tests are available.
		function updateProviderTestCounts() {
			(fields.providerTestTabButtons || []).forEach((button) => {
				const panel = testPanelForType(testTypeForTabId(button.id));
				const badge = button.querySelector('[data-test-count]');
				if (!badge || !panel) return;
				const count = panel.querySelectorAll('[data-provider-media-test]').length;
				badge.textContent = String(count);
				badge.hidden = count <= 0;
			});
		}

		function formatArtifactBytes(sizeBytes) {
			const bytes = Number(sizeBytes);
			if (!Number.isFinite(bytes) || bytes < 0) return '';
			if (bytes < 1024) return bytes + ' B';
			if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0) + ' KB';
			return (bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0) + ' MB';
		}

		function artifactMetaLabel(artifact) {
			const parts = [];
			const width = Number(artifact && artifact.width);
			const height = Number(artifact && artifact.height);
			if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
				parts.push(width + ' × ' + height);
			}
			const sizeLabel = formatArtifactBytes(artifact && artifact.size_bytes);
			if (sizeLabel) parts.push(sizeLabel);
			return parts.join(' · ');
		}

		function text(value, fallback = '-') {
			const normalized = String(value ?? '').trim();
			return normalized || fallback;
		}

		function normalizeText(value) {
			return String(value || '')
				.replace(/â/g, "'")
				.replace(/â/g, "'")
				.replace(/â/g, '"')
				.replace(/â/g, '"')
				.replace(/â/g, '-')
				.replace(/â/g, '-')
				.replace(/â¦/g, '...')
				.replace(/Â /g, ' ')
				.replace(/Â/g, '');
		}

		function escapeHtml(value) {
			return text(value, '').replace(/[&<>"']/g, (char) => ({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			}[char]));
		}

		function elapsed(ms) {
			const seconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
			const minutes = Math.floor(seconds / 60);
			return minutes > 0 ? minutes + 'm ' + (seconds % 60) + 's' : seconds + 's';
		}

		function setPill(element, state, label) {
			element.className = 'pill ' + state;
			element.querySelector('span:last-child').textContent = label;
		}

		function setConnection(state, label) {
			fields.connectionPill.className = 'pill connection-pill ' + state;
			fields.connectionPill.querySelector('span:last-child').textContent = label;
		}

		function markLiveEvent(label) {
			fields.lastEvent.textContent = label + ' event ' + new Date().toLocaleTimeString();
		}

		function statusClass(status) {
			const normalized = String(status || '').toLowerCase();
			if (normalized === 'completed') return 'status-completed';
			if (normalized === 'failed') return 'status-failed';
			if (normalized === 'cancelled' || normalized === 'canceled') return 'status-cancelled';
			if (normalized === 'running') return 'status-running';
			if (normalized === 'pending') return 'status-pending';
			if (normalized === 'queued' || normalized === 'expired' || normalized === 'cancelling') return 'status-queued';
			return '';
		}

		function statusText(status) {
			const normalized = String(status || 'unknown');
			return '<span class="live-status-pill ' + statusClass(normalized) + '"><span class="live-status-dot"></span>' + escapeHtml(normalized) + '</span>';
		}

		function elapsedSpan(job, live) {
			const base = Number(job.elapsed_ms || 0);
			return '<span class="elapsed" data-live-elapsed="' + (live ? 'true' : 'false') + '" data-elapsed-base="' + base + '" data-elapsed-captured="' + Date.now() + '">' + elapsed(base) + '</span>';
		}

		function shortLiveRequestId(requestId) {
			const value = String(requestId || '').trim();
			return value.length > 18 ? value.slice(0, 8) + '...' + value.slice(-6) : value;
		}

		// One readable block of session input / output: label, size, Copy, and a monospace area that wraps (or scrolls
		// sideways when the detail panel's Wrap lines toggle is off). The text is filled in by updateSessionOutput.
		function sessionOutputBlock(label, options = {}) {
			const live = !!options.live;
			const key = text(options.key, '');
			return '<div class="session-output-block' + (live ? ' is-live' : '') + '" data-session-block>' +
				'<div class="session-output-summary">' +
					'<span class="label">' + escapeHtml(label) + '</span>' +
					'<span class="session-output-size" data-session-size></span>' +
					'<button type="button" class="copy-session-output">Copy</button>' +
				'</div>' +
				'<pre class="session-output' + (live ? ' live-session-output' : '') + '" data-session-key="' + escapeHtml(key) + '" tabindex="0"></pre>' +
			'</div>';
		}

		function formatCharCount(count) {
			const value = Math.max(0, Number(count) || 0);
			return value < 1000 ? value + (value === 1 ? ' char' : ' chars') : (value / 1000).toFixed(value < 10000 ? 1 : 0) + 'k chars';
		}

		// Error details of a failed job (or the reason a job was cancelled), as a copyable block. The message is escaped here.
		function liveErrorBlock(job, status) {
			const message = String(job && job.error_message || '').trim();
			if (!message && status !== 'failed') return '';
			const title = status === 'cancelled' ? 'Cancelled' : 'Error';
			return '<div class="session-output-block live-error" role="alert"><div class="session-output-summary"><span class="label">' + escapeHtml(title) + '</span>' +
				'<button type="button" class="copy-session-output">Copy</button></div>' +
				'<pre class="session-output live-error-text" tabindex="0">' + escapeHtml(message || 'The job failed without an error message.') + '</pre></div>';
		}

		function liveTypeLabel(type) {
			const labels = { chat: 'Chat', images: 'Image', videos: 'Video', transcribe: 'Transcription', media_analysis: 'Video analysis', 'media.analyze': 'Video analysis', music_analysis: 'Music analysis', 'music.analyze': 'Music analysis', upscale: 'Upscale', job: 'Job' };
			const key = String(type || '');
			return Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : text(key, 'Job');
		}

		function artifactPreviewBlock(job) {
			const artifacts = Array.isArray(job.artifacts) ? job.artifacts : [];
			const previews = artifacts.map((artifact, index) => {
				const url = text(artifact && artifact.url, '');
				const mimeType = text(artifact && artifact.mime_type, '');
				if (!/^\/v1\/status\/jobs\/\d+\/artifacts\/\d+$/.test(url)) return '';
				const download = '<div class="live-artifact-actions"><a class="live-artifact-download" href="' + escapeHtml(url) + '" download>Download</a></div>';
				if (/^video\//.test(mimeType)) return '<div class="live-artifact-card"><button type="button" class="job-artifact-preview" data-media-preview="' + escapeHtml(url) + '" data-media-mime="' + escapeHtml(mimeType) + '" title="Open generated video ' + (index + 1) + '"><video src="' + escapeHtml(url) + '" muted preload="metadata" playsinline></video><span>Open generated video ' + (index + 1) + '</span></button>' + download + '</div>';
				if (!/^image\//.test(mimeType)) return '';
				const label = 'Open generated image ' + (index + 1);
				const meta = artifactMetaLabel(artifact);
				return '<div class="live-artifact-card"><button type="button" class="job-artifact-preview" data-media-preview="' + escapeHtml(url) + '" data-media-mime="' + escapeHtml(mimeType) + '" title="' + escapeHtml(label) + '"><img src="' + escapeHtml(url) + '" alt="Generated image preview ' + (index + 1) + '" loading="lazy"><span>' + escapeHtml(label) + (meta ? '<br><span class="job-artifact-meta">' + escapeHtml(meta) + '</span>' : '') + '</span></button>' + download + '</div>';
			}).filter(Boolean);
			return previews.length ? '<div class="job-artifacts">' + previews.join('') + '</div>' : '';
		}

		function debugLogBlocks(job, key) {
			const logs = Array.isArray(job.debug_logs) ? job.debug_logs : [];
			const blocks = [];
			logs.forEach((log, index) => {
				const suffix = logs.length > 1 ? ' ' + (index + 1) : '';
				if (log.prompt) {
					blocks.push(sessionOutputBlock('Prompt' + suffix, { key: key + ':prompt:' + index }));
				}
				if (log.output) {
					blocks.push(sessionOutputBlock('AI Response' + suffix, { key: key + ':output:' + index }));
				}
			});
			return blocks.join('');
		}

		function updateDebugLogBlocks(container, job, key) {
			const logs = Array.isArray(job.debug_logs) ? job.debug_logs : [];
			const outputs = Array.from(container.querySelectorAll('.session-output'));
			const byKey = (value) => outputs.find((output) => output.dataset.sessionKey === value);
			logs.forEach((log, index) => {
				const promptOutput = byKey(key + ':prompt:' + index);
				if (promptOutput) {
					updateSessionOutput(promptOutput, log.prompt || '');
				}
				const responseOutput = byKey(key + ':output:' + index);
				if (responseOutput) {
					updateSessionOutput(responseOutput, log.output || '');
				}
			});
		}

		function updateSessionOutput(output, nextValue) {
			const next = normalizeText(text(nextValue, ''));
			const current = output.textContent || '';
			if (next === current) {
				return;
			}
			const block = output.closest ? output.closest('[data-session-block]') : null;
			const size = block ? block.querySelector('[data-session-size]') : null;
			if (size) size.textContent = formatCharCount(next.length);
			if (next.startsWith(current)) {
				output.appendChild(document.createTextNode(next.slice(current.length)));
				return;
			}
			output.textContent = next;
		}

		function providerSessionLabel(job, label, channel) {
			if (text(job && job.provider, '') !== 'grok-cli') {
				return label;
			}
			return channel === 'input'
				? label.replace(/stdin/i, 'Grok CLI request')
				: label.replace(/Session Output/i, 'Grok CLI stdout / stderr');
		}

		function jobRequestId(job) {
			return text(job.request_id || job.id || job.short_request_id, '');
		}

		function collectUnifiedJobs(jobs) {
			const active = (Array.isArray(jobs.active) ? jobs.active : []).map((job) => ({ ...job, _bucket: 'active' }));
			const queued = (Array.isArray(jobs.queued) ? jobs.queued : []).map((job) => ({ ...job, _bucket: 'queued' }));
			const recent = (Array.isArray(jobs.recent) ? jobs.recent : []).map((job) => ({ ...job, _bucket: 'recent' }));
			const unified = [...active, ...queued, ...recent];
			unified.forEach((job) => {
				const requestId = jobRequestId(job);
				if (requestId) seenLiveRequestIds.add(requestId);
			});
			return unified;
		}

		function liveJobStatus(job) {
			return String(job && (job.status || job._bucket) || '').toLowerCase();
		}

		function liveJobMatchesFilter(job) {
			const status = liveJobStatus(job);
			if (liveFilter === 'all') return true;
			if (liveFilter === 'running') return status === 'running' || status === 'cancelling';
			if (liveFilter === 'queued') return status === 'queued' || status === 'pending';
			if (liveFilter === 'completed') return status === 'completed';
			if (liveFilter === 'failed') return status === 'failed';
			if (liveFilter === 'cancelled') return status === 'cancelled' || status === 'canceled';
			return true;
		}

		function liveJobMatchesType(job) {
			return liveTypeFilter === 'all' || String(job && job.type || '') === liveTypeFilter;
		}

		function liveJobMatchesSearch(job) {
			const query = String(liveSearchQuery || '').trim().toLowerCase();
			if (!query) return true;
			const haystack = [
				job.request_id,
				job.short_request_id,
				job.type,
				liveTypeLabel(job.type),
				job.model,
				job.provider,
				job.provider_label,
				job.workflow,
				job.status,
			].join(' ').toLowerCase();
			return haystack.includes(query);
		}

		// All active filters together: status chip, job type, and search text.
		function liveJobVisible(job) {
			return liveJobMatchesFilter(job) && liveJobMatchesType(job) && liveJobMatchesSearch(job);
		}

		function liveFiltersActive() {
			return liveFilter !== 'all' || liveTypeFilter !== 'all' || !!String(liveSearchQuery || '').trim();
		}

		// The type select lists the job types that exist right now; the chosen type stays selectable even if no job has it.
		function updateLiveTypeOptions(unified) {
			const select = fields.liveTypeFilter;
			if (!select) return;
			const types = Array.from(new Set(unified.map((job) => String(job && job.type || '')).filter(Boolean))).sort();
			if (liveTypeFilter !== 'all' && !types.includes(liveTypeFilter)) types.push(liveTypeFilter);
			const signature = types.join('|') + '#' + liveTypeFilter;
			if (signature === liveTypeOptionsSignature) return;
			liveTypeOptionsSignature = signature;
			select.innerHTML = '<option value="all">All types</option>' + types.map((type) => '<option value="' + escapeHtml(type) + '">' + escapeHtml(liveTypeLabel(type)) + '</option>').join('');
			select.value = liveTypeFilter;
		}

		function pendingLiveJob(requestId) {
			const id = String(requestId || '');
			return {
				request_id: id,
				short_request_id: shortLiveRequestId(id),
				type: 'job',
				model: '',
				provider: '',
				status: seenLiveRequestIds.has(id) ? 'expired' : 'pending',
				_pending: true,
				_expired: seenLiveRequestIds.has(id),
			};
		}

		function updateLiveFilterCounts(jobs) {
			const unified = collectUnifiedJobs(jobs);
			const counts = { all: unified.length, running: 0, queued: 0, completed: 0, failed: 0, cancelled: 0 };
			unified.forEach((job) => {
				const status = liveJobStatus(job);
				if (status === 'running' || status === 'cancelling') counts.running += 1;
				else if (status === 'queued' || status === 'pending') counts.queued += 1;
				else if (status === 'completed') counts.completed += 1;
				else if (status === 'failed') counts.failed += 1;
				else if (status === 'cancelled' || status === 'canceled') counts.cancelled += 1;
			});
			document.querySelectorAll('[data-live-filter-count]').forEach((badge) => {
				const key = badge.getAttribute('data-live-filter-count');
				badge.textContent = String(counts[key] || 0);
			});
		}

		function liveMetaCard(label, value) {
			return '<div class="live-meta-card"><span>' + escapeHtml(label) + '</span><div>' + value + '</div></div>';
		}

		// One job in the list: id + status pill, type + model, provider + elapsed. Cards are patched in place so focus survives updates.
		function liveJobCardMarkup(job, requestId) {
			const provider = text(job.provider_label || job.provider || 'Unknown');
			const status = liveJobStatus(job);
			const live = status === 'running' || status === 'queued' || status === 'pending' || status === 'cancelling';
			return '<div class="live-job-card-head"><span class="live-job-card-title">' + escapeHtml(text(job.short_request_id || shortLiveRequestId(requestId))) + '</span>' + statusText(status || 'pending') + '</div>' +
				'<div class="live-job-card-model">' + (job.type ? '<span class="live-job-tag">' + escapeHtml(liveTypeLabel(job.type)) + '</span>' : '') +
				'<span class="live-job-model">' + escapeHtml(text(job.model, 'Waiting for job')) + '</span></div>' +
				'<div class="live-job-card-meta"><span class="live-job-provider">' + escapeHtml(provider) + '</span><span class="live-job-elapsed">' + elapsedSpan(job, live) + '</span></div>';
		}

		function renderLiveJobList(jobs) {
			updateLiveFilterCounts(jobs);
			const everything = collectUnifiedJobs(jobs);
			updateLiveTypeOptions(everything);
			const unified = everything.filter((job) => liveJobVisible(job));
			if (livePinned && selectedLiveRequestId && !unified.some((job) => jobRequestId(job) === selectedLiveRequestId)) {
				const selected = findJobByRequestId(selectedLiveRequestId, jobs);
				if (selected) {
					unified.unshift(selected);
				} else if (!seenLiveRequestIds.has(selectedLiveRequestId)) {
					unified.unshift(pendingLiveJob(selectedLiveRequestId));
				}
			}
			if (!unified.length) {
				fields.liveJobList.innerHTML = everything.length
					? '<div class="live-list-empty muted">No jobs match these filters.' + (liveFiltersActive() ? ' <button type="button" class="btn-sm" data-live-clear-filters>Clear filters</button>' : '') + '</div>'
					: '<div class="live-list-empty muted">No jobs yet. Jobs appear here while a client or a provider test sends a request, and stay for a few minutes after they finish.</div>';
				return;
			}
			Array.from(fields.liveJobList.children).forEach((child) => {
				if (!child.matches('[data-live-request-id]')) {
					child.remove();
				}
			});
			const wanted = new Set();
			for (const job of unified) {
				const requestId = jobRequestId(job);
				if (!requestId) continue;
				wanted.add(requestId);
				let card = fields.liveJobList.querySelector('[data-live-request-id="' + CSS.escape(requestId) + '"]');
				if (!card) {
					card = document.createElement('button');
					card.type = 'button';
					card.className = 'live-job-card';
					card.dataset.liveRequestId = requestId;
					card.addEventListener('click', () => selectLiveJob(requestId));
				}
				card.setAttribute('aria-pressed', requestId === selectedLiveRequestId ? 'true' : 'false');
				card.innerHTML = liveJobCardMarkup(job, requestId);
				fields.liveJobList.appendChild(card);
			}
			Array.from(fields.liveJobList.querySelectorAll('[data-live-request-id]')).forEach((card) => {
				if (!wanted.has(card.dataset.liveRequestId)) card.remove();
			});
		}

		function applyLiveViewOptions() {
			if (fields.liveDetailBody && fields.liveDetailBody.classList) fields.liveDetailBody.classList.toggle('nowrap', !liveOutputWrap);
			if (fields.liveWrapToggle) fields.liveWrapToggle.setAttribute('aria-pressed', liveOutputWrap ? 'true' : 'false');
			if (fields.liveFollowToggle) fields.liveFollowToggle.setAttribute('aria-pressed', liveAutoScroll ? 'true' : 'false');
		}

		// While a job runs and Auto-scroll is on, the newest session output stays in view.
		function followLiveOutputs() {
			if (!liveAutoScroll || !fields.liveDetailBody) return;
			fields.liveDetailBody.querySelectorAll('.live-session-output').forEach((output) => {
				output.scrollTop = output.scrollHeight;
			});
		}

		function renderLiveDetail(job) {
			if (!job) {
				fields.liveDetailEmpty.hidden = false;
				fields.liveDetailContent.hidden = true;
				fields.liveDetailBody.innerHTML = '';
				// The body is empty now: forget what it showed, or re-selecting the same job would skip the rebuild.
				delete fields.liveDetailBody.dataset.detailSignature;
				if (fields.liveDetailStatus) fields.liveDetailStatus.innerHTML = '';
				if (fields.liveDetailSubtitle) fields.liveDetailSubtitle.textContent = '';
				return;
			}
			const requestId = jobRequestId(job);
			const status = liveJobStatus(job);
			const live = status === 'running' || status === 'queued' || status === 'pending' || status === 'cancelling';
			const canCancelImage = job.type === 'images' && job.provider === 'local-image' && ['running', 'queued', 'cancelling'].includes(status);
			if (canCancelImage && fields.liveDetailCancel) {
				fields.liveDetailCancel.hidden = false;
				fields.liveDetailCancel.disabled = status === 'cancelling' || cancellingLiveImageRequests.has(requestId);
				fields.liveDetailCancel.textContent = fields.liveDetailCancel.disabled ? 'Cancelling…' : 'Cancel generation';
				fields.liveDetailCancel.dataset.requestId = requestId;
			} else if (fields.liveDetailCancel) {
				fields.liveDetailCancel.hidden = true;
				fields.liveDetailCancel.disabled = false;
				fields.liveDetailCancel.textContent = 'Cancel generation';
				fields.liveDetailCancel.dataset.requestId = '';
				if (['completed', 'failed', 'cancelled'].includes(status)) cancellingLiveImageRequests.delete(requestId);
			}
			const key = 'detail:' + requestId;
			fields.liveDetailEmpty.hidden = true;
			fields.liveDetailContent.hidden = false;
			fields.liveDetailTitle.textContent = text(job.short_request_id || shortLiveRequestId(requestId) || requestId);
			if (fields.liveDetailStatus) fields.liveDetailStatus.innerHTML = statusText(status || 'pending');
			if (fields.liveDetailSubtitle) {
				fields.liveDetailSubtitle.textContent = [job.type ? liveTypeLabel(job.type) : '', job.model, job.provider_label || job.provider].filter(Boolean).join(' · ');
			}
			if (fields.liveFollowToggle) fields.liveFollowToggle.hidden = !live;
			fields.liveDetailCopyId.dataset.copyValue = requestId;
			const skills = Array.isArray(job.skills) ? job.skills.filter(Boolean) : [];
			let blocks = '';
			if (job._pending) {
				blocks += '<div class="muted live-pending-note">' + (job._expired
					? 'This job is no longer in the 15-minute live retention window.'
					: 'Waiting for this job to appear in live updates.') + '</div>';
			}
			blocks += liveErrorBlock(job, status);
			blocks += '<div class="live-detail-meta">' +
				liveMetaCard('Request', '<code>' + escapeHtml(requestId) + '</code>') +
				liveMetaCard('Type', escapeHtml(job.type ? liveTypeLabel(job.type) : '-')) +
				liveMetaCard('Model', escapeHtml(text(job.model, '-'))) +
				liveMetaCard('Provider', escapeHtml(text(job.provider_label || job.provider || 'Unknown')) + (job.provider_label && job.provider ? '<div class="muted"><code>' + escapeHtml(job.provider) + '</code></div>' : '')) +
				liveMetaCard('Workflow', escapeHtml(text(job.workflow || (live ? 'Pending' : '-'))) + (skills.length ? '<div class="muted">Skill: ' + escapeHtml(skills.join(', ')) + '</div>' : '')) +
				liveMetaCard('Elapsed', elapsedSpan(job, live)) +
				(job.started_at ? liveMetaCard('Started', escapeHtml(new Date(job.started_at).toLocaleTimeString())) : '') +
				(job.finished_at ? liveMetaCard('Finished', escapeHtml(new Date(job.finished_at).toLocaleTimeString())) : '') +
				'</div>';
			blocks += artifactPreviewBlock(job);
			if (job.session_input) {
				blocks += sessionOutputBlock(providerSessionLabel(job, live ? 'Live stdin' : 'stdin', 'input'), { live, key: key + ':input' });
			}
			if (job.session_output) {
				blocks += sessionOutputBlock(providerSessionLabel(job, live ? 'Live Session Output' : 'Session Output', 'output'), { live, key: key + ':output' });
			}
			blocks += debugLogBlocks(job, key);
			const signature = JSON.stringify({
				requestId,
				status: job.status,
				error_message: job.error_message,
				started_at: job.started_at,
				finished_at: job.finished_at,
				workflow: job.workflow,
				skills: job.skills,
				pending: !!job._pending,
				expired: !!job._expired,
				artifacts: (Array.isArray(job.artifacts) ? job.artifacts : []).map((artifact) => [artifact && artifact.url, artifact && artifact.mime_type]),
				input: !!job.session_input,
				output: !!job.session_output,
				debug: Array.isArray(job.debug_logs) ? job.debug_logs.length : 0,
			});
			if (fields.liveDetailBody.dataset.detailSignature !== signature) {
				fields.liveDetailBody.dataset.detailSignature = signature;
				fields.liveDetailBody.innerHTML = blocks;
			}
			if (job.session_output) {
				const output = fields.liveDetailBody.querySelector('.session-output[data-session-key="' + CSS.escape(key + ':output') + '"]');
				if (output) updateSessionOutput(output, job.session_output);
			}
			if (job.session_input) {
				const input = fields.liveDetailBody.querySelector('.session-output[data-session-key="' + CSS.escape(key + ':input') + '"]');
				if (input) updateSessionOutput(input, job.session_input);
			}
			updateDebugLogBlocks(fields.liveDetailBody, job, key);
			applyLiveViewOptions();
			if (live) followLiveOutputs();
		}

		async function cancelLiveImageJob(button) {
			const requestId = String(button && button.dataset.requestId || '').trim();
			if (!requestId || button.disabled) return;
			button.disabled = true;
			button.textContent = 'Cancelling…';
			cancellingLiveImageRequests.add(requestId);
			try {
				const response = await fetch(liveImageCancelUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ request_id: requestId }),
				});
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Image generation could not be cancelled.');
				if (fields.lastEvent) fields.lastEvent.textContent = 'Image cancellation requested ' + new Date().toLocaleTimeString();
			} catch (error) {
				cancellingLiveImageRequests.delete(requestId);
				button.disabled = false;
				button.textContent = 'Cancel generation';
				if (fields.lastEvent) fields.lastEvent.textContent = error.message || 'Image cancellation failed';
			}
		}

		function findJobByRequestId(requestId, jobs) {
			const source = jobs || (currentStatus && currentStatus.jobs) || {};
			return collectUnifiedJobs(source).find((job) => jobRequestId(job) === String(requestId || '')) || null;
		}

		function selectLiveJob(requestId, options = {}) {
			selectedLiveRequestId = String(requestId || '');
			livePinned = options.pin !== false && !!selectedLiveRequestId;
			if (!options.skipHash && livePinned) {
				setHash('live/' + encodeURIComponent(selectedLiveRequestId));
			}
			const jobs = currentStatus && currentStatus.jobs || {};
			renderLiveJobList(jobs);
			renderLiveDetail(findJobByRequestId(selectedLiveRequestId, jobs) || (livePinned && selectedLiveRequestId ? pendingLiveJob(selectedLiveRequestId) : null));
		}

		function autoSelectLiveJob(jobs) {
			if (livePinned && selectedLiveRequestId) {
				const selected = findJobByRequestId(selectedLiveRequestId, jobs);
				renderLiveDetail(selected || (!seenLiveRequestIds.has(selectedLiveRequestId) ? pendingLiveJob(selectedLiveRequestId) : selected));
				return;
			}
			// Running jobs first, then queued ones, then the newest job that passes the filters.
			const active = (Array.isArray(jobs.active) ? jobs.active : []).filter(liveJobVisible);
			const queued = (Array.isArray(jobs.queued) ? jobs.queued : []).filter(liveJobVisible);
			const candidates = active.length ? active : (queued.length ? queued : collectUnifiedJobs(jobs).filter(liveJobVisible));
			if (candidates.length) {
				selectedLiveRequestId = jobRequestId(candidates[0]);
				livePinned = false;
				renderLiveJobList(jobs);
				renderLiveDetail(findJobByRequestId(selectedLiveRequestId, jobs));
				return;
			}
			selectedLiveRequestId = '';
			renderLiveDetail(null);
		}

		// Re-renders the list and the selected job after a filter or search change.
		function refreshLiveView() {
			const jobs = currentStatus && currentStatus.jobs || {};
			renderLiveJobList(jobs);
			if (livePinned && selectedLiveRequestId) {
				renderLiveDetail(findJobByRequestId(selectedLiveRequestId, jobs) || (!seenLiveRequestIds.has(selectedLiveRequestId) ? pendingLiveJob(selectedLiveRequestId) : null));
			} else {
				autoSelectLiveJob(jobs);
			}
		}

		function setLiveFilter(value) {
			liveFilter = ['all', 'running', 'queued', 'completed', 'failed', 'cancelled'].includes(value) ? value : 'all';
			document.querySelectorAll('[data-live-filter]').forEach((item) => {
				item.setAttribute('aria-pressed', item.getAttribute('data-live-filter') === liveFilter ? 'true' : 'false');
			});
		}

		function clearLiveFilters() {
			setLiveFilter('all');
			liveTypeFilter = 'all';
			liveSearchQuery = '';
			if (fields.liveJobSearch) fields.liveJobSearch.value = '';
			if (fields.liveTypeFilter) fields.liveTypeFilter.value = 'all';
			refreshLiveView();
		}

		function initLiveFilters() {
			document.querySelectorAll('[data-live-filter]').forEach((button) => {
				button.addEventListener('click', () => {
					setLiveFilter(button.getAttribute('data-live-filter') || 'all');
					refreshLiveView();
				});
			});
			if (fields.liveTypeFilter) {
				fields.liveTypeFilter.addEventListener('change', () => {
					liveTypeFilter = fields.liveTypeFilter.value || 'all';
					refreshLiveView();
				});
			}
			if (fields.liveJobSearch) {
				fields.liveJobSearch.addEventListener('input', () => {
					liveSearchQuery = fields.liveJobSearch.value || '';
					refreshLiveView();
				});
			}
			if (fields.liveWrapToggle) {
				fields.liveWrapToggle.addEventListener('click', () => {
					liveOutputWrap = !liveOutputWrap;
					applyLiveViewOptions();
				});
			}
			if (fields.liveFollowToggle) {
				fields.liveFollowToggle.addEventListener('click', () => {
					liveAutoScroll = !liveAutoScroll;
					applyLiveViewOptions();
					followLiveOutputs();
				});
			}
			applyLiveViewOptions();
		}

		function updateTabBadges(jobs) {
			const running = Number(jobs.running_count || 0);
			const queued = Number(jobs.queued_count || 0);
			const liveCount = running + queued;
			const liveBadge = navBadge('live');
			if (liveBadge) {
				liveBadge.hidden = liveCount <= 0;
				liveBadge.textContent = String(liveCount);
				liveBadge.className = 'nav-badge' + (running > 0 ? ' warn' : '');
				liveBadge.title = running + ' running, ' + queued + ' queued';
			}
			const recent = Array.isArray(jobs.recent) ? jobs.recent : [];
			const failed = recent.filter((job) => String(job.status || '').toLowerCase() === 'failed').length;
			const debugBadge = navBadge('debug');
			if (debugBadge) {
				debugBadge.hidden = failed <= 0;
				debugBadge.textContent = String(failed);
				debugBadge.title = failed + ' recent failed job(s)';
			}
			updateSettingsDirtyState();
		}

		// Reachability: any JSON answer from the Relay (even a 503 while Codex is still being checked) means the Relay is
		// reachable; only a network failure (no usable answer) means it is not.
		function relayPillInfo(reachable) {
			return reachable === false ? { state: 'error', label: 'Unreachable' } : { state: 'ok', label: 'Reachable' };
		}

		// The Relay reports a Codex check in progress as success:false with checking:true (or details.checking, or an active refresh).
		function isCodexChecking(payload) {
			const source = payload || {};
			return source.success !== true && (source.checking === true || !!(source.details && source.details.checking) || !!(source.refresh && source.refresh.active));
		}

		function codexPillInfo(payload, reachable) {
			if (reachable === false) return { state: 'unknown', label: 'Unknown' };
			if (payload && payload.success === true) return { state: 'ok', label: 'Ready' };
			if (isCodexChecking(payload)) return { state: 'checking', label: 'Checking…' };
			return { state: 'warn', label: 'Needs attention' };
		}

		function debugHealthChecks(payload, ok) {
			const jobs = payload.jobs || {};
			const bridge = payload.bridge || {};
			const paired = Array.isArray(bridge.paired_origins) ? bridge.paired_origins : [];
			const asr = payload.asr || currentCapabilities.asr || {};
			const queued = Number(jobs.queued_count || 0);
			const recent = Array.isArray(jobs.recent) ? jobs.recent : [];
			const lastFailure = recent.find((job) => String(job.status || '').toLowerCase() === 'failed');
			const reachable = ok !== false;
			const codexChecking = reachable && isCodexChecking(payload);
			return [
				{
					state: reachable ? 'ok' : 'bad',
					title: 'Relay reachable',
					detail: reachable ? 'The local Relay is responding.' : 'The status request could not reach the Relay.',
					action: '<button type="button" data-nav-hash="overview">Overview</button>',
				},
				{
					state: !reachable ? 'warn' : (payload.success ? 'ok' : (codexChecking ? 'checking' : 'warn')),
					title: 'Codex ready',
					detail: !reachable ? 'Codex status is unknown while the Relay is unreachable.' : (payload.success ? 'Codex CLI is ready for jobs.' : (codexChecking ? 'Codex CLI is still being checked.' : (payload.message || 'Codex needs attention.'))),
					action: '<button type="button" data-nav-hash="providers/codex-cli">Open Codex card</button>',
				},
				{
					state: paired.length ? 'ok' : 'warn',
					title: 'Paired browser origins',
					detail: paired.length ? paired.length + ' origin(s) paired.' : 'No browser origins are paired yet.',
					action: '<button type="button" data-nav-hash="pairing">Pairing</button>',
				},
				{
					state: queued > 0 ? 'warn' : 'ok',
					title: 'Job queue',
					detail: queued > 0 ? queued + ' job(s) waiting.' : 'No queued jobs.',
					action: '<button type="button" data-nav-hash="live">Open Live</button>',
				},
				{
					state: asr.ready ? 'ok' : 'warn',
					title: 'Local ASR',
					detail: asr.ready ? 'Local ASR runtime is ready.' : 'Local ASR is not ready or not checked.',
					action: '<button type="button" data-nav-hash="asr">ASR settings</button>',
				},
				{
					state: lastFailure ? 'bad' : 'ok',
					title: 'Recent failures',
					detail: lastFailure ? 'Latest failure: ' + text(lastFailure.error_message || lastFailure.type, 'unknown') : 'No recent failed jobs.',
					action: lastFailure ? '<button type="button" data-open-live-job="' + escapeHtml(jobRequestId(lastFailure)) + '">Inspect failure</button>' : '<button type="button" data-nav-hash="live">Open Live</button>',
				},
			];
		}

		function debugHealthSummary(checks) {
			const counts = { ok: 0, warn: 0, bad: 0, checking: 0 };
			checks.forEach((check) => { counts[check.state] = (counts[check.state] || 0) + 1; });
			const chips = [];
			const add = (tone, value, label) => { if (value) chips.push('<span class="count-chip ' + tone + '"><b>' + value + '</b> ' + label + '</span>'); };
			add('ok', counts.ok, 'passing');
			add('warn', counts.warn, counts.warn === 1 ? 'warning' : 'warnings');
			add('bad', counts.bad, counts.bad === 1 ? 'problem' : 'problems');
			add('muted', counts.checking, 'checking');
			return { counts, markup: chips.join('') };
		}

		function renderDebugHealth(payload, ok) {
			const checks = debugHealthChecks(payload, ok);
			const summary = debugHealthSummary(checks);
			if (fields.debugHealthSummary) fields.debugHealthSummary.innerHTML = summary.markup;
			if (fields.debugHealthOverall) {
				const overall = summary.counts.bad ? { state: 'error', label: 'Problems found' } : (summary.counts.warn ? { state: 'warn', label: 'Needs attention' } : (summary.counts.checking ? { state: 'checking', label: 'Checking…' } : { state: 'ok', label: 'All checks passed' }));
				setPill(fields.debugHealthOverall, overall.state, overall.label);
			}
			const pillFor = { ok: ['ok', 'OK'], warn: ['warn', 'Warning'], bad: ['error', 'Problem'], checking: ['checking', 'Checking'] };
			fields.debugHealthList.innerHTML = checks.map((check) => {
				const pill = pillFor[check.state] || pillFor.warn;
				return '<div class="debug-health-item ' + check.state + '">' +
					providerStatusPill(pill[0], pill[1]) +
					'<div class="debug-health-text"><strong>' + escapeHtml(check.title) + '</strong><div class="muted">' + escapeHtml(check.detail) + '</div></div>' +
					'<div class="debug-health-action">' + check.action + '</div>' +
				'</div>';
			}).join('');
		}

		// A failed job as an expandable row: one line while collapsed (id, type, first line of the error, time), the full
		// error, meta, and actions when open. Everything dynamic is escaped.
		function debugFailureItem(job) {
			const id = jobRequestId(job);
			const message = String(job.error_message || '').trim() || 'Failed without an error message.';
			const firstLine = message.split('\n')[0].trim();
			const headline = firstLine.length > 160 ? firstLine.slice(0, 157) + '…' : firstLine;
			const finished = job.finished_at ? new Date(job.finished_at).toLocaleTimeString() : '';
			const row = (label, value) => value ? '<div><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value) + '</dd></div>' : '';
			return '<details class="debug-failure" data-failure-id="' + escapeHtml(id) + '">' +
				'<summary><span class="debug-failure-main"><code>' + escapeHtml(text(job.short_request_id || shortLiveRequestId(id))) + '</code>' +
				(job.type ? '<span class="live-job-tag">' + escapeHtml(liveTypeLabel(job.type)) + '</span>' : '') +
				'<span class="debug-failure-msg">' + escapeHtml(headline) + '</span></span>' +
				'<span class="debug-failure-time">' + escapeHtml(finished) + '</span></summary>' +
				'<div class="debug-failure-body">' +
					'<dl class="kv">' + row('Provider', text(job.provider_label || job.provider, '')) + row('Model', text(job.model, '')) + row('Workflow', text(job.workflow, '')) + row('Elapsed', elapsed(job.elapsed_ms)) + row('Request id', id) + '</dl>' +
					'<pre class="debug-failure-text" tabindex="0">' + escapeHtml(message) + '</pre>' +
					'<div class="debug-failure-actions"><button type="button" data-open-live-job="' + escapeHtml(id) + '">Inspect in Live</button>' +
					'<button type="button" class="copy-value" data-copy-value="' + escapeHtml(message) + '">Copy error</button></div>' +
				'</div></details>';
		}

		function renderDebugFailures(jobs) {
			const recent = Array.isArray(jobs.recent) ? jobs.recent : [];
			const failed = recent.filter((job) => String(job.status || '').toLowerCase() === 'failed').slice(0, 8);
			const markup = failed.length ? failed.map(debugFailureItem).join('') : '<div class="muted">No recent failures</div>';
			if (markup === debugFailureMarkup) return;
			debugFailureMarkup = markup;
			fields.debugFailureList.innerHTML = markup;
			// Rows the user had expanded stay expanded across updates.
			fields.debugFailureList.querySelectorAll('details[data-failure-id]').forEach((details) => {
				if (debugFailureOpen.has(details.getAttribute('data-failure-id'))) details.open = true;
			});
		}

		function escapeRegExp(value) {
			return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		}

		function applyRawStatusFilter() {
			// The raw JSON is collapsed by default and only built while its disclosure is open (toggling it renders it).
			if (fields.rawStatusDetails && !fields.rawStatusDetails.open) return;
			const query = String(fields.rawStatusFilter && fields.rawStatusFilter.value || '').trim();
			const json = JSON.stringify(currentStatus, null, 2);
			if (!query) {
				fields.rawStatus.textContent = json;
				return;
			}
			let pattern = null;
			try {
				pattern = new RegExp('(' + escapeRegExp(query) + ')', 'ig');
			} catch (error) {
				pattern = null;
			}
			if (!pattern) {
				const lowerJson = json.toLowerCase();
				const lowerQuery = query.toLowerCase();
				let html = '';
				let cursor = 0;
				let index = lowerJson.indexOf(lowerQuery);
				while (index !== -1) {
					html += escapeHtml(json.slice(cursor, index)) + '<mark>' + escapeHtml(json.slice(index, index + lowerQuery.length)) + '</mark>';
					cursor = index + lowerQuery.length;
					index = lowerJson.indexOf(lowerQuery, cursor);
				}
				fields.rawStatus.innerHTML = html + escapeHtml(json.slice(cursor));
				return;
			}
			// Match against the raw JSON text and escape each piece afterwards: matching HTML-escaped text would find "quot" in
			// &quot; and could never match a quote or an ampersand.
			fields.rawStatus.innerHTML = json.split(pattern).map((piece, index) => (index % 2 ? '<mark>' + escapeHtml(piece) + '</mark>' : escapeHtml(piece))).join('');
		}

		function updateHealthCards(payload, ok) {
			const bridge = payload.bridge || {};
			const asr = payload.asr || currentCapabilities.asr || {};
			fields.overviewPairedCount.textContent = Array.isArray(bridge.paired_origins) ? String(bridge.paired_origins.length) : '—';
			fields.overviewPort.textContent = location.port || (location.protocol === 'https:' ? '443' : '80');
			setPill(fields.asrPill, asr.ready ? 'ok' : (asr.enabled === false ? 'unknown' : 'warn'), asr.ready ? 'Ready' : (asr.enabled === false ? 'Disabled' : 'Not ready'));
		}

		// Overview provider tiles. Pure helpers: status comes from the backend metadata in /v1/capabilities.
		function backendStatusInfo(backend) {
			const item = backend || {};
			const state = String(item.state || '').toLowerCase();
			if (state === 'checking' || (item.details && item.details.checking)) return { state: 'checking', label: 'Checking' };
			if (item.ready === true) return { state: 'ok', label: 'Ready' };
			if (state === 'not_authenticated') return { state: 'warn', label: 'Not authenticated' };
			if (state === 'unsupported') return { state: 'warn', label: 'Unsupported CLI' };
			if (state === 'error' || state === 'failed') return { state: 'error', label: 'Error' };
			if (item.enabled === false) return { state: 'unknown', label: 'Disabled' };
			if (item.installed === false) return { state: 'unknown', label: 'Not installed' };
			if (item.configured === false) return { state: 'unknown', label: 'Not configured' };
			if (item.provider_kind === 'local-runtime' || item.kind === 'local-runtime') return { state: 'unknown', label: 'Not set up' };
			if (state === 'installed') return { state: 'unknown', label: 'Not verified' };
			return { state: 'warn', label: 'Unavailable' };
		}

		function summarizeProviders(backends) {
			const list = Array.isArray(backends) ? backends : [];
			const summary = { total: list.length, ready: 0, attention: 0, inactive: 0, checking: 0 };
			list.forEach((backend) => {
				const info = backendStatusInfo(backend);
				if (info.state === 'ok') summary.ready += 1;
				else if (info.state === 'warn' || info.state === 'error') summary.attention += 1;
				else if (info.state === 'checking') summary.checking += 1;
				else summary.inactive += 1;
			});
			return summary;
		}

		function providerDiagnosticLine(backend, info) {
			const item = backend || {};
			const diagnostic = String(item.diagnostic == null ? '' : item.diagnostic).trim();
			if (diagnostic && diagnostic !== 'Ready.' && diagnostic !== 'Authentication not checked yet.') return diagnostic;
			const detail = String(item.version || item.command || '').trim();
			if (detail) return detail;
			const jobTypes = Array.isArray(item.job_types) ? item.job_types.join(', ') : '';
			return jobTypes || (info && info.state === 'ok' ? 'Ready' : 'No details reported');
		}

		function providerStatusPill(state, label) {
			const safeState = ['ok', 'warn', 'error', 'unknown', 'checking'].includes(state) ? state : 'unknown';
			return '<span class="pill ' + safeState + '"><span class="dot"></span><span>' + escapeHtml(label) + '</span></span>';
		}

		function renderProviderTiles(backends) {
			const list = Array.isArray(backends) ? backends : [];
			if (!list.length) return '<div class="empty-state">No provider metadata reported</div>';
			return list.map((backend) => {
				const item = backend || {};
				const info = backendStatusInfo(item);
				const id = String(item.id == null ? '' : item.id);
				const name = String(item.label || item.id || 'Provider');
				const diagnostic = providerDiagnosticLine(item, info);
				const target = id ? 'providers/' + encodeURIComponent(id) : 'providers';
				return '<a class="provider-tile" href="#' + escapeHtml(target) + '" data-nav-hash="' + escapeHtml(target) + '" data-provider-tile="' + escapeHtml(id) + '" title="' + escapeHtml(name + ': ' + diagnostic) + '">' +
					'<span class="provider-tile-head"><span class="provider-tile-name">' + escapeHtml(name) + '</span>' + providerStatusPill(info.state, info.label) + '</span>' +
					'<span class="provider-tile-diag">' + escapeHtml(diagnostic) + '</span>' +
				'</a>';
			}).join('');
		}

		let overviewProviderMarkup = null;
		function renderOverviewProviders(backends) {
			const markup = renderProviderTiles(backends);
			if (fields.overviewProviderGrid && markup !== overviewProviderMarkup) {
				overviewProviderMarkup = markup;
				fields.overviewProviderGrid.innerHTML = markup;
			}
			const summary = summarizeProviders(backends);
			if (fields.overviewProviderSummary) {
				fields.overviewProviderSummary.textContent = summary.total ? summary.ready + ' ready / ' + summary.attention + ' need attention' : 'No providers reported';
			}
			if (fields.overviewProviderSummarySub) {
				const notes = [];
				if (summary.inactive) notes.push(summary.inactive + ' not set up');
				if (summary.checking) notes.push(summary.checking + ' checking');
				fields.overviewProviderSummarySub.textContent = notes.length ? notes.join(' · ') : (summary.total ? 'All detected providers are accounted for' : 'Waiting for provider detection');
			}
		}

		function renderDetails(details) {
			const rows = [
				['Binary', details.codex_binary],
				['Home', details.codex_home],
				['Auth', details.auth_path],
				['Generated Images', details.generated_images_dir],
				['Version', details.version],
				['Login', details.login_status],
			];
			return rows.map(([label, value]) => '<tr><th scope="row">' + escapeHtml(label) + '</th><td><code title="' + escapeHtml(value) + '">' + escapeHtml(value) + '</code></td></tr>').join('');
		}

		function renderAsrDetails(asr) {
			asr = asr || {};
			const runtime = asr.runtime || {};
			const python = runtime.python || {};
			const gpu = runtime.gpu || {};
			const selected = asr.selected || {};
			const checked = runtime.checked !== false && asr.runtime_checked !== false;
			const availability = (value, yes, no) => value === null || value === undefined ? 'Not checked' : (value ? yes : no);
			const torchCuda = runtime.qwen_torch_cuda || {};
			const torchCudaText = torchCuda.available === null || torchCuda.available === undefined
				? 'Not checked'
				: (torchCuda.available ? ((torchCuda.version || 'torch') + ' / CUDA ' + (torchCuda.cuda_version || '?') + ' / devices ' + (torchCuda.device_count || 0)) : (torchCuda.reason || 'Unavailable'));
			const rows = [
				['Runtime Check', checked ? (runtime.cached ? 'Cached' : 'Checked') : 'Not checked'],
				['Ready', availability(asr.ready, 'Yes', 'No')],
				['Auto Model', asr.auto_model],
				['Selected Device', selected.device ? selected.device + ' / ' + selected.compute_type : ''],
				['Selected Provider', selected.provider || ''],
				['Selected Model Path', selected.model_path],
				['Selected Aligner Path', selected.aligner_model_path || ''],
				['Python', checked ? (python.available ? python.command + ' ' + (python.version || '') : 'Not found') : 'Not checked'],
				['Venv', runtime.venv_python],
				['faster-whisper', availability(runtime.faster_whisper_installed, 'Installed', 'Missing')],
				['Qwen Python', checked && runtime.qwen_python ? (runtime.qwen_python.available ? runtime.qwen_python.command + ' ' + (runtime.qwen_python.version || '') : 'Not found') : 'Not checked'],
				['Qwen Venv', runtime.qwen_venv_python],
				['qwen-asr', availability(runtime.qwen_asr_installed, 'Installed', 'Missing')],
				['Qwen torch CUDA', torchCudaText],
				['ffmpeg', availability(runtime.ffmpeg_available, 'Available', 'Missing')],
				['ffprobe', availability(runtime.ffprobe_available, 'Available', 'Missing')],
				['GPU', gpu.available === null || gpu.available === undefined ? 'Not checked' : (gpu.available ? gpu.name + ' (' + gpu.free_mb + ' MB free / ' + gpu.total_mb + ' MB)' : 'Unavailable')],
			];
			fields.asrDetails.innerHTML = rows.map(([label, value]) => '<tr><th scope="row">' + escapeHtml(label) + '</th><td><code title="' + escapeHtml(value) + '">' + escapeHtml(value) + '</code></td></tr>').join('');
		}

		function featureState(value) {
			if (value === null || value === undefined) {
				return 'disabled';
			}
			return value ? 'enabled' : 'disabled';
		}

		function featureLabel(value) {
			if (value === null || value === undefined) {
				return 'Not checked';
			}
			return value ? 'Yes' : 'No';
		}

		function featurePill(name, value) {
			const state = featureState(value);
			return '<div class="feature-pill ' + state + '">' +
				'<span class="name">' + escapeHtml(name) + '</span>' +
				'<span class="state">' + featureLabel(value) + '</span>' +
			'</div>';
		}

		function renderBackendDrivers(backends) {
			const items = Array.isArray(backends) ? backends : [];
			if (!items.length) {
				fields.backendDrivers.innerHTML = '<div class="muted">No backend metadata reported</div>';
				return;
			}
			fields.backendDrivers.innerHTML = items.map((backend) => {
				const info = backendStatusInfo(backend);
				const name = backend.label || backend.id || 'Backend';
				const jobTypes = Array.isArray(backend.job_types) ? backend.job_types.join(', ') : '';
				return '<div class="driver-row">' +
					'<span class="driver-name">' + escapeHtml(name) + (backend.kind ? ' <span class="kind-badge">' + escapeHtml(backend.kind) + '</span>' : '') + '</span>' +
					providerStatusPill(info.state, info.label) +
					(jobTypes ? '<span class="driver-types">' + escapeHtml(jobTypes) + '</span>' : '') +
				'</div>';
			}).join('');
		}

		function renderCapabilities(payload) {
			currentCapabilities = payload || {};
			const codex = currentCapabilities.codex || {};
			const features = currentCapabilities.features || {};
			const video = currentCapabilities.video || {};
			const mediaAnalysis = currentCapabilities.media_analysis || {};
			const musicAnalysis = currentCapabilities.music_analysis || {};
			fields.codexCliVersion.textContent = text(codex.version);
			fields.codexBinary.textContent = text(codex.binary);
			fields.codexBinary.title = text(codex.binary, '');
			fields.detectedFeatures.innerHTML = [
				featurePill('Structured exec JSON', features.structured_exec_json),
				featurePill('Output schema', features.output_schema),
				featurePill('Image attachments', features.image_attachments),
				featurePill('Codex app server', features.app_server),
				featurePill('Local image generation', features.images),
				featurePill('Local ASR', currentCapabilities.asr && currentCapabilities.asr.enabled),
				featurePill('Local ASR ready', currentCapabilities.asr && currentCapabilities.asr.ready),
				featurePill('Media analysis route', mediaAnalysis.enabled),
				featurePill('ffmpeg frame extraction', mediaAnalysis.ffmpeg_available),
				featurePill('Local music analysis', musicAnalysis.enabled),
				featurePill('Music analysis ready', musicAnalysis.ready),
				featurePill('OpenAI video route', video.enabled),
				featurePill('Video API configured', video.configured),
			].join('');
			renderBackendDrivers(currentCapabilities.backends || []);
			renderOverviewProviders(currentCapabilities.backends || []);
			updateProviderCardStatuses(currentCapabilities.backends || []);
			renderAsrDetails(currentCapabilities.asr || {});
			currentStatus.capabilities = currentCapabilities;
			applyRawStatusFilter();
		}

		// ---- Providers view: one expandable card per backend, plus a Routing card ----

		// Backends that own settings fields (or an engine page) are listed first, in this order; any other backend the Relay
		// reports follows. Local engines keep their own page, so their cards only link to it.
		function providerCardSpecs() {
			return {
				'codex-cli': { label: 'Codex CLI', kind: 'cli', cliPath: { label: 'Codex CLI executable', placeholder: 'codex or C:\\Tools\\codex.exe' }, fields: ['codexImageTool'] },
				'anthropic-api': { label: 'Claude API', kind: 'api', fields: ['anthropic'] },
				'xai-api': { label: 'Grok / xAI API', kind: 'api', fields: ['xai'] },
				'grok-cli': { label: 'Grok CLI', kind: 'cli', cliPath: { label: 'Grok CLI executable', placeholder: 'grok or C:\\Tools\\grok.exe' }, fields: ['grokImagineSkill'] },
				'cursor-cli': { label: 'Cursor Agent', kind: 'cli', cliPath: { label: 'Cursor Agent executable', placeholder: 'cursor-agent or C:\\Tools\\cursor-agent.exe' }, fields: [] },
				'antigravity-cli': { label: 'Antigravity CLI', kind: 'cli', cliPath: { label: 'Antigravity CLI executable', placeholder: 'agy or C:\\Tools\\agy.exe', hint: 'Windows auto-detects %LOCALAPPDATA%\\agy\\bin\\agy.exe; enter another path here to override it.' }, fields: ['antigravityStateDir'] },
				'openai-videos': { label: 'OpenAI Videos', kind: 'api', fields: ['openaiVideos'] },
				'api-key-chat': { label: 'API-key chat', kind: 'api', fields: ['apiKeyChat'] },
				'cli-process': { label: 'CLI Process', kind: 'cli', cliPath: { label: 'CLI Process executable', placeholder: 'Optional generic command path' }, fields: ['cliProcessArgs'] },
				'local-asr': { label: 'Local ASR', kind: 'local', route: 'asr', routeLabel: 'Open Local ASR settings', description: 'Whisper and Qwen models run on this computer. Install models and set paths on the Local ASR page.' },
				'local-image': { label: 'Local Image', kind: 'local', route: 'image', routeLabel: 'Open Local Image settings', description: 'Use the Local Image page to set up the Diffusers runtime. Setup Environment installs packages; Install Model downloads weights explicitly.' },
				'local-upscale': { label: 'Local Upscale', kind: 'local', route: 'upscale', routeLabel: 'Open CUDA Upscale settings', description: 'Use the CUDA Upscale page to install an available pinned model. Jobs never download a model, downsample native output, or fall back to CPU.' },
				'music-analysis': { label: 'Music Analysis', kind: 'local', route: 'music', routeLabel: 'Open Music Analysis settings', description: 'Core album metrics run privately on this computer. Set up the local runtime on the Music Analysis page.' },
			};
		}

		// A provider that owns settings fields always gets a card, even if the Relay did not report it, so its inputs (and the
		// settings payload built from them) are always present. Engines are listed only when reported.
		function providerCardEntries(backends) {
			const specs = providerCardSpecs();
			const list = Array.isArray(backends) ? backends.filter((backend) => backend && typeof backend === 'object') : [];
			const byId = new Map(list.map((backend) => [String(backend.id == null ? '' : backend.id), backend]));
			const entries = [];
			Object.keys(specs).forEach((id) => {
				const spec = specs[id];
				let backend = byId.get(id);
				if (!backend) {
					if (!spec.cliPath && !(spec.fields && spec.fields.length)) return;
					backend = { id, label: spec.label, ready: false, configured: false, diagnostic: 'Not reported by this Relay.' };
				}
				entries.push({ backend, spec });
			});
			list.forEach((backend) => {
				if (!Object.prototype.hasOwnProperty.call(specs, String(backend.id == null ? '' : backend.id))) entries.push({ backend, spec: null });
			});
			return entries;
		}

		function providerKindLabel(backend, spec) {
			const kind = String(spec && spec.kind || (backend && (backend.provider_kind || backend.kind)) || '').toLowerCase();
			if (kind === 'cli' || kind === 'local-cli') return 'CLI';
			if (kind === 'api') return 'API';
			if (kind === 'local' || kind === 'local-runtime') return 'Local';
			return 'Provider';
		}

		// Cards that need attention (warn / error) start expanded; the user's own choice always wins.
		function providerCardIsOpen(id, info) {
			if (providerCardOpen.has(id)) return providerCardOpen.get(id) === true;
			return !!(info && (info.state === 'warn' || info.state === 'error')) || (!!id && pendingProviderFocus === id);
		}

		function fieldErrorSlot(key) {
			return '<small class="field-error" id="fieldError-' + escapeHtml(key) + '" data-field-error="' + escapeHtml(key) + '" role="alert" hidden></small>';
		}

		// config.hint is trusted markup (callers escape anything dynamic); everything else is escaped here.
		function providerInputField(config) {
			const keyAttr = config.fieldKey ? ' data-field-key="' + escapeHtml(config.fieldKey) + '" aria-describedby="fieldError-' + escapeHtml(config.fieldKey) + '"' : '';
			return '<label class="field"><span>' + escapeHtml(config.label) + '</span><input type="' + (config.type || 'text') + '"' + (config.inputmode ? ' inputmode="' + config.inputmode + '"' : '') + (config.id ? ' id="' + config.id + '"' : '') + (config.attrs || '') + ' value="' + escapeHtml(config.value == null ? '' : config.value) + '" placeholder="' + escapeHtml(config.placeholder || '') + '" autocomplete="off" spellcheck="false"' + keyAttr + '>' +
				(config.hint ? '<small class="muted">' + config.hint + '</small>' : '') + (config.fieldKey ? fieldErrorSlot(config.fieldKey) : '') + '</label>';
		}

		function secretStatusText(mode, suffix) {
			const ending = suffix ? 'ends with ' + suffix : 'is saved';
			if (mode === 'clear') return 'The saved key will be removed when you save.';
			if (mode === 'replace') return 'Enter the new key below. It replaces the saved key when you save.';
			return 'Saved key ' + ending + '.';
		}

		// A secret is never sent back to the page; only its last characters are shown. Replace reveals the input, Clear sets the
		// existing clear flag (the hidden checkbox the settings payload already reads).
		function providerSecretField(id, label, secret, envName) {
			const configured = !!(secret && secret.configured);
			const suffix = String(secret && secret.suffix || '');
			const labelId = id + 'Label';
			if (!configured) {
				return '<div class="field secret-field" id="' + id + 'Field" data-secret-field="' + id + '" data-secret-configured="0"><span id="' + labelId + '">' + escapeHtml(label) + '</span>' +
					'<input type="password" autocomplete="new-password" spellcheck="false" id="' + id + '" aria-labelledby="' + labelId + '">' +
					'<small class="muted">Leave blank to use ' + escapeHtml(envName) + '.</small></div>';
			}
			return '<div class="field secret-field" id="' + id + 'Field" data-secret-field="' + id + '" data-secret-configured="1" data-secret-suffix="' + escapeHtml(suffix) + '"><span id="' + labelId + '">' + escapeHtml(label) + '</span>' +
				'<div class="secret-row"><span class="secret-status" id="' + id + 'Status" aria-live="polite">' + escapeHtml(secretStatusText('keep', suffix)) + '</span>' +
				'<button type="button" class="btn-sm" id="' + id + 'ReplaceBtn" data-secret-action="replace" data-secret-id="' + id + '" aria-expanded="false" aria-controls="' + id + '">Replace</button>' +
				'<button type="button" class="btn-sm btn-danger" id="' + id + 'ClearBtn" data-secret-action="clear" data-secret-id="' + id + '" aria-pressed="false">Clear</button></div>' +
				'<input type="password" autocomplete="new-password" spellcheck="false" id="' + id + '" aria-labelledby="' + labelId + '" hidden>' +
				'<input type="checkbox" id="' + id + 'Clear" hidden></div>';
		}

		function secretFieldMode(id) {
			const input = document.getElementById(id);
			const clearBox = document.getElementById(id + 'Clear');
			if (clearBox && clearBox.checked) return 'clear';
			if (input && !input.hidden) return 'replace';
			return 'keep';
		}

		// mode: 'keep' (nothing changes), 'replace' (new key typed in), or 'clear' (remove the saved key on save).
		function setSecretMode(id, mode, options = {}) {
			const field = document.getElementById(id + 'Field');
			const input = document.getElementById(id);
			const clearBox = document.getElementById(id + 'Clear');
			if (!field || !input || !clearBox || !field.dataset || field.dataset.secretConfigured !== '1') return false;
			const next = mode === 'replace' || mode === 'clear' ? mode : 'keep';
			if (next !== 'replace') input.value = '';
			input.hidden = next !== 'replace';
			clearBox.checked = next === 'clear';
			const status = document.getElementById(id + 'Status');
			if (status) status.textContent = secretStatusText(next, field.dataset.secretSuffix || '');
			const replaceBtn = document.getElementById(id + 'ReplaceBtn');
			if (replaceBtn) {
				replaceBtn.textContent = next === 'replace' ? 'Cancel replace' : 'Replace';
				replaceBtn.setAttribute('aria-expanded', next === 'replace' ? 'true' : 'false');
			}
			const clearBtn = document.getElementById(id + 'ClearBtn');
			if (clearBtn) {
				clearBtn.textContent = next === 'clear' ? 'Undo clear' : 'Clear';
				clearBtn.setAttribute('aria-pressed', next === 'clear' ? 'true' : 'false');
			}
			if (next === 'replace' && options.focus && typeof input.focus === 'function') input.focus();
			return true;
		}

		function applySecretAction(id, action, options = {}) {
			const mode = secretFieldMode(id);
			let next = mode;
			if (action === 'replace') next = mode === 'replace' ? 'keep' : 'replace';
			else if (action === 'clear') next = mode === 'clear' ? 'keep' : 'clear';
			else return false;
			return setSecretMode(id, next, options);
		}

		// After values were restored into the inputs, make the Replace / Clear controls agree with them.
		function syncSecretFields() {
			if (!fields.providerSettings) return;
			fields.providerSettings.querySelectorAll('[data-secret-field][data-secret-configured="1"]').forEach((field) => {
				const id = field.getAttribute('data-secret-field');
				const input = document.getElementById(id);
				const clearBox = document.getElementById(id + 'Clear');
				const mode = clearBox && clearBox.checked ? 'clear' : (input && input.value ? 'replace' : 'keep');
				setSecretMode(id, mode);
			});
		}

		function providerCodexImageToolField(settings) {
			const value = settings.codex_image_tool === 'generations' ? 'generations' : 'image_gen';
			return '<label class="field"><span>Codex image route</span><select id="relayCodexImageTool"><option value="image_gen"' + (value === 'image_gen' ? ' selected' : '') + '>Codex exec image_gen tool</option><option value="generations"' + (value === 'generations' ? ' selected' : '') + '>Codex login images request</option></select><small class="muted">image_gen is the default. It asks Codex exec to pass size and quality inside the image_gen prompt. Those values are scene hints only. The built-in tool accepts only prompt, referenced_image_paths, and num_last_images_to_include, and returns PNG. generations posts size and quality on the Codex login images request; that endpoint does not apply them.</small></label>';
		}

		function providerFieldGroup(key, settings) {
			const providers = settings.providers || {};
			const anthropic = providers.anthropic || {};
			const xai = providers.xai || {};
			const openai = providers.openai_videos || {};
			const apiKeyChat = providers.api_key_chat || {};
			const savedAt = anthropic.credit_balance_as_of && formatLocalDateTime(anthropic.credit_balance_as_of);
			if (key === 'codexImageTool') return providerCodexImageToolField(settings);
			if (key === 'anthropic') {
				return [
					providerSecretField('relayAnthropicApiKey', 'Claude API key', anthropic.api_key, 'ANTHROPIC_API_KEY'),
					providerSecretField('relayAnthropicAdminKey', 'Claude Admin API key (optional, usage only)', anthropic.admin_api_key, 'ANTHROPIC_ADMIN_KEY'),
					'<small class="muted">Admin keys (sk-ant-admin…) are created under platform.claude.com → Settings → Admin keys and are only used to read month-to-date cost. Not available for individual accounts.</small>',
					providerInputField({ id: 'relayAnthropicBaseUrl', label: 'Claude API base URL', value: anthropic.base_url, placeholder: 'https://api.anthropic.com' }),
					providerInputField({ id: 'relayAnthropicModels', label: 'Claude chat models', value: Array.isArray(anthropic.models) ? anthropic.models.join(',') : (anthropic.models || ''), placeholder: 'claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5', hint: 'Comma-separated model IDs.' }),
					providerInputField({ id: 'relayAnthropicMonthlyLimit', inputmode: 'decimal', fieldKey: 'relayAnthropicMonthlyLimit', label: 'Monthly spend limit (USD)', value: anthropic.monthly_limit_usd == null ? '' : String(anthropic.monthly_limit_usd), hint: 'Your tier or custom limit from the Claude dashboard, e.g. 500.' }),
					providerInputField({ id: 'relayAnthropicCreditBalance', inputmode: 'decimal', fieldKey: 'relayAnthropicCreditBalance', label: 'Organization credit balance (USD)', value: anthropic.credit_balance_usd == null ? '' : String(anthropic.credit_balance_usd), hint: 'Copy "Organization credits" from platform.claude.com/dashboard. Relay subtracts the Cost API spend from the start of the UTC day you saved it. Changing this amount restarts that count; tick the box below only to restart it with an unchanged amount.' + (savedAt ? ' Saved ' + escapeHtml(savedAt) : '') }),
					'<label class="checkbox-row"><input type="checkbox" id="relayAnthropicCreditRebaseline"><span>Recount spend from today</span></label>',
				].join('');
			}
			if (key === 'xai') {
				return [
					providerSecretField('relayXaiApiKey', 'xAI API key', xai.api_key, 'XAI_API_KEY'),
					providerInputField({ id: 'relayXaiBaseUrl', label: 'xAI base URL', value: xai.base_url, placeholder: 'https://api.x.ai/v1' }),
					providerInputField({ id: 'relayXaiModels', label: 'xAI chat models', value: xai.models, placeholder: 'grok-4.6,grok-4.5,grok-4.3,latest', hint: 'Comma-separated native model IDs.' }),
				].join('');
			}
			if (key === 'openaiVideos') {
				return [
					'<label class="field"><span>OpenAI Videos</span><select id="relayOpenaiEnabled"><option value="">Use environment</option><option value="true"' + (openai.enabled === true ? ' selected' : '') + '>Enabled</option><option value="false"' + (openai.enabled === false ? ' selected' : '') + '>Disabled</option></select></label>',
					providerSecretField('relayOpenaiApiKey', 'OpenAI API key', openai.api_key, 'OPENAI_API_KEY'),
				].join('');
			}
			if (key === 'apiKeyChat') {
				return [
					providerSecretField('relayApiKeyChatKey', 'API-key chat key', apiKeyChat.api_key, 'AI_MODEL_RELAY_CHAT_API_KEY'),
					providerInputField({ id: 'relayApiKeyChatBaseUrl', label: 'API-key chat base URL', value: apiKeyChat.base_url, placeholder: 'https://api.example.com/v1' }),
					providerInputField({ id: 'relayApiKeyChatProviderId', label: 'API-key chat provider id', value: apiKeyChat.provider_id, placeholder: 'api-key-chat' }),
					providerInputField({ id: 'relayApiKeyChatModel', label: 'API-key chat model', value: apiKeyChat.model, placeholder: 'default' }),
				].join('');
			}
			if (key === 'cliProcessArgs') return providerInputField({ id: 'relayCliProcessArgs', label: 'CLI process extra arguments', value: providers.cli_process && providers.cli_process.args, placeholder: 'Optional argv after the executable' });
			if (key === 'grokImagineSkill') return providerInputField({ id: 'relayGrokImagineSkill', label: 'Grok Imagine skill path', value: providers.grok && providers.grok.imagine_skill, placeholder: '%USERPROFILE%\\.grok\\skills\\imagine\\SKILL.md' });
			if (key === 'antigravityStateDir') return providerInputField({ id: 'relayAntigravityStateDir', label: 'Antigravity state directory', value: providers.antigravity && providers.antigravity.state_dir, placeholder: '%USERPROFILE%\\.gemini\\antigravity-cli' });
			return '';
		}

		function providerCliPathField(id, config, settings) {
			const cliPaths = settings.cli_paths || {};
			return providerInputField({ attrs: ' data-relay-cli-path="' + escapeHtml(id) + '"', label: config.label, value: cliPaths[id] || '', placeholder: config.placeholder, hint: config.hint ? escapeHtml(config.hint) : '' });
		}

		// Model chips come from the models endpoint; engines without model entries fall back to the backend's own model states.
		function providerModelChips(backend, models) {
			const id = backend && backend.id;
			const own = (Array.isArray(models) ? models : []).filter((model) => model && model.backend === id && model.id);
			let items = own.map((model) => ({ text: String(model.id), note: model.experimental ? 'experimental' : '', off: model.ready === false }));
			if (!items.length && Array.isArray(backend && backend.models)) {
				items = backend.models.map((model) => (model && typeof model === 'object'
					? { text: String(model.label || model.id || 'model') + ' — ' + String(model.state || (model.ready ? 'ready' : 'not checked')), note: '', off: false }
					: { text: String(model), note: '', off: false })).filter((item) => item.text);
			}
			if (!items.length) return '';
			const limit = 10;
			const chips = items.slice(0, limit).map((item) => '<li class="chip' + (item.off ? ' chip-off' : '') + '"><code>' + escapeHtml(item.text) + '</code>' + (item.note ? '<span class="chip-note">' + escapeHtml(item.note) + '</span>' : '') + '</li>');
			if (items.length > limit) chips.push('<li class="chip chip-more" title="' + escapeHtml(items.slice(limit).map((item) => item.text).join(', ')) + '">+' + (items.length - limit) + ' more</li>');
			return '<div class="provider-card-models"><span class="label">Models</span><ul class="chip-list" aria-label="Models">' + chips.join('') + '</ul></div>';
		}

		function providerTestTabTargets() {
			return [
				{ jobType: 'images', type: 'images', tab: 'provider-test-tab-images', label: 'Open image test' },
				{ jobType: 'videos', type: 'videos', tab: 'provider-test-tab-videos', label: 'Open video test' },
				{ jobType: 'media.analyze', type: 'analysis', tab: 'provider-test-tab-analysis', label: 'Open video analysis test' },
				{ jobType: 'transcribe', type: 'audio', tab: 'provider-test-tab-audio', label: 'Open audio test' },
				{ jobType: 'music.analyze', type: 'audio', tab: 'provider-test-tab-audio', label: 'Open audio test' },
			];
		}

		// Links to the Tests route with the matching test type selected and this provider's cards highlighted
		// (#tests/<type>/<backend id>), for the media job types a backend supports.
		function providerMediaTestLinks(backend) {
			const jobTypes = Array.isArray(backend && backend.job_types) ? backend.job_types : [];
			const id = String(backend && backend.id == null ? '' : (backend && backend.id) || '');
			const seen = new Set();
			const links = [];
			providerTestTabTargets().forEach((target) => {
				if (!jobTypes.includes(target.jobType) || seen.has(target.tab)) return;
				seen.add(target.tab);
				const route = 'tests/' + target.type + (id ? '/' + encodeURIComponent(id) : '');
				links.push('<a class="btn btn-sm" href="#' + escapeHtml(route) + '" data-open-test-tab="' + target.tab + '" data-test-provider="' + escapeHtml(id) + '">' + target.label + '</a>');
			});
			return links;
		}

		// Shared by the Tests tab and the provider cards: the optional image input of a chat test.
		function chatTestImageField(model, isApi) {
			const imageAccept = isApi ? 'image/png,image/jpeg,image/webp,image/gif' : 'image/png,image/jpeg,image/webp';
			const cliImageHint = ['grok-cli', 'cursor-cli', 'antigravity-cli', 'codex-cli'].includes(model.backend) ? '<small class="muted">CLI providers receive the image as a local file reference; check that the reply actually describes the image.</small>' : '';
			// The generic CLI Process driver always rejects images, so it gets no image input.
			return model.backend === 'cli-process' ? '' : '<label class="field"><span>Image (optional, vision check)</span><input type="file" accept="' + imageAccept + '" data-chat-image></label>' + cliImageHint;
		}

		// The inline chat test of a provider card. It is the same element the Tests tab uses (data-provider-media-test, the same
		// data-* hooks), so runProviderMediaTest, the progress tracker, and the result rendering all work unchanged.
		function providerCardChatTestMarkup(backend, chatModels) {
			const label = String(backend.label || backend.id || 'Provider');
			const isApi = backend.provider_kind === 'api' || backend.kind === 'api';
			const first = chatModels[0];
			const modelSelect = chatModels.length > 1
				? '<label class="field"><span>Model</span><select data-test-option="model">' + chatModels.map((model) => '<option value="' + escapeHtml(model.id) + '"' + (model.id === first.id ? ' selected' : '') + '>' + escapeHtml(model.id) + '</option>').join('') + '</select></label>'
				: '<small class="muted">Model: <code>' + escapeHtml(first.id) + '</code></small>';
			const cost = isApi ? '<small class="muted">This request is sent to ' + escapeHtml(label) + '; usage charges may apply.</small>' : '';
			return '<div class="provider-media-test provider-card-chat-test" data-provider-media-test data-test-job-type="chat" data-card-test="1" data-card-key="' + escapeHtml('card-chat|' + backend.id) + '">' +
				modelSelect +
				'<details class="provider-chat-system"><summary>Test options</summary><div class="provider-card-test-options">' +
				'<label class="field"><span>Test prompt</span><input type="text" data-test-prompt maxlength="8000" value="Reply with exactly: OK"></label>' +
				'<label class="field"><span>System prompt (optional)</span><textarea data-chat-system maxlength="4000" rows="3" spellcheck="false"></textarea></label>' +
				chatTestImageField(first, isApi) +
				'<label class="field"><span>Max tokens</span><input type="number" min="16" max="4096" step="1" inputmode="numeric" data-chat-max-tokens value="256"></label>' +
				'</div></details>' +
				cost +
				'<div class="provider-card-test-row"><button type="button" data-provider-test="chat" data-model="' + escapeHtml(first.id) + '" aria-label="Test ' + escapeHtml(label) + '">Test</button>' +
				'<div class="provider-test-status"><small class="muted" data-test-message>Sends one short chat request.</small><small class="provider-test-progress" data-test-progress aria-live="polite">Idle</small></div></div>' +
				'<div class="provider-test-activity" data-test-progress-bar role="progressbar" aria-label="Provider test activity" aria-valuetext="Idle" hidden><span></span></div>' +
				'<div class="provider-test-result" data-test-result></div>' +
			'</div>';
		}

		function yesNoLabel(value) {
			return value === null || value === undefined ? '' : (value ? 'Yes' : 'No');
		}

		function providerDetailsMarkup(backend) {
			const features = Object.keys(backend.features && typeof backend.features === 'object' ? backend.features : {}).filter((key) => backend.features[key]).join(', ');
			const rows = [
				['Version', backend.version],
				['Command', backend.command],
				['State', backend.state],
				['Installed', yesNoLabel(backend.installed)],
				['Authenticated', yesNoLabel(backend.authenticated)],
				['Enabled', yesNoLabel(backend.enabled)],
				['Configured', yesNoLabel(backend.configured)],
				['Job types', Array.isArray(backend.job_types) ? backend.job_types.join(', ') : ''],
				['Features', features],
				['Diagnostic', backend.diagnostic],
			].filter((row) => row[1] !== undefined && row[1] !== null && String(row[1]) !== '');
			if (!rows.length) return '';
			return '<details class="provider-card-details"><summary>Details</summary><table class="table"><tbody>' + rows.map(([label, value]) => '<tr><th scope="row">' + escapeHtml(label) + '</th><td><code title="' + escapeHtml(value) + '">' + escapeHtml(value) + '</code>' + (label === 'Command' ? ' <button type="button" class="copy-value" data-copy-value="' + escapeHtml(value) + '">Copy</button>' : '') + '</td></tr>').join('') + '</tbody></table></details>';
		}

		function renderProviderCard(entry, index, context) {
			const backend = entry.backend;
			const spec = entry.spec;
			const settings = context.settings;
			const id = String(backend.id == null ? '' : backend.id);
			const info = backendStatusInfo(backend);
			const open = providerCardIsOpen(id, info);
			const bodyId = 'providerCardBody-' + index;
			const name = String(backend.label || (spec && spec.label) || backend.id || 'Provider');
			const fieldParts = [];
			if (spec && spec.cliPath) fieldParts.push(providerCliPathField(id, spec.cliPath, settings));
			if (spec && Array.isArray(spec.fields)) spec.fields.forEach((key) => fieldParts.push(providerFieldGroup(key, settings)));
			const sections = [];
			if (spec && spec.description) sections.push('<p class="muted provider-card-description">' + escapeHtml(spec.description) + '</p>');
			if (fieldParts.length) sections.push('<div class="settings-grid provider-card-fields">' + fieldParts.join('') + '</div>');
			if (id === 'anthropic-api') sections.push('<div class="claude-card-usage" data-claude-card-usage>' + claudeCardUsageMarkup(lastClaudeUsage) + '</div>');
			const chips = providerModelChips(backend, context.models);
			if (chips) sections.push(chips);
			const actions = [];
			const chatModels = readyMediaModels(context.models, [backend], 'chat', 'text');
			const supportsChat = Array.isArray(backend.job_types) && backend.job_types.includes('chat');
			if (supportsChat && !chatModels.length) actions.push('<button type="button" disabled>Test</button><small class="muted">Chat tests need a ready provider.</small>');
			if (spec && spec.route) actions.push('<a class="btn btn-sm" href="#' + escapeHtml(spec.route) + '" data-nav-hash="' + escapeHtml(spec.route) + '">' + escapeHtml(spec.routeLabel || 'Open settings') + '</a>');
			providerMediaTestLinks(backend).forEach((link) => actions.push(link));
			if (actions.length) sections.push('<div class="provider-card-actions">' + actions.join('') + '</div>');
			if (chatModels.length) sections.push(providerCardChatTestMarkup(backend, chatModels));
			const details = providerDetailsMarkup(backend);
			if (details) sections.push(details);
			return '<article class="card provider-card" data-provider-id="' + escapeHtml(id) + '" data-provider-state="' + info.state + '" data-expanded="' + (open ? 'true' : 'false') + '" tabindex="-1">' +
				'<h3 class="provider-card-head"><button type="button" class="provider-card-toggle" data-provider-toggle aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="' + bodyId + '">' +
				'<span class="provider-card-title"><span class="provider-card-name">' + escapeHtml(name) + '</span><span class="kind-badge">' + providerKindLabel(backend, spec) + '</span></span>' +
				'<span class="provider-card-status" data-provider-status>' + providerStatusPill(info.state, info.label) + '</span>' +
				'<span class="provider-card-diag" data-provider-diag>' + escapeHtml(providerDiagnosticLine(backend, info)) + '</span>' +
				'<span class="provider-card-chevron" aria-hidden="true"></span></button></h3>' +
				'<div class="provider-card-body" id="' + bodyId + '" data-provider-body' + (open ? '' : ' hidden') + '>' + (sections.join('') || '<p class="muted">No settings for this provider.</p>') + '</div>' +
			'</article>';
		}

		function renderProviderCards(backends, models, settings) {
			const entries = providerCardEntries(backends);
			if (!entries.length) return '<div class="empty-state">No provider metadata reported</div>';
			const context = { models: Array.isArray(models) ? models : [], settings: settings || {} };
			return entries.map((entry, index) => renderProviderCard(entry, index, context)).join('');
		}

		// Status changes arrive often (capabilities events, polling): update the pill and the one-line diagnostic in place, so
		// an open card, typed values, and a running test are left alone.
		function updateProviderCardStatuses(backends) {
			if (!fields.providerSettings) return;
			(Array.isArray(backends) ? backends : []).forEach((backend) => {
				const id = String(backend && backend.id || '');
				if (!id) return;
				const card = fields.providerSettings.querySelector('[data-provider-id="' + CSS.escape(id) + '"]');
				if (!card) return;
				const info = backendStatusInfo(backend);
				const status = card.querySelector('[data-provider-status]');
				const pill = providerStatusPill(info.state, info.label);
				if (status && status.innerHTML !== pill) status.innerHTML = pill;
				const diag = card.querySelector('[data-provider-diag]');
				const line = providerDiagnosticLine(backend, info);
				if (diag && diag.textContent !== line) diag.textContent = line;
				card.setAttribute('data-provider-state', info.state);
			});
		}

		// The in-card test elements survive a re-render: a running one is moved into the new card, others keep what was typed
		// and the last result.
		function collectProviderCardTests() {
			const previous = new Map();
			if (!fields.providerSettings) return previous;
			fields.providerSettings.querySelectorAll('[data-provider-id]').forEach((card) => {
				const test = card.querySelector('[data-provider-media-test]');
				if (test) previous.set(card.getAttribute('data-provider-id'), test);
			});
			return previous;
		}

		function restoreProviderCardTests(previous) {
			if (!previous || !previous.size || !fields.providerSettings) return;
			fields.providerSettings.querySelectorAll('[data-provider-id]').forEach((card) => {
				const old = previous.get(card.getAttribute('data-provider-id'));
				const fresh = card.querySelector('[data-provider-media-test]');
				if (!old || !fresh) return;
				if (old.dataset && old.dataset.testRequestId) fresh.replaceWith(old);
				else copyProviderTestCardState(old, fresh);
			});
		}

		// Compact Claude usage for the Claude card; the full panel stays on Overview.
		function claudeCardUsageMarkup(data) {
			const link = ' <a href="#overview" data-nav-hash="overview">Open the usage panel on Overview</a>';
			if (!data || typeof data !== 'object') return '<span class="muted">Usage loads on the Overview panel.</span>' + link;
			const configured = data.configured || {};
			if (!configured.api_key && !configured.admin_api_key) return '<span class="muted">No key saved yet, so there is no usage to show.</span>' + link;
			const month = data.month || {};
			const credits = data.credits || {};
			const spend = claudeNum(month.spend_usd);
			const limit = claudeNum(month.limit_usd);
			const remaining = claudeNum(credits.remaining_usd);
			const parts = [];
			if (spend !== null) parts.push('Spend this month ' + formatUsd(spend) + (limit !== null ? ' of ' + formatUsd(limit) + ' limit' : ''));
			if (remaining !== null) parts.push('Credits (estimated) ' + formatUsd(remaining));
			if (!parts.length) parts.push('No spend report yet');
			return '<span class="claude-card-usage-text">' + escapeHtml(parts.join(' · ')) + '</span>' + link;
		}

		function renderClaudeCardUsage() {
			if (!fields.providerSettings) return;
			fields.providerSettings.querySelectorAll('[data-claude-card-usage]').forEach((node) => {
				node.innerHTML = claudeCardUsageMarkup(lastClaudeUsage);
			});
		}

		// Inline validation: one message per field key, shown next to the field. Keys match the data-field-key attribute.
		// A value that is invalid but identical to the last loaded settings (an old stored value) is not the user's mistake:
		// it becomes a non-blocking warning instead of an error. Only a newly edited invalid value blocks Save.
		function relayFieldProblems(settings, section, baseline) {
			const storedValueWarning = 'Stored value is outside the supported range and will be clamped by the Relay.';
			const errors = {};
			const warnings = {};
			const source = settings || {};
			const base = baseline && typeof baseline === 'object' ? baseline : null;
			const report = (key, value, original, message) => {
				if (base && String(value == null ? '' : value) === String(original == null ? '' : original)) warnings[key] = storedValueWarning;
				else errors[key] = message;
			};
			if (section === 'runtime') {
				const runtime = source.runtime || {};
				const baseRuntime = base && base.runtime || {};
				const concurrent = String(runtime.max_concurrent_jobs == null ? '' : runtime.max_concurrent_jobs);
				if (concurrent && (!/^\d+$/.test(concurrent) || Number(concurrent) < 1 || Number(concurrent) > 32)) report('runtime:max_concurrent_jobs', concurrent, baseRuntime.max_concurrent_jobs, 'Enter a whole number from 1 to 32, or leave blank.');
				const timeouts = runtime.timeouts || {};
				const baseTimeouts = baseRuntime.timeouts || {};
				Object.keys(timeouts).forEach((key) => {
					const value = String(timeouts[key] == null ? '' : timeouts[key]);
					if (value && (!/^\d+$/.test(value) || Number(value) < 1)) report('timeout:' + key, value, baseTimeouts[key], 'Enter a whole number of milliseconds (1 or more), or leave blank.');
				});
				return { errors, warnings };
			}
			const anthropic = source.providers && source.providers.anthropic;
			if (anthropic) {
				const baseAnthropic = base && base.providers && base.providers.anthropic || {};
				const usdChecks = [
					{ key: 'relayAnthropicMonthlyLimit', value: anthropic.monthly_limit_usd, original: baseAnthropic.monthly_limit_usd, message: 'Monthly spend limit must be a dollar amount like 500 or 500.25 (max 100,000,000).' },
					{ key: 'relayAnthropicCreditBalance', value: anthropic.credit_balance_usd, original: baseAnthropic.credit_balance_usd, message: 'Credit balance must be a dollar amount like 500 or 500.25 (max 100,000,000).' },
				];
				for (const check of usdChecks) {
					if (check.value && (!/^\d+([.,]\d{1,2})?$/.test(check.value) || Number.parseFloat(check.value.replace(',', '.')) > 100000000)) {
						report(check.key, check.value, check.original, check.message);
					}
				}
			}
			const tokenDefaults = source.token_defaults || {};
			const baseTokens = base && base.token_defaults || {};
			Object.keys(tokenDefaults).forEach((job) => {
				const value = String(tokenDefaults[job] == null ? '' : tokenDefaults[job]);
				if (value && (!/^\d+$/.test(value) || Number(value) < 512 || Number(value) > 128000)) report('token:' + job, value, baseTokens[job], 'Enter a whole number from 512 to 128000, or leave blank for the code default.');
			});
			return { errors, warnings };
		}

		// baseline: the section's settings as last loaded (optional). Without it every invalid value is an error.
		function relayFieldErrors(settings, section, baseline) {
			return relayFieldProblems(settings, section, baseline).errors;
		}

		function relayFieldWarnings(settings, section, baseline) {
			return relayFieldProblems(settings, section, baseline).warnings;
		}

		// Shows (or clears) the message under every validated field in root; returns the first invalid input. warnings is
		// optional: a warning is shown in the same place with a different look, and never marks the field invalid.
		function applyFieldErrors(root, errors, warnings) {
			let first = null;
			if (!root) return first;
			const notes = warnings || {};
			root.querySelectorAll('[data-field-key]').forEach((input) => {
				const key = input.getAttribute('data-field-key');
				const hasError = Object.prototype.hasOwnProperty.call(errors, key);
				const hasWarning = !hasError && Object.prototype.hasOwnProperty.call(notes, key);
				const message = hasError ? errors[key] : (hasWarning ? notes[key] : '');
				const slot = document.getElementById('fieldError-' + key);
				if (slot) {
					slot.textContent = message;
					slot.hidden = !message;
					if (slot.classList) slot.classList.toggle('is-warning', hasWarning);
					if (typeof slot.setAttribute === 'function') slot.setAttribute('role', hasWarning ? 'status' : 'alert');
				}
				if (hasError) {
					input.setAttribute('aria-invalid', 'true');
					if (!first) first = input;
				} else {
					input.removeAttribute('aria-invalid');
				}
			});
			return first;
		}

		function validateRelaySection(section) {
			const root = section === 'runtime' ? fields.relayRuntimeSettings : fields.relaySettingsForm;
			let baseline = null;
			try {
				baseline = formSnapshots[section] ? JSON.parse(formSnapshots[section]) : null;
			} catch (error) {
				baseline = null;
			}
			const problems = relayFieldProblems(collectRelaySettingsPayload(section), section, baseline);
			const first = applyFieldErrors(root, problems.errors, problems.warnings);
			return { errors: problems.errors, warnings: problems.warnings, first };
		}

		function setSaveBarText(section, message) {
			const target = section === 'runtime' ? fields.runtimeSaveBarText : fields.relaySaveBarText;
			if (target) target.textContent = message || 'Unsaved changes';
		}

		function renderRelaySettings(payload) {
			lastRelaySettingsPayload = payload || null;
			const settings = payload && payload.settings || {};
			const defaults = settings.defaults || {};
			const tokenDefaults = settings.token_defaults || {};
			const models = Array.isArray(payload && payload.models) ? payload.models : [];
			const backends = Array.isArray(payload && payload.backends) ? payload.backends : (currentCapabilities.backends || []);
			const backendById = new Map(backends.map((backend) => [backend.id, backend]));
			const previousTests = collectProviderCardTests();
			fields.providerSettings.innerHTML = renderProviderCards(backends, models, settings);
			restoreProviderCardTests(previousTests);
			const labels = { chat: 'Chat and coding', images: 'Image generation', videos: 'Video generation', transcribe: 'Transcription', 'media.analyze': 'Media analysis', 'music.analyze': 'Music analysis' };
			fields.relayDefaultSettings.innerHTML = Object.keys(labels).map((jobType) => {
				const current = defaults[jobType] || '';
				const expectedType = (jobType === 'chat' || jobType === 'media.analyze') ? 'text' : ({ images: 'image', videos: 'video', transcribe: 'audio', 'music.analyze': 'audio' }[jobType]);
				const compatible = models.filter((model) => {
					const backend = backendById.get(model.backend);
					return model.type === expectedType && model.ready !== false && backend && backend.ready === true && Array.isArray(backend.job_types) && backend.job_types.includes(jobType) && (!Array.isArray(model.job_types) || !model.job_types.length || model.job_types.includes(jobType));
				});
				const selectedKnown = compatible.some((model) => model.id === current);
				const unavailable = current && !selectedKnown ? ['<option value="' + escapeHtml(current) + '" selected disabled>Unavailable saved selection: ' + escapeHtml(current) + '</option>'] : [];
				const options = unavailable.concat(compatible.map((model) => '<option value="' + escapeHtml(model.id) + '"' + optionAttr(model.id, current) + '>' + escapeHtml(model.id) + (model.experimental ? ' (experimental)' : '') + '</option>'));
				return '<label class="field"><span>' + labels[jobType] + '</span><select data-relay-job="' + jobType + '">' + options.join('') + '</select></label>';
			}).join('');
			const tokenFields = [
				{ jobType: 'chat', label: 'Chat token default', codeDefault: 8192 },
				{ jobType: 'media.analyze', label: 'Media analysis token default', codeDefault: 4096 },
			];
			fields.relayTokenDefaults.innerHTML = tokenFields.map((entry) => '<label class="field"><span>' + escapeHtml(entry.label) + '</span><input type="number" min="512" max="128000" step="1" inputmode="numeric" data-relay-token-default="' + escapeHtml(entry.jobType) + '" data-field-key="token:' + escapeHtml(entry.jobType) + '" aria-describedby="fieldError-token:' + escapeHtml(entry.jobType) + '" value="' + escapeHtml(tokenDefaults[entry.jobType] || '') + '" placeholder="Code default: ' + entry.codeDefault + '"><small class="muted">Leave blank to use the code default.</small>' + fieldErrorSlot('token:' + entry.jobType) + '</label>').join('');
			const runtime = settings.runtime || {};
			const runtimeTimeouts = runtime.timeouts || {};
			const timeoutFields = [
				{ key: 'codex_chat_ms', label: 'Codex chat timeout (ms)', placeholder: '600000' },
				{ key: 'codex_image_ms', label: 'Codex image timeout (ms)', placeholder: '1800000' },
				{ key: 'codex_status_ms', label: 'Codex status probe timeout (ms)', placeholder: '15000' },
				{ key: 'named_cli_chat_ms', label: 'Grok/Cursor chat timeout (ms)', placeholder: '600000' },
				{ key: 'grok_media_ms', label: 'Grok Imagine timeout (ms)', placeholder: '450000' },
				{ key: 'antigravity_chat_ms', label: 'Antigravity chat timeout (ms)', placeholder: '600000' },
				{ key: 'antigravity_image_ms', label: 'Antigravity image timeout (ms)', placeholder: '1800000' },
				{ key: 'antigravity_media_ms', label: 'Antigravity media timeout (ms)', placeholder: '600000' },
				{ key: 'cli_process_ms', label: 'CLI process timeout (ms)', placeholder: '600000' },
				{ key: 'cli_probe_ms', label: 'CLI probe timeout (ms)', placeholder: '10000' },
				{ key: 'provider_fetch_ms', label: 'HTTP provider fetch timeout (ms, not Claude chat)', placeholder: '60000' },
				{ key: 'anthropic_chat_ms', label: 'Claude API chat timeout (ms)', placeholder: '600000' },
				{ key: 'xai_poll_timeout_ms', label: 'xAI video poll timeout (ms)', placeholder: '600000' },
				{ key: 'xai_poll_interval_ms', label: 'xAI video poll interval (ms)', placeholder: '3000' },
				{ key: 'openai_poll_timeout_ms', label: 'OpenAI Videos poll timeout (ms)', placeholder: '600000' },
				{ key: 'openai_poll_interval_ms', label: 'OpenAI Videos poll interval (ms)', placeholder: '3000' },
			];
			if (fields.relayRuntimeSettings) {
				fields.relayRuntimeSettings.innerHTML = [
					'<label class="field"><span>Listen port</span><input value="' + escapeHtml(payload && payload.listen_port || '') + '" disabled><small class="muted">Set ALORBACH_CODEX_BRIDGE_PORT before starting the tray app.</small></label>',
					'<label class="field"><span>Max concurrent jobs</span><input id="relayMaxConcurrent" type="number" min="1" max="32" step="1" inputmode="numeric" data-field-key="runtime:max_concurrent_jobs" aria-describedby="fieldError-runtime:max_concurrent_jobs" value="' + escapeHtml(runtime.max_concurrent_jobs || '') + '" placeholder="2"><small class="muted">Leave blank to use ALORBACH_CODEX_MAX_CONCURRENT_JOBS.</small>' + fieldErrorSlot('runtime:max_concurrent_jobs') + '</label>',
				].concat(timeoutFields.map((entry) => '<label class="field"><span>' + escapeHtml(entry.label) + '</span><input type="number" min="1" step="1" inputmode="numeric" data-relay-timeout="' + escapeHtml(entry.key) + '" data-field-key="timeout:' + escapeHtml(entry.key) + '" aria-describedby="fieldError-timeout:' + escapeHtml(entry.key) + '" value="' + escapeHtml(runtimeTimeouts[entry.key] || '') + '" placeholder="' + entry.placeholder + '"><small class="muted">Leave blank for the environment or code default.</small>' + fieldErrorSlot('timeout:' + entry.key) + '</label>')).join('');
			}
			if (!providerFormRendered) {
				// First successful render: the form now holds the stored settings, so Refresh detection may save and probe.
				providerFormRendered = true;
				const refreshButton = fields.refreshRelayProviders;
				if (refreshButton && !(refreshButton.dataset && refreshButton.dataset.refreshId) && refreshButton.textContent !== 'Checking…') refreshButton.disabled = false;
			}
			if (fields.relayRuntimeMessage && fields.refreshRelayProviders && !fields.refreshRelayProviders.disabled) {
				fields.relayRuntimeMessage.textContent = 'Runtime settings loaded';
			}
			setSaveBarText('relay');
			setSaveBarText('runtime');
			renderProviderTestPanels(models, backends);
			updateProviderTestCounts();
			applyProviderFocus();
			applyTestFocus();
		}

		// Provider test cards are never rebuilt while a test is in flight or Run all is active; the latest
		// models/backends are kept and rendered once the last card settles.
		function providerTestsBusy() {
			return chatRunAll.running || !!document.querySelector('[data-provider-media-test][data-test-request-id]');
		}

		function renderProviderTestPanels(models, backends) {
			if (providerTestsBusy()) {
				pendingProviderTestRender = { models, backends };
				return;
			}
			pendingProviderTestRender = null;
			renderProviderMediaTests(models, backends);
			renderProviderChatTests(models, backends);
		}

		function flushPendingProviderTestRender() {
			if (!pendingProviderTestRender || providerTestsBusy()) return;
			const pending = pendingProviderTestRender;
			pendingProviderTestRender = null;
			renderProviderMediaTests(pending.models, pending.backends);
			renderProviderChatTests(pending.models, pending.backends);
		}

		function waitForProviderTestSettled(card) {
			return new Promise((resolve) => {
				const waiting = providerTestWaiters.get(card) || [];
				waiting.push(resolve);
				providerTestWaiters.set(card, waiting);
			});
		}

		// Called once a card's test has fully settled (request ids cleared): resolves Run all and runs any deferred render.
		function providerTestSettled(card) {
			const waiting = providerTestWaiters.get(card);
			if (waiting) {
				providerTestWaiters.delete(card);
				const outcome = card.dataset.testOutcome === 'passed' || card.dataset.testOutcome === 'noreply' ? card.dataset.testOutcome : 'failed';
				waiting.forEach((resolve) => resolve(outcome));
			}
			flushPendingProviderTestRender();
		}

		// Every job state after which the Relay will not change the job again.
		function providerTestTerminal(state) {
			return ['completed', 'failed', 'cancelled', 'canceled', 'timeout', 'timed_out', 'error', 'aborted', 'interrupted'].includes(String(state || '').toLowerCase());
		}

		// Carries what the user typed and the last result over from a card that is being replaced by changed markup.
		function copyProviderTestCardState(from, to) {
			['[data-test-prompt]', '[data-chat-system]', '[data-chat-max-tokens]'].forEach((selector) => {
				const source = from.querySelector(selector);
				const target = to.querySelector(selector);
				if (source && target) target.value = source.value;
			});
			const targets = Array.from(to.querySelectorAll('[data-test-option]'));
			Array.from(from.querySelectorAll('[data-test-option]')).forEach((source) => {
				const target = targets.find((entry) => entry.dataset.testOption === source.dataset.testOption);
				if (!target) return;
				const fallback = target.value;
				target.value = source.value;
				if (target.value !== source.value) target.value = fallback;
			});
			[['[data-test-result]', 'innerHTML'], ['[data-test-message]', 'textContent'], ['[data-test-progress]', 'textContent']].forEach(([selector, property]) => {
				const source = from.querySelector(selector);
				const target = to.querySelector(selector);
				if (source && target) target[property] = source[property];
			});
			if (from.dataset.testOutcome) to.dataset.testOutcome = from.dataset.testOutcome;
			if (from.chatTestPayload) to.chatTestPayload = from.chatTestPayload;
		}

		// Renders one test panel from [{ key, html }] cards. Nothing happens when the card set is identical to the last
		// render; otherwise cards whose markup is unchanged (or that are mid-test) are moved over as they are, and changed
		// cards inherit the entered values and last result, so a finished test never loses its reply to a re-render.
		function setProviderTestPanel(container, entries, emptyHtml) {
			if (!container) return false;
			// Card keys must be unique or two entries would collapse into one card; a duplicate gets '#index' appended.
			const usedKeys = new Set();
			entries = entries.map((entry, index) => {
				if (!usedKeys.has(entry.key)) {
					usedKeys.add(entry.key);
					return entry;
				}
				const key = entry.key + '#' + index;
				usedKeys.add(key);
				return { key, html: entry.html.replace('data-card-key="' + escapeHtml(entry.key) + '"', 'data-card-key="' + escapeHtml(key) + '"') };
			});
			const fingerprint = entries.length ? entries.map((entry) => entry.key + '\u0001' + entry.html).join('\u0002') : 'empty:' + emptyHtml;
			const previous = providerTestPanels.get(container);
			if (previous && previous.fingerprint === fingerprint) return false;
			const oldCards = new Map();
			Array.from(container.querySelectorAll('[data-provider-media-test]')).forEach((card) => {
				if (card.dataset.cardKey) oldCards.set(card.dataset.cardKey, card);
			});
			const markup = new Map(entries.map((entry) => [entry.key, entry.html]));
			container.innerHTML = entries.length ? entries.map((entry) => entry.html).join('') : emptyHtml;
			Array.from(container.querySelectorAll('[data-provider-media-test]')).forEach((card) => {
				const old = oldCards.get(card.dataset.cardKey);
				if (!old) return;
				const unchanged = !!previous && previous.markup.get(card.dataset.cardKey) === markup.get(card.dataset.cardKey);
				if (unchanged || old.dataset.testRequestId) {
					if (!unchanged && previous) markup.set(card.dataset.cardKey, previous.markup.get(card.dataset.cardKey));
					card.replaceWith(old);
				} else {
					copyProviderTestCardState(old, card);
				}
			});
			providerTestPanels.set(container, { fingerprint, markup });
			return true;
		}

		function readyMediaModels(models, backends, jobType, type) {
			const backendById = new Map(backends.map((backend) => [backend.id, backend]));
			return models.filter((model) => {
				const backend = backendById.get(model.backend);
				return model.type === type && model.ready !== false && backend && backend.ready === true && Array.isArray(backend.job_types) && backend.job_types.includes(jobType) && (!Array.isArray(model.job_types) || !model.job_types.length || model.job_types.includes(jobType));
			});
		}

                function providerTestControls(model, jobType) {
                        const options = Array.isArray(model.test_options) ? model.test_options.filter((entry) => entry && entry.key && ((Array.isArray(entry.choices) && entry.choices.length) || (entry.input && entry.input.type === 'text'))) : [];
                        if (!options.length) return '';
                        const deliveryLabel = (entry) => {
                                if (entry.delivery === 'direct') return 'sent directly';
                                if (entry.delivery === 'tool-arg') return 'Imagine tool argument';
                                return 'generation guidance';
                        };
                        const deliverySummary = (entry) => {
                                if (entry.delivery === 'direct') return 'directly to the provider';
                                if (entry.delivery === 'tool-arg') return 'as an Imagine tool argument';
                                return 'as generation guidance';
                        };
                        const controls = options.map((entry) => {
                                const key = String(entry.key || '').trim();
                                if (key && entry.input && entry.input.type === 'text') {
                                        const field = entry.input;
                                        return '<label class="field"><span>' + escapeHtml(entry.label || key) + ' · ' + deliveryLabel(entry) + '</span><input type="text" data-test-option="' + escapeHtml(key) + '" value="' + escapeHtml(field.default_value || '') + '" placeholder="' + escapeHtml(field.placeholder || '') + '"></label>';
                                }
                                const choices = entry.choices.filter((choice) => choice && choice.value !== undefined);
                                if (!key || !choices.length) return '';
                                const selected = key === 'model' ? model.id : String(choices[0].value);
                                const selectOptions = choices.map((choice) => '<option value="' + escapeHtml(choice.value) + '"' + (String(choice.value) === selected ? ' selected' : '') + '>' + escapeHtml(choice.label || choice.value) + '</option>').join('');
                                return '<label class="field"><span>' + escapeHtml(entry.label || key) + ' · ' + deliveryLabel(entry) + '</span><select data-test-option="' + escapeHtml(key) + '">' + selectOptions + '</select></label>';
                        }).filter(Boolean).join('');
                        const deliveries = Array.from(new Set(options.map((entry) => deliverySummary(entry))));
                        return controls ? '<div class="settings-grid provider-generation-options">' + controls + '</div><small class="muted">Selected values are sent ' + escapeHtml(deliveries.join(' and ')) + '.</small>' : '';
                }

                function renderProviderMediaTests(models, backends) {
			const imageTests = readyMediaModels(models, backends, 'images', 'image').map((model) => ({ model, jobType: 'images', title: 'Image generation', prompt: 'Ultrarealistic scene Cool Kungfu Cat' }));
                        const videoModels = readyMediaModels(models, backends, 'videos', 'video');
                        const renderedVideoBackends = new Set();
                        const videoTests = videoModels.filter((model) => {
                                if (model.backend !== 'openai-videos') return true;
                                if (renderedVideoBackends.has(model.backend)) return false;
                                renderedVideoBackends.add(model.backend);
                                return true;
                        }).map((model) => ({ model, jobType: 'videos', title: 'Video generation', prompt: 'Create a short, subtle cinematic motion from the supplied reference image.' }));
                        const analysisTests = readyMediaModels(models, backends, 'media.analyze', 'text').map((model) => ({ model, jobType: 'media.analyze', title: 'Video analysis', prompt: 'Summarize the visible action, text, timing, and user-facing issues in this video.' }));
                        const audioTests = [
                                ...readyMediaModels(models, backends, 'transcribe', 'audio').map((model) => ({ model, jobType: 'transcribe', title: model.backend === 'xai-api' ? 'xAI Speech-to-Text (cloud)' : 'Audio transcription', prompt: '' })),
                                ...readyMediaModels(models, backends, 'music.analyze', 'audio').map((model) => ({ model, jobType: 'music.analyze', title: 'Local music analysis', prompt: '' })),
                        ];
                        const renderCards = (container, items, emptyMessage) => setProviderTestPanel(container, items.map(({ model, jobType, title, prompt }) => {
                                const isVideo = jobType === 'videos';
                                const isMediaAnalysis = jobType === 'media.analyze';
                                const isAudio = jobType === 'transcribe' || jobType === 'music.analyze';
				const referenceLimit = model.image_capabilities && Number(model.image_capabilities.reference_images_max);
				const reference = referenceLimit === 0 ? '' : '<label class="field"><span>Reference image (optional)</span><input type="file" accept="image/png,image/jpeg,image/webp" data-test-reference></label>';
				const media = '<label class="field"><span>Video file (MP4, MOV, WebM, or AVI; small test file)</span><input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi" data-test-media></label>';
				const audio = '<label class="field"><span>Audio file</span><input type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.webm" data-test-audio></label>';
				const promptField = isAudio ? '' : '<label class="field"><span>Test prompt</span><input type="text" data-test-prompt value="' + escapeHtml(prompt) + '"></label>';
				const testLabel = isAudio ? (jobType === 'transcribe' ? 'transcription' : 'music analysis') : (isMediaAnalysis ? 'video analysis' : (isVideo ? 'video' : 'image'));
				const key = jobType + '|' + model.backend + '|' + model.id;
				return { key, html: '<article class="provider-media-test" data-provider-media-test data-card-key="' + escapeHtml(key) + '" data-test-backend="' + escapeHtml(model.backend) + '">' +
                                        '<div class="provider-media-test-heading"><span>' + escapeHtml(title) + '</span><code>' + escapeHtml(model.id) + '</code></div>' +
                                        promptField +
                                        (isAudio ? audio : (isMediaAnalysis ? media : reference)) +
                                        providerTestControls(model, jobType) +
                                        (isMediaAnalysis && model.backend === 'antigravity-cli' ? '<small class="muted">The selected video is sent to your authenticated Antigravity CLI; it is not a local-only analysis path.</small>' : '') +
                                        ((jobType === 'images' || jobType === 'videos') && model.backend === 'xai-api' ? '<small class="muted">This request is sent to the xAI Imagine API; usage charges may apply.</small>' : '') +
					'<button type="button" data-provider-test="' + jobType + '" data-model="' + escapeHtml(model.id) + '">Run ' + testLabel + ' test</button>' +
                                        '<div class="provider-test-status"><small class="muted" data-test-message>Ready to test ' + escapeHtml(model.id) + '.</small><small class="provider-test-progress" data-test-progress aria-live="polite">Idle</small></div>' +
                                        '<div class="provider-test-activity" data-test-progress-bar role="progressbar" aria-label="Provider test activity" aria-valuetext="Idle" hidden><span></span></div>' +
                                        '<div class="provider-test-result" data-test-result></div>' +
				'</article>' };
			}), '<div class="muted">' + escapeHtml(emptyMessage) + '</div>');
                        renderCards(fields.providerImageTests, imageTests, 'No ready image providers are available for testing.');
                        renderCards(fields.providerVideoTests, videoTests, 'No ready video providers are available for testing.');
                        renderCards(fields.providerAnalysisTests, analysisTests, 'No ready video-analysis providers are available for testing.');
                        renderCards(fields.providerAudioTests, audioTests, 'No ready transcription or music-analysis providers are available for testing.');
                }

		function renderProviderChatTests(models, backends) {
			if (!fields.providerChatTests) return;
			const backendById = new Map(backends.map((backend) => [backend.id, backend]));
			const labelFor = (model) => { const backend = backendById.get(model.backend); return String(backend && backend.label || model.backend || 'Provider'); };
			const chatModels = readyMediaModels(models, backends, 'chat', 'text').slice().sort((left, right) => labelFor(left).localeCompare(labelFor(right)) || String(left.id).localeCompare(String(right.id)));
			const entries = chatModels.map((model) => {
				const label = labelFor(model);
				const backend = backendById.get(model.backend);
				const isApi = !!backend && (backend.provider_kind === 'api' || backend.kind === 'api');
				const cost = isApi ? '<small class="muted">This request is sent to ' + escapeHtml(label) + '; usage charges may apply.</small>' : '';
				const imageField = chatTestImageField(model, isApi);
				const key = 'chat|' + model.backend + '|' + model.id;
				return { key, html: '<article class="provider-media-test" data-provider-media-test data-test-job-type="chat" data-card-key="' + escapeHtml(key) + '" data-test-backend="' + escapeHtml(model.backend) + '">' +
					'<div class="provider-media-test-heading"><span>' + escapeHtml(label) + '</span><code>' + escapeHtml(model.id) + '</code></div>' +
					'<label class="field"><span>Test prompt</span><input type="text" data-test-prompt maxlength="8000" value="Reply with exactly: OK"></label>' +
					'<details class="provider-chat-system"><summary>System prompt (optional)</summary><textarea data-chat-system maxlength="4000" rows="3" spellcheck="false"></textarea></details>' +
					imageField +
					'<label class="field"><span>Max tokens</span><input type="number" min="16" max="4096" step="1" inputmode="numeric" data-chat-max-tokens value="256"></label>' +
					cost +
					'<button type="button" data-provider-test="chat" data-model="' + escapeHtml(model.id) + '">Run chat test</button>' +
					'<div class="provider-test-status"><small class="muted" data-test-message>Ready to test ' + escapeHtml(model.id) + '.</small><small class="provider-test-progress" data-test-progress aria-live="polite">Idle</small></div>' +
					'<div class="provider-test-activity" data-test-progress-bar role="progressbar" aria-label="Provider test activity" aria-valuetext="Idle" hidden><span></span></div>' +
					'<div class="provider-test-result" data-test-result></div>' +
				'</article>' };
			});
			setProviderTestPanel(fields.providerChatTests, entries, '<div class="muted">No ready chat providers are available for testing.</div>');
			updateChatRunAllState();
		}

		function updateChatRunAllState() {
			if (!fields.runAllChatTests || !fields.providerChatTests) return;
			// Disabled while a chat test is in flight (also one started on its own card), so Run all never has to skip it.
			const busy = Array.from(fields.providerChatTests.querySelectorAll('[data-provider-media-test]')).some((card) => !!card.dataset.testRequestId);
			fields.runAllChatTests.disabled = chatRunAll.running || busy || !fields.providerChatTests.querySelector('[data-provider-media-test]');
			fields.cancelAllChatTests.hidden = !chatRunAll.running;
			fields.cancelAllChatTests.disabled = chatRunAll.cancelled;
			fields.providerChatTests.querySelectorAll('[data-provider-media-test]').forEach((card) => {
				const button = card.querySelector('[data-provider-test]');
				if (button && !card.dataset.testRequestId) button.disabled = chatRunAll.running;
			});
		}

		function chatRunAllSummaryText(counts, cancelled) {
			let summary = counts.passed + ' passed / ' + counts.failed + ' failed';
			if (counts.noReply) summary += ' · ' + counts.noReply + ' without reply';
			if (counts.cancelled) summary += ' · ' + counts.cancelled + ' cancelled (still running in Live)';
			if (counts.busy) summary += ' · ' + counts.busy + ' skipped (already running)';
			if (counts.notRun) summary += ' · ' + counts.notRun + ' not run' + (cancelled ? ' (cancelled)' : '');
			return summary;
		}

		// Colored counts of a Run all, e.g. "3 passed", "1 failed". Passed and failed are always listed; the rest only when non-zero.
		function chatRunAllCountChips(counts) {
			const source = counts || {};
			const chips = [];
			const add = (tone, value, label, always) => {
				const number = Number(value) || 0;
				if (number || always) chips.push('<span class="count-chip ' + tone + '"><b>' + escapeHtml(String(number)) + '</b> ' + escapeHtml(label) + '</span>');
			};
			add('ok', source.passed, 'passed', true);
			add('bad', source.failed, 'failed', true);
			add('warn', source.noReply, 'without reply');
			add('muted', source.cancelled, 'cancelled');
			add('muted', source.busy, 'skipped');
			add('muted', source.notRun, 'not run');
			return chips.join('');
		}

		// state: 'idle' | 'running' | 'cancelling' | 'done'; progress: 0..1. The text is the live line, the chips and the bar carry the rest.
		function renderChatRunAllSummary(state, text, counts, progress) {
			if (fields.chatRunAllSummary) fields.chatRunAllSummary.textContent = text;
			if (fields.chatRunAllCounts) fields.chatRunAllCounts.innerHTML = counts ? chatRunAllCountChips(counts) : '';
			const bar = fields.chatSummaryBar;
			if (bar && bar.dataset) {
				bar.dataset.state = state;
				bar.dataset.outcome = state === 'done' && counts ? (counts.failed ? 'bad' : (counts.noReply || counts.cancelled || counts.notRun ? 'warn' : 'ok')) : '';
			}
			const meter = fields.chatRunAllProgress;
			if (meter) {
				meter.hidden = state !== 'running' && state !== 'cancelling';
				const percent = Math.max(0, Math.min(100, Math.round((Number(progress) || 0) * 100)));
				if (typeof meter.setAttribute === 'function') meter.setAttribute('aria-valuenow', String(percent));
				const fill = meter.firstElementChild;
				if (fill && fill.style) fill.style.width = percent + '%';
			}
		}

		async function runAllChatTests() {
			if (chatRunAll.running) return;
			const cards = Array.from(fields.providerChatTests.querySelectorAll('[data-provider-media-test]'));
			if (!cards.length) return;
			chatRunAll.running = true;
			chatRunAll.cancelled = false;
			updateChatRunAllState();
			const counts = { passed: 0, failed: 0, noReply: 0, cancelled: 0, notRun: 0, busy: 0 };
			chatRunAll.counts = counts;
			chatRunAll.total = cards.length;
			renderChatRunAllSummary('running', 'Running 1 of ' + cards.length + ' · 0 passed / 0 failed', counts, 0);
			try {
				for (let index = 0; index < cards.length; index += 1) {
					if (chatRunAll.cancelled) { counts.notRun += cards.length - index; break; }
					const card = cards[index];
					const button = card.querySelector('[data-provider-test]');
					if (card.dataset.testRequestId) { counts.busy += 1; continue; }
					if (!button || !document.body.contains(card)) { counts.notRun += 1; continue; }
					renderChatRunAllSummary('running', 'Running ' + (index + 1) + ' of ' + cards.length + ' · ' + counts.passed + ' passed / ' + counts.failed + ' failed', counts, index / cards.length);
					delete card.dataset.testOutcome;
					const settled = waitForProviderTestSettled(card);
					const cancelWait = new Promise((resolve) => { chatRunAll.abortWait = () => resolve('cancelled'); });
					const work = (async () => {
						try {
							await runProviderMediaTest(button);
							return await settled;
						} catch (error) {
							return 'failed';
						}
					})();
					const outcome = await Promise.race([work, cancelWait]);
					chatRunAll.abortWait = null;
					if (outcome === 'cancelled') {
						// Stop waiting, but leave the job running; the card keeps following it and says so.
						providerTestWaiters.delete(card);
						if (card.dataset.testRequestId) {
							card.dataset.testDetached = '1';
							updateProviderTestProgress();
							counts.cancelled += 1;
						} else if (card.dataset.testOutcome === 'passed' || card.dataset.testOutcome === 'noreply') {
							counts.passed += 1;
							if (card.dataset.testOutcome === 'noreply') counts.noReply += 1;
						} else {
							counts.failed += 1;
						}
					} else if (outcome === 'passed' || outcome === 'noreply') {
						counts.passed += 1;
						if (outcome === 'noreply') counts.noReply += 1;
					} else {
						counts.failed += 1;
					}
				}
			} finally {
				chatRunAll.running = false;
				chatRunAll.abortWait = null;
				updateChatRunAllState();
				renderChatRunAllSummary('done', chatRunAllSummaryText(counts, chatRunAll.cancelled), counts, 1);
				chatRunAll.cancelled = false;
				flushPendingProviderTestRender();
			}
		}

		// Stops Run all promptly: no further tests start and the test being awaited is no longer waited for.
		function cancelChatRunAll() {
			if (!chatRunAll.running) return;
			chatRunAll.cancelled = true;
			updateChatRunAllState();
			renderChatRunAllSummary('cancelling', 'Cancelling Run all. A test that is already running keeps going in Live.', chatRunAll.counts || null, chatRunAll.counts && chatRunAll.total ? (chatRunAll.counts.passed + chatRunAll.counts.failed + chatRunAll.counts.busy + chatRunAll.counts.cancelled) / chatRunAll.total : 0);
			if (typeof chatRunAll.abortWait === 'function') chatRunAll.abortWait();
		}

		function initProviderChatTests() {
			if (fields.runAllChatTests) fields.runAllChatTests.addEventListener('click', () => { runAllChatTests(); });
			if (fields.cancelAllChatTests) fields.cancelAllChatTests.addEventListener('click', cancelChatRunAll);
		}

		function chatReplyText(response) {
			const choice = response && Array.isArray(response.choices) && response.choices[0] || {};
			const content = choice.message && choice.message.content;
			if (Array.isArray(content)) return content.map((part) => part && typeof part === 'object' ? String(part.text || '') : String(part || '')).join('');
			return typeof content === 'string' ? content : '';
		}

		function chatElapsed(ms) {
			const value = Math.max(0, Number(ms || 0));
			return value < 10000 ? (value / 1000).toFixed(1) + 's' : elapsed(value);
		}

		function renderChatTestResult(card, job) {
			const result = card && card.querySelector('[data-test-result]');
			if (!result) return;
			const payload = card.chatTestPayload || null;
			const requestId = job ? jobRequestId(job) : '';
			if (!payload) {
				card.dataset.testOutcome = 'noreply';
				result.innerHTML = '<div class="provider-chat-result"><div class="provider-chat-warning" role="alert">Completed — reply not returned to this page; open in Live.</div>' +
					(requestId ? '<button type="button" data-open-live-job="' + escapeHtml(requestId) + '">Open job in Live</button>' : '') + '</div>';
				return;
			}
			const response = payload.response && typeof payload.response === 'object' ? payload.response : {};
			const choice = Array.isArray(response.choices) && response.choices[0] || {};
			const reply = chatReplyText(response);
			const limit = 4000;
			const elapsedMs = job && Number(job.elapsed_ms) ? Number(job.elapsed_ms) : Math.max(0, Date.now() - Number(card.dataset.testStartedAt || Date.now()));
			const meta = ['Model: ' + text(response.model, '-'), 'Elapsed: ' + chatElapsed(elapsedMs)];
			const usage = response.usage && typeof response.usage === 'object' ? response.usage : null;
			if (usage) {
				const count = (value) => value === undefined || value === null ? '-' : String(value);
				meta.push('Tokens (prompt / completion / total): ' + count(usage.prompt_tokens) + ' / ' + count(usage.completion_tokens) + ' / ' + count(usage.total_tokens));
			}
			if (choice.finish_reason) meta.push('Finish reason: ' + text(choice.finish_reason, ''));
			const details = response.provider_details && typeof response.provider_details === 'object' ? response.provider_details : {};
			Object.keys(details).filter((key) => key !== 'provider' && !/api_?key|secret|authorization|password/i.test(key) && ['string', 'number', 'boolean'].includes(typeof details[key]) && String(details[key]) !== '').slice(0, 8).forEach((key) => {
				meta.push(key + ': ' + String(details[key]).slice(0, 80));
			});
			const body = reply.trim()
				? '<div class="reply-toolbar"><span class="label">Reply</span><span class="muted reply-size">' + escapeHtml(reply.length + (reply.length === 1 ? ' character' : ' characters')) + '</span><span class="reply-toolbar-actions">' +
					'<button type="button" class="btn-sm" data-reply-wrap aria-pressed="true">Wrap</button>' +
					'<button type="button" class="btn-sm" data-reply-copy>Copy</button></span></div>' +
					'<pre class="provider-chat-reply" tabindex="0">' + escapeHtml(reply.slice(0, limit)) + '</pre>' + (reply.length > limit ? '<small class="muted">Reply truncated: showing ' + limit + ' of ' + reply.length + ' characters. Copy returns the full reply.</small>' : '')
				: '<div class="provider-chat-warning" role="alert">The provider returned an empty reply.</div>';
			card.dataset.testOutcome = reply.trim() ? 'passed' : 'failed';
			result.innerHTML = '<div class="provider-chat-result">' + body + '<small class="muted">' + meta.map(escapeHtml).join(' · ') + '</small></div>';
		}

		function renderChatTestFailure(card, error) {
			const result = card && card.querySelector('[data-test-result]');
			card.dataset.testOutcome = 'failed';
			if (!result) return;
			const parts = [];
			if (error && error.code) parts.push('Code: ' + error.code);
			if (error && error.httpStatus) parts.push('HTTP status: ' + error.httpStatus);
			result.innerHTML = '<div class="provider-chat-result"><div class="provider-chat-warning" role="alert">' + escapeHtml(error && error.message || 'Chat test failed.') + '</div>' +
				(parts.length ? '<small class="muted">' + escapeHtml(parts.join(' · ')) + '</small>' : '') + '</div>';
		}

		function fileAsDataUrl(file) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result || ''));
				reader.onerror = () => reject(new Error('The selected file could not be read.'));
				reader.readAsDataURL(file);
			});
		}

		function createProviderTestRequestId() {
			return 'status-test-ui-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
		}

		function providerTestJob(requestId) {
			const jobs = providerTestLastKnownJobs || {};
			return [...(Array.isArray(jobs.active) ? jobs.active : []), ...(Array.isArray(jobs.queued) ? jobs.queued : []), ...(Array.isArray(jobs.recent) ? jobs.recent : [])]
				.find((job) => String(job && job.request_id || '') === String(requestId || '')) || null;
		}

		function setProviderTestActivity(card, active, state) {
			const activity = card && card.querySelector('[data-test-progress-bar]');
			if (!activity) return;
			activity.hidden = !active;
			activity.setAttribute('aria-valuetext', state || (active ? 'Working' : 'Idle'));
		}

		function restoreProviderTestButton(card) {
			const button = card && card.querySelector('[data-provider-test]');
			if (!button) return;
			// The tests inside provider cards are independent of Run all (it only drives the Tests tab), so Run all never locks them.
			button.disabled = chatRunAll.running && card.dataset.testJobType === 'chat' && card.dataset.cardTest !== '1';
			button.textContent = card.dataset.testButtonLabel || button.textContent;
			delete card.dataset.testButtonLabel;
			updateChatRunAllState();
		}

		function chatTestOutcomeMessage(outcome) {
			if (outcome === 'passed') return 'Completed. The reply is shown below.';
			if (outcome === 'noreply') return 'Completed — reply not returned to this page; open in Live';
			return 'Completed, but the reply needs attention.';
		}

		function settleProviderTestCard(card, job) {
			const message = card && card.querySelector('[data-test-message]');
			const progress = card && card.querySelector('[data-test-progress]');
			const state = String(job && job.status || '').toLowerCase();
			if (!providerTestTerminal(state)) return false;
			const isChat = card.dataset.testJobType === 'chat';
			if (state === 'completed') {
				if (isChat && card.dataset.testAwaitingReply === '1') return false;
				card.dataset.testOutcome = 'passed';
				renderProviderTestResult(card, job);
				if (message) message.textContent = isChat ? chatTestOutcomeMessage(card.dataset.testOutcome) : 'Completed. Click the result to preview it.';
				if (progress) progress.textContent = 'Completed · ' + elapsed(Number(job.elapsed_ms || 0));
			} else {
				const label = state === 'cancelled' || state === 'canceled' ? 'Cancelled' : 'Failed';
				card.dataset.testOutcome = 'failed';
				if (message) message.textContent = String(job.error_message || (label === 'Cancelled' ? 'The provider test was cancelled.' : 'Provider test failed.'));
				if (progress) progress.textContent = label + ' · ' + elapsed(Number(job.elapsed_ms || 0));
			}
			setProviderTestActivity(card, false, state);
			delete card.dataset.testRequestId;
			delete card.dataset.testStartedAt;
			delete card.dataset.testContinuing;
			delete card.dataset.testDetached;
			card.providerTestMissing = null;
			card.providerTestFollowingSince = null;
			card.providerTestRefreshSeenAt = null;
			card.providerTestJobSeen = false;
			restoreProviderTestButton(card);
			providerTestSettled(card);
			return true;
		}

		// fresh: true marks a newly received status snapshot (the tracker keeps its jobs); fresh: false marks a failed
		// status refresh; no option is just the one-second ticker.
		function updateProviderTestProgress(options) {
			if (options && options.fresh === true) {
				providerTestStatusSerial += 1;
				providerTestLastKnownJobs = currentStatus && currentStatus.jobs || providerTestLastKnownJobs;
				providerTestLastFreshAt = Date.now();
				providerTestFeedStale = false;
				providerTestStaleSince = 0;
			} else if (options && options.fresh === false) {
				if (!providerTestFeedStale) providerTestStaleSince = Date.now();
				providerTestFeedStale = true;
			}
			let needsPoll = false;
			document.querySelectorAll('[data-provider-media-test][data-test-request-id]').forEach((card) => {
				const progress = card.querySelector('[data-test-progress]');
				const message = card.querySelector('[data-test-message]');
				if (!progress) return;
				const job = providerTestJob(card.dataset.testRequestId);
				const startedAt = Number(card.dataset.testStartedAt || Date.now());
				if (card.dataset.testContinuing === '1' && !(job && providerTestTerminal(String(job.status || '').toLowerCase()))) {
					// Following a job while the status feed is stale (refreshes keep failing) for two minutes: stop waiting. A healthy
					// feed with a silent running job (an API chat produces no session output) never times out.
					if (!card.providerTestFollowingSince) {
						card.providerTestFollowingSince = Date.now();
						providerTestLastPollAt = Math.max(providerTestLastPollAt, card.providerTestFollowingSince);
					}
					if (providerTestFeedStale && Date.now() - Math.max(providerTestStaleSince, card.providerTestFollowingSince) >= providerTestStatusTimeoutMs) {
						settleProviderTestCard(card, { status: 'failed', error_message: 'Status unknown — the Relay did not report status for 2 minutes; check Live.', elapsed_ms: Math.max(0, Date.now() - startedAt) });
						return;
					}
				}
				if (!job && card.dataset.testContinuing === '1') {
					// The job was tracked after the request connection dropped. If the Relay stops reporting it
					// (restart, eviction), stop waiting instead of leaving the card and Run all hanging. Only fresh,
					// successfully received snapshots with a jobs list count (an SSE jobs event is one too, not just a status
					// poll); the job must be absent from at least three of them. The 45 s floor since the first miss keeps a
					// burst of snapshots from evicting it early, because the Relay can create the job well after the request was
					// sent (provider probes run before the job is created). A job that was never seen at all is given up on
					// after 60 s of following instead (it may never have started).
					if (options && options.fresh === true && currentStatus && currentStatus.jobs) {
						card.providerTestMissing = card.providerTestMissing || { at: Date.now(), count: 0 };
						card.providerTestMissing.count += 1;
					}
					const missing = card.providerTestMissing;
					if (card.providerTestJobSeen && missing && missing.count >= providerTestMissingMinSnapshots && Date.now() - missing.at >= providerTestMissingMinMs) {
						settleProviderTestCard(card, { status: 'failed', error_message: 'Test job is no longer tracked by the Relay.', elapsed_ms: Math.max(0, Date.now() - startedAt) });
						return;
					}
					// While a provider detection refresh is active the Relay may still be probing before it creates the job, so the
					// 60 s clock does not run: it restarts from the moment the refresh is no longer active.
					if (currentStatus && currentStatus.refresh && currentStatus.refresh.active) card.providerTestRefreshSeenAt = Date.now();
					if (!card.providerTestJobSeen && !providerTestFeedStale && Date.now() - Math.max(card.providerTestFollowingSince || 0, card.providerTestRefreshSeenAt || 0) >= providerTestNotFoundMs) {
						settleProviderTestCard(card, { status: 'failed', error_message: 'Test job was not found on the Relay; it may not have started. Check Live.', elapsed_ms: Math.max(0, Date.now() - startedAt) });
						return;
					}
					// An idle Relay sends no snapshots; the one-second ticker asks for one (see below).
					needsPoll = true;
				}
				if (job) {
					card.providerTestMissing = null;
					card.providerTestJobSeen = true;
				}
				if (!job) {
					progress.textContent = 'Submitting · ' + elapsed(Math.max(0, Date.now() - startedAt));
					if (message) message.textContent = providerTestFeedStale ? 'Relay unreachable — waiting for status…' : (card.dataset.testContinuing === '1' ? 'Connection lost — following the job in Live…' : 'Submitting provider test. This card will follow the matching Live job.');
					setProviderTestActivity(card, true, 'Submitting');
					return;
				}
				const duration = Number(job.elapsed_ms || Math.max(0, Date.now() - startedAt));
				const state = String(job.status || 'running').toLowerCase();
				if (settleProviderTestCard(card, job)) return;
				if (providerTestFeedStale) {
					// The job state comes from an older snapshot: do not present it as running.
					progress.textContent = 'Waiting for status · ' + elapsed(Math.max(0, Date.now() - startedAt));
					if (message) message.textContent = card.dataset.testDetached === '1' ? 'Run all was cancelled. Relay unreachable — waiting for status…' : 'Relay unreachable — waiting for status…';
					setProviderTestActivity(card, true, 'Waiting for status');
					return;
				}
				const detail = String(job.session_output || '').trim().replace(/\s+/g, ' ').slice(-180);
				progress.textContent = (state === 'queued' ? 'Queued' : (state === 'running' ? 'Running' : state)) + ' · ' + elapsed(duration) + (detail ? ' · ' + detail : '');
				if (message) message.textContent = card.dataset.testDetached === '1' ? 'Run all was cancelled. Still running in Live.' : (state === 'queued' ? 'Queued' : 'Running') + '. This card is following the matching Live job.';
				if (detail) progress.title = String(job.session_output).slice(-500);
				setProviderTestActivity(card, state === 'queued' || state === 'running' || state === 'cancelling', state);
			});
			// While a followed job is absent from the snapshots, ask for a status at most every 5 s (one request in flight);
			// SSE only emits on changes, so an idle Relay would otherwise never tell the card anything. Only the ticker polls.
			if (needsPoll && !options && !providerTestPollInFlight && Date.now() - providerTestLastPollAt >= providerTestPollMs) {
				providerTestPollInFlight = true;
				providerTestLastPollAt = Date.now();
				Promise.resolve().then(() => refresh({ silent: true, timer: true })).catch(() => {}).then(() => { providerTestPollInFlight = false; });
			}
		}

		function renderProviderTestResult(card, job) {
			const result = card && card.querySelector('[data-test-result]');
			if (!result) return;
			if (card.dataset.testJobType === 'chat') {
				renderChatTestResult(card, job);
				return;
			}
			const artifacts = Array.isArray(job && job.artifacts) ? job.artifacts : [];
			const artifact = artifacts.find((entry) => entry && /^\/(?:v1)\/status\/jobs\/\d+\/artifacts\/\d+$/.test(String(entry.url || '')) && /^(image|video)\//.test(String(entry.mime_type || '')));
			if (!artifact) {
				const requestId = jobRequestId(job);
				result.innerHTML = requestId
					? '<button type="button" data-open-live-job="' + escapeHtml(requestId) + '">Open completed result in Live</button>'
					: '<button type="button" data-open-live>Open completed result in Live</button>';
				return;
			}
			const url = escapeHtml(artifact.url);
			const mimeType = String(artifact.mime_type || '');
			const isVideo = /^video\//.test(mimeType);
			const label = isVideo ? 'Open generated video' : 'Open generated image';
			const media = isVideo
				? '<video src="' + url + '" muted preload="metadata" playsinline></video>'
				: '<img src="' + url + '" alt="Generated image preview" loading="lazy">';
			const requestId = jobRequestId(job);
			const actions = '<div class="provider-test-artifact-actions"><a class="btn btn-sm" href="' + url + '" download>Download</a>' +
				(requestId ? '<button type="button" class="btn-sm" data-open-live-job="' + escapeHtml(requestId) + '">Open in Live</button>' : '') + '</div>';
			result.innerHTML = '<div class="provider-test-artifact-card"><button type="button" class="provider-test-artifact" data-media-preview="' + url + '" data-media-mime="' + escapeHtml(mimeType) + '" title="' + escapeHtml(label) + '">' + media + '<span>' + escapeHtml(label) + '</span></button>' + actions + '</div>';
		}

		async function runProviderMediaTest(button) {
			const card = button.closest('[data-provider-media-test]');
			const message = card && card.querySelector('[data-test-message]');
			const progress = card && card.querySelector('[data-test-progress]');
			const result = card && card.querySelector('[data-test-result]');
			const jobType = button.dataset.providerTest;
			const prompt = card && card.querySelector('[data-test-prompt]');
			const reference = card && card.querySelector('[data-test-reference]');
			const media = card && card.querySelector('[data-test-media]');
			const audio = card && card.querySelector('[data-test-audio]');
			const original = button.textContent;
			const requestId = createProviderTestRequestId();
			let completed = false;
			let continuingTrackedJob = false;
			let droppedConnection = false;
			let requestSent = false;
			try {
				button.disabled = true;
				button.textContent = 'Running...';
				card.dataset.testButtonLabel = original;
				card.dataset.testRequestId = requestId;
				card.dataset.testStartedAt = String(Date.now());
				updateChatRunAllState();
				delete card.dataset.testOutcome;
				delete card.dataset.testDetached;
				delete card.dataset.testContinuing;
				card.providerTestMissing = null;
				card.providerTestFollowingSince = null;
				card.providerTestRefreshSeenAt = null;
				card.providerTestJobSeen = false;
				card.chatTestPayload = null;
				if (jobType === 'chat') card.dataset.testAwaitingReply = '1';
				if (result) result.innerHTML = '';
				if (message) message.textContent = 'Starting provider test.';
				updateProviderTestProgress();
				if (jobType !== 'chat' && selectRoute('live')) {
					selectLiveJob(requestId, { skipHash: false });
				}
				const body = { job_type: jobType, model: button.dataset.model || '', prompt: prompt ? prompt.value.trim() : '', test_request_id: requestId };
				Array.from(card.querySelectorAll('[data-test-option]')).forEach((field) => {
					const key = String(field.dataset.testOption || '').trim();
					if (!key || !field.value) return;
					if (key === 'model') body.model = field.value;
					else body[key] = field.value;
				});
				if (jobType === 'chat') {
					const system = card.querySelector('[data-chat-system]');
					const maxTokens = card.querySelector('[data-chat-max-tokens]');
					const image = card.querySelector('[data-chat-image]');
					if (!body.prompt) throw new Error('Enter a test prompt before running a chat test.');
					if (system && system.value.trim()) body.system = system.value.trim();
					if (maxTokens && maxTokens.value.trim()) body.max_tokens = Number(maxTokens.value);
					const imageFile = image && image.files && image.files[0];
					if (imageFile && imageFile.size > 5 * 1024 * 1024) throw new Error('Image is larger than 5 MB.');
					if (imageFile) body.image_data_url = await fileAsDataUrl(imageFile);
				}
				const file = reference && reference.files && reference.files[0];
				if (file) body.input_reference_data_url = await fileAsDataUrl(file);
				const mediaFile = media && media.files && media.files[0];
				if (jobType === 'media.analyze' && !mediaFile) throw new Error('Choose a small video file before running this test.');
				if (mediaFile) body.media_data_url = await fileAsDataUrl(mediaFile);
				const audioFile = audio && audio.files && audio.files[0];
				if ((jobType === 'transcribe' || jobType === 'music.analyze') && !audioFile) throw new Error('Choose an audio file before running this test.');
				if (audioFile) {
					const dataUrl = await fileAsDataUrl(audioFile);
					const match = /^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
					if (!match) throw new Error('The selected audio file is not a supported base64 upload.');
					body.audio_base64 = match[2].replace(/\s+/g, '');
					body.audio_format = audioFile.type || (audioFile.name.split('.').pop() || '');
				}
				requestSent = true;
				const response = await fetch(relayTestUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				const payload = await response.json().catch(() => ({}));
				if (!response.ok || !payload.success) {
					const failure = new Error(payload.error_message || payload.message || 'Provider test failed.');
					failure.code = payload.code || '';
					failure.httpStatus = response.status;
					throw failure;
				}
				if (jobType === 'chat') card.chatTestPayload = payload;
				completed = true;
			} catch (error) {
				await refresh().catch(() => {});
				const job = providerTestJob(requestId);
				const state = String(job && job.status || '').toLowerCase();
				if (job && !error.httpStatus && providerTestTerminal(state)) {
					// The connection dropped but the job finished anyway: the finally block settles the card from the job record.
					droppedConnection = true;
				} else if (job && !providerTestTerminal(state)) {
					continuingTrackedJob = true;
					card.dataset.testContinuing = '1';
					if (message) message.textContent = 'The test request connection ended, but the provider job is still ' + state + '. Continuing to follow it here.';
					updateProviderTestProgress();
				} else if (requestSent && !error.httpStatus && !providerTestFeedStale) {
					// Network-level failure (no HTTP response), job state unknown: the job may still be running on the Relay.
					// Keep following it; the progress tracker settles the card from the job status.
					// (If the status refresh above failed too and no job with this request id is known, the Relay is unreachable: fail below.)
					continuingTrackedJob = true;
					card.dataset.testContinuing = '1';
					if (message) message.textContent = 'Connection lost — following the job in Live…';
					updateProviderTestProgress();
				} else {
					const unreachable = requestSent && !error.httpStatus;
					if (unreachable) error = new Error('Relay unreachable — the test could not be confirmed. Check that AI Model Relay is running.');
					if (message) message.textContent = error.message || 'Provider test failed.';
					if (progress) progress.textContent = 'Failed · ' + elapsed(Math.max(0, Date.now() - Number(card.dataset.testStartedAt || Date.now())));
					setProviderTestActivity(card, false, 'Failed');
					if (jobType === 'chat') renderChatTestFailure(card, error);
					// Stop the progress tracker from replacing this report ("Submitting provider test…") while the finally block refreshes
					// the status again: no job was created, so there is nothing left to follow.
					delete card.dataset.testRequestId;
					delete card.dataset.testContinuing;
				}
			} finally {
				delete card.dataset.testAwaitingReply;
				await refresh().catch(() => {});
				const job = providerTestJob(requestId);
				const state = String(job && job.status || '').toLowerCase();
				const jobTerminal = !!job && providerTestTerminal(state);
				if (!completed && !jobTerminal && (continuingTrackedJob || job)) {
					// Keep following the job (known non-terminal, or lost after a network failure); updateProviderTestProgress
					// settles the card when it ends or is no longer tracked.
					if (card.dataset.testContinuing !== '1') {
						// The catch had already reported a failure, but the job turned out to be live: undo that report.
						card.dataset.testContinuing = '1';
						card.dataset.testRequestId = requestId;
						delete card.dataset.testOutcome;
						if (result) result.innerHTML = '';
						if (message) message.textContent = 'Connection lost — following the job in Live…';
						updateProviderTestProgress();
					}
					return;
				}
				if (completed && jobType === 'chat') {
					card.dataset.testOutcome = 'passed';
					renderChatTestResult(card, job);
					const startedAt = Number(card.dataset.testStartedAt || Date.now());
					if (message) message.textContent = chatTestOutcomeMessage(card.dataset.testOutcome);
					if (progress) progress.textContent = 'Completed · ' + elapsed(job && Number(job.elapsed_ms) ? Number(job.elapsed_ms) : Math.max(0, Date.now() - startedAt));
				} else if (completed && job) {
					settleProviderTestCard(card, job);
				} else if (!completed && jobTerminal && (droppedConnection || continuingTrackedJob) && card.dataset.testRequestId) {
					settleProviderTestCard(card, job);
				} else if (completed && message) {
					message.textContent = 'Completed. Open Live to inspect the result.';
					if (progress) progress.textContent = 'Completed';
				}
				delete card.dataset.testRequestId;
				delete card.dataset.testStartedAt;
				delete card.dataset.testContinuing;
				delete card.dataset.testDetached;
				setProviderTestActivity(card, false, completed || (jobTerminal && state === 'completed') ? 'Completed' : 'Failed');
				restoreProviderTestButton(card);
				providerTestSettled(card);
			}
		}

		async function loadPairingSettings() {
			try {
				const response = await fetch(pairingCodeSettingsUrl, { cache: 'no-store' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Pairing settings unavailable');
				fields.persistentPairingCodeInput.value = '';
				fields.pairingCodeStatus.textContent = payload.persistent ? 'A fixed pairing code is active.' : 'Relay is using a rotating code.';
				fields.saveFixedPairingCode.disabled = payload.persistence_available !== true;
				fields.disableFixedPairingCode.disabled = payload.persistent !== true;
				fields.pairingCodeMessage.textContent = payload.persistence_available
					? 'The code is never returned to this page after saving.'
					: 'Fixed-code storage requires the AI Model Relay desktop app and available OS secure storage.';
			} catch (error) {
				fields.pairingCodeStatus.textContent = error.message || 'Pairing settings unavailable';
				fields.saveFixedPairingCode.disabled = true;
				fields.disableFixedPairingCode.disabled = true;
			}
		}

		async function saveFixedPairingCode() {
			const pairingCode = String(fields.persistentPairingCodeInput.value || '');
			if (!/^[0-9]{6}$/.test(pairingCode)) {
				fields.pairingCodeMessage.textContent = 'Enter exactly six digits.';
				return;
			}
			fields.saveFixedPairingCode.disabled = true;
			fields.pairingCodeMessage.textContent = 'Saving encrypted pairing code…';
			try {
				const response = await fetch(pairingCodeSettingsUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ pairing_code: pairingCode }),
					cache: 'no-store',
				});
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Pairing code save failed');
				fields.persistentPairingCodeInput.value = '';
				await loadPairingSettings();
				fields.pairingCodeMessage.textContent = 'Fixed pairing code saved securely on this device.';
			} catch (error) {
				fields.pairingCodeMessage.textContent = error.message || 'Pairing code save failed';
				fields.saveFixedPairingCode.disabled = false;
			}
		}

		async function disableFixedPairingCode() {
			fields.disableFixedPairingCode.disabled = true;
			fields.pairingCodeMessage.textContent = 'Switching back to rotating codes…';
			try {
				const response = await fetch(pairingCodeSettingsUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ enabled: false }),
					cache: 'no-store',
				});
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Fixed pairing code could not be disabled');
				await loadPairingSettings();
				fields.pairingCodeMessage.textContent = 'Relay will use a new rotating pairing code.';
			} catch (error) {
				fields.pairingCodeMessage.textContent = error.message || 'Fixed pairing code could not be disabled';
				fields.disableFixedPairingCode.disabled = false;
			}
		}

		// Focus survives a re-render of the provider forms: the focused field is found again by its id, or by the data attribute
		// that identifies it (CLI path, token default, timeout, routing job, field key), and the caret of text inputs is put back.
		function relayFocusAttributes() {
			return ['data-relay-cli-path', 'data-relay-token-default', 'data-relay-timeout', 'data-relay-job', 'data-field-key'];
		}

		function relayFocusContainers() {
			return [fields.providerSettings, fields.relayDefaultSettings, fields.relayTokenDefaults, fields.relayRuntimeSettings].filter((container) => container && typeof container.querySelectorAll === 'function');
		}

		function captureRelayFocus() {
			const active = document.activeElement;
			if (!active || typeof active.getAttribute !== 'function') return null;
			if (!relayFocusContainers().some((container) => typeof container.contains === 'function' && container.contains(active))) return null;
			const focus = { id: active.id || '', attribute: '', value: '', start: null, end: null, direction: 'none' };
			if (!focus.id) {
				for (const attribute of relayFocusAttributes()) {
					const value = active.getAttribute(attribute);
					if (value) {
						focus.attribute = attribute;
						focus.value = value;
						break;
					}
				}
				if (!focus.attribute) return null;
			}
			try {
				if (typeof active.selectionStart === 'number' && typeof active.selectionEnd === 'number') {
					focus.start = active.selectionStart;
					focus.end = active.selectionEnd;
					focus.direction = active.selectionDirection || 'none';
				}
			} catch (error) {
				// Number and checkbox inputs have no caret.
			}
			return focus;
		}

		function restoreRelayFocus(focus) {
			if (!focus) return false;
			let again = null;
			if (focus.id) {
				again = document.getElementById(focus.id);
			} else {
				for (const container of relayFocusContainers()) {
					again = Array.from(container.querySelectorAll('[' + focus.attribute + ']')).find((element) => element.getAttribute(focus.attribute) === focus.value) || null;
					if (again) break;
				}
			}
			if (!again || typeof again.focus !== 'function') return false;
			again.focus({ preventScroll: true });
			if (focus.start !== null && typeof again.setSelectionRange === 'function') {
				try {
					again.setSelectionRange(focus.start, focus.end, focus.direction);
				} catch (error) {
					// The field no longer supports a caret (for example it became a number input).
				}
			}
			return true;
		}

		// fetch + JSON body with a time limit. The request is aborted when the limit passes, and the call rejects even if the
		// transport ignores the abort, so callers can always release their busy state.
		function fetchJsonWithTimeout(url, init, timeoutMs, label) {
			const controller = typeof AbortController === 'function' ? new AbortController() : null;
			let timer = null;
			const timeout = new Promise((resolve, reject) => {
				timer = setTimeout(() => {
					if (controller) {
						try { controller.abort(); } catch (error) {}
					}
					const error = new Error(label + ' timed out after ' + Math.round(timeoutMs / 1000) + ' s');
					error.timedOut = true;
					reject(error);
				}, timeoutMs);
			});
			const work = (async () => {
				const options = controller ? Object.assign({}, init, { signal: controller.signal }) : init;
				const response = await fetch(url, options);
				const payload = await response.json();
				return { response, payload };
			})();
			work.catch(() => {});
			return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
		}

		function cancelRelaySettingsRetry() {
			clearTimeout(relaySettingsRetryTimer);
			relaySettingsRetryTimer = null;
			relaySettingsRetryDelay = relaySettingsRetryMs;
		}

		function scheduleRelaySettingsRetry() {
			if (providerFormRendered || relaySettingsRetryTimer) return;
			const delay = relaySettingsRetryDelay;
			relaySettingsRetryDelay = Math.min(relaySettingsRetryMaxMs, relaySettingsRetryDelay * 2);
			relaySettingsRetryTimer = setTimeout(() => {
				relaySettingsRetryTimer = null;
				if (!providerFormRendered) loadRelaySettings();
			}, delay);
		}

		async function loadRelaySettings(options) {
			// One request at a time; a reload asked for meanwhile (capabilities event, Reload button) runs right after it.
			if (relaySettingsLoading) {
				relaySettingsReloadQueued = true;
				const queued = relaySettingsQueuedOptions || {};
				relaySettingsQueuedOptions = { manual: !!(queued.manual || (options && options.manual)), keepMessage: !!(queued.keepMessage || (options && options.keepMessage)) };
				return;
			}
			relaySettingsLoading = true;
			relaySettingsLastAttemptAt = Date.now();
			// A manual reload tries now: the pending automatic retry (if any) is replaced by this attempt.
			if (options && options.manual) cancelRelaySettingsRetry();
			const startedGeneration = relaySettingsSaveGeneration;
			const busy = () => !!fields.refreshRelayProviders.disabled;
			try {
				if (options && options.manual && !busy()) fields.relaySettingsMessage.textContent = 'Reloading routing settings…';
				const { response, payload } = await fetchJsonWithTimeout(relaySettingsUrl, { cache: 'no-store' }, settingsLoadTimeoutMs, 'Loading routing settings');
				if (!response.ok) throw new Error(payload.message || ('Routing settings unavailable' + (response.status ? ' (HTTP ' + response.status + ')' : '')));
				if (startedGeneration !== relaySettingsSaveGeneration) {
					// A save finished while this request was in flight, so the answer may predate it: never show it as the clean
					// baseline. Ask again instead.
					relaySettingsReloadQueued = true;
					const queued = relaySettingsQueuedOptions || {};
					relaySettingsQueuedOptions = { manual: !!(queued.manual || (options && options.manual)), keepMessage: !!(queued.keepMessage || (options && options.keepMessage)) };
					return;
				}
				// A background reload (capabilities event, detection refresh) must not wipe edits the user has not saved yet: remember
				// which fields were edited, render the new settings, then put back only those fields.
				const edits = { relay: relayFormEdits('relay'), runtime: relayFormEdits('runtime') };
				const focus = captureRelayFocus();
				renderRelaySettings(payload);
				captureFormSnapshots(['relay', 'runtime']);
				reapplyRelayEdits(edits);
				updateSettingsDirtyState();
				restoreRelayFocus(focus);
				cancelRelaySettingsRetry();
				// After a detection run the message keeps saying that detection was refreshed.
				if (!busy() && !(options && options.keepMessage && !options.manual)) fields.relaySettingsMessage.textContent = 'Routing settings loaded';
			} catch (error) {
				const reason = (error && error.message) || 'unknown error';
				if (!providerFormRendered) {
					// Nothing was ever loaded: say why in the form area itself (it would otherwise read "Loading providers" forever).
					if (fields.providerSettings) fields.providerSettings.innerHTML = '<div class="empty-state" role="alert">Provider settings could not be loaded: ' + escapeHtml(reason) + '. The page retries automatically; use Reload to try now.</div>';
					fields.relaySettingsMessage.textContent = 'Routing settings load failed: ' + reason;
					scheduleRelaySettingsRetry();
				} else if (!busy()) {
					fields.relaySettingsMessage.textContent = reason === 'unknown error' ? 'Routing settings load failed' : reason;
				}
			} finally {
				relaySettingsLoading = false;
				if (relaySettingsReloadQueued) {
					relaySettingsReloadQueued = false;
					const queued = relaySettingsQueuedOptions;
					relaySettingsQueuedOptions = null;
					loadRelaySettings(queued || undefined);
				}
			}
		}

		// Polling-only mode never gets a capabilities event, so a failed first load is also retried from the status poll,
		// throttled. The load's own retry timer normally covers it; this only fills in when no timer is pending.
		function retryRelaySettingsLoad() {
			if (!settingsLoaded || providerFormRendered || relaySettingsLoading || relaySettingsRetryTimer) return;
			if (Date.now() - relaySettingsLastAttemptAt < relaySettingsRetryMs) return;
			loadRelaySettings();
		}

		// Discard: put the section back to the last settings the Relay returned. The other section's edits stay as they are.
		function discardRelaySection(section) {
			const payload = lastRelaySettingsPayload;
			if (!payload) return false;
			const otherSection = section === 'runtime' ? 'relay' : 'runtime';
			let preserved = null;
			try { preserved = collectRelaySettingsPayload(otherSection); } catch (error) {}
			renderRelaySettings(payload);
			restoreRelaySection(otherSection, preserved);
			captureFormSnapshots([section]);
			const message = section === 'runtime' ? fields.relayRuntimeMessage : fields.relaySettingsMessage;
			if (message) message.textContent = 'Changes discarded';
			return true;
		}

		function followProviderRefresh(refreshState) {
			if (!refreshState || !refreshState.active) return false;
			fields.refreshRelayProviders.disabled = true;
			fields.refreshRelayProviders.textContent = 'Checking…';
			fields.refreshRelayProviders.dataset.refreshId = String(refreshState.id || '');
			fields.relaySettingsMessage.textContent = 'CLI paths saved; checking providers in background…';
			clearInterval(providerRefreshPollTimer);
			providerRefreshPollTimer = setInterval(pollProviderRefresh, 1000);
			pollProviderRefresh();
			return true;
		}

		function formatUsd(value) {
			const n = Number(value);
			if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return '—';
			return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);
		}

		function formatLocalDateTime(value) {
			const d = new Date(value);
			return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
		}

		function formatLocalDate(value) {
			const d = new Date(value);
			return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
		}

		function formatRelativeTime(value) {
			const t = new Date(value).getTime();
			if (Number.isNaN(t)) return '';
			const seconds = Math.max(0, Math.round((Date.now() - t) / 1000));
			if (seconds < 60) return seconds + 's ago';
			if (seconds < 3600) return Math.round(seconds / 60) + 'm ago';
			if (seconds < 86400) return Math.round(seconds / 3600) + 'h ago';
			return formatLocalDateTime(value);
		}

		function claudeNum(value) {
			return value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
		}

		function renderClaudeUsage(data) {
			const panel = document.getElementById('claudeUsagePanel');
			if (!panel) return;
			const configured = data.configured || {};
			if (!configured.api_key && !configured.admin_api_key) {
				panel.innerHTML = '<div class="claude-usage-head"><div class="label">Claude API usage</div><span class="muted">Claude API not configured — add a key under Providers.</span><button type="button" data-nav-hash="providers/anthropic-api">Open Providers</button></div>';
				return;
			}
			const month = data.month || {};
			const credits = data.credits || {};
			const costReport = data.cost_report || {};
			const rate = data.rate_limits || null;
			const dashboardUrl = data.dashboard_url || 'https://platform.claude.com/dashboard';
			const spend = claudeNum(month.spend_usd);
			const limit = claudeNum(month.limit_usd);
			const monthRemaining = claudeNum(month.remaining_usd);
			const creditBalance = claudeNum(credits.balance_usd);
			const creditRemaining = claudeNum(credits.remaining_usd);
			const creditSpent = claudeNum(credits.spent_since_usd);
			const creditClass = creditRemaining !== null && creditRemaining < 0 ? ' claude-usage-negative' : '';
			const creditSub = creditBalance === null
				? 'Enter your dashboard credit balance in Providers'
				: (creditRemaining === null
					? 'Saved balance ' + formatUsd(creditBalance) + (credits.as_of && formatLocalDate(credits.as_of) ? ' on ' + formatLocalDate(credits.as_of) : '') + '; spend since then unavailable' + (credits.reason || costReport.reason ? ' — ' + (credits.reason || costReport.reason) : '')
					: 'From ' + formatUsd(creditBalance) + ' saved' + (credits.as_of ? ' ' + formatLocalDate(credits.as_of) : '') + ' minus ' + formatUsd(creditSpent === null ? 0 : creditSpent) + ' spent since');
			const monthParts = [];
			if (limit !== null) monthParts.push('of ' + formatUsd(limit) + ' limit');
			if (monthRemaining !== null) monthParts.push(formatUsd(monthRemaining) + ' left');
			if (month.resets_at && formatLocalDate(month.resets_at)) monthParts.push('resets ' + formatLocalDate(month.resets_at));
			let monthSub = monthParts.join(' · ');
			if (spend === null && costReport.reason) monthSub = costReport.reason;
			let bar = '';
			if (spend !== null && limit !== null && limit > 0) {
				const pct = Math.max(0, Math.min(100, (spend / limit) * 100));
				bar = '<div class="claude-usage-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + escapeHtml(String(Math.round(pct))) + '"><span class="' + (pct >= 90 ? 'claude-usage-bar-high' : '') + '" style="width:' + pct.toFixed(1) + '%"></span></div>';
			}
			const rateLines = [];
			if (rate) {
				const pair = (label, remaining, max) => {
					const r = claudeNum(remaining);
					const m = claudeNum(max);
					if (r === null && m === null) return;
					rateLines.push(escapeHtml(label) + ': ' + escapeHtml(r === null ? '—' : r.toLocaleString()) + (m === null ? '' : ' / ' + escapeHtml(m.toLocaleString())));
				};
				pair('Requests', rate.requests_remaining, rate.requests_limit);
				pair('Tokens', rate.tokens_remaining, rate.tokens_limit);
				pair('Input tokens', rate.input_tokens_remaining, rate.input_tokens_limit);
				pair('Output tokens', rate.output_tokens_remaining, rate.output_tokens_limit);
			}
			let rateHtml;
			if (rateLines.length) {
				rateHtml = '<div class="claude-usage-lines">' + rateLines.map((line) => '<div>' + line + '</div>').join('') + '</div>' + (rate.observed_at ? '<div class="health-hint">observed ' + escapeHtml(formatRelativeTime(rate.observed_at) || formatLocalDateTime(rate.observed_at)) + '</div>' : '');
			} else {
				rateHtml = '<div class="health-value">No Claude request yet</div>';
			}
			const notes = [];
			if (costReport.note) notes.push(escapeHtml(costReport.note));
			notes.push('Anthropic does not publish the credit balance through its API; the credit figure is an estimate: saved balance minus Cost API spend from the start of the UTC day you saved it (daily granularity, about 5 minutes of lag, excludes Priority Tier).');
			panel.innerHTML = [
				'<div class="claude-usage-head"><div class="label">Claude API usage</div>',
				'<a class="muted" href="' + escapeHtml(dashboardUrl) + '" target="_blank" rel="noopener">Open dashboard</a>',
				'<button type="button" data-claude-usage-refresh>Refresh</button></div>',
				'<div class="claude-usage-grid">',
				'<div class="claude-usage-card"><span class="health-title">Organization credits (estimated)</span><span class="health-value' + creditClass + '">' + escapeHtml(creditRemaining !== null ? formatUsd(creditRemaining) : '—') + '</span><span class="health-hint">' + escapeHtml(creditSub) + '</span></div>',
				'<div class="claude-usage-card"><span class="health-title">Spend this month</span><span class="health-value">' + escapeHtml(spend === null ? '—' : formatUsd(spend)) + '</span>' + bar + (monthSub ? '<span class="health-hint">' + escapeHtml(monthSub) + '</span>' : '') + '</div>',
				'<div class="claude-usage-card"><span class="health-title">Rate limits (last request)</span>' + rateHtml + '</div>',
				'</div>',
				'<div class="health-hint claude-usage-note">' + notes.join('<br>') + '</div>',
			].join('');
		}

		let claudeUsageSequence = 0;
		async function loadClaudeUsage({ force } = {}) {
			const panel = document.getElementById('claudeUsagePanel');
			if (!panel) return;
			const sequence = ++claudeUsageSequence;
			try {
				const response = await fetch(claudeUsageUrl + (force ? '?refresh=1' : ''), { cache: 'no-store' });
				const payload = await response.json();
				if (sequence !== claudeUsageSequence) return;
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Claude usage unavailable');
				renderClaudeUsage(payload);
				lastClaudeUsage = payload;
				renderClaudeCardUsage();
			} catch (error) {
				if (sequence !== claudeUsageSequence) return;
				panel.innerHTML = '<div class="claude-usage-head"><div class="label">Claude API usage</div><button type="button" data-claude-usage-refresh>Refresh</button></div><div class="muted">' + escapeHtml((error && error.message) || 'Claude usage unavailable') + '</div>';
			}
		}

		async function saveRelaySettings(options = {}) {
			const section = options.section || 'relay';
			if (!providerFormRendered) {
				// The form is still empty; posting it would erase the stored executable paths and routing defaults.
				const message = 'Provider settings are not loaded yet.';
				if (!options.quiet) {
					if (section === 'runtime') {
						if (fields.relayRuntimeMessage) fields.relayRuntimeMessage.textContent = message;
					} else {
						fields.relaySettingsMessage.textContent = message;
					}
				}
				return { success: false, message };
			}
			// cliPathsOnly: post just the executable paths (the Relay keeps every other section as stored) and leave the
			// rest of the form - typed API keys, routing, timeouts - unsaved and dirty.
			const cliPathsOnly = options.cliPathsOnly === true && section === 'relay';
			const settings = cliPathsOnly ? { cli_paths: collectRelaySettingsPayload(section).cli_paths } : collectRelaySettingsPayload(section);
			const validation = cliPathsOnly ? { errors: {}, warnings: {}, first: null } : validateRelaySection(section);
			const failedKeys = Object.keys(validation.errors);
			if (failedKeys.length) {
				const message = validation.errors[failedKeys[0]];
				if (validation.first) {
					const owner = validation.first.closest ? validation.first.closest('[data-provider-id]') : null;
					if (owner) setProviderCardOpen(owner, true);
					if (!options.quiet && typeof validation.first.focus === 'function') validation.first.focus();
				}
				if (!options.quiet) {
					setSaveBarText(section, message);
					if (section === 'runtime') {
						if (fields.relayRuntimeMessage) fields.relayRuntimeMessage.textContent = message;
					} else {
						fields.relaySettingsMessage.textContent = message;
					}
				}
				return { success: false, message };
			}
			const otherSection = section === 'runtime' ? 'relay' : 'runtime';
			try {
				const { response, payload } = await fetchJsonWithTimeout(relaySettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) }, settingsPostTimeoutMs, 'Saving routing settings');
				if (!response.ok) throw new Error(payload.message || 'Routing settings save failed');
				// Any settings GET still in flight started before this save and may carry the old values.
				relaySettingsSaveGeneration += 1;
				// Fields typed while the request was in flight differ from what was sent; the other section's edits differ from its
				// baseline. Both are put back on top of the saved settings, which become the new baseline.
				const edits = {};
				try {
					if (cliPathsOnly) {
						// What the form held before, with the saved paths: everything else still differing is an unsaved edit.
						const baseline = Object.assign({}, JSON.parse(formSnapshots.relay), { cli_paths: settings.cli_paths });
						edits[section] = collectFormEdits(JSON.stringify(baseline), collectRelaySettingsPayload(section));
					} else {
						edits[section] = collectFormEdits(JSON.stringify(settings), collectRelaySettingsPayload(section));
					}
				} catch (error) { edits[section] = []; }
				edits[otherSection] = relayFormEdits(otherSection);
				const focus = captureRelayFocus();
				renderRelaySettings(payload);
				captureFormSnapshots(['relay', 'runtime']);
				reapplyRelayEdits(edits);
				restoreRelayFocus(focus);
				const refreshStarted = payload.refresh_started === true && followProviderRefresh(payload.refresh);
				if (!options.quiet && !refreshStarted) {
					if (section === 'runtime') {
						if (fields.relayRuntimeMessage) fields.relayRuntimeMessage.textContent = 'Runtime settings saved';
					} else {
						fields.relaySettingsMessage.textContent = 'CLI paths, APIs, and routing saved';
					}
				}
				loadClaudeUsage({ force: true });
				return { success: true, payload, refreshStarted };
			} catch (error) {
				const message = error.message || 'Routing settings save failed';
				if (!options.quiet) {
					setSaveBarText(section, message);
					fields.relaySettingsMessage.textContent = message;
					if (fields.relayRuntimeMessage) fields.relayRuntimeMessage.textContent = message;
				}
				return { success: false, message };
			}
		}

		function renderMusicAnalysisSettings(settings) {
			currentMusicAnalysisSettings = settings || {};
			fields.musicAnalysisSettings.innerHTML = [
				'<label class="field"><span>Python path</span><input id="musicAnalysisPythonPath" value="' + escapeHtml(currentMusicAnalysisSettings.python_path || '') + '" placeholder="Auto-detect Python 3.10+"></label>',
				'<label class="field"><span>Virtual environment path</span><input id="musicAnalysisVenvPath" value="' + escapeHtml(currentMusicAnalysisSettings.venv_path || '') + '"></label>',
				'<label class="field"><span>Analysis sample rate</span><input id="musicAnalysisSampleRate" type="number" min="8000" max="96000" value="' + escapeHtml(currentMusicAnalysisSettings.sample_rate || 22050) + '"></label>',
				'<label class="field"><span>Maximum sections</span><input id="musicAnalysisMaxSections" type="number" min="2" max="24" value="' + escapeHtml(currentMusicAnalysisSettings.max_sections || 12) + '"></label>',
				'<label class="field"><span>Analysis timeout (ms)</span><input id="musicAnalysisTimeout" type="number" min="1000" step="1000" inputmode="numeric" value="' + escapeHtml(currentMusicAnalysisSettings.timeout_ms || 1800000) + '" placeholder="1800000"><small class="muted">Leave the field at the loaded value unless you need a longer analysis job.</small></label>',
			].join('');
		}

		function serializeMusicAnalysisSettings() {
			return {
				python_path: document.getElementById('musicAnalysisPythonPath').value.trim(),
				venv_path: document.getElementById('musicAnalysisVenvPath').value.trim(),
				sample_rate: numberValue(document.getElementById('musicAnalysisSampleRate').value, 22050),
				max_sections: numberValue(document.getElementById('musicAnalysisMaxSections').value, 12),
				timeout_ms: numberValue((document.getElementById('musicAnalysisTimeout') || {}).value, currentMusicAnalysisSettings.timeout_ms || 1800000),
			};
		}

		async function loadMusicAnalysisSettings(options = {}) {
			const refreshRuntime = !!options.refreshRuntime;
			const discardEdits = options.discardEdits === true;
			fields.musicAnalysisSettingsMessage.textContent = refreshRuntime ? 'Checking runtime' : 'Loading settings';
			try {
				const response = await fetch(musicAnalysisSettingsUrl + (refreshRuntime ? '?refresh=1' : ''), { cache: 'no-store' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Music analysis settings unavailable');
				const edits = discardEdits ? [] : engineFormEdits('music', serializeMusicAnalysisSettings);
				renderMusicAnalysisSettings(payload.settings || {});
				engineBaselines.music = { settings: currentMusicAnalysisSettings };
				captureFormSnapshots(['music']);
				const kept = reapplyEngineEdits(edits, serializeMusicAnalysisSettings, renderMusicAnalysisSettings, engineBaselines.music.settings);
				fields.musicAnalysisSettingsMessage.textContent = (refreshRuntime ? 'Runtime checked' : 'Settings loaded') + (kept ? ' - unsaved edits kept' : '');
			} catch (error) {
				fields.musicAnalysisSettingsMessage.textContent = error.message || 'Music analysis settings load failed';
			}
		}

		function applyMusicSaveResult(payload, sent) {
			return applyEngineSaveResult('music', sent, serializeMusicAnalysisSettings, () => {
				renderMusicAnalysisSettings(payload.settings || sent);
				engineBaselines.music = { settings: currentMusicAnalysisSettings };
			}, renderMusicAnalysisSettings);
		}

		async function saveMusicAnalysisSettings() {
			if (engineSettingsMissing('music', fields.musicAnalysisSettingsMessage, 'Music analysis settings are not loaded yet.')) return;
			const settings = serializeMusicAnalysisSettings();
			fields.musicAnalysisSettingsMessage.textContent = 'Saving';
			try {
				const response = await fetch(musicAnalysisSettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Save failed');
				fields.musicAnalysisSettingsMessage.textContent = engineSavedText(applyMusicSaveResult(payload, settings));
				await Promise.all([refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.musicAnalysisSettingsMessage.textContent = error.message || 'Save failed';
			}
		}

		async function setupMusicAnalysis() {
			const original = fields.setupMusicAnalysis.textContent;
			try {
				fields.setupMusicAnalysis.disabled = true;
				fields.setupMusicAnalysis.textContent = 'Setting up...';
				fields.musicAnalysisSettingsMessage.textContent = 'Creating venv and downloading local packages...';
				const response = await fetch(musicAnalysisSetupUrl, { method: 'POST' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Music analysis setup failed');
				fields.musicAnalysisSettingsMessage.textContent = 'Local music analysis is ready';
				await Promise.all([loadMusicAnalysisSettings({ refreshRuntime: true }), refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.musicAnalysisSettingsMessage.textContent = error.message || 'Music analysis setup failed';
			} finally {
				fields.setupMusicAnalysis.disabled = false;
				fields.setupMusicAnalysis.textContent = original;
			}
		}

		function renderUpscaleSettings(settings, models) {
			currentUpscaleSettings = settings || {};
			fields.upscaleSettings.innerHTML = [
				'<label class="field"><span>Python path</span><input id="upscalePythonPath" value="' + escapeHtml(currentUpscaleSettings.python_path || '') + '" placeholder="Auto-detect CUDA-capable Python"></label>',
				'<label class="field"><span>Virtual environment path</span><input id="upscaleVenvPath" value="' + escapeHtml(currentUpscaleSettings.venv_path || '') + '"></label>',
				'<label class="field"><span>APISR virtual environment path</span><input id="upscaleApisrVenvPath" value="' + escapeHtml(currentUpscaleSettings.apisr_venv_path || '') + '" placeholder="Separate venv for APISR anime models"></label>',
				'<label class="field"><span>Job timeout (ms)</span><input id="upscaleTimeout" type="number" min="1000" step="1000" inputmode="numeric" value="' + escapeHtml(currentUpscaleSettings.timeout_ms || 1800000) + '" placeholder="1800000"></label>',
				'<label class="field"><span>Tile size</span><input id="upscaleTile" type="number" min="0" step="32" inputmode="numeric" value="' + escapeHtml(currentUpscaleSettings.tile === undefined || currentUpscaleSettings.tile === null ? 0 : currentUpscaleSettings.tile) + '" placeholder="0"><small class="muted">0 uses the model recommended tile.</small></label>',
				'<label class="field"><span>Precision</span><select id="upscalePrecision"><option value="fp16"' + (currentUpscaleSettings.precision === 'fp32' ? '' : ' selected') + '>fp16</option><option value="fp32"' + (currentUpscaleSettings.precision === 'fp32' ? ' selected' : '') + '>fp32</option></select></label>',
			].join('');
			fields.upscaleModelStates.textContent = 'Models: ' + (Array.isArray(models) && models.length ? models.map((model) => String(model.label || model.id || 'model') + ' — ' + String(model.state || 'not checked')).join(' · ') : 'not checked');
			fields.upscaleInstallActions.innerHTML = (Array.isArray(models) ? models : []).map((model) => {
				const caps = model.upscale_capabilities || {};
				const restriction = caps.academic_only ? '<small class="muted">Experimental · GPL-3.0-only · academic-only</small>' : '<small class="muted">' + escapeHtml(String(caps.model_class || 'local')) + ' · native ×' + escapeHtml(String(caps.native_scale || '?')) + '</small>';
				const acknowledgement = caps.installation_acknowledgement_required ? '<label class="field"><span><input type="checkbox" data-upscale-restricted="' + escapeHtml(String(model.id)) + '"> I acknowledge the APISR academic-only and GPL-3.0 restriction</span></label>' : '';
				const policy = caps.output_policy ? '<small class="muted">Output: ' + escapeHtml(String(caps.output_policy)) + ' · tile ' + escapeHtml(String(caps.tile && caps.tile.recommended || '?')) + ' · ' + escapeHtml(String((caps.precision || []).join('/')) || 'fp16') + '</small>' : '';
				return '<div class="field"><strong>' + escapeHtml(String(model.label || model.id)) + '</strong><br>' + restriction + '<br>' + policy + acknowledgement + '<button type="button" data-upscale-install="' + escapeHtml(String(model.id)) + '"' + (model.state === 'installed' ? ' disabled' : '') + '>Install ' + escapeHtml(String(model.label || 'model')) + '</button></div>';
			}).join('') || '<span class="muted">No local upscale models were reported.</span>';
		}

		function serializeUpscaleSettings() {
			return {
				python_path: document.getElementById('upscalePythonPath').value.trim(),
				venv_path: document.getElementById('upscaleVenvPath').value.trim(),
				apisr_venv_path: ((document.getElementById('upscaleApisrVenvPath') || {}).value || '').trim(),
				timeout_ms: numberValue((document.getElementById('upscaleTimeout') || {}).value, currentUpscaleSettings.timeout_ms || 1800000),
				tile: numberValue((document.getElementById('upscaleTile') || {}).value, currentUpscaleSettings.tile || 0),
				precision: ((document.getElementById('upscalePrecision') || {}).value || currentUpscaleSettings.precision || 'fp16'),
			};
		}

		async function loadUpscaleSettings(options = {}) {
			const discardEdits = !!options && options.discardEdits === true;
			fields.upscaleSettingsMessage.textContent = 'Loading settings';
			try {
				const response = await fetch(upscaleSettingsUrl, { cache: 'no-store' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Local upscale settings unavailable');
				const edits = discardEdits ? [] : engineFormEdits('upscale', serializeUpscaleSettings);
				renderUpscaleSettings(payload.settings || {}, payload.models || []);
				engineBaselines.upscale = { settings: currentUpscaleSettings, models: payload.models || [] };
				captureFormSnapshots(['upscale']);
				const kept = reapplyEngineEdits(edits, serializeUpscaleSettings, (merged) => renderUpscaleSettings(merged, engineBaselines.upscale.models), engineBaselines.upscale.settings);
				fields.upscaleSettingsMessage.textContent = kept ? 'Settings loaded - unsaved edits kept' : 'Settings loaded';
			} catch (error) {
				fields.upscaleSettingsMessage.textContent = error.message || 'Local upscale settings load failed';
			}
		}

		function applyUpscaleSaveResult(payload, sent) {
			return applyEngineSaveResult('upscale', sent, serializeUpscaleSettings, () => {
				renderUpscaleSettings(payload.settings || sent, payload.models || []);
				engineBaselines.upscale = { settings: currentUpscaleSettings, models: payload.models || [] };
			}, (merged) => renderUpscaleSettings(merged, engineBaselines.upscale.models));
		}

		async function saveUpscaleSettings() {
			if (engineSettingsMissing('upscale', fields.upscaleSettingsMessage, 'Local upscale settings are not loaded yet.')) return;
			const settings = serializeUpscaleSettings();
			fields.upscaleSettingsMessage.textContent = 'Saving';
			try {
				const response = await fetch(upscaleSettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Save failed');
				fields.upscaleSettingsMessage.textContent = engineSavedText(applyUpscaleSaveResult(payload, settings));
				await Promise.all([refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.upscaleSettingsMessage.textContent = error.message || 'Save failed';
			}
		}

		function showSetupLog(node, text) {
			if (!node) return;
			const value = String(text || '').trim();
			node.hidden = !value;
			node.textContent = value;
		}

		function setupFailureText(payload, fallback) {
			const details = payload && payload.details && typeof payload.details === 'object' ? payload.details : {};
			const lines = [String((payload && payload.message) || fallback || 'Setup failed')];
			if (payload && payload.code) lines.push('Code: ' + payload.code);
			['python', 'python_version', 'python_exists', 'venv_path', 'venv_python', 'index_url', 'extra_index_url', 'status', 'error', 'repo_id'].forEach((key) => {
				const value = details[key];
				if (value === undefined || value === null || value === '') return;
				const text = value && typeof value === 'object' ? (value.message || JSON.stringify(value)) : String(value);
				lines.push(key.replace(/_/g, ' ') + ': ' + text);
			});
			if (details.torch && typeof details.torch === 'object') {
				lines.push('torch: ' + JSON.stringify(details.torch));
			}
			const log = String(details.log || details.stderr || details.stdout || '').trim();
			if (log) lines.push('', log.slice(-12000));
			return lines.join(String.fromCharCode(10));
		}

		async function setupUpscale(modelId, button, acceptRestricted) {
			if (engineSettingsMissing('upscale', fields.upscaleSettingsMessage, 'Local upscale settings are not loaded yet.')) return;
			const original = button.textContent;
			// Saving first re-renders the model list, which replaces the install buttons; lock the new ones again.
			const lockInstallButtons = () => {
				Array.from(fields.upscaleInstallActions.querySelectorAll('[data-upscale-install]')).forEach((control) => {
					control.disabled = true;
					if (control === button || control.getAttribute('data-upscale-install') === modelId) control.textContent = 'Installing...';
				});
			};
			try {
				lockInstallButtons();
				button.textContent = 'Installing...';
				showSetupLog(fields.upscaleSetupLog, '');
				const settings = serializeUpscaleSettings();
				const saveResponse = await fetch(upscaleSettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
				const savePayload = await saveResponse.json();
				if (!saveResponse.ok || savePayload.success === false) throw new Error(savePayload.message || 'Save failed');
				// What the Relay stored (it may normalize values) is the new baseline, so the follow-up reload does not treat the
				// just-saved fields as unsaved edits.
				applyUpscaleSaveResult(savePayload, settings);
				lockInstallButtons();
				fields.upscaleSettingsMessage.textContent = 'Installing selected model (venv, CUDA torch, pinned checkout, verified weight)...';
				const response = await fetch(upscaleSetupUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, accept_restricted: !!acceptRestricted }) });
				const payload = await response.json();
				if (!response.ok || payload.success === false) {
					const error = new Error(payload.message || 'Local upscale setup failed');
					error.payload = payload;
					throw error;
				}
				fields.upscaleSettingsMessage.textContent = (payload.model && payload.model.label || modelId) + ' is installed';
				showSetupLog(fields.upscaleSetupLog, payload.details && payload.details.log || '');
				await Promise.all([loadUpscaleSettings(), refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.upscaleSettingsMessage.textContent = error.message || 'Local upscale setup failed';
				showSetupLog(fields.upscaleSetupLog, setupFailureText(error.payload || {}, error.message || 'Local upscale setup failed'));
			} finally {
				Array.from(fields.upscaleInstallActions.querySelectorAll('[data-upscale-install]')).forEach((control) => {
					control.disabled = false;
					if (control.textContent === 'Installing...') control.textContent = original;
				});
				button.textContent = original;
			}
		}

		function renderImageSettings(settings, models, resolutionChoices) {
			currentImageSettings = settings || {};
			const precision = currentImageSettings.precision || 'bf16';
			const resolution = String(currentImageSettings.default_resolution || '1024x1024');
			const choices = Array.isArray(resolutionChoices) && resolutionChoices.length
				? resolutionChoices
				: [
					{ value: '1024x1024', label: '1K · 1:1 · 1024×1024' },
					{ value: '2048x2048', label: '2K · 1:1 · 2048×2048' },
				];
			const resolutionOptions = choices.map((choice) => {
				const value = String(choice.value || '');
				const selected = value === resolution || (resolution === '1k' && value === '1024x1024') || (resolution === '2k' && value === '2048x2048');
				return '<option value="' + escapeHtml(value) + '"' + (selected ? ' selected' : '') + '>' + escapeHtml(String(choice.label || value)) + '</option>';
			}).join('');
			fields.imageSettings.innerHTML = [
				'<label class="field"><span>Python path</span><input id="imagePythonPath" value="' + escapeHtml(currentImageSettings.python_path || '') + '" placeholder="Auto-detect Python 3.10+"></label>',
				'<label class="field"><span>Virtual environment path</span><input id="imageVenvPath" value="' + escapeHtml(currentImageSettings.venv_path || '') + '"></label>',
				'<label class="field"><span>Precision</span><select id="imagePrecision"><option value="bf16"' + (precision === 'fp8' ? '' : ' selected') + '>BF16 (recommended with CPU offload)</option><option value="fp8"' + (precision === 'fp8' ? ' selected' : '') + '>FP8 (falls back to BF16)</option></select></label>',
				'<label class="field"><span>Default resolution</span><select id="imageDefaultResolution">' + resolutionOptions + '</select></label>',
				'<label class="field"><span>Default steps</span><input id="imageDefaultSteps" type="number" min="1" max="100" step="1" inputmode="numeric" value="' + escapeHtml(currentImageSettings.default_steps || 40) + '"></label>',
				'<label class="field"><span>Guidance / CFG scale</span><input id="imageGuidanceScale" type="number" min="0" max="20" step="0.1" inputmode="decimal" value="' + escapeHtml(currentImageSettings.guidance_scale == null ? 1 : currentImageSettings.guidance_scale) + '"><small class="muted">Qwen-Image-2.1 uses True CFG; FLUX.2 uses guidance scale. Each model applies its recommended default unless you change this setting.</small></label>',
				'<label class="checkbox-row"><input type="checkbox" id="imageCpuOffload"' + checkedAttr(currentImageSettings.cpu_offload !== false) + '><span>Enable model CPU offload</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="imageVaeTiling"' + checkedAttr(currentImageSettings.vae_tiling !== false) + '><span>Enable VAE tiling (reduces peak VRAM use)</span></label>',
				'<small class="muted">Turning this off uses more VRAM and does not guarantee faster generation. Sana 4K always enables its required model-specific tiling.</small>',
				'<label class="checkbox-row"><input type="checkbox" id="imageAllowModelDownloads"' + checkedAttr(currentImageSettings.allow_model_downloads === true) + '><span>Allow model downloads during setup</span></label>',
			].join('');
			fields.imageModelStates.textContent = 'Models: ' + (Array.isArray(models) && models.length ? models.map((model) => String(model.label || model.id || 'model') + ' — ' + String(model.state || 'not checked')).join(' · ') : 'not checked');
			fields.imageInstallActions.innerHTML = (Array.isArray(models) ? models : []).map((model) => (
				'<div class="field"><strong>' + escapeHtml(String(model.label || model.id)) + '</strong><br>' +
				'<small class="muted">Diffusers · ' + escapeHtml(String(model.precision || 'BF16')) + ' · ' + (Number(model.reference_images_max) === 0 ? 'text-to-image only' : Number(model.reference_images_max) === 1 ? '1 reference image' : 'up to ' + escapeHtml(String(model.reference_images_max)) + ' reference images') + (model.vram_note ? ' · ' + escapeHtml(String(model.vram_note)) : '') + '</small><br>' +
				'<button type="button" data-image-install="' + escapeHtml(String(model.id)) + '">' +
				(model.state === 'installed' ? 'Repair / Reinstall Model' : 'Install Model') +
				'</button></div>'
			)).join('') || '<span class="muted">No local image models were reported.</span>';
		}

		function serializeImageSettings() {
			return {
				python_path: ((document.getElementById('imagePythonPath') || {}).value || '').trim(),
				venv_path: ((document.getElementById('imageVenvPath') || {}).value || '').trim(),
				precision: ((document.getElementById('imagePrecision') || {}).value || currentImageSettings.precision || 'bf16'),
				default_resolution: ((document.getElementById('imageDefaultResolution') || {}).value || currentImageSettings.default_resolution || '1024x1024'),
				default_steps: numberValue((document.getElementById('imageDefaultSteps') || {}).value, currentImageSettings.default_steps || 40),
				guidance_scale: numberValue((document.getElementById('imageGuidanceScale') || {}).value, currentImageSettings.guidance_scale == null ? 1 : currentImageSettings.guidance_scale),
				cpu_offload: !!(document.getElementById('imageCpuOffload') || {}).checked,
				vae_tiling: !!(document.getElementById('imageVaeTiling') || {}).checked,
				allow_model_downloads: !!(document.getElementById('imageAllowModelDownloads') || {}).checked,
			};
		}

		async function loadImageSettings(options = {}) {
			const discardEdits = !!options && options.discardEdits === true;
			fields.imageSettingsMessage.textContent = 'Loading settings';
			try {
				const response = await fetch(imageSettingsUrl, { cache: 'no-store' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Local image settings unavailable');
				const edits = discardEdits ? [] : engineFormEdits('image', serializeImageSettings);
				renderImageSettings(payload.settings || {}, payload.models || [], payload.resolution_choices || []);
				engineBaselines.image = { settings: currentImageSettings, models: payload.models || [], resolutionChoices: payload.resolution_choices || [] };
				captureFormSnapshots(['image']);
				const kept = reapplyEngineEdits(edits, serializeImageSettings, (merged) => renderImageSettings(merged, engineBaselines.image.models, engineBaselines.image.resolutionChoices), engineBaselines.image.settings);
				fields.imageSettingsMessage.textContent = kept ? 'Settings loaded - unsaved edits kept' : 'Settings loaded';
			} catch (error) {
				fields.imageSettingsMessage.textContent = error.message || 'Local image settings load failed';
			}
		}

		function applyImageSaveResult(payload, sent) {
			const resolutionChoices = payload.resolution_choices || payload.capabilities?.resolution_choices || [];
			return applyEngineSaveResult('image', sent, serializeImageSettings, () => {
				renderImageSettings(payload.settings || sent, payload.models || [], resolutionChoices);
				engineBaselines.image = { settings: currentImageSettings, models: payload.models || [], resolutionChoices };
			}, (merged) => renderImageSettings(merged, engineBaselines.image.models, engineBaselines.image.resolutionChoices));
		}

		async function saveImageSettings() {
			if (engineSettingsMissing('image', fields.imageSettingsMessage, 'Local image settings are not loaded yet.')) return;
			const settings = serializeImageSettings();
			fields.imageSettingsMessage.textContent = 'Saving';
			try {
				const response = await fetch(imageSettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
				const payload = await response.json();
				if (!response.ok || payload.success === false) throw new Error(payload.message || 'Save failed');
				fields.imageSettingsMessage.textContent = engineSavedText(applyImageSaveResult(payload, settings));
				await Promise.all([refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.imageSettingsMessage.textContent = error.message || 'Save failed';
			}
		}

		async function setupImage(options = {}) {
			if (engineSettingsMissing('image', fields.imageSettingsMessage, 'Local image settings are not loaded yet.')) return;
			const button = options.button || fields.setupImageEnvironment;
			const original = button ? button.textContent : '';
			const downloadModel = options.download_model === true;
			const modelId = options.model || '';
			const busyText = downloadModel ? 'Installing model...' : 'Setting up...';
			// Saving first re-renders the model list, which replaces the install buttons; lock the new ones again.
			const lockInstallButtons = () => {
				if (fields.setupImageEnvironment) fields.setupImageEnvironment.disabled = true;
				Array.from(fields.imageInstallActions.querySelectorAll('[data-image-install]')).forEach((control) => {
					control.disabled = true;
					if (control === button || (modelId && control.getAttribute('data-image-install') === modelId)) control.textContent = busyText;
				});
			};
			try {
				lockInstallButtons();
				if (button) button.textContent = busyText;
				showSetupLog(fields.imageSetupLog, '');
				const settings = serializeImageSettings();
				const saveResponse = await fetch(imageSettingsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
				const savePayload = await saveResponse.json();
				if (!saveResponse.ok || savePayload.success === false) throw new Error(savePayload.message || 'Save failed');
				applyImageSaveResult(savePayload, settings);
				lockInstallButtons();
				fields.imageSettingsMessage.textContent = downloadModel
					? 'Downloading selected model weights from Hugging Face...'
					: 'Creating venv and installing CUDA Diffusers packages...';
				const response = await fetch(imageSetupUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ model: modelId, download_model: downloadModel }),
				});
				const payload = await response.json();
				if (!response.ok || payload.success === false) {
					const error = new Error(payload.message || 'Local image setup failed');
					error.payload = payload;
					throw error;
				}
				fields.imageSettingsMessage.textContent = downloadModel
					? ((payload.model && payload.model.label || modelId || 'Model') + ' is installed')
					: 'Local image environment is ready';
				showSetupLog(fields.imageSetupLog, payload.details && payload.details.log || '');
				await Promise.all([loadImageSettings(), refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.imageSettingsMessage.textContent = error.message || 'Local image setup failed';
				showSetupLog(fields.imageSetupLog, setupFailureText(error.payload || {}, error.message || 'Local image setup failed'));
			} finally {
				if (fields.setupImageEnvironment) fields.setupImageEnvironment.disabled = false;
				Array.from(fields.imageInstallActions.querySelectorAll('[data-image-install]')).forEach((control) => {
					control.disabled = false;
					if (control.textContent === busyText) control.textContent = original;
				});
				if (button) button.textContent = original;
			}
		}

		function checkedAttr(value) {
			return value ? ' checked' : '';
		}

		function optionAttr(value, selected) {
			return String(value) === String(selected) ? ' selected' : '';
		}

		function numberValue(value, fallback) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : fallback;
		}

		function renderAsrSettingsJson(settings) {
			fields.asrSettingsJson.value = JSON.stringify(settings || {}, null, 2);
		}

		function renderAsrSettingsForm(settings) {
			currentAsrSettings = settings || {};
			const models = Array.isArray(currentAsrSettings.models) ? currentAsrSettings.models : [];
			const defaultModel = currentAsrSettings.default_model || '';
			const defaultModelOptions = [
				'<option value=""' + optionAttr('', defaultModel) + '>Auto</option>',
				...models.filter((model) => model && model.id && model.enabled !== false && model.provider !== 'qwen-aligner').map((model) => (
					'<option value="' + escapeHtml(model.id || '') + '"' + optionAttr(model.id || '', defaultModel) + '>' + escapeHtml(model.label || model.id || 'Model') + '</option>'
				)),
			].join('');
			fields.asrGeneralSettings.innerHTML = [
				'<label class="checkbox-row"><input type="checkbox" id="asrAllowPackageInstall"' + checkedAttr(currentAsrSettings.allow_package_install !== false) + '><span>Install Python packages automatically</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrAllowModelDownloads"' + checkedAttr(currentAsrSettings.allow_model_downloads === true) + '><span>Allow ASR model downloads</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrAllowQwenCpuOffload"' + checkedAttr(currentAsrSettings.allow_qwen_cpu_offload !== false) + '><span>Allow Qwen CPU offload</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrVadFilter"' + checkedAttr(currentAsrSettings.vad_filter === true) + '><span>Use VAD filter</span></label>',
				'<label class="checkbox-row"><input type="checkbox" id="asrConditionPrevious"' + checkedAttr(currentAsrSettings.condition_on_previous_text !== false) + '><span>Condition on previous text</span></label>',
				'<label class="field"><span>Default model</span><select id="asrDefaultModel">' + defaultModelOptions + '</select></label>',
				'<label class="field"><span>Whisper Python path</span><input id="asrPythonPath" value="' + escapeHtml(currentAsrSettings.python_path || '') + '" placeholder="Auto-detect Python 3.10"></label>',
				'<label class="field"><span>Whisper venv path</span><input id="asrVenvPath" value="' + escapeHtml(currentAsrSettings.venv_path || '') + '"></label>',
				'<label class="field"><span>Qwen Python path</span><input id="asrQwenPythonPath" value="' + escapeHtml(currentAsrSettings.qwen_python_path || '') + '" placeholder="Auto-detect Python 3.12"></label>',
				'<label class="field"><span>Qwen venv path</span><input id="asrQwenVenvPath" value="' + escapeHtml(currentAsrSettings.qwen_venv_path || '') + '"></label>',
				'<label class="field"><span>Qwen chunk seconds</span><input id="asrQwenChunkSeconds" type="number" min="5" max="180" value="' + escapeHtml(currentAsrSettings.qwen_chunk_seconds || 30) + '"></label>',
				'<label class="field"><span>Qwen max word seconds</span><input id="asrQwenMaxWordDurationSeconds" type="number" min="1" max="60" value="' + escapeHtml(currentAsrSettings.qwen_max_word_duration_seconds || 12) + '"></label>',
				'<label class="field"><span>CPU threads</span><input id="asrCpuThreads" type="number" min="1" max="64" value="' + escapeHtml(currentAsrSettings.cpu_threads || 4) + '"></label>',
				'<label class="field"><span>Workers</span><input id="asrNumWorkers" type="number" min="1" max="8" value="' + escapeHtml(currentAsrSettings.num_workers || 1) + '"></label>',
				'<label class="field"><span>Beam size</span><input id="asrBeamSize" type="number" min="1" max="20" value="' + escapeHtml(currentAsrSettings.beam_size || 5) + '"></label>',
				'<label class="field"><span>Best of</span><input id="asrBestOf" type="number" min="1" max="20" value="' + escapeHtml(currentAsrSettings.best_of || 5) + '"></label>',
				'<label class="field"><span>Transcribe timeout (ms)</span><input id="asrTranscribeTimeout" type="number" min="1000" step="1000" inputmode="numeric" value="' + escapeHtml(currentAsrSettings.transcribe_timeout_ms || 1800000) + '" placeholder="1800000"></label>',
				'<label class="field"><span>CUDA extra PATH</span><input id="asrCudaPaths" value="' + escapeHtml(currentAsrSettings.cuda_paths || '') + '" placeholder="Optional extra CUDA bin directories" autocomplete="off" spellcheck="false"><small class="muted">Leave blank to use ALORBACH_ASR_CUDA_PATHS.</small></label>',
				'<label class="field"><span>Qwen torch index URL</span><input id="asrQwenTorchIndexUrl" value="' + escapeHtml(currentAsrSettings.qwen_torch_index_url || '') + '" placeholder="https://download.pytorch.org/whl/cu128" autocomplete="off" spellcheck="false"><small class="muted">Leave blank to use ALORBACH_QWEN_TORCH_INDEX_URL.</small></label>',
			].join('');

			fields.asrModelSettings.innerHTML = models.map((model, index) => (
				'<div class="model-settings-card" data-model-index="' + index + '">' +
					'<div class="model-heading"><span>' + escapeHtml(model.label || model.id || 'Model') + '</span><label><input type="checkbox" data-field="enabled"' + checkedAttr(model.enabled !== false) + '> Enabled</label></div>' +
					'<label class="field"><span>Model id</span><input data-field="id" value="' + escapeHtml(model.id || '') + '"></label>' +
					'<label class="field"><span>Label</span><input data-field="label" value="' + escapeHtml(model.label || '') + '"></label>' +
					'<label class="field"><span>Provider</span><select data-field="provider">' +
						'<option value="faster-whisper"' + optionAttr('faster-whisper', model.provider || 'faster-whisper') + '>faster-whisper</option>' +
						'<option value="qwen-asr"' + optionAttr('qwen-asr', model.provider || 'faster-whisper') + '>qwen-asr</option>' +
						'<option value="qwen-aligner"' + optionAttr('qwen-aligner', model.provider || 'faster-whisper') + '>qwen-aligner</option>' +
					'</select></label>' +
					'<label class="field"><span>CPU repo id</span><input data-field="repo_id" value="' + escapeHtml(model.repo_id || '') + '"></label>' +
					'<label class="field"><span>GPU repo id</span><input data-field="gpu_repo_id" value="' + escapeHtml(model.gpu_repo_id || '') + '"></label>' +
					'<label class="field"><span>Aligner repo id</span><input data-field="aligner_repo_id" value="' + escapeHtml(model.aligner_repo_id || '') + '"></label>' +
					'<label class="field"><span>Local model path</span><input data-field="local_path" value="' + escapeHtml(model.local_path || '') + '"></label>' +
					'<label class="field"><span>Aligner local path</span><input data-field="aligner_local_path" value="' + escapeHtml(model.aligner_local_path || '') + '"></label>' +
					'<label class="field"><span>Minimum VRAM MB</span><input data-field="min_vram_mb" type="number" min="0" step="256" value="' + escapeHtml(model.min_vram_mb || 0) + '"></label>' +
					'<label class="field"><span>Preferred device</span><select data-field="preferred_device">' +
						'<option value="auto"' + optionAttr('auto', model.preferred_device || 'auto') + '>Auto</option>' +
						'<option value="cpu"' + optionAttr('cpu', model.preferred_device || 'auto') + '>CPU</option>' +
						'<option value="cuda"' + optionAttr('cuda', model.preferred_device || 'auto') + '>CUDA</option>' +
					'</select></label>' +
					'<div class="settings-actions"><button type="button" data-install-asr-model="' + escapeHtml(model.id || '') + '">Install model</button></div>' +
				'</div>'
			)).join('');
			renderAsrSettingsJson(currentAsrSettings);
		}

		function serializeAsrSettingsForm() {
			const modelCards = Array.from(fields.asrModelSettings.querySelectorAll('.model-settings-card'));
			return {
				allow_package_install: !!document.getElementById('asrAllowPackageInstall').checked,
				allow_model_downloads: !!document.getElementById('asrAllowModelDownloads').checked,
				allow_qwen_cpu_offload: !!document.getElementById('asrAllowQwenCpuOffload').checked,
				default_model: document.getElementById('asrDefaultModel').value.trim(),
				python_path: document.getElementById('asrPythonPath').value.trim(),
				venv_path: document.getElementById('asrVenvPath').value.trim(),
				qwen_python_path: document.getElementById('asrQwenPythonPath').value.trim(),
				qwen_venv_path: document.getElementById('asrQwenVenvPath').value.trim(),
				qwen_chunk_seconds: numberValue(document.getElementById('asrQwenChunkSeconds').value, 30),
				qwen_max_word_duration_seconds: numberValue(document.getElementById('asrQwenMaxWordDurationSeconds').value, 12),
				cpu_threads: numberValue(document.getElementById('asrCpuThreads').value, 4),
				num_workers: numberValue(document.getElementById('asrNumWorkers').value, 1),
				beam_size: numberValue(document.getElementById('asrBeamSize').value, 5),
				best_of: numberValue(document.getElementById('asrBestOf').value, 5),
				vad_filter: !!document.getElementById('asrVadFilter').checked,
				condition_on_previous_text: !!document.getElementById('asrConditionPrevious').checked,
				transcribe_timeout_ms: numberValue((document.getElementById('asrTranscribeTimeout') || {}).value, currentAsrSettings.transcribe_timeout_ms || 1800000),
				cuda_paths: ((document.getElementById('asrCudaPaths') || {}).value || '').trim(),
				qwen_torch_index_url: ((document.getElementById('asrQwenTorchIndexUrl') || {}).value || '').trim(),
				models: modelCards.map((card) => ({
					id: (card.querySelector('[data-field="id"]') || {}).value || '',
					label: (card.querySelector('[data-field="label"]') || {}).value || '',
					provider: (card.querySelector('[data-field="provider"]') || {}).value || 'faster-whisper',
					repo_id: (card.querySelector('[data-field="repo_id"]') || {}).value || '',
					gpu_repo_id: (card.querySelector('[data-field="gpu_repo_id"]') || {}).value || '',
					aligner_repo_id: (card.querySelector('[data-field="aligner_repo_id"]') || {}).value || '',
					local_path: (card.querySelector('[data-field="local_path"]') || {}).value || '',
					aligner_local_path: (card.querySelector('[data-field="aligner_local_path"]') || {}).value || '',
					min_vram_mb: numberValue((card.querySelector('[data-field="min_vram_mb"]') || {}).value, 0),
					enabled: !!(card.querySelector('[data-field="enabled"]') || {}).checked,
					preferred_device: (card.querySelector('[data-field="preferred_device"]') || {}).value || 'auto',
				})),
			};
		}

		async function loadAsrSettings(options = {}) {
			const refreshRuntime = !!options.refreshRuntime;
			const discardEdits = options.discardEdits === true;
			fields.asrSettingsMessage.textContent = refreshRuntime ? 'Checking runtime' : 'Loading settings';
			try {
				const response = await fetch(asrSettingsUrl + (refreshRuntime ? '?refresh=1' : ''), { cache: 'no-store' });
				const payload = await response.json();
				if (!response.ok || payload.success === false) {
					throw new Error(payload.message || 'Settings unavailable');
				}
				const edits = discardEdits ? [] : engineFormEdits('asr', serializeAsrSettingsForm);
				renderAsrSettingsForm(payload.settings || {});
				engineBaselines.asr = { settings: currentAsrSettings };
				captureFormSnapshots(['asr']);
				const kept = reapplyEngineEdits(edits, serializeAsrSettingsForm, renderAsrSettingsForm, engineBaselines.asr.settings);
				fields.asrSettingsMessage.textContent = (refreshRuntime ? 'Runtime checked' : 'Settings loaded') + (kept ? ' - unsaved edits kept' : '');
				if (payload.capabilities) {
					renderAsrDetails(payload.capabilities);
				}
			} catch (error) {
				fields.asrSettingsMessage.textContent = error.message || 'Settings load failed';
			}
		}

		async function persistAsrSettings() {
			const settings = serializeAsrSettingsForm();
			renderAsrSettingsJson(settings);
			const response = await fetch(asrSettingsUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ settings }),
			});
			const payload = await response.json();
			if (!response.ok || payload.success === false) {
				throw new Error(payload.message || 'Save failed');
			}
			return { payload, sent: settings };
		}

		function applyAsrSaveResult(payload, sent) {
			return applyEngineSaveResult('asr', sent, serializeAsrSettingsForm, () => {
				renderAsrSettingsForm(payload.settings || sent);
				engineBaselines.asr = { settings: currentAsrSettings };
			}, renderAsrSettingsForm);
		}

		async function saveAsrSettings() {
			if (engineSettingsMissing('asr', fields.asrSettingsMessage, 'ASR settings are not loaded yet.')) return;
			fields.asrSettingsMessage.textContent = 'Saving';
			try {
				const saved = await persistAsrSettings();
				const payload = saved.payload;
				fields.asrSettingsMessage.textContent = engineSavedText(applyAsrSaveResult(payload, saved.sent));
				if (payload.capabilities) {
					renderAsrDetails(payload.capabilities);
				}
				refresh();
			} catch (error) {
				fields.asrSettingsMessage.textContent = error.message || 'Save failed';
			}
		}

		async function setupAsrModel(button) {
			if (engineSettingsMissing('asr', fields.asrSettingsMessage, 'ASR settings are not loaded yet.')) return;
			const card = button.closest('.model-settings-card');
			const modelId = String((card && card.querySelector('[data-field="id"]') || {}).value || button.getAttribute('data-install-asr-model') || '').trim();
			const original = button.textContent;
			// Saving first re-renders the model cards from the Relay's answer, which replaces the buttons; lock the new ones again.
			const lockInstallButtons = () => {
				Array.from(fields.asrModelSettings.querySelectorAll('[data-install-asr-model]')).forEach((item) => {
					item.disabled = true;
					if (item.getAttribute('data-install-asr-model') === modelId || item === button) item.textContent = 'Installing...';
				});
			};
			try {
				lockInstallButtons();
				button.textContent = 'Installing...';
				showSetupLog(fields.asrSetupLog, '');
				fields.asrSettingsMessage.textContent = 'Saving settings, then installing ' + (modelId || 'model') + '...';
				const saved = await persistAsrSettings();
				applyAsrSaveResult(saved.payload, saved.sent);
				lockInstallButtons();
				const response = await fetch(asrSetupUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model_id: modelId }) });
				const payload = await response.json();
				if (!response.ok || payload.success === false) {
					const error = new Error(payload.message || 'Local ASR setup failed');
					error.payload = payload;
					throw error;
				}
				fields.asrSettingsMessage.textContent = (payload.label || modelId) + ' is installed';
				showSetupLog(fields.asrSetupLog, payload.details && payload.details.log || '');
				await Promise.all([loadAsrSettings({ refreshRuntime: true }), refresh().catch(() => {}), loadRelaySettings().catch(() => {})]);
			} catch (error) {
				fields.asrSettingsMessage.textContent = error.message || 'Local ASR setup failed';
				showSetupLog(fields.asrSetupLog, setupFailureText(error.payload || {}, error.message || 'Local ASR setup failed'));
			} finally {
				Array.from(fields.asrModelSettings.querySelectorAll('[data-install-asr-model]')).forEach((item) => {
					item.disabled = false;
					if (item.textContent === 'Installing...') item.textContent = original;
				});
				if (button.isConnected) button.textContent = original;
			}
		}

		// Discard on a local engine page: put the form back to the settings it last loaded or saved.
		function discardEngineSettings(key) {
			const base = engineBaselines[key];
			if (!base) return false;
			let message = null;
			if (key === 'asr') {
				renderAsrSettingsForm(base.settings);
				message = fields.asrSettingsMessage;
			} else if (key === 'music') {
				renderMusicAnalysisSettings(base.settings);
				message = fields.musicAnalysisSettingsMessage;
			} else if (key === 'upscale') {
				renderUpscaleSettings(base.settings, base.models);
				message = fields.upscaleSettingsMessage;
			} else if (key === 'image') {
				renderImageSettings(base.settings, base.models, base.resolutionChoices);
				message = fields.imageSettingsMessage;
			} else {
				return false;
			}
			captureFormSnapshots([key]);
			if (message) message.textContent = 'Changes discarded';
			return true;
		}

		function markAsrSettingsDirty() {
			try {
				renderAsrSettingsJson(serializeAsrSettingsForm());
				fields.asrSettingsMessage.textContent = 'Unsaved changes';
			} catch (error) {
				fields.asrSettingsMessage.textContent = 'Settings need review';
			}
			updateSettingsDirtyState();
		}

		function applyAsrSettingsJson() {
			try {
				const settings = JSON.parse(fields.asrSettingsJson.value || '{}');
				renderAsrSettingsForm(settings);
				fields.asrSettingsMessage.textContent = 'JSON applied - save to persist';
				updateSettingsDirtyState();
			} catch (error) {
				fields.asrSettingsMessage.textContent = 'Invalid JSON';
			}
		}

		function addAsrModel() {
			const settings = serializeAsrSettingsForm();
			settings.models.push({
				id: 'custom-whisper-model',
				label: 'Custom Whisper Model',
				provider: 'faster-whisper',
				repo_id: '',
				gpu_repo_id: '',
				aligner_repo_id: '',
				local_path: '',
				aligner_local_path: '',
				min_vram_mb: 0,
				enabled: true,
				preferred_device: 'auto',
			});
			renderAsrSettingsForm(settings);
			fields.asrSettingsMessage.textContent = 'Model added - edit and save';
			updateSettingsDirtyState();
		}

		function captureSessionOutputScrolls() {
			const states = new Map();
			document.querySelectorAll('.session-output[data-session-key]').forEach((output) => {
				const maxScrollTop = Math.max(0, output.scrollHeight - output.clientHeight);
				states.set(output.dataset.sessionKey, {
					atBottom: maxScrollTop - output.scrollTop <= 8,
					scrollTop: output.scrollTop,
				});
			});
			return states;
		}

		function restoreSessionOutputScrolls(scrollStates) {
			document.querySelectorAll('.session-output[data-session-key]').forEach((output) => {
				const state = scrollStates.get(output.dataset.sessionKey);
				const maxScrollTop = Math.max(0, output.scrollHeight - output.clientHeight);
				if (state) {
					output.scrollTop = output.classList.contains('live-session-output') && state.atBottom && liveAutoScroll
						? maxScrollTop
						: Math.min(state.scrollTop, maxScrollTop);
					return;
				}
				if (output.classList.contains('live-session-output') && liveAutoScroll) {
					output.scrollTop = maxScrollTop;
				}
			});
		}

		function queueRestoreSessionOutputScrolls(scrollStates) {
			const restore = () => restoreSessionOutputScrolls(scrollStates);
			if (typeof requestAnimationFrame === 'function') {
				requestAnimationFrame(restore);
				return;
			}
			setTimeout(restore, 0);
		}

		async function copyToClipboard(value) {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(value);
				return;
			}
			const textarea = document.createElement('textarea');
			textarea.value = value;
			textarea.setAttribute('readonly', '');
			textarea.style.position = 'fixed';
			textarea.style.left = '-9999px';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			textarea.remove();
		}

		function closeImageLightbox() {
			fields.imageLightbox.hidden = true;
			fields.mediaLightboxVideo.pause();
			fields.mediaLightboxVideo.hidden = true;
			fields.mediaLightboxVideo.removeAttribute('src');
			fields.imageLightboxContent.removeAttribute('src');
			fields.imageLightboxContent.hidden = true;
		}

		function openImageLightbox(url) {
			openMediaLightbox(url, 'image/png');
		}

		function openMediaLightbox(url, mimeType) {
			const video = /^video\//i.test(String(mimeType || ''));
			fields.imageLightboxContent.hidden = video;
			fields.mediaLightboxVideo.hidden = !video;
			if (video) {
				fields.imageLightboxContent.removeAttribute('src');
				fields.mediaLightboxVideo.src = url;
			} else {
				fields.mediaLightboxVideo.pause();
				fields.mediaLightboxVideo.removeAttribute('src');
				fields.imageLightboxContent.src = url;
			}
			fields.imageLightbox.hidden = false;
			fields.closeImageLightbox.focus();
		}

		// Shows Copied / Copy failed on a button for a moment after copying value to the clipboard.
		async function flashCopyButton(button, value) {
			const original = button.dataset.copyLabel || button.textContent;
			button.dataset.copyLabel = original;
			try {
				await copyToClipboard(value);
				button.textContent = 'Copied';
			} catch (error) {
				button.textContent = 'Copy failed';
			}
			setTimeout(() => {
				button.textContent = original;
				delete button.dataset.copyLabel;
			}, 1800);
		}

		document.addEventListener('click', async (event) => {
			const clearLiveFiltersButton = event.target.closest('[data-live-clear-filters]');
			if (clearLiveFiltersButton) {
				event.preventDefault();
				clearLiveFilters();
				return;
			}
			const replyWrap = event.target.closest('[data-reply-wrap]');
			if (replyWrap) {
				event.preventDefault();
				const container = replyWrap.closest('.provider-chat-result');
				const reply = container && container.querySelector('.provider-chat-reply');
				if (reply) {
					const nowrap = !reply.classList.contains('nowrap');
					reply.classList.toggle('nowrap', nowrap);
					replyWrap.setAttribute('aria-pressed', nowrap ? 'false' : 'true');
				}
				return;
			}
			const replyCopy = event.target.closest('[data-reply-copy]');
			if (replyCopy) {
				event.preventDefault();
				const card = replyCopy.closest('[data-provider-media-test]');
				const container = replyCopy.closest('.provider-chat-result');
				const reply = container && container.querySelector('.provider-chat-reply');
				const full = card && card.chatTestPayload && card.chatTestPayload.response ? chatReplyText(card.chatTestPayload.response) : '';
				await flashCopyButton(replyCopy, full || (reply ? reply.textContent : ''));
				return;
			}
			const cancelLiveImage = event.target.closest('#liveDetailCancel');
			if (cancelLiveImage) {
				event.preventDefault();
				await cancelLiveImageJob(cancelLiveImage);
				return;
			}
			const providerTest = event.target.closest('[data-provider-test]');
			if (providerTest) {
				event.preventDefault();
				await runProviderMediaTest(providerTest);
				return;
			}
			const mediaPreview = event.target.closest('[data-media-preview]');
			if (mediaPreview) {
				event.preventDefault();
				openMediaLightbox(mediaPreview.dataset.mediaPreview, mediaPreview.dataset.mediaMime);
				return;
			}
			const imagePreview = event.target.closest('[data-image-preview]');
			if (imagePreview) {
				event.preventDefault();
				openImageLightbox(imagePreview.dataset.imagePreview);
				return;
			}
			const openLive = event.target.closest('[data-open-live]');
			if (openLive) {
				event.preventDefault();
				if (!selectRoute('live')) {
					return;
				}
				const card = openLive.closest('[data-provider-media-test]');
				const requestId = card && card.dataset.testRequestId;
				if (requestId) selectLiveJob(requestId);
				return;
			}
			const openLiveJob = event.target.closest('[data-open-live-job]');
			if (openLiveJob) {
				event.preventDefault();
				if (!selectRoute('live')) {
					return;
				}
				selectLiveJob(openLiveJob.getAttribute('data-open-live-job') || '');
				return;
			}
			const openTestTab = event.target.closest('[data-open-test-tab]');
			if (openTestTab) {
				event.preventDefault();
				navigateTo(hashForRoute({ route: 'tests', liveRequestId: '', providerId: openTestTab.getAttribute('data-test-provider') || '', testType: testTypeForTabId(openTestTab.getAttribute('data-open-test-tab')) }));
				return;
			}
			const navHash = event.target.closest('[data-nav-hash]');
			if (navHash) {
				event.preventDefault();
				navigateTo(navHash.getAttribute('data-nav-hash') || 'overview');
				return;
			}
			if (event.target === fields.closeImageLightbox || event.target === fields.imageLightbox) {
				closeImageLightbox();
				return;
			}
			const copyValue = event.target.closest('.copy-value');
			if (copyValue) {
				const original = copyValue.textContent;
				try {
					const copySource = copyValue.dataset.copyFrom ? document.getElementById(copyValue.dataset.copyFrom) : null;
					await copyToClipboard(copyValue.dataset.copyValue || (copySource ? copySource.textContent : '') || original || '');
					copyValue.textContent = 'Copied';
				} catch (error) {
					copyValue.textContent = 'Copy failed';
				}
				setTimeout(() => {
					copyValue.textContent = original;
				}, 1800);
				return;
			}
			const button = event.target.closest('.copy-session-output');
			if (!button) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			const block = button.closest('.session-output-block');
			const output = button === fields.copyRawStatus ? fields.rawStatus : (block ? block.querySelector('.session-output') : null);
			if (!output) {
				return;
			}
			const original = button.textContent;
			try {
				await copyToClipboard(output.textContent || '');
				button.textContent = 'Copied';
			} catch (error) {
				button.textContent = 'Copy failed';
			}
			setTimeout(() => {
				button.textContent = original;
			}, 1800);
		});
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && !fields.imageLightbox.hidden) closeImageLightbox();
		});

		// options.stale: a status refresh failed; the (empty) jobs are not a Relay report, so the provider-test tracker keeps its last known jobs.
		function renderJobs(jobs, options) {
			const scrollStates = captureSessionOutputScrolls();
			currentStatus.jobs = jobs;
			fields.jobCounts.textContent = 'Running ' + Number(jobs.running_count || 0) + ' / Queued ' + Number(jobs.queued_count || 0);
			fields.maxConcurrent.textContent = text(jobs.max_concurrent);
			renderLiveJobList(jobs);
			if (livePinned && selectedLiveRequestId) {
				renderLiveDetail(findJobByRequestId(selectedLiveRequestId, jobs) || (!seenLiveRequestIds.has(selectedLiveRequestId) ? pendingLiveJob(selectedLiveRequestId) : null));
			} else {
				autoSelectLiveJob(jobs);
			}
			updateProviderTestProgress({ fresh: !(options && options.stale) });
			updateTabBadges(jobs);
			renderDebugFailures(jobs);
			applyRawStatusFilter();
			// Rendering never touches the connection pill or the #updated label: those follow connectionView() only.
			queueRestoreSessionOutputScrolls(scrollStates);
		}

		function tickElapsedCells() {
			checkJobEventsStall();
			document.querySelectorAll('.elapsed[data-live-elapsed="true"]').forEach((cell) => {
				const base = Number(cell.dataset.elapsedBase || 0);
				const captured = Number(cell.dataset.elapsedCaptured || Date.now());
				cell.textContent = elapsed(base + Math.max(0, Date.now() - captured));
			});
			updateProviderTestProgress();
			if (selectedLiveRequestId) {
				const job = findJobByRequestId(selectedLiveRequestId);
				if (job) {
					const status = String(job.status || '').toLowerCase();
					if (status === 'running' || status === 'queued' || status === 'pending') {
						renderLiveDetail(job);
					}
				} else if (livePinned && !seenLiveRequestIds.has(selectedLiveRequestId)) {
					renderLiveDetail(pendingLiveJob(selectedLiveRequestId));
				}
			}
		}

		function renderStatus(payload, ok, options) {
			const stale = !!(options && options.stale) || !payload.jobs;
			currentStatus = payload;
			if (Object.keys(currentCapabilities).length) {
				currentStatus.capabilities = currentCapabilities;
			}
			const jobs = payload.jobs || {};
			const bridge = payload.bridge || {};
			const details = payload.details || {};
			const paired = Array.isArray(bridge.paired_origins) ? bridge.paired_origins : [];
			// ok means "the Relay answered" (any JSON answer, including the 503 it sends while Codex is still being checked).
			// The Relay pill follows that alone; the Codex pill shows Checking… while the Relay says it is still checking.
			const reachable = ok !== false;
			const relayInfo = relayPillInfo(reachable);
			setPill(fields.bridgePill, relayInfo.state, relayInfo.label);
			const codexInfo = codexPillInfo(payload, reachable);
			setPill(fields.codexPill, codexInfo.state, codexInfo.label);
			fields.version.textContent = text(bridge.version);
			fields.pairedSites.innerHTML = paired.length ? paired.map((origin) => '<code>' + escapeHtml(origin) + '</code>').join(' ') : '<span class="muted">None</span>';
			fields.codexDetails.innerHTML = renderDetails(details);
			renderAsrDetails(payload.asr || currentCapabilities.asr || {});
			updateHealthCards(payload, ok);
			renderDebugHealth(payload, ok);
			if (!Object.keys(currentCapabilities).length) {
				fields.codexCliVersion.textContent = text(details.version);
				fields.codexBinary.textContent = text(details.codex_binary);
				fields.codexBinary.title = text(details.codex_binary, '');
				fields.detectedFeatures.innerHTML = '<div class="muted">Loading detected features</div>';
				fields.backendDrivers.innerHTML = '<div class="muted">Loading backend drivers</div>';
			}
			renderJobs(jobs, { stale });
			updateProviderRefreshState(payload.refresh);
		}

		// Shown for a detection run this page did not start (the Relay also refreshes after every settings save and at startup).
		const foreignRefreshMessage = 'Checking providers…';
		// Wording the page itself puts up while it follows a run it started. It must never outlive the run it describes.
		const ownRefreshMessages = ['Checking providers in background…', 'CLI paths saved; checking providers in background…'];

		function refreshStartMs(refreshState) {
			const parsed = Date.parse(refreshState && refreshState.started_at);
			return Number.isFinite(parsed) ? parsed : 0;
		}

		function refreshCompletionText(refreshState) {
			if (refreshState.error) return 'Detection refresh failed: ' + refreshState.error;
			return 'Detection refreshed ' + new Date(refreshState.completed_at || Date.now()).toLocaleTimeString();
		}

		function updateProviderRefreshState(refreshState) {
			if (!settingsLoaded || !refreshState) return;
			const button = fields.refreshRelayProviders;
			const message = fields.relaySettingsMessage;
			const snapshotId = Number(refreshState.id || 0);
			const startMs = refreshStartMs(refreshState);
			// Run ids are per Relay process and count up. A snapshot older than what was already seen is either a late answer
			// (ignore it) or the first sign of a restarted Relay, where ids start over at 1 (forget what was tracked). The run's
			// start time tells the two apart; without one, a run that was already seen finishing can only be a late answer.
			const lower = snapshotId < providerRefreshLastSeenId;
			const replay = !!refreshState.active && snapshotId <= providerRefreshDoneId;
			if (lower || replay) {
				const known = lower ? providerRefreshLastSeenStart : providerRefreshDoneStart;
				const restarted = startMs && known ? (lower ? startMs >= known : startMs > known) : (lower && snapshotId > providerRefreshDoneId);
				if (!restarted) return;
				providerRefreshLastSeenId = 0;
				providerRefreshLastSeenStart = 0;
				providerRefreshDoneId = 0;
				providerRefreshDoneStart = 0;
				// The tracked run died with the old process; the page's own "checking" text for it goes with it.
				delete button.dataset.refreshId;
			}
			providerRefreshLastSeenId = snapshotId;
			providerRefreshLastSeenStart = startMs;
			if (!refreshState.active && snapshotId >= providerRefreshDoneId) {
				providerRefreshDoneId = snapshotId;
				providerRefreshDoneStart = startMs;
			}
			// The page is still starting a run (saving paths, posting the request); its own handler owns the button until then.
			if (button.dataset.refreshStarting) return;
			let ownedId = Number(button.dataset.refreshId || 0);
			// A snapshot older than the run this page started is a late answer; ignore it.
			if (ownedId && snapshotId < ownedId) return;
			// A newer run that begins while this page's request is pending is the run that serves it (a queued re-detection).
			if (ownedId && refreshState.active && snapshotId > ownedId) {
				ownedId = snapshotId;
				button.dataset.refreshId = String(ownedId);
			}
			const owned = ownedId > 0;
			if (refreshState.active) {
				// Any active run, started here or not, keeps the button busy.
				button.disabled = true;
				button.textContent = 'Checking…';
				if (!owned && !button.dataset.refreshNotice) {
					// Remember what the message said so it can come back; the page's own wording is left alone for its own runs.
					// Its own "checking" text is not worth coming back to once the run it described is gone.
					const ownText = ownRefreshMessages.includes(message.textContent);
					button.dataset.refreshNotice = '1';
					button.dataset.refreshPriorMessage = ownText ? '' : (message.textContent || '');
					if (ownText) button.dataset.refreshPriorOwn = '1';
					message.textContent = foreignRefreshMessage;
				}
				return;
			}
			// Not active: whoever started the run, the button comes back (disabled only while the form has never loaded).
			clearInterval(providerRefreshPollTimer);
			providerRefreshPollTimer = null;
			button.disabled = !providerFormRendered;
			button.textContent = 'Refresh detection';
			const hadNotice = !!button.dataset.refreshNotice;
			const priorMessage = button.dataset.refreshPriorMessage || '';
			const priorOwn = !!button.dataset.refreshPriorOwn;
			delete button.dataset.refreshNotice;
			delete button.dataset.refreshPriorMessage;
			delete button.dataset.refreshPriorOwn;
			if (!owned) {
				// Only put the old text back if nothing else (a save result, an error) replaced the neutral one meanwhile. Whatever
				// happens, no "checking" text of the page's own stays up once a snapshot says the run is over.
				if (hadNotice && message.textContent === foreignRefreshMessage) message.textContent = priorOwn ? refreshCompletionText(refreshState) : priorMessage;
				else if (ownRefreshMessages.includes(message.textContent)) message.textContent = refreshCompletionText(refreshState);
				return;
			}
			delete button.dataset.refreshId;
			if (refreshState.error) {
				message.textContent = refreshCompletionText(refreshState);
				return;
			}
			message.textContent = refreshCompletionText(refreshState);
			loadRelaySettings({ keepMessage: true });
		}

		// Timer-driven: skipped while a status request is still pending, so a stalled status cannot pile up requests.
		function pollProviderRefresh() {
			refresh({ timer: true }).catch(() => {});
		}

		// True when an executable path in the form differs from the last loaded settings (or that cannot be told).
		function cliPathsEdited() {
			try {
				const baseline = JSON.parse(formSnapshots.relay);
				return JSON.stringify(baseline.cli_paths || {}) !== JSON.stringify(collectRelaySettingsPayload('relay').cli_paths || {});
			} catch (error) {
				return true;
			}
		}

		async function refreshProviderDetection() {
			if (fields.refreshRelayProviders.disabled) return;
			fields.refreshRelayProviders.disabled = true;
			fields.refreshRelayProviders.textContent = 'Checking…';
			// Status snapshots that arrive while the paths are saved and the request is posted must not release the button.
			fields.refreshRelayProviders.dataset.refreshStarting = '1';
			try {
				// Detection uses the executable paths, so edited paths are saved first - and only those: keys, routing and the rest
				// of the form stay unsaved until the user presses Save. Unchanged paths are not posted at all. An unloaded form is
				// never posted (it would wipe the saved paths and routing); detection itself can still be started.
				if (providerFormRendered && cliPathsEdited()) {
					fields.relaySettingsMessage.textContent = 'Saving executable paths…';
					const saved = await saveRelaySettings({ quiet: true, cliPathsOnly: true });
					if (!saved.success) throw new Error(saved.message || 'CLI path settings could not be saved');
					if (saved.refreshStarted) return;
				}
				fields.relaySettingsMessage.textContent = 'Starting provider detection…';
				const { response, payload } = await fetchJsonWithTimeout('/v1/relay/refresh', { method: 'POST' }, settingsPostTimeoutMs, 'Starting provider detection');
				if (!response.ok) throw new Error(payload.message || 'Detection refresh could not be started');
				const refreshState = payload.refresh || {};
				fields.refreshRelayProviders.dataset.refreshId = String(refreshState.id || '');
				fields.relaySettingsMessage.textContent = 'Checking providers in background…';
				clearInterval(providerRefreshPollTimer);
				providerRefreshPollTimer = setInterval(pollProviderRefresh, 1000);
				pollProviderRefresh();
			} catch (error) {
				fields.refreshRelayProviders.disabled = false;
				fields.refreshRelayProviders.textContent = 'Refresh detection';
				fields.relaySettingsMessage.textContent = 'Detection refresh failed: ' + (error.message || 'unknown error');
			} finally {
				delete fields.refreshRelayProviders.dataset.refreshStarting;
			}
		}

		// ---- Connectivity model ----
		// Every status answer (a poll's 2xx or 503 JSON, any live event) is a success; a failed or timed-out poll is a failure.
		// Nothing else decides what the topbar pill, the #updated label and the Relay pill say, or whether the last good
		// picture stays on screen: they all read connectionView().
		function recordStatusSuccess(source) {
			connectionState.lastGoodAt = Date.now();
			connectionState.lastSource = source === 'sse' ? 'sse' : 'poll';
			connectionState.failureCount = 0;
			connectionState.failureSince = 0;
			connectionState.lastError = '';
		}

		function recordStatusFailure(error) {
			if (!connectionState.failureCount) connectionState.failureSince = Date.now();
			connectionState.failureCount += 1;
			connectionState.lastError = String((error && error.message) || error || 'Status request failed');
		}

		// A failure becomes a hard error after statusFailureHardCount in a row with no success in between, or when the
		// streak has lasted statusFailureHardMs; a failure with nothing good to keep (and no live stream) is hard at once.
		// Until then the last good picture stays and the label says how old it is.
		function connectionView(now) {
			const state = connectionState;
			const at = state.lastGoodAt ? new Date(state.lastGoodAt).toLocaleTimeString() : '';
			if (state.failureCount > 0) {
				const streakMs = state.failureSince ? Math.max(0, Number(now) - state.failureSince) : 0;
				if (state.failureCount >= statusFailureHardCount || streakMs >= statusFailureHardMs || (!state.lastGoodAt && !state.sseLive)) {
					return { pill: 'unreachable', pillLabel: 'Relay unreachable', label: 'Relay unreachable' + (at ? ' — last update ' + at : ''), keepLastGood: false, hardError: true };
				}
				const delayed = 'Status delayed' + (at ? ' — last update ' + at : '');
				return { pill: 'delayed', pillLabel: delayed, label: delayed, keepLastGood: true, hardError: false };
			}
			if (state.sseLive) {
				return { pill: 'connected', pillLabel: 'Connected', label: at ? 'Live updates on · updated ' + at : 'Live updates connected', keepLastGood: true, hardError: false };
			}
			const polled = at && state.lastSource === 'poll' ? 'Polled · updated ' + at : '';
			if (state.polling) {
				return { pill: 'polling', pillLabel: 'Polling fallback', label: polled || 'Live updates unavailable - polling', keepLastGood: true, hardError: false };
			}
			return { pill: 'connecting', pillLabel: 'Connecting', label: polled || (at ? 'Last update ' + at : 'Loading'), keepLastGood: true, hardError: false };
		}

		// The only writer of the topbar pill and the #updated label.
		function applyConnectionView() {
			const view = connectionView(Date.now());
			const pillStates = { connected: 'ok', polling: 'warn', delayed: 'warn', unreachable: 'error', connecting: 'warn' };
			setConnection(pillStates[view.pill] || 'warn', view.pillLabel);
			fields.updated.textContent = view.label;
			return view;
		}

		// "The Relay answered" for the Relay pill and the health cards.
		function statusReachable() {
			return !connectionView(Date.now()).hardError;
		}

		function reportRenderError(error, message) {
			console.error(message ? 'Status page live update error' : 'Status page error while rendering', error);
			if (fields.renderError) {
				fields.renderError.textContent = message || 'Status page error while rendering — see console';
				fields.renderError.hidden = false;
			}
		}

		function clearRenderError() {
			if (fields.renderError) fields.renderError.hidden = true;
		}

		// Runs render steps after connectivity was recorded: an exception in one is logged and shown as a small inline note
		// instead of being swallowed, never stops the other steps, and never changes what connectivity says.
		function guardedRender(...steps) {
			let failed = false;
			for (const step of steps) {
				try {
					step();
				} catch (error) {
					failed = true;
					reportRenderError(error);
				}
			}
			if (!failed && fields.renderError) fields.renderError.hidden = true;
			return !failed;
		}

		// One status request at a time. Timer-driven calls (options.timer) are skipped while one is pending; an explicit call
		// waits for it (whatever its outcome) and then reports a request that started after the explicit call was made.
		function refresh(options) {
			if (statusRefreshPending) {
				if (options && options.timer) return statusRefreshPending;
				return statusRefreshPending.catch(() => null).then(() => statusRefreshPending || refresh(options));
			}
			const run = refreshStatusOnce(options);
			const release = () => { if (statusRefreshPending === run) statusRefreshPending = null; };
			statusRefreshPending = run;
			run.then(release, release);
			return run;
		}

		// A failed or timed-out poll, or an HTTP error answer (payload): inside the tolerance the last good picture stays and
		// the provider-test tracker only hears "not fresh"; past it the page shows the error state.
		function handleStatusPollFailure(error, payload) {
			recordStatusFailure(error);
			const view = applyConnectionView();
			if (view.keepLastGood) {
				guardedRender(() => updateProviderTestProgress({ fresh: false }));
				return;
			}
			guardedRender(() => {
				if (payload) renderStatus(payload, false, { stale: !payload.jobs });
				else renderStatus({ success: false, message: error.message, jobs: {} }, false, { stale: true });
			});
		}

		async function refreshStatusOnce() {
			let response;
			let payload;
			let capabilitiesResult;
			try {
				const [statusResult, capabilities] = await Promise.all([
					fetchJsonWithTimeout(statusUrl, { cache: 'no-store' }, statusFetchTimeoutMs, 'Status request'),
					fetchJsonWithTimeout(capabilitiesUrl, { cache: 'no-store' }, statusFetchTimeoutMs, 'Capabilities request').catch(() => null),
				]);
				response = statusResult.response;
				payload = statusResult.payload;
				capabilitiesResult = capabilities;
				if (!payload || typeof payload !== 'object') throw new Error('Unexpected status response');
			} catch (error) {
				handleStatusPollFailure(error, null);
				return;
			}
			// The Relay answered. 503 is its "still checking Codex" answer and counts as healthy; any other non-2xx answer
			// (a 500 with a JSON body) is an error answer that shows the error state once it persists (at once if nothing
			// good is on screen).
			if (!(response.ok || response.status === 503)) {
				handleStatusPollFailure(new Error('Status request failed (HTTP ' + response.status + ')'), payload);
				return;
			}
			// Connectivity first, so an exception while rendering cannot freeze it.
			recordStatusSuccess('poll');
			applyConnectionView();
			guardedRender(
				() => renderStatus(payload, statusReachable(), { stale: !response.ok && !payload.jobs }),
				() => { if (capabilitiesResult && capabilitiesResult.response.ok) renderCapabilities(capabilitiesResult.payload); },
				() => retryRelaySettingsLoad(),
			);
		}

		function startFallbackPolling() {
			connectionState.polling = true;
			applyConnectionView();
			if (fallbackPollTimer) {
				return;
			}
			refresh();
			fallbackPollTimer = setInterval(() => refresh({ timer: true }), 5000);
		}

		function stopFallbackPolling() {
			connectionState.polling = false;
			if (!fallbackPollTimer) return;
			clearInterval(fallbackPollTimer);
			fallbackPollTimer = null;
		}

		// A live event is the Relay talking: it counts as a success before anything is rendered. A malformed event is not one.
		function handleLiveEvent(label, event, render) {
			markLiveEvent(label);
			let payload;
			try {
				payload = JSON.parse(event.data || '{}');
			} catch (error) {
				reportRenderError(error, 'Received an unreadable live update — see console');
				return;
			}
			recordStatusSuccess('sse');
			applyConnectionView();
			clearRenderError();
			guardedRender(() => render(payload));
		}

		// 2 s, 4 s, 8 s, 16 s, then 30 s between attempts.
		function nextJobEventsRetryDelay(current) {
			return Math.min(jobEventsRetryMaxMs, Math.max(jobEventsRetryMinMs, Number(current) || jobEventsRetryMinMs) * 2);
		}

		function scheduleJobEventsReconnect() {
			if (jobEventsRetryTimer || jobEvents) return;
			const delay = jobEventsRetryDelay;
			jobEventsRetryDelay = nextJobEventsRetryDelay(delay);
			jobEventsRetryTimer = setTimeout(() => {
				jobEventsRetryTimer = null;
				connectJobEvents();
			}, delay);
		}

		// Called by the 1 s ticker. A stream that is open but has delivered nothing (no event, no heartbeat) for longer than
		// jobEventsStallMs is stalled (the Relay stopped servicing it without closing it, so no error ever fires): drop it, poll,
		// and retry the stream with the usual backoff. The polls then decide Connected-less states (delayed / unreachable).
		function checkJobEventsStall() {
			if (!connectionState.sseLive || !jobEvents) return false;
			const lastSeen = Math.max(connectionState.lastGoodAt, connectionState.sseSince);
			if (Date.now() - lastSeen <= jobEventsStallMs) return false;
			const stalled = jobEvents;
			jobEvents = null;
			try { stalled.close(); } catch (error) { /* already closed */ }
			connectionState.sseLive = false;
			startFallbackPolling();
			scheduleJobEventsReconnect();
			applyConnectionView();
			return true;
		}

		// Opens the event stream. Only one EventSource exists at a time; when it drops, polling takes over and the stream is
		// retried with a growing delay until it opens again, which stops the polling.
		function connectJobEvents() {
			if (jobEventsRetryTimer) {
				clearTimeout(jobEventsRetryTimer);
				jobEventsRetryTimer = null;
			}
			if (jobEvents) return;
			if (!window.EventSource) {
				startFallbackPolling();
				return;
			}
			let source = null;
			try {
				source = new window.EventSource(jobEventsUrl);
			} catch (error) {
				connectionState.sseLive = false;
				startFallbackPolling();
				scheduleJobEventsReconnect();
				return;
			}
			jobEvents = source;
			const active = () => jobEvents === source;
			source.addEventListener('open', () => {
				if (!active()) return;
				connectionState.sseLive = true;
				connectionState.sseSince = Date.now();
				jobEventsRetryDelay = jobEventsRetryMinMs;
				stopFallbackPolling();
				applyConnectionView();
			});
			// A status event is the Relay talking, even while Codex is still being checked (success:false).
			source.addEventListener('status', (event) => {
				if (!active()) return;
				handleLiveEvent('Status', event, (payload) => renderStatus(payload, statusReachable()));
			});
			source.addEventListener('capabilities', (event) => {
				if (!active()) return;
				handleLiveEvent('Capabilities', event, (payload) => {
					renderCapabilities(payload);
					if (settingsLoaded) loadRelaySettings();
				});
			});
			source.addEventListener('jobs', (event) => {
				if (!active()) return;
				handleLiveEvent('Jobs', event, (payload) => renderJobs(payload));
			});
			source.addEventListener('heartbeat', () => {
				if (!active()) return;
				markLiveEvent('Heartbeat');
				recordStatusSuccess('sse');
				applyConnectionView();
				clearRenderError();
			});
			source.onerror = () => {
				if (!active()) return;
				source.close();
				jobEvents = null;
				connectionState.sseLive = false;
				startFallbackPolling();
				scheduleJobEventsReconnect();
			};
		}

		initTheme();
		initProviderTestTabs();
		initNav();
		initLiveFilters();
		initProviderChatTests();
		setInterval(tickElapsedCells, 1000);
		fields.rawStatusFilter.addEventListener('input', applyRawStatusFilter);
		// The raw JSON is only built while its disclosure is open.
		if (fields.rawStatusDetails) fields.rawStatusDetails.addEventListener('toggle', applyRawStatusFilter);
		// toggle does not bubble, so listen in the capture phase to remember which failure rows are expanded.
		if (fields.debugFailureList) {
			fields.debugFailureList.addEventListener('toggle', (event) => {
				const details = event.target;
				const id = details && details.getAttribute ? details.getAttribute('data-failure-id') : '';
				if (!id) return;
				if (details.open) debugFailureOpen.add(id);
				else debugFailureOpen.delete(id);
			}, true);
		}
		// Editing a validated field re-checks it once it shows an error and on blur; every edit refreshes the dirty state.
		function onRelaySettingsEdited(event, section, type) {
			const target = event && event.target;
			const validated = !!(target && target.getAttribute && target.getAttribute('data-field-key'));
			if (validated && (type === 'change' || target.getAttribute('aria-invalid') === 'true')) {
				const result = validateRelaySection(section);
				if (!Object.keys(result.errors).length) setSaveBarText(section);
			} else if (type === 'input') {
				setSaveBarText(section);
			}
			updateSettingsDirtyState();
		}
		fields.relaySettingsForm.addEventListener('input', (event) => onRelaySettingsEdited(event, 'relay', 'input'));
		fields.relaySettingsForm.addEventListener('change', (event) => onRelaySettingsEdited(event, 'relay', 'change'));
		fields.providerSettings.addEventListener('click', (event) => {
			const toggle = event.target.closest('[data-provider-toggle]');
			if (toggle) {
				const card = toggle.closest('[data-provider-id]');
				setProviderCardOpen(card, toggle.getAttribute('aria-expanded') !== 'true');
				return;
			}
			const secretButton = event.target.closest('[data-secret-action]');
			if (secretButton) {
				event.preventDefault();
				applySecretAction(secretButton.getAttribute('data-secret-id'), secretButton.getAttribute('data-secret-action'), { focus: true });
				updateSettingsDirtyState();
			}
		});
		// Working inside a card keeps it open, even if its status later stops needing attention.
		fields.providerSettings.addEventListener('focusin', (event) => {
			const card = event.target.closest('[data-provider-id]');
			const id = card && card.getAttribute('data-provider-id');
			if (id && !providerCardOpen.has(id) && !event.target.closest('[data-provider-toggle]')) providerCardOpen.set(id, true);
		});
		if (fields.discardRelaySettings) fields.discardRelaySettings.addEventListener('click', () => discardRelaySection('relay'));
		if (fields.discardRuntimeSettings) fields.discardRuntimeSettings.addEventListener('click', () => discardRelaySection('runtime'));
		fields.musicAnalysisSettingsForm.addEventListener('input', () => {
			fields.musicAnalysisSettingsMessage.textContent = 'Unsaved changes';
			updateSettingsDirtyState();
		});
		fields.musicAnalysisSettingsForm.addEventListener('change', updateSettingsDirtyState);
		fields.upscaleSettingsForm.addEventListener('input', () => {
			fields.upscaleSettingsMessage.textContent = 'Unsaved changes';
			updateSettingsDirtyState();
		});
		fields.upscaleSettingsForm.addEventListener('change', updateSettingsDirtyState);
		fields.imageSettingsForm.addEventListener('input', () => {
			fields.imageSettingsMessage.textContent = 'Unsaved changes';
			updateSettingsDirtyState();
		});
		fields.imageSettingsForm.addEventListener('change', updateSettingsDirtyState);
		fields.asrSettingsForm.addEventListener('submit', (event) => {
			event.preventDefault();
			saveAsrSettings();
		});
		fields.asrSettingsForm.addEventListener('input', (event) => {
			if (event.target === fields.asrSettingsJson) {
				fields.asrSettingsMessage.textContent = 'JSON edited - apply or reload';
				return;
			}
			markAsrSettingsDirty();
		});
		fields.asrSettingsForm.addEventListener('change', (event) => {
			if (event.target !== fields.asrSettingsJson) {
				markAsrSettingsDirty();
			}
		});
		if (fields.discardAsrSettings) fields.discardAsrSettings.addEventListener('click', () => discardEngineSettings('asr'));
		if (fields.discardMusicAnalysisSettings) fields.discardMusicAnalysisSettings.addEventListener('click', () => discardEngineSettings('music'));
		if (fields.discardUpscaleSettings) fields.discardUpscaleSettings.addEventListener('click', () => discardEngineSettings('upscale'));
		if (fields.discardImageSettings) fields.discardImageSettings.addEventListener('click', () => discardEngineSettings('image'));
		fields.reloadAsrSettings.addEventListener('click', () => loadAsrSettings({ discardEdits: true }));
		fields.refreshAsrRuntime.addEventListener('click', () => loadAsrSettings({ refreshRuntime: true }));
		fields.saveAsrSettings.addEventListener('click', saveAsrSettings);
		fields.applyAsrSettingsJson.addEventListener('click', applyAsrSettingsJson);
		fields.addAsrModel.addEventListener('click', addAsrModel);
		fields.asrSettingsForm.addEventListener('click', (event) => {
			const button = event.target.closest('[data-install-asr-model]');
			if (!button || !fields.asrSettingsForm.contains(button)) return;
			event.preventDefault();
			setupAsrModel(button);
		});
		fields.musicAnalysisSettingsForm.addEventListener('submit', (event) => { event.preventDefault(); saveMusicAnalysisSettings(); });
		fields.reloadMusicAnalysisSettings.addEventListener('click', () => loadMusicAnalysisSettings({ discardEdits: true }));
		fields.refreshMusicAnalysisRuntime.addEventListener('click', () => loadMusicAnalysisSettings({ refreshRuntime: true }));
		fields.saveMusicAnalysisSettings.addEventListener('click', saveMusicAnalysisSettings);
		fields.setupMusicAnalysis.addEventListener('click', setupMusicAnalysis);
		fields.upscaleSettingsForm.addEventListener('submit', (event) => { event.preventDefault(); saveUpscaleSettings(); });
		fields.reloadUpscaleSettings.addEventListener('click', () => loadUpscaleSettings({ discardEdits: true }));
		fields.saveUpscaleSettings.addEventListener('click', saveUpscaleSettings);
		fields.upscaleInstallActions.addEventListener('click', (event) => {
			const button = event.target.closest('[data-upscale-install]');
			if (!button) return;
			const modelId = button.getAttribute('data-upscale-install');
			const restricted = fields.upscaleInstallActions.querySelector('[data-upscale-restricted="' + CSS.escape(modelId) + '"]');
			if (restricted && !restricted.checked) {
				fields.upscaleSettingsMessage.textContent = 'Confirm the APISR academic-only and GPL-3.0 restriction before installation.';
				return;
			}
			setupUpscale(modelId, button, !!(restricted && restricted.checked));
		});
		fields.imageSettingsForm.addEventListener('submit', (event) => { event.preventDefault(); saveImageSettings(); });
		fields.reloadImageSettings.addEventListener('click', () => loadImageSettings({ discardEdits: true }));
		fields.saveImageSettings.addEventListener('click', saveImageSettings);
		fields.setupImageEnvironment.addEventListener('click', () => setupImage({ button: fields.setupImageEnvironment, download_model: false }));
		fields.imageInstallActions.addEventListener('click', (event) => {
			const button = event.target.closest('[data-image-install]');
			if (!button) return;
			setupImage({ button, model: button.getAttribute('data-image-install'), download_model: true });
		});
		fields.persistentPairingCodeForm.addEventListener('submit', (event) => {
			event.preventDefault();
			saveFixedPairingCode();
		});
		fields.disableFixedPairingCode.addEventListener('click', disableFixedPairingCode);
		fields.relaySettingsForm.addEventListener('submit', (event) => { event.preventDefault(); saveRelaySettings(); });
		fields.saveRelaySettings.addEventListener('click', saveRelaySettings);
		if (fields.relayRuntimeSettings) {
			fields.relayRuntimeSettings.addEventListener('input', (event) => onRelaySettingsEdited(event, 'runtime', 'input'));
			fields.relayRuntimeSettings.addEventListener('change', (event) => onRelaySettingsEdited(event, 'runtime', 'change'));
		}
		if (fields.saveRelayRuntimeSettings) fields.saveRelayRuntimeSettings.addEventListener('click', () => saveRelaySettings({ section: 'runtime' }));
		fields.refreshRelayProviders.addEventListener('click', refreshProviderDetection);
		if (fields.reloadRelaySettings) fields.reloadRelaySettings.addEventListener('click', () => { loadRelaySettings({ manual: true }); });
		document.getElementById('claudeUsagePanel').addEventListener('click', (event) => {
			if (event.target.closest('[data-claude-usage-refresh]')) loadClaudeUsage({ force: true });
		});
		loadClaudeUsage({ force: false });
		setInterval(() => { if (!document.hidden) loadClaudeUsage({ force: false }); }, 5 * 60 * 1000);
		refresh().then(connectJobEvents).catch(() => {
			startFallbackPolling();
		});
