"""Evidence-derived vowel rewards; recording failures never become scores."""
from collections import deque
import os

from ..curriculum import TAMIL_LESSONS

TARGETS = ('a', 'aa', 'i', 'ii', 'u', 'uu', 'e', 'ee', 'o', 'oo')
SUCCESS_THRESHOLD = float(os.getenv('VOWEL_SUCCESS_THRESHOLD', '50'))
CELEBRATION_THRESHOLD = float(os.getenv('VOWEL_CELEBRATION_THRESHOLD', '90'))
CATALOG = [dict(target_phoneme=lesson['phoneme'], identity=lesson['phoneme'][0].upper(),
                length='long' if len(lesson['phoneme']) == 2 else 'short',
                lesson_id=lesson['id'], symbol=lesson['symbol'], audio=f"/api/vowels/reference/{lesson['phoneme']}", tip=lesson['tip'])
           for lesson in TAMIL_LESSONS if lesson['phoneme'] in TARGETS]
BY_TARGET = {item['target_phoneme']: item for item in CATALOG}


def rewards(score, analysis=None):
    if score is None: return {'success': False, 'celebration': None, 'stars_earned': 0, 'xp_earned': 0}
    if isinstance(analysis, dict) and (analysis.get('identity_match') is False or analysis.get('length_match') is False):
        return {'success': False, 'celebration': None, 'stars_earned': 0, 'xp_earned': 2}
    success = score > SUCCESS_THRESHOLD
    stars = 3 if score >= CELEBRATION_THRESHOLD else 2 if score >= 75 else int(success)
    return {'success': success, 'celebration': 'perfect' if score == 100 else 'excellent' if score >= CELEBRATION_THRESHOLD else None,
            'stars_earned': stars, 'xp_earned': 50 if score == 100 else (10 + stars * 5) if success else 2}


class ProgressAccumulator:
    def __init__(self):
        self.total = self.scored = self.score_sum = self.current = self.longest = self.xp = self.stars = 0
        self.best = None
        self.listening_attempts = self.listening_correct = 0
        self.recent = deque(maxlen=20)
        self.classes = {target: {'scores': deque(maxlen=3), 'count': 0, 'sum': 0, 'best': None} for target in TARGETS}

    def add(self, row):
        self.total += 1
        if row.get('kind') == 'listening':
            self.listening_attempts += 1
            self.listening_correct += bool(row.get('correct'))
            return
        if not row.get('scorable') or row.get('accuracy') is None: return
        score = float(row['accuracy'])
        self.scored += 1; self.score_sum += score
        self.best = score if self.best is None else max(self.best, score)
        earned = rewards(score, row.get('vowel_analysis'))
        self.current = self.current + 1 if earned['success'] else 0
        self.longest = max(self.longest, self.current)
        self.xp += earned['xp_earned']; self.stars += earned['stars_earned']
        item = self.classes[row['target_phoneme']]
        item['count'] += 1; item['sum'] += score; item['scores'].append(score)
        item['best'] = score if item['best'] is None else max(item['best'], score)
        self.recent.append({key: row.get(key) for key in ('accuracy', 'target_phoneme', 'created_at')})

    def result(self, completed_sessions=0):
        per_vowel = []
        for target, stats in self.classes.items():
            per_vowel.append({**{k: BY_TARGET[target][k] for k in ('target_phoneme', 'identity', 'length')},
                              'attempts': stats['count'], 'average_score': round(stats['sum'] / stats['count'], 1) if stats['count'] else None,
                              'best_score': stats['best'], 'mastered': len(stats['scores']) == 3 and sum(stats['scores']) / 3 >= 80})
        mastered = sum(row['mastered'] for row in per_vowel)
        level = 'Vowel Master' if mastered == 10 else 'Confident Speaker' if mastered >= 6 else 'Learner' if mastered >= 3 else 'Explorer' if mastered else 'Beginner'
        badges = []
        if self.scored: badges.append({'id': 'first-voice', 'label': 'First voice'})
        for milestone in (2, 3, 5, 10):
            if self.longest >= milestone: badges.append({'id': f'streak-{milestone}', 'label': f'{milestone} successful sounds'})
        if mastered == 10: badges.append({'id': 'vowel-master', 'label': 'All ten vowels mastered'})
        if self.best == 100: badges.append({'id': 'perfect-sound', 'label': 'Perfect sound'})
        return {'total_attempts': self.total, 'scored_attempts': self.scored,
                'average_score': round(self.score_sum / self.scored, 1) if self.scored else None,
                'best_score': self.best, 'current_streak': self.current, 'longest_streak': self.longest,
                'xp': self.xp, 'stars': self.stars, 'level': level, 'badges': badges,
                'mastered_classes': mastered, 'total_classes': 10, 'per_vowel': per_vowel,
                'listening': {'attempts': self.listening_attempts, 'correct': self.listening_correct,
                              'accuracy': round(100 * self.listening_correct / self.listening_attempts, 1) if self.listening_attempts else None},
                'recent_scores': list(self.recent), 'completed_sessions': completed_sessions}


def build_progress(rows, completed_sessions=0):
    accumulator = ProgressAccumulator()
    for row in rows: accumulator.add(row)
    return accumulator.result(completed_sessions)


async def load_progress(db, user_id):
    """Mongo sorts evidence; Python keeps only ten class accumulators and 20 chart points."""
    cursor = await db.vowel_sessions.aggregate([
        {'$match': {'user_id': user_id}}, {'$unwind': '$attempts'},
        {'$replaceRoot': {'newRoot': '$attempts'}}, {'$sort': {'created_at': 1, 'id': 1}},
    ], allowDiskUse=True)
    accumulator = ProgressAccumulator()
    async for row in cursor: accumulator.add(row)
    completed = await db.vowel_sessions.count_documents({'user_id': user_id, 'status': 'completed'})
    return accumulator.result(completed)


def session_summary(session):
    latest = {}
    for attempt in session['attempts']:
        if attempt.get('scorable') or attempt.get('kind') == 'listening': latest[attempt['challenge_index']] = attempt
    results = [latest[index] for index in sorted(latest)]
    scores = [row['accuracy'] for row in results if row.get('scorable') and row.get('accuracy') is not None]
    scored_rows = [row for row in results if row.get('scorable') and row.get('accuracy') is not None]
    components = {}
    for key in ('identity', 'duration', 'pronunciation', 'consistency'):
        values = [row['score_components'][key] for row in scored_rows if isinstance(row.get('score_components', {}).get(key), (int, float))]
        components[key] = round(sum(values) / len(values), 1) if values else None
    strengths = [row['target_phoneme'] for row in scored_rows if row['accuracy'] >= 80]
    weaknesses = [row['target_phoneme'] for row in sorted(scored_rows, key=lambda row: row['accuracy']) if row['accuracy'] < 80]
    recommendations = [BY_TARGET[target]['tip'] for target in weaknesses[:3]]
    if scored_rows and not recommendations: recommendations = ['Practise each vowel again across separate sessions to build consistent mastery.']
    return {'challenge_count': len(results), 'average_score': round(sum(scores) / len(scores), 1) if scores else None,
            'best_score': max(scores) if scores else None,
            'successful_challenges': sum(bool(row.get('success', row.get('correct', False))) for row in results),
            'component_averages': components, 'strengths': strengths, 'weaknesses': weaknesses,
            'recommendations': recommendations, 'results': results}
