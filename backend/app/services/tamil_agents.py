"""Bounded deterministic learning agents over validated, child-scoped evidence.

Each stage has one narrow input/output contract. No stage can send messages,
read another child's data, or invent an acoustic score.
"""
from dataclasses import asdict, dataclass
from typing import Any
from uuid import uuid4

from ..tamil_curriculum import TAMIL_CATALOG

GAME_ORDER = ('letter-match', 'find-letter', 'picture-word-match', 'listen-choose', 'word-builder')


@dataclass(frozen=True)
class LearningResult:
    mastered: int
    completed: int
    total: int
    next_item_id: str | None


@dataclass(frozen=True)
class PracticeResult:
    due_item_ids: tuple[str, ...]
    reason: str


@dataclass(frozen=True)
class GameResult:
    recommended_game: str
    reason: str


@dataclass(frozen=True)
class SpeechResult:
    scored_attempts: int
    measured_average: float | None
    status: str


@dataclass(frozen=True)
class AnalyticsResult:
    practice_attempts: int
    game_rounds: int
    mastered_items: int


@dataclass(frozen=True)
class ReportResult:
    educational_summary: str
    next_step_item_id: str | None


@dataclass(frozen=True)
class IntegrationResult:
    status: str
    reason: str


def learning_agent(progress: dict) -> LearningResult:
    mastered = set(progress.get('mastered_items') or [])
    completed = set(progress.get('completed_items') or [])
    next_item = next((item['id'] for item in TAMIL_CATALOG if item['id'] not in mastered), None)
    return LearningResult(len(mastered), len(completed), progress.get('lesson_total', len(TAMIL_CATALOG)), next_item)


def practice_agent(progress: dict) -> PracticeResult:
    due = tuple(item for item in progress.get('review_due_items', []) if item in {row['id'] for row in TAMIL_CATALOG})
    return PracticeResult(due[:10], 'A missed or scheduled item is due.' if due else 'No reviews are due yet.')


def game_agent(progress: dict) -> GameResult:
    by_game = progress.get('by_game') or {}
    candidate = min(GAME_ORDER, key=lambda game: (by_game.get(game, {}).get('attempts', 0),
                                                  by_game.get(game, {}).get('accuracy', 0),
                                                  GAME_ORDER.index(game)))
    return GameResult(candidate, 'Try a less-practised game based on saved rounds.')


def speech_agent(progress: dict) -> SpeechResult:
    count = progress.get('scored_attempts') or 0
    measured = progress.get('average_score') if count else None
    return SpeechResult(count, measured, 'measured' if count else 'no_validated_score')


def analytics_agent(progress: dict, learning: LearningResult) -> AnalyticsResult:
    return AnalyticsResult(progress.get('total_attempts') or 0,
                           progress.get('game_total_attempts') or 0, learning.mastered)


def report_agent(learning: LearningResult, practice: PracticeResult,
                 analytics: AnalyticsResult) -> ReportResult:
    next_item = practice.due_item_ids[0] if practice.due_item_ids else learning.next_item_id
    summary = (f"{analytics.practice_attempts} Tamil practice attempts and {analytics.game_rounds} "
               f"game rounds are saved; {learning.mastered} of {learning.total} items are mastered.")
    return ReportResult(summary, next_item)


def integration_agent(*, enabled: bool, consent: bool, provider_ready: bool) -> IntegrationResult:
    if not enabled or not consent:
        return IntegrationResult('disabled', 'Caregiver consent and enablement are required.')
    if not provider_ready:
        return IntegrationResult('not_configured', 'Provider credentials are missing.')
    return IntegrationResult('ready', 'A configured, consented channel may deliver a report.')


def run_learning_pipeline(progress: dict, *, report_config: dict | None = None,
                          delivery_provider_ready: bool = False) -> dict[str, Any]:
    trace_id = str(uuid4())
    learning = learning_agent(progress)
    practice = practice_agent(progress)
    game = game_agent(progress)
    speech = speech_agent(progress)
    analytics = analytics_agent(progress, learning)
    report = report_agent(learning, practice, analytics)
    config = report_config or {}
    integration = integration_agent(enabled=bool(config.get('enabled')),
                                    consent=bool(config.get('consent')),
                                    provider_ready=delivery_provider_ready)
    return {'trace_id': trace_id, 'version': 1,
            'learning': asdict(learning), 'practice': asdict(practice),
            'game': asdict(game), 'speech': asdict(speech),
            'analytics': asdict(analytics), 'report': asdict(report),
            'integration': asdict(integration)}
