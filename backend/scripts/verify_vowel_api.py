"""Run real HTTP/Mongo vowel integration checks against an isolated QA server.

Example (from backend):
  .runtime/Scripts/python.exe scripts/verify_vowel_api.py

Creates two disposable QA accounts through public registration. Passwords are
written only to the git-ignored *.log credential file, never into the report.
The ten representative held-out clips are a smoke test, not a population metric.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import io
import json
from pathlib import Path
import secrets
import sys
import time
import uuid
import wave

import httpx

ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT / 'backend/models/vowel-classifier'


def wav_bytes(frames: bytes, rate=16000):
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as target:
        target.setnchannels(1); target.setsampwidth(2); target.setframerate(rate)
        target.writeframes(frames)
    return buffer.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8001')
    parser.add_argument('--report', type=Path, default=ROOT / '.runlogs/vowel-api-integration.json')
    parser.add_argument('--credentials', type=Path, default=ROOT / '.runlogs/vowel-qa-credentials.log')
    args = parser.parse_args()
    if not args.base_url.startswith(('http://127.0.0.1:8001', 'http://localhost:8001')):
        raise SystemExit('This QA script is restricted to the isolated local port 8001.')
    if args.credentials.suffix != '.log':
        raise SystemExit('Credentials must use a git-ignored .log filename.')
    report = {'started_at': datetime.now(timezone.utc).isoformat(), 'base_url': args.base_url,
              'database': 'speakeasy_vowel_qa_20260906', 'checks': [], 'evaluations': [],
              'scope': 'Real HTTP, registered QA accounts, Mongo persistence, representative held-out human recordings. No API or model mocks. Not a new accuracy benchmark.'}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()

    def check(name, condition, **evidence):
        report['checks'].append({'name': name, 'passed': bool(condition), **evidence})
        if not condition: raise AssertionError(f'{name}: {evidence}')

    def request(client, method, path, expected=200, **kwargs):
        response = client.request(method, path, **kwargs)
        check(f'{method} {path} returns {expected}', response.status_code == expected,
              status=response.status_code, error=response.text[:500] if response.status_code != expected else None)
        return response

    def upload(client, session, index, data, request_id=None, target=None, expected=200):
        return request(client, 'POST', '/api/vowels/analyze', expected,
                       data={'session_id': session['id'], 'challenge_index': index,
                             'target_phoneme': target or session['challenges'][index]['target_phoneme'],
                             'request_id': request_id or str(uuid.uuid4())},
                       files={'audio': ('heldout.wav', data, 'audio/wav')})

    def make_session(client, mode, target='a'):
        return request(client, 'POST', '/api/vowels/sessions', 201,
                       json={'mode': mode, 'target_phoneme': target}).json()

    try:
        with httpx.Client(base_url=args.base_url, timeout=120) as public, \
             httpx.Client(base_url=args.base_url, timeout=120) as owner, \
             httpx.Client(base_url=args.base_url, timeout=120) as stranger:
            report['readiness'] = request(public, 'GET', '/health/ready').json()
            report['legacy_speech_health'] = request(public, 'GET', '/health/speech').json()
            report['vowel_health'] = request(public, 'GET', '/health/vowels').json()
            request(public, 'GET', '/api/vowels/catalog', 401)
            credentials = []
            for index, client in enumerate((owner, stranger)):
                password = 'Qa9!' + secrets.token_urlsafe(18)
                email = f'vowel-qa-{uuid.uuid4().hex[:14]}@example.com'
                credentials.append({'email': email, 'password': password})
                args.credentials.write_text(json.dumps({'base_url': args.base_url, 'accounts': credentials}, indent=2), encoding='utf8')
                registered = request(client, 'POST', '/api/auth/register', 201, json={
                    'email': email, 'password': password, 'confirm_password': password,
                    'full_name': 'Vowel QA Adult', 'child_name': 'QA Learner', 'child_age': 8, 'language': 'Tamil',
                }).json()
                login = request(client, 'POST', '/api/auth/login', json={'email': email, 'password': password}).json()
                client.headers['Authorization'] = 'Bearer ' + login['access_token']
                credentials[index]['user_id'] = registered['user']['id']
            args.credentials.write_text(json.dumps({'base_url': args.base_url, 'accounts': credentials}, indent=2), encoding='utf8')
            report['qa_user_ids'] = [row['user_id'] for row in credentials]
            print('QA accounts registered and authenticated.', flush=True)

            catalog = request(owner, 'GET', '/api/vowels/catalog').json()
            targets = {row['target_phoneme'] for row in catalog['vowels']}
            check('catalog has ten canonical classes', targets == {'a', 'aa', 'i', 'ii', 'u', 'uu', 'e', 'ee', 'o', 'oo'})
            check('capture contract is seven seconds', catalog['recording_seconds'] == 7)
            for vowel in catalog['vowels']:
                reference = request(owner, 'GET', vowel['audio'])
                with wave.open(io.BytesIO(reference.content)) as source:
                    check(f"{vowel['target_phoneme']} reference contains PCM audio", source.getnframes() > 0,
                          bytes=len(reference.content), frames=source.getnframes(), sample_rate=source.getframerate())
            request(public, 'GET', catalog['vowels'][0]['audio'], 401)
            empty = request(owner, 'GET', '/api/vowels/progress').json()
            check('new account has no fabricated progress', empty['total_attempts'] == 0 and empty['xp'] == 0 and empty['average_score'] is None)

            session = make_session(owner, 'evaluate')
            report['evaluation_session_id'] = session['id']
            check('evaluation server sequence has ten distinct classes', len(session['challenges']) == 10 and {row['target_phoneme'] for row in session['challenges']} == targets)
            first_target = session['challenges'][0]['target_phoneme']
            first_clip = (MODEL / 'heldout' / f'{first_target}.wav').read_bytes()
            upload(owner, session, 1, first_clip, expected=409)
            upload(owner, session, 0, first_clip, target='aa' if first_target != 'aa' else 'a', expected=422)
            upload(stranger, session, 0, first_clip, expected=404)
            request(owner, 'POST', f"/api/vowels/sessions/{session['id']}/complete", 409)
            current_streak = longest_streak = 0
            for challenge in session['challenges']:
                target = challenge['target_phoneme']; index = challenge['index']
                clip = (MODEL / 'heldout' / f'{target}.wav').read_bytes()
                response = upload(owner, session, index, clip, request_id=f'heldout-{index}').json()
                result = response['result']; analysis = result.get('vowel_analysis', {})
                report['evaluations'].append(result)
                check(f'{target} held-out recording is scorable', result['scorable'], validation_status=result.get('validation_status'))
                check(f'{target} identity and length are measured correctly', analysis.get('identity') == challenge['identity'] and analysis.get('length') == challenge['length'],
                      accuracy=result['accuracy'], identity=analysis.get('identity'), length=analysis.get('length'), duration_seconds=analysis.get('duration_seconds'))
                check(f'{target} response hides raw debug features', 'debug_features' not in result)
                current_streak = current_streak + 1 if result['accuracy'] > catalog['success_threshold'] else 0
                longest_streak = max(longest_streak, current_streak)
                check(f'{target} persisted counts and streak are exact', response['progress']['scored_attempts'] == index + 1 and response['progress']['current_streak'] == current_streak and response['progress']['longest_streak'] == longest_streak)
                print(f"Held-out {target}: {result['accuracy']}, {analysis.get('identity')} {analysis.get('length')}, saved {index + 1}/10", flush=True)
            complete = request(owner, 'POST', f"/api/vowels/sessions/{session['id']}/complete").json()
            report['evaluation_summary'] = complete['summary']; report['evaluation_progress'] = complete['progress']
            check('evaluation completion contains ten authoritative results', complete['summary']['challenge_count'] == 10 and complete['progress']['completed_sessions'] == 1)
            replay = upload(owner, session, 0, first_clip, request_id='heldout-0').json()
            check('replayed completed evaluation does not add rewards', replay['already_saved'] and replay['progress'] == complete['progress'])
            complete_again = request(owner, 'POST', f"/api/vowels/sessions/{session['id']}/complete").json()
            check('completion is idempotent', complete_again == complete)

            legacy = request(owner, 'GET', '/api/progress/user/me').json()
            profile = request(owner, 'GET', '/api/auth/me').json()
            check('legacy per-lesson counts are synchronized', len(legacy['progress']) == 10 and sum(row['attempts'] for row in legacy['progress']) == 10)
            check('legacy account totals match saved vowel evidence', profile['total_sessions'] == 10 and profile['total_stars'] == complete['progress']['stars'])
            legacy_report = request(owner, 'POST', '/api/reports/run', json={'name': 'Vowel QA accuracy', 'source': 'accuracy', 'group_by': 'phoneme'}).json()
            check('legacy report has all ten vowel scores', legacy_report['row_count'] == 10 and sum(row['count'] for row in legacy_report['rows']) == 10)
            report['legacy_report'] = legacy_report
            request(stranger, 'POST', f"/api/vowels/sessions/{session['id']}/complete", 404)
            foreign_progress = request(stranger, 'GET', '/api/vowels/progress').json()
            check('other account sees no owner progress', foreign_progress['scored_attempts'] == 0)

            listening = make_session(owner, 'match-sound')
            for challenge in listening['challenges']:
                request(owner, 'POST', f"/api/vowels/sessions/{listening['id']}/answer", json={
                    'challenge_index': challenge['index'], 'identity': challenge['identity'], 'length': challenge['length'],
                    'request_id': f"listening-{challenge['index']}",
                })
            listen_complete = request(owner, 'POST', f"/api/vowels/sessions/{listening['id']}/complete").json()
            check('listening is stored separately from acoustic scores', listen_complete['progress']['listening']['attempts'] == 10 and listen_complete['progress']['listening']['correct'] == 10 and listen_complete['progress']['scored_attempts'] == 10)
            check('listening does not change pronunciation mastery or streak', listen_complete['progress']['per_vowel'] == complete['progress']['per_vowel'] and listen_complete['progress']['current_streak'] == complete['progress']['current_streak'])

            wrong_length = make_session(owner, 'practice', 'aa')
            mismatch = upload(owner, wrong_length, 0, (MODEL / 'heldout/a.wav').read_bytes()).json()
            check('wrong-length evidence remains a mismatch', mismatch['result']['scorable'] and mismatch['result']['vowel_analysis']['identity_match'] and not mismatch['result']['vowel_analysis']['length_match'])
            legacy = request(owner, 'GET', '/api/progress/user/me').json()
            legacy_mismatch = next(row for row in legacy['recent_evaluations'] if row['_id'] == mismatch['result']['id'])
            check('wrong length cannot become legacy phoneme_match', legacy_mismatch['phoneme_match'] is False)

            silence_session = make_session(owner, 'practice')
            silence = upload(owner, silence_session, 0, wav_bytes(bytes(7 * 16000 * 2))).json()
            check('silence has no fabricated score and does not advance', not silence['result']['scorable'] and silence['result']['accuracy'] is None and silence['next_index'] == 0)
            check('silence earns no XP or stars', silence['result']['xp_earned'] == 0 and silence['result']['stars_earned'] == 0)
            too_long = upload(owner, silence_session, 0, wav_bytes(bytes(13 * 16000 * 2))).json()
            check('overlong decoded recording is unscorable', not too_long['result']['scorable'] and too_long['next_index'] == 0)
            upload(owner, silence_session, 0, bytes(5 * 1024 * 1024 + 1), expected=413)

            with wave.open(str(MODEL / 'heldout/a.wav'), 'rb') as source:
                rate = source.getframerate(); frames = source.readframes(source.getnframes())
            padded = wav_bytes(frames + bytes(max(0, 7 * rate * 2 - len(frames))), rate)
            padded_session = make_session(owner, 'practice')
            padded_result = upload(owner, padded_session, 0, padded).json()['result']
            report['padded_recording_result'] = padded_result
            raw_a = next(row for row in report['evaluations'] if row['target_phoneme'] == 'a')
            check('seven-second capture does not imply a long vowel', padded_result['scorable'] and padded_result['vowel_analysis']['length'] == 'short' and abs(padded_result['vowel_analysis']['duration_seconds'] - raw_a['vowel_analysis']['duration_seconds']) <= .06,
                  recording_seconds=padded_result.get('audio_quality', {}).get('duration_seconds'), vowel_seconds=padded_result['vowel_analysis']['duration_seconds'])

            final_progress = request(owner, 'GET', '/api/vowels/progress').json()
            report['final_progress'] = final_progress
            # Login through a separate connection to check saved state survives the
            # original HTTP client's lifetime/auth state rather than frontend state.
            with httpx.Client(base_url=args.base_url, timeout=120) as reopened:
                login = request(reopened, 'POST', '/api/auth/login', json={key: credentials[0][key] for key in ('email', 'password')}).json()
                reopened.headers['Authorization'] = 'Bearer ' + login['access_token']
                persisted = request(reopened, 'GET', '/api/vowels/progress').json()
                check('progress persists across a fresh authenticated connection', persisted == final_progress)
                history = request(reopened, 'GET', '/api/vowels/sessions?limit=2').json()
                check('history limit is honored', len(history['sessions']) == 2)
            print('HTTP evaluation, ownership, replay, reports, listening, duration, and persistence checks finished.', flush=True)
    except Exception as exc:
        report['error'] = f'{type(exc).__name__}: {exc}'
        print(report['error'], flush=True)
    finally:
        report['finished_at'] = datetime.now(timezone.utc).isoformat()
        report['elapsed_seconds'] = round(time.monotonic() - started, 2)
        report['checks_passed'] = sum(check['passed'] for check in report['checks'])
        report['checks_failed'] = sum(not check['passed'] for check in report['checks'])
        report['success'] = not report.get('error') and report['checks_failed'] == 0
        args.report.write_text(json.dumps(report, indent=2), encoding='utf8')
        print(json.dumps({key: report[key] for key in ('success', 'checks_passed', 'checks_failed', 'elapsed_seconds')}), flush=True)
    return 0 if report['success'] else 1


if __name__ == '__main__':
    sys.exit(main())
