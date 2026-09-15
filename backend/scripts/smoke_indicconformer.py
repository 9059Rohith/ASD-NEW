"""Run one real Tamil IndicConformer transcription from the command line."""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from typing import Callable

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.indicconformer import (  # noqa: E402
    IndicConformerService,
    IndicConformerUnavailable,
)


def run_smoke(
    audio_path: str | Path,
    model_path: str | Path,
    device: str,
    service_factory: Callable[..., IndicConformerService] = IndicConformerService,
) -> int:
    audio_path = Path(audio_path).expanduser().resolve()
    model_path = Path(model_path).expanduser().resolve()
    if not audio_path.is_file():
        print("ERROR: Audio file was not found.")
        return 1
    if not model_path.is_file():
        print("ERROR: IndicConformer checkpoint was not found.")
        return 1

    started = time.perf_counter()
    try:
        service = service_factory(
            model_path=model_path,
            enabled=True,
            device=device,
        )
        transcript = service.transcribe(audio_path.read_bytes())
    except IndicConformerUnavailable as exc:
        print(f"ERROR: {exc}")
        return 1
    except Exception:
        print("ERROR: IndicConformer smoke test failed.")
        return 1

    if not transcript:
        print("ERROR: The model returned an empty transcript.")
        return 1
    print("IndicConformer status: available")
    print(f"Elapsed seconds: {time.perf_counter() - started:.2f}")
    print(f"Transcript: {transcript}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio", required=True, help="Tamil WAV/audio sample")
    parser.add_argument(
        "--model",
        default=str(
            BACKEND_ROOT.parent
            / "indicconformer_stt_ta_hybrid_rnnt_large.nemo"
        ),
        help="Path to the Tamil .nemo checkpoint",
    )
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    args = parser.parse_args()
    return run_smoke(args.audio, args.model, args.device)


if __name__ == "__main__":
    raise SystemExit(main())
