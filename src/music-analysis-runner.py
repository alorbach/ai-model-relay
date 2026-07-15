#!/usr/bin/env python3
"""Private, deterministic feature extraction for AI Model Relay music analysis."""

import json
import math
import sys

import librosa
import numpy as np
import pyloudnorm as pyln


KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def finite(value, default=0.0):
    try:
        number = float(value)
        return number if math.isfinite(number) else default
    except (TypeError, ValueError):
        return default


def dbfs(value):
    return finite(20.0 * np.log10(max(float(value), 1e-12)))


def estimate_key(chroma):
    if chroma.size == 0:
        return {"tonic": "", "mode": "", "confidence": 0.0}
    vector = np.mean(chroma, axis=1)
    if not np.any(vector):
        return {"tonic": "", "mode": "", "confidence": 0.0}
    vector = (vector - np.mean(vector)) / (np.std(vector) + 1e-12)
    candidates = []
    for tonic in range(12):
        for mode, profile in (("major", MAJOR_PROFILE), ("minor", MINOR_PROFILE)):
            normalized = (np.roll(profile, tonic) - np.mean(profile)) / (np.std(profile) + 1e-12)
            candidates.append((finite(np.mean(vector * normalized)), tonic, mode))
    candidates.sort(reverse=True)
    best = candidates[0]
    runner_up = candidates[1] if len(candidates) > 1 else (0.0, 0, "")
    return {
        "tonic": KEYS[best[1]],
        "mode": best[2],
        "confidence": finite(max(0.0, min(1.0, (best[0] - runner_up[0]) / 2.0))),
    }


def section_boundaries(chroma, sr, hop_length, duration, maximum):
    if chroma.shape[1] < 8 or duration <= 0:
        return [{"start_seconds": 0.0, "end_seconds": duration}]
    target = max(2, min(int(maximum), max(2, int(round(duration / 30.0)))))
    try:
        boundaries = librosa.segment.agglomerative(chroma, k=target)
        times = librosa.frames_to_time(boundaries, sr=sr, hop_length=hop_length)
        values = [0.0] + [finite(item) for item in times if finite(item) > 0.0] + [duration]
    except Exception:
        values = [0.0, duration]
    cleaned = []
    for value in sorted(set(max(0.0, min(duration, item)) for item in values)):
        if not cleaned or value - cleaned[-1] >= 1.0:
            cleaned.append(value)
    if len(cleaned) < 2:
        cleaned = [0.0, duration]
    return [
        {"start_seconds": finite(cleaned[index]), "end_seconds": finite(cleaned[index + 1])}
        for index in range(len(cleaned) - 1)
        if cleaned[index + 1] > cleaned[index]
    ]


def analyze(request):
    audio_path = str(request.get("audio_path") or "")
    sample_rate = max(8000, min(96000, int(request.get("sample_rate") or 22050)))
    maximum_sections = max(2, min(24, int(request.get("max_sections") or 12)))
    if not audio_path:
        raise ValueError("audio_path is required")
    y, sr = librosa.load(audio_path, sr=sample_rate, mono=True)
    if y.size == 0:
        raise ValueError("audio contains no decodable samples")
    duration = finite(librosa.get_duration(y=y, sr=sr))
    if duration <= 0:
        raise ValueError("audio duration is zero")

    hop_length = 512
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop_length, trim=False)
    tempo_values = np.asarray(tempo).reshape(-1)
    bpm = finite(tempo_values[0] if tempo_values.size else 0.0)
    beat_grid = [finite(item) for item in librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)]

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop_length)[0]
    rms_db = 20.0 * np.log10(np.maximum(rms, 1e-12))
    peak = float(np.max(np.abs(y)))
    try:
        meter = pyln.Meter(sr)
        integrated_lufs = finite(meter.integrated_loudness(y)) if duration >= 0.4 else None
        loudness_range = finite(meter.loudness_range(y)) if duration >= 3.0 else None
    except Exception:
        integrated_lufs = None
        loudness_range = None

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length)
    flatness = librosa.feature.spectral_flatness(y=y, hop_length=hop_length)
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr, hop_length=hop_length)
    return {
        "duration_seconds": duration,
        "tempo": {"bpm": bpm},
        "beat_grid_seconds": beat_grid,
        "key": estimate_key(chroma),
        "loudness": {
            "integrated_lufs": integrated_lufs,
            "loudness_range_lu": loudness_range,
            "peak_dbfs": dbfs(peak),
            "rms_dbfs": finite(np.mean(rms_db)),
            "dynamic_range_db": finite(np.percentile(rms_db, 95) - np.percentile(rms_db, 10)),
        },
        "spectral": {
            "centroid_hz_mean": finite(np.mean(centroid)),
            "rolloff_hz_mean": finite(np.mean(rolloff)),
            "flatness_mean": finite(np.mean(flatness)),
            "contrast_db_mean": finite(np.mean(contrast)),
        },
        "sections": section_boundaries(chroma, sr, hop_length, duration, maximum_sections),
    }


def main():
    request = json.load(sys.stdin)
    print(json.dumps(analyze(request), ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
