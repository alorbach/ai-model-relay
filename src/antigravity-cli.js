'use strict';

const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const DEFAULT_MAX_ARTIFACT_BYTES = 20 * 1024 * 1024;
const AUTHENTICATION_ERROR_PATTERN = /authentication required|not logged in|not authenticated|no auth credentials?|login required|please visit .*oauth|accounts\.google\.com\/o\/oauth2|sign[\s-]?in|unauthenticated/i;

function pathIsInside(parent, candidate) {
	const root = path.resolve(String(parent || ''));
	const target = path.resolve(String(candidate || ''));
	const comparableRoot = process.platform === 'win32' ? root.toLowerCase() : root;
	const comparableTarget = process.platform === 'win32' ? target.toLowerCase() : target;
	return comparableTarget === comparableRoot || comparableTarget.startsWith(`${comparableRoot}${path.sep}`);
}

function antigravityResultText(result) {
	const details = result && result.details && typeof result.details === 'object' ? result.details : {};
	const nested = result && result.result && typeof result.result === 'object' ? result.result : {};
	return [result && result.message, result && result.error, result && result.text, result && result.stdout, result && result.stderr, nested.message, nested.error, nested.text, nested.stdout, nested.stderr, details.message, details.error, details.text, details.stdout, details.stderr]
		.filter((value) => typeof value === 'string' && value.trim())
		.join('\n');
}

function isAntigravityAuthenticationError(resultOrText) {
	const output = typeof resultOrText === 'string' ? resultOrText : antigravityResultText(resultOrText);
	return AUTHENTICATION_ERROR_PATTERN.test(output);
}

function antigravityAuthenticationFailure() {
	return {
		success: false,
		category: 'configuration',
		code: 'antigravity_cli_not_authenticated',
		message: 'Antigravity CLI is not authenticated. Run agy interactively, sign in with the same Windows account, then retry.',
		retryable: true,
	};
}

function normalizeArtifactToken(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function stripQuotedPath(value) {
	const text = String(value || '').trim();
	if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) return text.slice(1, -1).trim();
	return text;
}

function findAntigravityImagePath(value, seen = new Set(), depth = 0) {
	if (typeof value === 'string') {
		if (depth < 3) {
			try {
				const parsed = JSON.parse(value);
				const nested = findAntigravityImagePath(parsed, seen, depth + 1);
				if (nested) return nested;
			} catch (error) {}
		}
		const marker = /(?:^|\r?\n)\s*IMAGE_PATH:\s*(.*?)(?:\r?\n|$)/im.exec(value);
		return marker ? { present: true, path: stripQuotedPath(marker[1]) } : null;
	}
	if (!value || typeof value !== 'object' || seen.has(value)) return null;
	seen.add(value);
	const pathKeys = ['image_path', 'imagePath', 'artifact_path', 'artifactPath', 'output_path', 'outputPath', 'file_path', 'filePath', 'path'];
	for (const key of pathKeys) {
		if (typeof value[key] === 'string' && value[key].trim()) return { present: true, path: stripQuotedPath(value[key]) };
	}
	const preferredKeys = ['text', 'stdout', 'stderr', 'response', 'result', 'output', 'content', 'message', 'details', 'data'];
	const keys = Array.isArray(value)
		? Object.keys(value)
		: [...preferredKeys, ...Object.keys(value).filter((key) => !preferredKeys.includes(key))];
	for (const key of keys) {
		const nested = findAntigravityImagePath(value[key], seen, depth);
		if (nested) return nested;
	}
	return null;
}

function imageFileInfo(target, roots, maxBytes) {
	const extension = path.extname(target).toLowerCase();
	if (!ANTIGRAVITY_IMAGE_EXTENSIONS.has(extension)) return { error: 'Antigravity image artifacts must be PNG, JPEG, or WebP files.' };
	let stat;
	try { stat = fs.statSync(target); } catch (error) { return { error: 'Antigravity image artifact does not point to an existing file.' }; }
	if (!stat.isFile()) return { error: 'Antigravity image artifact must point to a file.' };
	if (stat.size <= 0 || stat.size > maxBytes) return { error: 'Antigravity image artifact must be non-empty and no larger than 20 MB.' };
	try {
		const realTarget = fs.realpathSync(target);
		const realRoots = roots.map((root) => {
			try { return fs.realpathSync(root); } catch (error) { return ''; }
		}).filter(Boolean);
		if (!realRoots.some((root) => pathIsInside(root, realTarget))) return { error: 'Antigravity image artifact must point inside the Antigravity state root or request workspace.' };
	} catch (error) {
		return { error: 'Antigravity image artifact could not be validated.' };
	}
	return { path: target, size: stat.size, mtimeMs: stat.mtimeMs };
}

function createAntigravityImageArtifactResolver({ stateRoot, maxBytes = DEFAULT_MAX_ARTIFACT_BYTES, maxEntries = 5000, maxDepth = 8 } = {}) {
	const root = path.resolve(String(stateRoot || ''));

	function validatePath(candidate, workspace) {
		const raw = stripQuotedPath(candidate);
		if (!raw) return { error: 'Antigravity returned an empty image artifact path.' };
		const roots = [root, workspace].filter(Boolean).map((entry) => path.resolve(String(entry)));
		const candidates = path.isAbsolute(raw) ? [path.resolve(raw)] : roots.map((entry) => path.resolve(entry, raw));
		for (const target of candidates) {
			if (!roots.some((entry) => pathIsInside(entry, target))) continue;
			const info = imageFileInfo(target, roots, maxBytes);
			if (!info.error) return info;
		}
		return { error: 'Antigravity image artifact path must point to an existing PNG, JPEG, or WebP file inside the Antigravity state root or request workspace.' };
	}

	function findGeneratedImages(imageName, startedAt) {
		const found = [];
		if (!fs.existsSync(root)) return found;
		const requestToken = normalizeArtifactToken(imageName);
		let scanned = 0;
		const walk = (folder, depth) => {
			if (depth > maxDepth || scanned >= maxEntries) return;
			let entries;
			try { entries = fs.readdirSync(folder, { withFileTypes: true }); } catch (error) { return; }
			for (const entry of entries) {
				if (scanned >= maxEntries) return;
				scanned += 1;
				const target = path.resolve(folder, entry.name);
				if (target !== root && !pathIsInside(root, target)) continue;
				if (entry.isDirectory()) { walk(target, depth + 1); continue; }
				if (!entry.isFile()) continue;
				const extension = path.extname(entry.name).toLowerCase();
				if (!ANTIGRAVITY_IMAGE_EXTENSIONS.has(extension)) continue;
				const stemToken = normalizeArtifactToken(path.basename(entry.name, extension));
				if (stemToken !== requestToken && !stemToken.startsWith(`${requestToken}_`)) continue;
				const info = imageFileInfo(target, [root], maxBytes);
				if (!info.error && info.mtimeMs >= Number(startedAt || 0) - 5000 && info.mtimeMs <= Date.now() + 5000) found.push(info);
			}
		};
		walk(root, 0);
		return found.sort((left, right) => right.mtimeMs - left.mtimeMs);
	}

	return { findGeneratedImages, validatePath };
}

module.exports = {
	antigravityAuthenticationFailure,
	antigravityResultText,
	createAntigravityImageArtifactResolver,
	findAntigravityImagePath,
	isAntigravityAuthenticationError,
};
