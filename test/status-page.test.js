'use strict';

const assert = require('assert');
const { statusPageHtml } = require('../src/status-page');

const html = statusPageHtml();
assert.ok(html.includes('Unavailable saved selection:'));
assert.ok(html.includes('selected disabled'));
assert.ok(html.includes('backend.job_types.includes(jobType)'));
assert.ok(html.includes("backend.ready === true"));
assert.ok(html.includes('Refresh detection'));
assert.ok(html.includes('Provider media tests'));
assert.ok(html.includes("const relayTestUrl = '/v1/relay/test'"));
assert.ok(html.includes('await Promise.all([refresh().catch(() => {}), loadRelaySettings().catch(() => {})])'));
assert.ok(html.includes('data-provider-test'));
assert.ok(html.includes("(isVideo ? 'video' : 'image')"));
assert.ok(html.includes('Reference image (optional)'));
assert.ok(html.includes('test image editing or image-guided video'));

console.log('status page tests passed');
