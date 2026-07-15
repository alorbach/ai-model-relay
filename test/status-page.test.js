'use strict';

const assert = require('assert');
const { statusPageHtml } = require('../src/status-page');

const html = statusPageHtml();
assert.ok(html.includes('Unavailable saved selection:'));
assert.ok(html.includes('selected disabled'));
assert.ok(html.includes('backend.job_types.includes(jobType)'));
assert.ok(html.includes("backend.ready === true"));
assert.ok(html.includes('Refresh detection'));
assert.ok(html.includes('Provider media and audio tests'));
assert.ok(html.includes('Local Music Analysis Settings'));
assert.ok(html.includes("const musicAnalysisSettingsUrl = '/v1/music-analysis/settings'"));
assert.ok(html.includes('Selecting xAI Speech-to-Text uploads the chosen audio to xAI'));
assert.ok(html.includes("const relayTestUrl = '/v1/relay/test'"));
assert.ok(html.includes('await Promise.all([refresh().catch(() => {}), loadRelaySettings().catch(() => {})])'));
assert.ok(html.includes('data-provider-test'));
assert.ok(html.includes("const isAudio = jobType === 'transcribe' || jobType === 'music.analyze'"));
assert.ok(html.includes('Reference image (optional)'));
assert.ok(html.includes('data-test-audio'));
assert.ok(html.includes('Choose an audio file before running this test.'));
assert.ok(html.includes('<video src="'));
assert.ok(html.includes('controls preload="metadata" playsinline'));
assert.ok(html.includes('Grok CLI request'));
assert.ok(html.includes('Grok CLI stdout / stderr'));

console.log('status page tests passed');
