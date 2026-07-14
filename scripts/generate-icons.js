'use strict';

const fs = require('fs');
const path = require('path');

const faviconPath = path.join(__dirname, '..', 'assets', 'favicon.ico');

if (!fs.existsSync(faviconPath)) {
	throw new Error(`Required application favicon is missing: ${faviconPath}`);
}

process.stdout.write('Verified assets/favicon.ico for the app, installer, and tray.\n');
