"""Unit tests for the pure VTLN / DTW / GOP / syllable helpers."""
import numpy as np
import pytest

from app.services.advanced_speech import (
    bilinear_warp_freqs,
    dtw_distance,
    forced_align_gop,
    syllabify,
)


# ---- VTLN frequency warp ---------------------------------------------------
def test_warp_identity_when_alpha_one():
    freqs = np.linspace(0, 1, 257)
    out = bilinear_warp_freqs(freqs, 1.0)
    assert np.allclose(out, freqs)


def test_warp_endpoints_fixed():
    freqs = np.linspace(0, 1, 257)
    out = bilinear_warp_freqs(freqs, 1.2)
    # 0 and Nyquist map to themselves; interior shifts
    assert out[0] == pytest.approx(0.0, abs=1e-6)
    assert out[-1] == pytest.approx(1.0, abs=1e-6)
    assert not np.allclose(out, freqs)


def test_warp_stays_in_range():
    freqs = np.linspace(0, 1, 129)
    for alpha in (0.85, 1.1, 1.3):
        out = bilinear_warp_freqs(freqs, alpha)
        assert out.min() >= 0.0 and out.max() <= 1.0


# ---- DTW distance ----------------------------------------------------------
def test_dtw_identical_is_zero():
    seq = np.random.RandomState(0).randn(20, 13)
    assert dtw_distance(seq, seq) == pytest.approx(0.0, abs=1e-6)


def test_dtw_different_is_positive():
    rs = np.random.RandomState(1)
    a = rs.randn(20, 13)
    b = rs.randn(25, 13) + 5.0
    assert dtw_distance(a, b) > 0.0


def test_dtw_handles_empty():
    assert dtw_distance(np.empty((0, 13)), np.ones((5, 13))) == float("inf")


# ---- forced alignment GOP --------------------------------------------------
def _one_hot_logprobs(seq_token_ids, vocab_size, frames_per_token=3):
    """Build a clean posteriorgram where each token dominates its own frames."""
    T = len(seq_token_ids) * frames_per_token
    lp = np.full((T, vocab_size), -10.0)
    for i, tid in enumerate(seq_token_ids):
        for f in range(frames_per_token):
            lp[i * frames_per_token + f, tid] = np.log(0.95)
    return lp


def test_forced_align_perfect_sequence():
    ids = [1, 2, 3]
    lp = _one_hot_logprobs(ids, vocab_size=5)
    gops = forced_align_gop(lp, ids)
    assert len(gops) == 3
    assert all(g > 0.9 for g in gops)


def test_forced_align_penalizes_missing_token():
    # token 3 never appears strongly -> low GOP for it
    lp = _one_hot_logprobs([1, 2, 2], vocab_size=5)
    gops = forced_align_gop(lp, [1, 2, 3])
    assert gops[0] > 0.9 and gops[1] > 0.9
    assert gops[2] < 0.1


def test_forced_align_empty():
    assert forced_align_gop(np.zeros((4, 5)), []) == []


# ---- syllabification -------------------------------------------------------
@pytest.mark.parametrize(
    "word,expected",
    [
        ("a", ["a"]),
        ("la", ["la"]),
        ("ta", ["ta"]),
        ("amma", ["am", "ma"]),
        ("appa", ["ap", "pa"]),
    ],
)
def test_syllabify(word, expected):
    assert syllabify(word) == expected


def test_syllabify_ignores_nonalpha():
    assert syllabify(" a-m m a ") == ["am", "ma"]
