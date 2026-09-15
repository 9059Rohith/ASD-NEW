# Vowel Studio API

All endpoints require the existing session cookie or bearer token. The authenticated account owns every session; the client cannot submit scores or ownership. No audio is persisted.

- `GET /api/vowels/catalog`: `{vowels, modes, recording_seconds:7, success_threshold:50, celebration_threshold:90}`. Each vowel has `target_phoneme,identity,length,lesson_id,symbol,audio,tip`. Canonical targets are `a aa i ii u uu e ee o oo`; identity is uppercase A/E/I/O/U; length is short/long.
- `POST /api/vowels/sessions`: JSON `{mode,target_phoneme?}`. Modes: practice, evaluate, vowel-catch, short-or-long, match-sound, pippin-challenge, speed-round, vowel-tower. Returns `{id,session_id,mode,status,challenges,next_index,created_at}`. Challenges add zero-based `index`. Practice has one selected target (default a); other modes have ten server-shuffled challenges, one per class.
- `POST /api/vowels/analyze`: multipart `audio,target_phoneme,session_id,challenge_index,request_id?`. Use a fresh UUID for each new recording, and reuse it for network retries. Returns `{result,progress,session_id,next_index,already_saved}`. `result` contains model `accuracy,scorable,feedback,validation_status,vowel_analysis,score_components,score_method,model_version` plus `id,target_phoneme,challenge_index,success,celebration,stars_earned,xp_earned,created_at`. Accuracy is null for unscorable recordings. Success means strictly greater than 50; celebration means at least 90; perfect means 100. Debug features are only returned on explicit `debug=true` by an admin in development/test.
- Results advance `next_index` only when scorable. Practice and speaking games allow retrying the most recently scored challenge with a new request ID, until the next challenge has been attempted. Evaluation/speed-round accept one scorable result per class (a retry returns that existing result). Client Continue uses `next_index`; unscorable audio can always be retried. At most 40 recordings/answers per session.
- `POST /api/vowels/sessions/{id}/answer`: JSON `{challenge_index,identity,length,request_id?}` for Match Sound only. Returns the same envelope, with listening `result.correct`, `target_identity`, `target_length`, chosen `identity`/`length`, and no acoustic score. Listening attempts never enter pronunciation statistics or mastery.
- `POST /api/vowels/sessions/{id}/complete`: requires all challenges answered with scorable speech (or listening answer). Returns `{session,summary,progress}`. Completion is idempotent. Evaluation must contain ten distinct canonical classes in server order. Summary uses latest result per challenge and includes average_score, best_score, successful_challenges, challenge_count, results, component_averages (points for identity/duration/pronunciation/consistency), strengths and weaknesses (target arrays), and recommendations (guidance strings).
- `GET /api/vowels/sessions?limit=20&offset=0`: bounded history (limit 1–50, offset 0–10000), `{sessions:[session with summary]}`.
- `GET /api/vowels/progress`: `{total_attempts,scored_attempts,average_score,best_score,current_streak,longest_streak,xp,stars,level,badges:[{id,label}],mastered_classes,total_classes:10,per_vowel:[{target_phoneme,identity,length,attempts,average_score,best_score,mastered}],listening:{attempts,correct,accuracy},recent_scores:[{accuracy,target_phoneme,created_at}],completed_sessions}`. Empty average/best is null. Mastery requires at least three scored attempts and a last-three average >=80 for a class. Levels derive from mastered class count: 0 Beginner, 1 Explorer, 3 Learner, 6 Confident Speaker, 10 Vowel Master. Per-identity short/long data is in `per_vowel`; no random display counters.

Requests with forged/out-of-order challenges return 409 or 422, cross-owner sessions 404, closed sessions 409. Unsupported media 415, empty audio 400, uploads over 5 MiB (or a smaller configured max) 413. Model enforces decoded duration bounds. References use curriculum audio URLs; their serving/production is coordinated by application integration.


Educational points are the nearest integer of the summed 40/30/20/10 component
points, with halves rounded upward. Component precision and calibrated confidence
remain separate; 100 learning points does not mean 100% prediction certainty.
Perfect results earn 50 XP and the Perfect sound badge; excellent results normally
earn 25 XP. Invalid/unscorable recordings earn no points, stars or XP.

`GET /api/vowels/reference/{target}` serves the authenticated human reference WAV
for one of the ten canonical targets. Dataset attribution is linked in the studio
and at `/credits`. Account privacy export and processed deletion include the saved
`vowel_sessions` collection. Raw microphone recordings and developer features are
not stored in session evidence.
