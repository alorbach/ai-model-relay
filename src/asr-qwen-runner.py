import json
import os
import sys

import torch
from qwen_asr import Qwen3ASRModel, Qwen3ForcedAligner
from qwen_asr.inference.utils import SAMPLE_RATE, normalize_audios, split_audio_into_chunks


def first_result(results):
    if isinstance(results, (list, tuple)):
        return results[0] if results else None
    return results


def read_attr(obj, name, default=None):
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def normalize_language(language):
    language = (language or "").strip()
    if not language:
        return None
    if "-" in language:
        language = language.split("-", 1)[0]
    aliases = {
        "en": "English",
        "de": "German",
        "fr": "French",
        "es": "Spanish",
        "it": "Italian",
        "pt": "Portuguese",
        "nl": "Dutch",
        "sv": "Swedish",
        "da": "Danish",
        "fi": "Finnish",
        "pl": "Polish",
        "cs": "Czech",
        "el": "Greek",
        "hu": "Hungarian",
        "ro": "Romanian",
        "ru": "Russian",
        "uk": "Ukrainian",
        "zh": "Chinese",
        "ja": "Japanese",
        "ko": "Korean",
    }
    return aliases.get(language.lower(), language)


def collect_words_from_time_stamps(time_stamps):
    words = []
    if isinstance(time_stamps, dict):
        for key in ("word", "words", "items"):
            if isinstance(time_stamps.get(key), list):
                words.extend(collect_words_from_time_stamps(time_stamps.get(key)))
        return words
    nested_items = getattr(time_stamps, "items", None)
    if isinstance(nested_items, (list, tuple)):
        return collect_words_from_time_stamps(list(nested_items))
    if not isinstance(time_stamps, (list, tuple)):
        if not isinstance(time_stamps, (str, bytes)) and hasattr(time_stamps, "__iter__"):
            try:
                return collect_words_from_time_stamps(list(time_stamps))
            except TypeError:
                pass
        return words
    for item in time_stamps:
        if isinstance(item, list):
            words.extend(collect_words_from_time_stamps(item))
            continue
        nested_items = getattr(item, "items", None)
        if isinstance(nested_items, (list, tuple)):
            words.extend(collect_words_from_time_stamps(list(nested_items)))
            continue
        if isinstance(item, dict):
            text = item.get("word") or item.get("text") or item.get("segment") or item.get("token")
            start = item.get("start") if "start" in item else item.get("start_time")
            end = item.get("end") if "end" in item else item.get("end_time")
        else:
            text = getattr(item, "word", None) or getattr(item, "text", None) or getattr(item, "segment", None) or getattr(item, "token", None)
            start = getattr(item, "start", None)
            if start is None:
                start = getattr(item, "start_time", None)
            end = getattr(item, "end", None)
            if end is None:
                end = getattr(item, "end_time", None)
        text = (text or "").strip()
        if not text:
            continue
        try:
            start = float(start)
            end = float(end)
        except (TypeError, ValueError):
            continue
        words.append({"word": text, "start": start, "end": end})
    return words


def float_request(request, key, default):
    try:
        value = float(request.get(key) if request.get(key) is not None else default)
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


def offset_words(words, offset_sec):
    shifted = []
    for item in words:
        shifted.append({
            "word": item["word"],
            "start": round(float(item["start"]) + offset_sec, 3),
            "end": round(float(item["end"]) + offset_sec, 3),
        })
    return shifted


def sanitize_word_timings(words, max_word_duration):
    sanitized = []
    warnings = []
    for index, item in enumerate(words):
        word = dict(item)
        duration = float(word["end"]) - float(word["start"])
        if duration > max_word_duration:
            original_end = float(word["end"])
            word["end"] = round(float(word["start"]) + max_word_duration, 3)
            warnings.append({
                "word": word["word"],
                "start": round(float(word["start"]), 3),
                "original_end": round(original_end, 3),
                "capped_end": word["end"],
                "reason": "word_duration_exceeded",
            })
        if float(word["end"]) > float(word["start"]):
            sanitized.append(word)
    sanitized.sort(key=lambda item: (item["start"], item["end"]))
    return sanitized, warnings


def qwen_model_kwargs(request, dtype):
    device_map = request.get("device_map") or "cuda:0"
    kwargs = dict(
        dtype=dtype,
        device_map=device_map,
    )
    if device_map == "auto":
        try:
            gpu_free_mb = int(request.get("gpu_free_mb") or 0)
        except (TypeError, ValueError):
            gpu_free_mb = 0
        if gpu_free_mb > 0:
            # Leave headroom for audio tensors, generation cache, and the aligner model.
            kwargs["max_memory"] = {
                0: f"{max(1024, int(gpu_free_mb * 0.70))}MiB",
                "cpu": request.get("cpu_max_memory") or "48GiB",
            }
    return kwargs


def run_alignment(request, dtype):
    reference_text = (request.get("reference_text") or "").strip()
    if not reference_text:
        raise ValueError("reference_text is required for Qwen ForcedAligner mode")
    model = Qwen3ForcedAligner.from_pretrained(request["aligner_model"], **qwen_model_kwargs(request, dtype))
    result = model.align(
        audio=request["audio_path"],
        text=reference_text,
        language=normalize_language(request.get("language")),
    )
    words = collect_words_from_time_stamps(result)
    print(json.dumps({
        "text": reference_text,
        "words": words,
        "language": normalize_language(request.get("language")),
        "duration": None,
        "mode": "align",
    }, ensure_ascii=False))


def run_transcription(request, dtype):
    model_kwargs = dict(qwen_model_kwargs(request, dtype), **dict(
        max_inference_batch_size=1,
        max_new_tokens=int(request.get("max_new_tokens") or 4096),
    ))
    if request.get("aligner_model"):
        model_kwargs["forced_aligner"] = request["aligner_model"]
        model_kwargs["forced_aligner_kwargs"] = qwen_model_kwargs(request, dtype)
    model = Qwen3ASRModel.from_pretrained(request["model"], **model_kwargs)
    language_request = normalize_language(request.get("language"))
    qwen_chunk_seconds = float_request(request, "chunk_seconds", 30.0)
    max_word_duration = float_request(request, "max_word_duration_seconds", 12.0)
    wav = normalize_audios(request["audio_path"])[0]
    audio_chunks = split_audio_into_chunks(wav, SAMPLE_RATE, max_chunk_sec=qwen_chunk_seconds)
    audio_inputs = [(chunk_wav, SAMPLE_RATE) for chunk_wav, _offset in audio_chunks]
    languages = [language_request] * len(audio_inputs) if language_request else None
    results = model.transcribe(
        audio=audio_inputs,
        language=languages,
        return_time_stamps=True,
    )
    text_parts = []
    language = None
    words = []
    for result, (_chunk_wav, offset_sec) in zip(results, audio_chunks):
        chunk_text = (read_attr(result, "text", "") or "").strip()
        if chunk_text:
            text_parts.append(chunk_text)
        language = language or read_attr(result, "language", None)
        time_stamps = read_attr(result, "time_stamps", None)
        if time_stamps is None:
            time_stamps = read_attr(result, "timestamps", None)
        words.extend(offset_words(collect_words_from_time_stamps(time_stamps), float(offset_sec)))
    words, timestamp_warnings = sanitize_word_timings(words, max_word_duration)
    text = " ".join(text_parts).strip()
    print(json.dumps({
        "text": text or " ".join(item["word"] for item in words),
        "words": words,
        "language": language,
        "duration": round(float(wav.shape[0]) / float(SAMPLE_RATE), 3) if getattr(wav, "shape", None) is not None else None,
        "mode": "transcribe",
        "chunk_seconds": qwen_chunk_seconds,
        "timestamp_warnings": timestamp_warnings,
    }, ensure_ascii=False))


def main():
    request = json.load(sys.stdin)
    allow_download = bool(request.get("allow_download"))
    if not allow_download:
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

    dtype = torch.bfloat16 if request.get("compute_type") == "bfloat16" else torch.float16
    if request.get("mode") == "align":
        run_alignment(request, dtype)
    else:
        run_transcription(request, dtype)


if __name__ == "__main__":
    main()
