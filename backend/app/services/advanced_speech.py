"""Advanced speech analysis: VTLN, DTW forced alignment, and syllable-level GOP.

This module implements the research components described in the project report:

* **VTLN** (Vocal Tract Length Normalization) — children have shorter vocal
  tracts and therefore higher formants. Without normalization an adult-trained
  acoustic model penalizes them unfairly. We apply a bilinear frequency warp to
  map child speech toward the adult acoustic space before feature extraction.

* **DTW forced alignment** — autistic / child speech is variably paced. We align
  the target phone sequence to the acoustic frames with a monotonic dynamic-time-
  warping DP over the CTC posteriorgram, instead of assuming fixed timing.

* **GOP** (Goodness of Pronunciation) — a reference-free per-phone confidence:
  the posterior probability that the intended phone was actually produced. We
  aggregate per-phone GOP into per-syllable scores so feedback can point at the
  exact syllable that needs work.

The pure-math helpers (warp, DTW, forced alignment, syllabify) have no ML
dependency and are unit-tested directly. The model-dependent entry point
(`syllable_gop`) degrades gracefully when transformers/torch is unavailable.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np


# --------------------------------------------------------------------------- #
# VTLN — bilinear frequency warping
# --------------------------------------------------------------------------- #
def bilinear_warp_freqs(freqs: np.ndarray, alpha: float) -> np.ndarray:
    """Bilinear frequency warp of normalized frequencies (0..1, 1 == Nyquist).

    alpha > 1 compresses the upper frequency range (child -> adult mapping);
    alpha == 1 is identity. Returns warped normalized frequencies in [0, 1].
    """
    if abs(alpha - 1.0) < 1e-6:
        return freqs.copy()
    omega = freqs * np.pi
    # standard bilinear (all-pass) warping curve
    warped = omega + 2.0 * np.arctan2(
        (1.0 - alpha) * np.sin(omega),
        1.0 - (1.0 - alpha) * np.cos(omega),
    )
    warped = warped / np.pi
    return np.clip(warped, 0.0, 1.0)


def apply_vtln(audio: np.ndarray, alpha: float = 1.15, n_fft: int = 512) -> np.ndarray:
    """Apply VTLN to a 16 kHz mono waveform via STFT magnitude warping.

    The warped magnitude spectrum is recombined with the original phase and
    inverted back to the time domain. Returns audio of the same length.
    """
    import librosa  # local import: keeps pure helpers import-light

    if audio.size == 0:
        return audio
    stft = librosa.stft(audio, n_fft=n_fft)
    mag, phase = np.abs(stft), np.angle(stft)
    n_bins = mag.shape[0]
    freqs = np.linspace(0.0, 1.0, n_bins)
    warped_axis = bilinear_warp_freqs(freqs, alpha)

    # Resample each frame's magnitude from the warped axis back onto the linear
    # axis so that energy at warped[f] lands at f.
    warped_mag = np.empty_like(mag)
    for t in range(mag.shape[1]):
        warped_mag[:, t] = np.interp(freqs, warped_axis, mag[:, t])

    warped_stft = warped_mag * np.exp(1j * phase)
    return librosa.istft(warped_stft, length=len(audio))


# --------------------------------------------------------------------------- #
# DTW distance between feature sequences
# --------------------------------------------------------------------------- #
def dtw_distance(seq_a: np.ndarray, seq_b: np.ndarray) -> float:
    """Length-normalized DTW distance between two (n_frames, n_features) seqs."""
    import librosa

    if seq_a.size == 0 or seq_b.size == 0:
        return float("inf")
    # librosa expects (features, frames)
    acc_cost, wp = librosa.sequence.dtw(X=seq_a.T, Y=seq_b.T, metric="euclidean")
    return float(acc_cost[-1, -1] / max(len(wp), 1))


# --------------------------------------------------------------------------- #
# Monotonic forced alignment over a posteriorgram (DTW-style DP)
# --------------------------------------------------------------------------- #
def forced_align_gop(
    log_probs: np.ndarray, token_ids: Sequence[int]
) -> List[float]:
    """Monotonically align a target token sequence to frames, return per-token GOP.

    Args:
        log_probs: (T, V) log-posteriors over the vocabulary per acoustic frame.
        token_ids: vocabulary indices of the intended phones, in order.

    Returns:
        Per-token GOP in [0, 1] (= exp of the aligned-frame log posterior),
        using a DP that requires each token to occupy a strictly later frame
        than the previous one (a monotonic DTW alignment).
    """
    T, _ = log_probs.shape
    n = len(token_ids)
    if n == 0 or T == 0:
        return []
    if n > T:
        # not enough frames to place every token monotonically
        return [float(np.exp(log_probs[:, tid].max())) for tid in token_ids]

    NEG = -1e18
    dp = np.full((n, T), NEG)
    back = np.full((n, T), -1, dtype=int)

    dp[0] = log_probs[:, token_ids[0]]
    for i in range(1, n):
        best_prev_val = NEG
        best_prev_idx = -1
        for t in range(T):
            if t - 1 >= 0 and dp[i - 1, t - 1] > best_prev_val:
                best_prev_val = dp[i - 1, t - 1]
                best_prev_idx = t - 1
            if best_prev_idx >= 0:
                dp[i, t] = best_prev_val + log_probs[t, token_ids[i]]
                back[i, t] = best_prev_idx

    # backtrack from the best final frame
    end_t = int(np.argmax(dp[n - 1]))
    frames = [0] * n
    frames[n - 1] = end_t
    for i in range(n - 1, 0, -1):
        frames[i - 1] = int(back[i, frames[i]])

    return [float(np.exp(log_probs[frames[i], token_ids[i]])) for i in range(n)]


# --------------------------------------------------------------------------- #
# Syllabification of romanized targets
# --------------------------------------------------------------------------- #
_VOWELS = set("aeiou")


def syllabify(roman: str) -> List[str]:
    """Very small CV-style syllabifier for romanized Tamil targets.

    'amma' -> ['am', 'ma'], 'appa' -> ['ap', 'pa'], 'la' -> ['la'],
    'a' -> ['a']. Good enough to attribute GOP to a child-recognizable chunk.
    """
    s = "".join(ch for ch in roman.lower() if ch.isalpha())
    if not s:
        return []
    syllables: List[str] = []
    cur = ""
    for ch in s:
        cur += ch
        if ch in _VOWELS:
            # peek: keep a trailing consonant with the current syllable when the
            # next char is also a consonant (closed syllable like 'am' in amma)
            syllables.append(cur)
            cur = ""
    if cur:
        if syllables:
            syllables[-1] += cur
        else:
            syllables.append(cur)
    # merge a doubled consonant boundary: 'a','mma' style won't occur here, but
    # close the previous syllable with the leading consonant of a geminate.
    return _balance_geminates(syllables, s)


def _balance_geminates(syllables: List[str], original: str) -> List[str]:
    """Move a leading doubled consonant so 'a'+'mma' becomes 'am'+'ma'."""
    out: List[str] = []
    for i, syl in enumerate(syllables):
        if (
            out
            and len(syl) >= 2
            and syl[0] not in _VOWELS
            and syl[0] == syl[1]
        ):
            out[-1] = out[-1] + syl[0]
            out.append(syl[1:])
        else:
            out.append(syl)
    return out


# --------------------------------------------------------------------------- #
# Model-dependent entry point
# --------------------------------------------------------------------------- #
def syllable_gop(
    audio: np.ndarray,
    target: str,
    model,
    processor,
    use_vtln: bool = True,
    vtln_alpha: float = 1.15,
) -> Optional[Dict]:
    """Compute per-syllable GOP for `target` from a Wav2Vec2 CTC model.

    Returns None if the model/processor are unavailable or the target maps to
    no in-vocabulary tokens. Otherwise returns:
        {
          "overall_gop": float 0..1,
          "syllables": [{"syllable": "am", "gop": 0.83}, ...],
          "weakest_syllable": "ma",
        }
    """
    if model is None or processor is None:
        return None

    import torch

    proc_audio = apply_vtln(audio, alpha=vtln_alpha) if use_vtln else audio
    # guard against numerical issues from warping
    if not np.all(np.isfinite(proc_audio)) or proc_audio.size == 0:
        proc_audio = audio

    input_values = processor(
        proc_audio, sampling_rate=16000, return_tensors="pt", padding=True
    ).input_values
    with torch.no_grad():
        logits = model(input_values).logits[0]  # (T, V)
    log_probs = torch.log_softmax(logits, dim=-1).cpu().numpy()

    vocab = processor.tokenizer.get_vocab()  # token string -> id

    syllables = syllabify(target)
    if not syllables:
        return None

    syllable_scores: List[Dict] = []
    for syl in syllables:
        token_ids = [vocab[c.upper()] for c in syl if c.upper() in vocab]
        if not token_ids:
            continue
        per_token = forced_align_gop(log_probs, token_ids)
        syl_gop = float(np.mean(per_token)) if per_token else 0.0
        syllable_scores.append({"syllable": syl, "gop": round(syl_gop, 3)})

    if not syllable_scores:
        return None

    overall = float(np.mean([s["gop"] for s in syllable_scores]))
    weakest = min(syllable_scores, key=lambda s: s["gop"])["syllable"]
    return {
        "overall_gop": round(overall, 3),
        "syllables": syllable_scores,
        "weakest_syllable": weakest,
    }
