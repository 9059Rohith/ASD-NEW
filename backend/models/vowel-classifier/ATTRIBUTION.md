# Human vowel recordings and derived model

Revathi Arunachalam, Vijayakrishnan VK, Nandhakumar N and Akilan A (2025).
**Tamil vowels-speech database**, version 1. Mendeley Data.
https://doi.org/10.17632/2dnxmvm22k.1

Licensed under **Creative Commons Attribution 4.0 International**:
https://creativecommons.org/licenses/by/4.0/

The `references/` and `heldout/` WAV files are human speech extracted from this
dataset. Changes: individual repetitions segmented from continuous source WAVs;
mono/16 kHz resampling where needed; PCM16 encoding. Source file boundaries and
speaker provenance are recorded in the adjacent JSON manifests. Reference clips
use only training speakers; held-out clips use only test speakers.

The classifier artifact is derived from acoustic statistics of these recordings.
The authors have not endorsed this application. Do not remove this attribution
when redistributing the clips or the derived model. Evaluation and limitations
are documented in `docs/VOWEL_MODEL_REPORT.md` and `evaluation.json`.
