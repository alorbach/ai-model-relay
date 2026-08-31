'use strict';

const JOB_MAX_TOKENS = Object.freeze({
	chat: 8192,
	'media.analyze': 4096,
});

const TINY_MAX_TOKENS_CEILING = 512;

function resolveMaxTokens(jobType, requested) {
	const defaultMaxTokens = Object.prototype.hasOwnProperty.call(JOB_MAX_TOKENS, jobType)
		? JOB_MAX_TOKENS[jobType]
		: JOB_MAX_TOKENS.chat;
	const numericRequested = typeof requested === 'number'
		? requested
		: typeof requested === 'string' && requested.trim() !== ''
			? Number(requested)
			: NaN;

	if (!Number.isFinite(numericRequested) || numericRequested < TINY_MAX_TOKENS_CEILING) {
		return defaultMaxTokens;
	}

	return Math.floor(numericRequested);
}

module.exports = {
	JOB_MAX_TOKENS,
	TINY_MAX_TOKENS_CEILING,
	resolveMaxTokens,
};
