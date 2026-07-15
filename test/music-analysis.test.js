'use strict';

const assert = require('assert');
const path = require('path');
const musicAnalysis = require('../src/music-analysis');
const packageInfo = require('../package.json');

(async () => {
	const sourceRunner = musicAnalysis.runnerPath('music-analysis-runner.py', path.join('D:', 'relay', 'src'));
	assert.strictEqual(sourceRunner, path.join('D:', 'relay', 'src', 'music-analysis-runner.py'));
	const packagedRunner = musicAnalysis.runnerPath('music-analysis-runner.py', path.join('C:', 'Program Files', 'AI Model Relay', 'resources', 'app.asar', 'src'));
	assert.strictEqual(packagedRunner, path.join('C:', 'Program Files', 'AI Model Relay', 'resources', 'app.asar.unpacked', 'src', 'music-analysis-runner.py'));
	assert.ok(packageInfo.build.asarUnpack.includes('src/music-analysis-runner.py'));

	const settings = musicAnalysis.normalizeSettings({ sample_rate: 192000, max_sections: 99, venv_path: ' D:\\music-venv ' });
	assert.strictEqual(settings.sample_rate, 96000);
	assert.strictEqual(settings.max_sections, 24);
	assert.strictEqual(settings.venv_path, 'D:\\music-venv');
	assert.strictEqual(musicAnalysis.decodeAudio(Buffer.from('audio').toString('base64')).toString(), 'audio');
	assert.strictEqual(musicAnalysis.decodeAudio('not base64%%%'), null);

	const output = musicAnalysis.normalizeRunnerOutput({
		duration_seconds: 12.5,
		tempo: { bpm: 123.4 },
		beat_grid_seconds: [0, 0.5, 1],
		key: { tonic: 'A', mode: 'minor', confidence: 0.75 },
		loudness: { integrated_lufs: -11.2, loudness_range_lu: 5.1, peak_dbfs: -0.1, rms_dbfs: -13, dynamic_range_db: 7 },
		spectral: { centroid_hz_mean: 1234, rolloff_hz_mean: 4321, flatness_mean: 0.12, contrast_db_mean: 17 },
		sections: [{ start_seconds: 0, end_seconds: 5 }, { start_seconds: 5, end_seconds: 12.5 }],
	});
	assert.strictEqual(output.tempo.bpm, 123.4);
	assert.strictEqual(output.key.tonic, 'A');
	assert.strictEqual(output.sections[0].label, 'section_01');
	assert.strictEqual(output.sections[1].end_seconds, 12.5);
	assert.strictEqual(musicAnalysis.normalizeRunnerOutput({ duration_seconds: 0 }), null);

	const invalidAudio = await musicAnalysis.analyze({ audio_base64: 'invalid%%%' });
	assert.strictEqual(invalidAudio.success, false);
	assert.strictEqual(invalidAudio.code, 'music_analysis_audio_invalid');

	console.log('music analysis tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
