'use strict';

// The local status page is plain files under src/status-page/ (index.html, styles.css,
// app.js). They are read once at module load and inlined into a single HTML response, so
// the page needs no extra routes and no build step.

const fs = require('fs');
const path = require('path');
const { PRODUCT_NAME, LEGACY_PRODUCT_NAME } = require('./brand');

const PAGE_DIR = path.join(__dirname, 'status-page');

// CRLF is normalized to LF (as a JS template literal would) so a Windows checkout with
// core.autocrlf emits the same page as one with LF files.
function readPageFile(name) {
	return fs.readFileSync(path.join(PAGE_DIR, name), 'utf8').replace(/\r\n/g, '\n');
}

// styles.css and app.js end with a newline for editors; the template puts the closing tag
// on its own line, so drop exactly one trailing newline when inlining.
function inlineBody(text) {
	return text.endsWith('\n') ? text.slice(0, -1) : text;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

const INDEX_TEMPLATE = readPageFile('index.html');
const STYLES = inlineBody(readPageFile('styles.css'));
const SCRIPT = inlineBody(readPageFile('app.js'));

function statusPageHtml() {
	// Product names are substituted in the markup first, then the style/script bodies are
	// inlined, so placeholder-like text inside CSS or JS is never reinterpreted. Function
	// replacers keep `$&`-style sequences in the CSS/JS literal.
	return INDEX_TEMPLATE
		.replace(/\{\{PRODUCT_NAME\}\}/g, () => escapeHtml(PRODUCT_NAME))
		.replace(/\{\{LEGACY_PRODUCT_NAME\}\}/g, () => escapeHtml(LEGACY_PRODUCT_NAME))
		.replace('<!-- RELAY_STYLES -->', () => STYLES)
		.replace('<!-- RELAY_SCRIPT -->', () => SCRIPT);
}

module.exports = {
	statusPageHtml,
};
