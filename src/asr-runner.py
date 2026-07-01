import json
import sys

from faster_whisper import WhisperModel


def main():
    request = json.load(sys.stdin)
    model_kwargs = {
        "device": request.get("device") or "cpu",
        "compute_type": request.get("compute_type") or "int8",
        "cpu_threads": int(request.get("cpu_threads") or 4),
        "num_workers": int(request.get("num_workers") or 1),
        "local_files_only": not bool(request.get("allow_download")),
    }
    try:
        model = WhisperModel(request["model"], **model_kwargs)
    except TypeError as exc:
        if "local_files_only" not in str(exc):
            raise
        model_kwargs.pop("local_files_only", None)
        model = WhisperModel(request["model"], **model_kwargs)
    language = request.get("language") or None
    if language and "-" in language:
        language = language.split("-", 1)[0]
    segments, info = model.transcribe(
        request["audio_path"],
        language=language,
        beam_size=int(request.get("beam_size") or 5),
        best_of=int(request.get("best_of") or 5),
        vad_filter=bool(request.get("vad_filter")),
        condition_on_previous_text=bool(request.get("condition_on_previous_text", True)),
        word_timestamps=True,
    )
    words = []
    text_parts = []
    for segment in segments:
        text = (getattr(segment, "text", "") or "").strip()
        if text:
            text_parts.append(text)
        for item in getattr(segment, "words", None) or []:
            word = (getattr(item, "word", "") or "").strip()
            start = getattr(item, "start", None)
            end = getattr(item, "end", None)
            if word and start is not None and end is not None:
                words.append({"word": word, "start": float(start), "end": float(end)})
    print(json.dumps({
        "text": " ".join(text_parts).strip() or " ".join(item["word"] for item in words),
        "words": words,
        "language": getattr(info, "language", None),
        "language_probability": getattr(info, "language_probability", None),
        "duration": getattr(info, "duration", None),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
