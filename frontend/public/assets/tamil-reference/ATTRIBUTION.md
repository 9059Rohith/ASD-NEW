# Tamil listening examples

The 18 word and sentence WAVs are computer-generated listening aids.
The 12 vowel WAVs are human recordings extracted from the dataset below.
None of these selected examples is an independent model accuracy benchmark.

## Synthetic words and sentences

The eight sentence examples were generated locally with Meta AI's [facebook/mms-tts-tam](https://huggingface.co/facebook/mms-tts-tam),
revision `e9cf59dae34f0f51e3b1842876a658e4516f9fe4`, using seed `20260906` and two CPU threads.
Model authors: Vineel Pratap et al., Meta AI.
Paper: [Scaling Speech Technology to 1,000+ Languages](https://arxiv.org/abs/2305.13516).
Model license: [Creative Commons Attribution-NonCommercial 4.0 International](https://creativecommons.org/licenses/by-nc/4.0/).
These project examples are supplied for noncommercial educational use with
attribution. No endorsement by Meta AI or the model authors is implied.

All ten word examples were regenerated with Microsoft Edge's online Tamil
speech service using the native Tamil voice `ta-IN-ValluvarNeural`, because the
older MMS word clips produced learner-facing consonant errors. Every word's
manifest entry records its exact Tamil synthesis text, provider, voice, audio
measurements, and file hash.

The project supplied the Tamil practice texts and synthesized mono 16 kHz PCM16
WAVs. Peak attenuation is applied only when needed to prevent clipping. No
user recording was used or transmitted. The manifest records exact text, input
tokens, dependency versions, duration, gain and SHA-256 for each output.

The model's vocabulary lacks standalone ஔ (U+0B94). Both diphthongs therefore
use human examples, without deleting or substituting the requested letter.
Synthetic speech may have pronunciation and prosody
limitations and is not a normative Tamil dialect reference.

## Human vowel recordings

Revathi Arunachalam, Vijayakrishnan VK, Nandhakumar N and Akilan A (2025).
[Tamil vowels-speech database, version 1](https://doi.org/10.17632/2dnxmvm22k.1).
Licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
The authors have not endorsed this application.

Changes: individual repetitions extracted from F943 source WAVs at energy
segmentation boundaries, encoded as mono 16 kHz PCM16.
These are training-speaker F943 clips. Source folder `i` is interpreted as ஐ
and `av` as ஔ; `e`/`ee` map to இ/ஈ and `eh`/`ehh` to எ/ஏ, consistent with the
existing label audit. Exact source hashes and sample/time boundaries are in the
manifest. A local ONNX spot-check heard /aɪ/ and /aʊ/ for the two diphthongs;
the latter had low token confidence (0.2237). The other ten clips are sourced
from corpus labels and are not independently validated pronunciation standards.
This spot-check supports example selection and does not establish universal
Tamil pronunciation or independent accuracy. No synthetic clip is substituted
for a human recording.

To regenerate: from `backend`, run `USE_TF=0 python scripts/generate_tamil_references.py`.
On PowerShell, set `$env:USE_TF='0'` first, then run the Python command.
To verify files without loading the model, append `--verify-only`.
