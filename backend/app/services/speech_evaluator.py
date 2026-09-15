"""Compatibility import for the audio-derived phoneme evaluation service.

The retired English-letter/MFCC-template scorer is intentionally no longer
available: its outputs were not acoustic phoneme measurements.
"""
from .phoneme_pipeline import PhonemeEvaluator as SpeechEvaluator
from .phoneme_pipeline import phoneme_evaluator as speech_evaluator

__all__ = ['SpeechEvaluator', 'speech_evaluator']
