#!/usr/bin/env python3
"""
faster-whisper transcription with word-level timestamps.

Usage:
  python3 transcribe_whisper.py <audio_or_video_path> <model> <device> <compute_type> <language>

Outputs JSON on stdout:
  {"language": "fr", "segments": [
     {"start": 0.0, "end": 3.2, "text": "...",
      "words": [{"start":0.0,"end":0.4,"text":"Bonjour","confidence":0.98}, ...]}
  ]}
"""
import sys
import json


def main() -> int:
    if len(sys.argv) < 6:
        print(json.dumps({"error": "usage: transcribe_whisper.py path model device compute_type language"}))
        return 2

    audio_path = sys.argv[1]
    model_name = sys.argv[2]
    device = sys.argv[3]
    compute_type = sys.argv[4]
    language = sys.argv[5]

    try:
        from faster_whisper import WhisperModel
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": f"faster-whisper not installed: {exc}"}))
        return 3

    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        segments_iter, info = model.transcribe(
            audio_path,
            language=None if language == "auto" else language,
            word_timestamps=True,
            vad_filter=True,
        )

        out_segments = []
        for seg in segments_iter:
            words = []
            if seg.words:
                for w in seg.words:
                    words.append(
                        {
                            "start": round(float(w.start or 0), 3),
                            "end": round(float(w.end or 0), 3),
                            "text": w.word.strip(),
                            "confidence": round(float(getattr(w, "probability", 0.0) or 0.0), 4),
                        }
                    )
            out_segments.append(
                {
                    "start": round(float(seg.start or 0), 3),
                    "end": round(float(seg.end or 0), 3),
                    "text": seg.text.strip(),
                    "words": words,
                }
            )

        print(json.dumps({"language": info.language, "segments": out_segments}, ensure_ascii=False))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
