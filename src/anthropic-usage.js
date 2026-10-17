'use strict';

// Claude API (platform.claude.com) usage summary for the local status page.
//
// Anthropic does not expose the Console's prepaid credit balance through the API. What is
// available: month-to-date spend from the Admin cost report (needs an Admin API key), and the
// rate-limit headers returned on every Messages response. The remaining credit shown here is
// therefore an estimate: the balance the user copied from the dashboard minus the cost reported
// since that balance was saved.

const packageInfo = require('../package.json');

const ANTHROPIC_VERSION = '2023-06-01';
const USAGE_CACHE_MS = 60 * 1000;
const MAX_COST_PAGES = 15;
const RATE_LIMIT_HEADERS = [
	'requests-limit',
	'requests-remaining',
	'requests-reset',
	'tokens-limit',
	'tokens-remaining',
	'tokens-reset',
	'input-tokens-limit',
	'input-tokens-remaining',
	'input-tokens-reset',
	'output-tokens-limit',
	'output-tokens-remaining',
	'output-tokens-reset',
];

let lastRateLimits = null;

function recordRateLimitHeaders(headers, now = new Date()) {
	if (!headers || typeof headers.get !== 'function') return;
	const values = {};
	for (const name of RATE_LIMIT_HEADERS) {
		const value = headers.get(`anthropic-ratelimit-${name}`);
		if (value === null || value === undefined || value === '') continue;
		const key = name.replace(/-/g, '_');
		values[key] = /-reset$/.test(name) ? String(value) : Number(value);
	}
	if (!Object.keys(values).length) return;
	lastRateLimits = { ...values, observed_at: now.toISOString() };
}

function rateLimitSnapshot() {
	return lastRateLimits ? { ...lastRateLimits } : null;
}

function resetRateLimitSnapshot() {
	lastRateLimits = null;
}

function startOfUtcMonth(date) {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextUtcMonth(date) {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function startOfUtcDay(date) {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function centsToUsd(cents) {
	return Math.round(cents) / 100;
}

function parseUsd(value) {
	if (value === undefined || value === null || value === '') return null;
	const parsed = Number.parseFloat(String(value));
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function createAnthropicUsage(options = {}) {
	const fetchImpl = options.fetch || globalThis.fetch;
	const getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => ({});
	const now = typeof options.now === 'function' ? options.now : () => new Date();
	const cacheMs = Number.isFinite(options.cacheMs) ? options.cacheMs : USAGE_CACHE_MS;
	const timeoutMs = Number(options.timeoutMs || 30000);
	let cached = null;
	let inflight = null;

	async function fetchCostBuckets(config, startingAt, endingAt) {
		const base = String(config.base_url || 'https://api.anthropic.com').replace(/\/+$/, '').replace(/\/v1$/, '');
		const buckets = [];
		let page = '';
		for (let index = 0; index < MAX_COST_PAGES; index += 1) {
			const params = new URLSearchParams({
				starting_at: startingAt.toISOString(),
				ending_at: endingAt.toISOString(),
				bucket_width: '1d',
				limit: '31',
			});
			if (page) params.set('page', page);
			const response = await fetchImpl(`${base}/v1/organizations/cost_report?${params.toString()}`, {
				method: 'GET',
				headers: {
					'x-api-key': config.admin_api_key,
					'anthropic-version': ANTHROPIC_VERSION,
					'User-Agent': `AI-Model-Relay/${packageInfo.version}`,
				},
				signal: AbortSignal.timeout(timeoutMs),
			});
			let parsed = null;
			try { parsed = await response.json(); } catch (error) {}
			if (!response.ok) {
				const message = parsed && parsed.error && parsed.error.message || `Cost report request failed with HTTP ${response.status}.`;
				const error = new Error(String(message).split(config.admin_api_key).join('[redacted]'));
				error.status = response.status;
				throw error;
			}
			if (!parsed || !Array.isArray(parsed.data)) throw new Error('Cost report returned an unexpected response.');
			for (const bucket of parsed.data) buckets.push(bucket);
			if (!(parsed.has_more && parsed.next_page)) return buckets;
			page = String(parsed.next_page);
		}
		throw new Error('Cost report has more pages than Relay reads; save a newer credit balance.');
	}

	function sumCents(buckets, from) {
		const fromMs = from.getTime();
		let total = 0;
		for (const bucket of buckets) {
			const start = Date.parse(bucket && bucket.starting_at);
			if (!Number.isFinite(start) || start < fromMs) continue;
			for (const result of Array.isArray(bucket.results) ? bucket.results : []) {
				const amount = Number.parseFloat(result && result.amount);
				if (Number.isFinite(amount)) total += amount;
			}
		}
		return total;
	}

	async function build() {
		const config = getConfig() || {};
		const current = now();
		const monthStart = startOfUtcMonth(current);
		const resetsAt = startOfNextUtcMonth(current);
		const limitUsd = parseUsd(config.monthly_limit_usd);
		const balanceUsd = parseUsd(config.credit_balance_usd);
		const balanceAsOf = balanceUsd !== null && Number.isFinite(Date.parse(config.credit_balance_as_of)) ? new Date(Date.parse(config.credit_balance_as_of)) : null;
		const report = {
			success: true,
			provider: 'anthropic-api',
			dashboard_url: 'https://platform.claude.com/dashboard',
			configured: { api_key: !!config.api_key, admin_api_key: !!config.admin_api_key },
			month: {
				starting_at: monthStart.toISOString(),
				resets_at: resetsAt.toISOString(),
				spend_usd: null,
				limit_usd: limitUsd,
				remaining_usd: null,
			},
			credits: {
				balance_usd: balanceUsd,
				as_of: balanceAsOf ? balanceAsOf.toISOString() : '',
				spent_since_usd: null,
				remaining_usd: null,
				estimated: true,
			},
			rate_limits: rateLimitSnapshot(),
			fetched_at: current.toISOString(),
		};
		if (!config.admin_api_key) {
			report.cost_report = { available: false, reason: 'Add an Admin API key (sk-ant-admin…) to read month-to-date spend from the Cost API.' };
			return report;
		}
		if (typeof fetchImpl !== 'function') {
			report.cost_report = { available: false, reason: 'This Node runtime does not provide fetch.' };
			return report;
		}
		// The cost report snaps to whole UTC days, so a balance saved mid-day also subtracts that
		// day's earlier spend. That errs toward showing less remaining credit, never more.
		const balanceDay = balanceAsOf ? startOfUtcDay(balanceAsOf) : null;
		const from = balanceDay && balanceDay < monthStart ? balanceDay : monthStart;
		const until = new Date(startOfUtcDay(current).getTime() + 24 * 60 * 60 * 1000);
		try {
			const buckets = await fetchCostBuckets(config, from, until);
			const monthCents = sumCents(buckets, monthStart);
			report.month.spend_usd = centsToUsd(monthCents);
			if (limitUsd !== null) report.month.remaining_usd = Math.max(0, Math.round((limitUsd - report.month.spend_usd) * 100) / 100);
			if (balanceDay) {
				report.credits.spent_since_usd = centsToUsd(sumCents(buckets, balanceDay));
				report.credits.remaining_usd = Math.round((balanceUsd - report.credits.spent_since_usd) * 100) / 100;
			}
			report.cost_report = { available: true, note: 'Cost API data lags about 5 minutes and excludes Priority Tier.' };
		} catch (error) {
			report.cost_report = {
				available: false,
				status: error && error.status || null,
				reason: error && error.status === 401 || error && error.status === 403
					? 'The Admin API key was rejected. Usage and cost reports need an Admin API key from an organization (not an individual account).'
					: (error && error.message) || 'Cost report request failed.',
			};
		}
		return report;
	}

	async function report(opts = {}) {
		const fingerprint = JSON.stringify(getConfig() || {});
		const current = now().getTime();
		if (!opts.force && cached && cached.fingerprint === fingerprint && current - cached.at < cacheMs) {
			return { ...cached.value, rate_limits: rateLimitSnapshot(), cached: true };
		}
		if (inflight && inflight.fingerprint === fingerprint && !opts.force) return inflight.promise;
		const entry = { fingerprint, promise: null };
		entry.promise = build().then((value) => {
			if (JSON.stringify(getConfig() || {}) === fingerprint) cached = { fingerprint, at: now().getTime(), value };
			return value;
		}).finally(() => { if (inflight === entry) inflight = null; });
		inflight = entry;
		return entry.promise;
	}

	return { report };
}

module.exports = {
	ANTHROPIC_VERSION,
	createAnthropicUsage,
	rateLimitSnapshot,
	recordRateLimitHeaders,
	resetRateLimitSnapshot,
};
