'use strict';

const IMAGE_CAPABILITY_CONTRACT_VERSION = 1;
const DEFAULT_IMAGE_OUTPUT_FORMATS = Object.freeze(['image/png', 'image/jpeg', 'image/webp']);

function normalizeImageOutputFormat(value) {
	const format = String(value || 'image/png').trim().toLowerCase();
	return format === 'png' ? 'image/png' : (format === 'jpg' || format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : format);
}

function optionValues(testOptions, key) {
	const option = (Array.isArray(testOptions) ? testOptions : []).find((candidate) => candidate && candidate.key === key);
	return option ? (Array.isArray(option.choices) ? option.choices : []).map((choice) => String(choice && choice.value || '').trim()).filter((value) => value && value !== 'auto') : [];
}

function optionDelivery(testOptions, key, fallback = '') {
	const option = (Array.isArray(testOptions) ? testOptions : []).find((candidate) => candidate && candidate.key === key);
	if (!option) return fallback;
	if (key === 'aspect_ratio' && option.delivery === 'tool-arg') return 'native';
	if (option.delivery === 'direct') return 'native';
	return option.delivery || fallback;
}

function addProviderOption(providerOptions, key, values, delivery) {
	if (!key || !Array.isArray(values) || !values.length) return;
	providerOptions[key] = { type: 'enum', delivery, values: values.slice() };
}

function imageCapabilityContract(testOptions, options = {}) {
	const resolutionKey = options.resolutionKey || ['size', 'resolution', 'image_size'].find((key) => optionValues(testOptions, key).length) || '';
	const supportedSizes = optionValues(testOptions, resolutionKey);
	const supportedQualities = optionValues(testOptions, 'quality');
	const supportedAspectRatios = optionValues(testOptions, 'aspect_ratio');
	const resolutionDelivery = optionDelivery(testOptions, resolutionKey, 'guidance');
	const qualityDelivery = optionDelivery(testOptions, 'quality', '');
	const aspectRatioDelivery = optionDelivery(testOptions, 'aspect_ratio', '');
	const providerOptions = {};
	addProviderOption(providerOptions, resolutionKey, supportedSizes, resolutionDelivery);
	if (qualityDelivery === 'native') addProviderOption(providerOptions, 'quality', supportedQualities, qualityDelivery);
	if (aspectRatioDelivery === 'native') addProviderOption(providerOptions, 'aspect_ratio', supportedAspectRatios, aspectRatioDelivery);
	const supportedOutputFormats = Array.isArray(options.outputFormats) && options.outputFormats.length
		? options.outputFormats.map(normalizeImageOutputFormat)
		: DEFAULT_IMAGE_OUTPUT_FORMATS.slice();
	return {
		contract_version: IMAGE_CAPABILITY_CONTRACT_VERSION,
		async_jobs: true,
		provider_progress: false,
		preview_images: false,
		reference_images: Number(options.referenceImagesMax || 0) > 0,
		reference_images_max: Number(options.referenceImagesMax || 0),
		provider_cancel: false,
		candidate_count_max: Number(options.candidateCountMax || 1),
		supported_sizes: supportedSizes,
		resolution_mode: resolutionDelivery === 'native' ? 'native_scale' : 'guidance',
		resolution_options: supportedSizes.map((value, index) => ({ value, rank: index + 1, delivery: resolutionDelivery })),
		supported_qualities: supportedQualities,
		quality_delivery: qualityDelivery,
		supported_aspect_ratios: supportedAspectRatios,
		aspect_ratio_delivery: aspectRatioDelivery,
		supported_output_formats: supportedOutputFormats,
		provider_options: providerOptions,
		...(options.cloudUpload ? { cloud_upload: true } : {}),
	};
}

function nativeProviderOption(schema, key) {
	const option = schema && schema[key];
	return !!(option && option.type === 'enum' && Array.isArray(option.values) && option.values.length && (option.delivery === 'native' || option.delivery === 'native_scale'));
}

function canonicalChoice(value, choices) {
	const text = String(value == null ? '' : value).trim();
	if (!text) return '';
	const list = Array.isArray(choices) ? choices : [];
	const exact = list.find((candidate) => String(candidate) === text);
	if (exact !== undefined) return String(exact);
	const lower = text.toLowerCase();
	const insensitive = list.find((candidate) => String(candidate).toLowerCase() === lower);
	return insensitive === undefined ? '' : String(insensitive);
}

function isCompleteImageCapabilityContract(model) {
	if (!model || model.ready === false || model.type !== 'image') return false;
	const jobTypes = Array.isArray(model.job_types) ? model.job_types : [];
	if (!jobTypes.includes('images') || jobTypes.includes('chat')) return false;
	const capabilities = model.image_capabilities && typeof model.image_capabilities === 'object' ? model.image_capabilities : null;
	if (!capabilities || Number(capabilities.contract_version) !== IMAGE_CAPABILITY_CONTRACT_VERSION) return false;
	if (!Array.isArray(capabilities.supported_output_formats) || !capabilities.supported_output_formats.length) return false;
	if (!Number.isInteger(Number(capabilities.candidate_count_max)) || Number(capabilities.candidate_count_max) < 1) return false;
	const schema = capabilities.provider_options && typeof capabilities.provider_options === 'object' && !Array.isArray(capabilities.provider_options)
		? capabilities.provider_options
		: null;
	if (!schema || !Object.keys(schema).length) return false;
	const resolutionKey = ['size', 'resolution', 'image_size'].find((key) => schema[key]) || '';
	if (capabilities.resolution_mode === 'native_scale' && !nativeProviderOption(schema, resolutionKey)) return false;
	if (capabilities.aspect_ratio_delivery === 'native' && !nativeProviderOption(schema, 'aspect_ratio')) return false;
	if (capabilities.quality_delivery === 'native' && !nativeProviderOption(schema, 'quality')) return false;
	return true;
}

function relayCatalogEntrySupportsImages(catalog, entry) {
	if (!entry || entry.ready !== true || !Array.isArray(entry.job_types) || !entry.job_types.includes('images')) return false;
	const backends = Array.isArray(catalog && catalog.backends) ? catalog.backends : [];
	const backend = backends.find((item) => item && item.id === entry.backend);
	return !!(backend && backend.ready === true && Array.isArray(backend.job_types) && backend.job_types.includes('images'));
}

function findRelayImageModel(catalog, modelId) {
	const wanted = String(modelId || '').trim();
	if (!wanted) return null;
	const backends = Array.isArray(catalog && catalog.backends) ? catalog.backends : [];
	const entry = backends.find((item) => item && item.kind !== 'driver' && item.type === 'image' && (item.id === wanted || item.legacy_id === wanted));
	if (!isCompleteImageCapabilityContract(entry)) return null;
	return relayCatalogEntrySupportsImages(catalog, entry) ? entry : null;
}

function imageOptionsError(model, message = 'The requested image size, quality, aspect ratio, format, candidate count, or provider option is not supported by this Relay model.') {
	return {
		success: false,
		category: 'validation',
		code: 'relay_image_options_unsupported',
		message,
		details: { model: String(model || '').trim() },
	};
}

function normalizeImagePayloadForModel(payload, modelEntry) {
	const requested = payload && typeof payload === 'object' ? { ...payload } : {};
	const capabilities = modelEntry && modelEntry.image_capabilities && typeof modelEntry.image_capabilities === 'object' ? modelEntry.image_capabilities : null;
	if (!capabilities || Number(capabilities.contract_version) !== IMAGE_CAPABILITY_CONTRACT_VERSION) return { payload: requested };
	const model = modelEntry.id || modelEntry.legacy_id || '';
	const schema = capabilities.provider_options && typeof capabilities.provider_options === 'object' ? capabilities.provider_options : {};
	const nested = requested.provider_options && typeof requested.provider_options === 'object' && !Array.isArray(requested.provider_options) ? requested.provider_options : {};
	const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';
	const isAuto = (value) => /^auto$/i.test(String(value || '').trim());
	const providerKeys = Object.keys(schema);
	const nestedKeys = Object.keys(nested);
	if (requested.provider_options !== undefined && (typeof requested.provider_options !== 'object' || Array.isArray(requested.provider_options))) return { error: imageOptionsError(model, 'Relay provider_options must be an object matching the selected model capability contract.') };
	for (const key of nestedKeys) {
		const option = schema[key];
		const value = nested[key];
		if (!option || !option.values || !hasValue(value) || !['string', 'number', 'boolean'].includes(typeof value)) return { error: imageOptionsError(model, `The provider option ${key} is not supported by the selected Relay image model.`) };
		const text = String(value).trim();
		const canonical = canonicalChoice(text, option.values);
		if (!isAuto(value) && !canonical) return { error: imageOptionsError(model, `The provider option ${key} does not support ${text} for the selected Relay image model.`) };
		if (isAuto(value)) {
			continue;
		}
		if (hasValue(requested[key]) && !isAuto(requested[key]) && canonicalChoice(requested[key], option.values) !== canonical) return { error: imageOptionsError(model, `Conflicting values were supplied for the Relay image option ${key}.`) };
		requested[key] = canonical;
	}
	const resolutionKey = providerKeys.find((key) => ['size', 'resolution', 'image_size'].includes(key)) || '';
	const supportedSizes = Array.isArray(capabilities.supported_sizes) ? capabilities.supported_sizes.map((value) => String(value)) : [];
	const supportedQualities = Array.isArray(capabilities.supported_qualities) ? capabilities.supported_qualities.map((value) => String(value)) : [];
	const supportedRatios = Array.isArray(capabilities.supported_aspect_ratios) ? capabilities.supported_aspect_ratios.map((value) => String(value)) : [];
	const validateChoice = (value, choices) => !hasValue(value) || isAuto(value) || !!canonicalChoice(value, choices);
	if (resolutionKey !== 'size' && hasValue(requested.size) && !isAuto(requested.size)) {
		// Older Gateway clients sent their global pixel default alongside a
		// provider-native resolution option. Once the native option is present,
		// the generic size has no meaning and must not reach the driver.
		if (hasValue(requested[resolutionKey]) && !isAuto(requested[resolutionKey])) delete requested.size;
		else return { error: imageOptionsError(model, `Pixel size is not a supported option for the selected Relay image model; use ${resolutionKey}.`) };
	}
	if (!validateChoice(requested[resolutionKey] || requested.size, supportedSizes)) return { error: imageOptionsError(model, 'The requested resolution is not supported by the selected Relay image model.') };
	if (!supportedQualities.length && hasValue(requested.quality) && !isAuto(requested.quality)) return { error: imageOptionsError(model, 'The selected Relay image model does not support image quality selection.') };
	if (supportedQualities.length && !validateChoice(requested.quality, supportedQualities)) return { error: imageOptionsError(model, 'The requested image quality is not supported by the selected Relay image model.') };
	if (!supportedRatios.length && hasValue(requested.aspect_ratio) && !isAuto(requested.aspect_ratio)) return { error: imageOptionsError(model, 'The selected Relay image model does not support aspect-ratio selection.') };
	if (supportedRatios.length && !validateChoice(requested.aspect_ratio, supportedRatios)) return { error: imageOptionsError(model, 'The requested aspect ratio is not supported by the selected Relay image model.') };
	if (hasValue(requested[resolutionKey]) && !isAuto(requested[resolutionKey])) requested[resolutionKey] = canonicalChoice(requested[resolutionKey], supportedSizes);
	if (hasValue(requested.quality) && !isAuto(requested.quality)) requested.quality = canonicalChoice(requested.quality, supportedQualities);
	if (hasValue(requested.aspect_ratio) && !isAuto(requested.aspect_ratio)) requested.aspect_ratio = canonicalChoice(requested.aspect_ratio, supportedRatios);
	for (const key of ['quality', 'aspect_ratio']) if (isAuto(requested[key])) delete requested[key];
	const normalizedFormat = normalizeImageOutputFormat(requested.output_format);
	if (!Array.isArray(capabilities.supported_output_formats) || !capabilities.supported_output_formats.includes(normalizedFormat)) return { error: imageOptionsError(model, 'The requested image output format is not supported by the selected Relay image model.') };
	requested.output_format = normalizedFormat;
	const countValue = requested.candidate_count !== undefined ? requested.candidate_count : (requested.n !== undefined ? requested.n : 1);
	const count = Number(countValue);
	if (!Number.isInteger(count) || count < 1 || count > Number(capabilities.candidate_count_max || 0)) return { error: imageOptionsError(model, 'The requested image candidate count is not supported by the selected Relay image model.') };
	if (requested.candidate_count !== undefined) requested.candidate_count = count;
	// xAI uses n as the provider request field. Always set it from the
	// validated canonical count so candidate_count cannot be silently ignored
	// or contradicted by a second field.
	requested.n = count;
	const references = [requested.input_reference_data_url, requested.input_reference, ...(Array.isArray(requested.reference_images) ? requested.reference_images : []), ...(Array.isArray(requested.frames) ? requested.frames : [])].filter(Boolean);
	if (references.length > Number(capabilities.reference_images_max || 0)) return { error: imageOptionsError(model, 'The selected Relay image model does not support this number of reference images.') };
	if (capabilities.cloud_upload && requested.cloud_upload_confirmed !== true && !(requested.cloud_consent && requested.cloud_consent.confirmed === true)) return { error: imageOptionsError(model, 'Cloud-backed image generation requires explicit cloud upload consent.') };
	const allowedKeys = new Set([
		'model',
		'prompt',
		'size',
		'quality',
		'aspect_ratio',
		'output_format',
		'n',
		'candidate_count',
		'provider_options',
		'input_reference_data_url',
		'input_reference',
		'reference_images',
		'frames',
		'referenced_image_paths',
		'cloud_upload_confirmed',
		'cloud_consent',
		'metadata',
		...providerKeys,
	]);
	for (const key of Object.keys(requested)) {
		if (!allowedKeys.has(key)) delete requested[key];
	}
	return { payload: requested };
}

module.exports = {
	DEFAULT_IMAGE_OUTPUT_FORMATS,
	IMAGE_CAPABILITY_CONTRACT_VERSION,
	imageCapabilityContract,
	isCompleteImageCapabilityContract,
	findRelayImageModel,
	relayCatalogEntrySupportsImages,
	normalizeImageOutputFormat,
	normalizeImagePayloadForModel,
};
