from app.services.tamil_agents import run_learning_pipeline


def test_bounded_agents_recommend_due_item_and_never_invent_speech_score():
    progress = {'lesson_total': 265, 'completed_items': ['letter-a'],
                'mastered_items': ['letter-a'], 'review_due_items': ['word-amma'],
                'total_attempts': 3, 'game_total_attempts': 2, 'scored_attempts': 0,
                'average_score': None, 'by_game': {'letter-match': {'attempts': 2, 'accuracy': 100}}}
    result = run_learning_pipeline(progress, report_config={'enabled': True, 'consent': True},
                                   delivery_provider_ready=False)
    assert result['practice']['due_item_ids'] == ('word-amma',)
    assert result['report']['next_step_item_id'] == 'word-amma'
    assert result['game']['recommended_game'] == 'find-letter'
    assert result['speech'] == {'scored_attempts': 0, 'measured_average': None, 'status': 'no_validated_score'}
    assert result['integration']['status'] == 'not_configured'
    assert result['trace_id']
