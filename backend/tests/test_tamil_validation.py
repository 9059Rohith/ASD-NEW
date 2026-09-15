from app.services.tamil_validation import compare_tamil_text, normalize_tamil_text, normalize_written_tamil


def test_normalization_removes_only_harmless_spacing_and_punctuation():
    assert normalize_tamil_text('  அம்மா,  வீட்டில் இருக்கிறார்! ') == 'அம்மா வீட்டில் இருக்கிறார்'
    assert compare_tamil_text('அம்மா', 'அம்மா.', kind='word')['correct'] is True
    assert compare_tamil_text('அம்மா', 'அப்பா', kind='word')['correct'] is False


def test_sentence_spelling_variation_gets_partial_similarity_without_false_success():
    close = compare_tamil_text('நாய் ஓடுகிறது.', 'நாய் ஓடுகிரது', kind='sentence')
    wrong = compare_tamil_text('நாய் ஓடுகிறது.', 'அம்மா வீட்டில் இருக்கிறார்', kind='sentence')
    partial = compare_tamil_text('நாய் ஓடுகிறது.', 'நாய்', kind='sentence')
    assert close['correct'] is False and close['edit_distance'] == 1
    assert close['similarity'] >= .9
    assert wrong['correct'] is False
    assert partial['correct'] is False


def test_sentence_does_not_accept_a_different_catalog_word_with_similar_spelling():
    from app.tamil_curriculum import BY_ID

    target = BY_ID['sentence-amma-veettil']['text']
    different = target.replace(BY_ID['word-amma']['text'], BY_ID['word-appa']['text'])
    result = compare_tamil_text(target, different, kind='sentence')

    assert result['edit_distance'] == 2
    assert result['similarity'] > .9
    assert result['correct'] is False


def test_empty_or_non_tamil_recognition_is_never_correct():
    assert compare_tamil_text('மரம்', '', kind='word')['correct'] is False
    assert compare_tamil_text('மரம்', 'tree', kind='word')['correct'] is False


def test_written_tamil_comparison_preserves_word_boundaries_and_meaningful_letters():
    assert normalize_written_tamil(' அம்மா,  வா! ') == 'அம்மா வா'
    assert normalize_written_tamil('அம்மா வா') != normalize_written_tamil('அம்மாவா')
    assert normalize_written_tamil('கா') != normalize_written_tamil('க')


def test_speech_text_comparison_preserves_word_boundaries_and_rejects_non_tamil_suffixes():
    assert compare_tamil_text('அம்மா, வா.', 'அம்மா வா', kind='sentence')['correct'] is True
    assert compare_tamil_text('அம்மா, வா.', 'அம்மாவா', kind='sentence')['correct'] is False
    assert compare_tamil_text('அம்மா', 'அம்மா mother', kind='word')['correct'] is False
