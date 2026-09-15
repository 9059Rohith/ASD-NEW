import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Check, PartyPopper, RefreshCw, RotateCcw } from 'lucide-react'
import VowelShell from '../components/layout/VowelShell'
import { TAMIL_KINDS, TAMIL_SECTIONS, itemsForTamilKind, normalizeTamilKind, sectionForTamilKind, tamilLengthLabel, tamilPracticeHref } from '../features/tamil/tamilLearning'
import { useTamilCatalog, useTamilProgress } from '../features/tamil/useTamilLearning'
import TamilLessonVisual from '../features/tamil/TamilLessonVisual'
import PippinStorybook from '../components/storybook/PippinStorybook'
import '../features/tamil/tamilLearning.css'
import '../features/tamil/tamilLearningPippin.css'

export default function TamilLearningPage() {
  const [params, setParams] = useSearchParams()
  const kind = normalizeTamilKind(params.get('kind'))
  const section = sectionForTamilKind(kind)
  const visibleKinds = TAMIL_KINDS.filter(item => sectionForTamilKind(item.id) === section)
  const category = TAMIL_KINDS.find(item => item.id === kind)
  const catalog = useTamilCatalog()
  const saved = useTamilProgress()
  const [showHints, setShowHints] = useState(false)
  const consonants = itemsForTamilKind(catalog.items, 'consonant')
  const requestedBase = params.get('base')
  const base = consonants.some(item => item.id === requestedBase) ? requestedBase : consonants[0]?.id
  const items = itemsForTamilKind(catalog.items, kind, kind === 'uyirmei' ? base : null)
  const selectKind = next => setParams({ kind: next })
  const selectBase = next => setParams({ kind: 'uyirmei', base: next })
  const tabKey = (event, index) => {
    let next
    if (event.key === 'ArrowRight') next = (index + 1) % visibleKinds.length
    if (event.key === 'ArrowLeft') next = (index + visibleKinds.length - 1) % visibleKinds.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = visibleKinds.length - 1
    if (next === undefined) return
    event.preventDefault()
    selectKind(visibleKinds[next].id)
    document.getElementById(`tamil-tab-${visibleKinds[next].id}`)?.focus()
  }
  const summary = saved.progress?.by_kind?.[kind]
  const completedItems = new Set(saved.progress?.completed_items || [])
  const masteredItems = new Set(saved.progress?.mastered_items || [])
  const masteryThreshold = saved.progress?.recognition_mastery_threshold ?? 3
  const dueReviews = (saved.progress?.review_due_items || [])
    .map(id => catalog.items.find(item => item.id === id)).filter(Boolean)
  const lessonComplete = Boolean(saved.progress?.lesson_total && saved.progress.completed_total === saved.progress.lesson_total)
  return <VowelShell className="tamil-world"><div className="tamil-learning-page">
    <header className="tamil-learning-intro"><div><p className="tamil-overline">தமிழ் பயிற்சி · LEARN TAMIL</p><h1 lang="ta">தமிழில் பழகலாம்.</h1><p lang="ta">ஓர் எழுத்து. ஒரு சொல். ஒரு சிறிய வாக்கியம்.<br />ஒவ்வொரு முயற்சியும் ஒரு புதிய தொடக்கம்.</p><p className="tamil-english-intro">Start with vowels, build consonant–vowel letters, then explore words and sentences.</p></div><div className="tamil-learning-pippin"><PippinStorybook transparent mood="idle" message="Pippin welcomes you to Tamil letters, words, and sentences." /></div></header>
    {lessonComplete && <section className="tamil-final-completion" aria-labelledby="tamil-complete-title"><PartyPopper aria-hidden="true" /><div><p>{saved.progress.lesson_total} lessons</p><h2 id="tamil-complete-title" lang="ta">தமிழ் பாடங்களை முடித்துவிட்டீர்கள்!</h2><span>You completed the available Tamil lessons.</span></div><Link className="tamil-button tamil-button-quiet" to="/tamil?kind=vowel"><RotateCcw size={17} /> Practice Again</Link></section>}
    <nav className="tamil-primary-sections" aria-label="Tamil training sections">{TAMIL_SECTIONS.map(item => <button key={item.id} type="button" aria-current={section === item.id ? 'page' : undefined} onClick={() => selectKind(item.firstKind)}><span lang="ta">{item.label}</span><strong>{item.english}</strong><small>{item.id === 'phonemes' ? '12 + 18 + 1 + 216' : item.id === 'words' ? 'Learn each word' : 'Speak in sentences'}</small></button>)}</nav>
    <div className="tamil-catalog-controls">{section === 'phonemes' && <div className="tamil-tabs" role="tablist" aria-label="Letter groups">{visibleKinds.map((item, index) => <button role="tab" id={`tamil-tab-${item.id}`} aria-controls="tamil-catalog-panel" aria-selected={kind === item.id} tabIndex={kind === item.id ? 0 : -1} key={item.id} onClick={() => selectKind(item.id)} onKeyDown={event => tabKey(event, index)}><em>Level {item.level}</em><span lang="ta">{item.label}</span><small>{item.english}</small></button>)}</div>}<label className="tamil-hint-toggle"><input type="checkbox" checked={showHints} onChange={event => setShowHints(event.target.checked)} /><span lang="ta">உச்சரிப்பு உதவி<small>Show pronunciation hints</small></span></label></div>
    <section id="tamil-catalog-panel" role={section === 'phonemes' ? 'tabpanel' : 'region'} aria-label={section === 'phonemes' ? undefined : category.english} aria-labelledby={section === 'phonemes' ? `tamil-tab-${kind}` : undefined} tabIndex={0} className="tamil-catalog-panel">
      <div className="tamil-category-heading"><div><p className="tamil-level-label">Level {category.level}</p><h2 lang="ta">{category.label}</h2><p lang="ta">{category.description}</p><p className="tamil-muted">{category.explanation}</p></div>{summary && <div className="tamil-kind-progress"><b>{summary.completed ?? 0}/{summary.total ?? category.total}</b><span lang="ta">முடித்தவை</span><small>Completed</small><progress aria-label={`${category.english} completed`} max={summary.total ?? category.total} value={summary.completed ?? 0} /></div>}</div>
      {summary?.total > 0 && summary.completed === summary.total && <div className="tamil-section-complete"><Check size={19} aria-hidden="true" /><span lang="ta">இந்த நிலை முடிந்தது!</span><b>{category.english} complete</b>{category.level < TAMIL_KINDS.length && <button className="tamil-text-button" onClick={() => selectKind(TAMIL_KINDS[category.level].id)}>Continue to Level {category.level + 1}<ArrowRight size={16} /></button>}</div>}
      {kind === 'vowel' && <p className="tamil-alphabet-note"><span lang="ta">12 உயிரெழுத்துகள் · 5 குறில் · 7 நெடில். ஐ, ஔ ஆகியவையும் நெடில் எழுத்துகள்.</span><small>In timed practice, voiced sound over 1.00 second is long; 1.00 second or less is short. Silence is excluded. ஐ and ஔ are vowel glides and use sound identity instead.</small></p>}
      {kind === 'aytham' && <p className="tamil-alphabet-note"><span lang="ta">12 உயிர் + 18 மெய் + 1 ஆய்தம் = 31 அடிப்படை எழுத்துகள்.</span><small>ஃ is a separate symbol. This lesson checks recognition and writing; pronunciation depends on context.</small></p>}
      {kind === 'uyirmei' && consonants.length > 0 && <div className="tamil-base-picker"><label htmlFor="tamil-base">மெய்யெழுத்தைத் தேர்ந்தெடுக்கவும் · Choose a consonant</label><select id="tamil-base" value={base} onChange={event => selectBase(event.target.value)}>{consonants.map(item => <option key={item.id} value={item.id}>{item.text} · {item.transliteration}</option>)}</select><span>12 combinations in this group · 216 altogether</span></div>}
      {catalog.loading ? <p className="tamil-loading" role="status">பயிற்சிகளைத் திறக்கிறோம்… Loading your Tamil examples…</p> : catalog.error ? <div className="tamil-notice" role="alert"><p>{catalog.error}</p><button className="tamil-button" onClick={catalog.retry}><RefreshCw size={17} /> மீண்டும் திறக்க · Retry</button></div> : items.length === 0 ? <p className="tamil-empty">இந்தப் பகுதியில் இன்னும் பயிற்சிகள் இல்லை. No examples are available in this category yet.</p> : <div className={`tamil-catalog-grid tamil-grid-${kind}`}>{items.map(item => <Link to={tamilPracticeHref(item)} className={`tamil-learning-card ${completedItems.has(item.id) ? 'is-complete' : ''} ${masteredItems.has(item.id) ? 'is-mastered' : ''}`} key={item.id} aria-label={`${item.text} — practise ${item.kind}`}><div className="tamil-card-meta">{item.length_label ? <span lang="ta">{tamilLengthLabel(item.length_label)}</span> : <BookOpen size={16} aria-hidden="true" />}{completedItems.has(item.id) ? <Check size={18} aria-label="Completed" /> : <ArrowRight size={18} aria-hidden="true" />}</div><TamilLessonVisual item={item} /><h3 lang="ta">{item.text}</h3>{masteredItems.has(item.id) && <span className="tamil-mastery-badge">Mastered</span>}{showHints && <p className="tamil-transliteration">{item.transliteration}</p>}{item.meaning && <p className="tamil-card-meaning">{item.meaning}</p>}<span className="tamil-card-action" lang="ta">{completedItems.has(item.id) ? 'மீண்டும் பழகலாம்' : 'பழகலாம்'}</span></Link>)}</div>}
    </section>
    {dueReviews.length > 0 && <section className="tamil-review-due" aria-labelledby="tamil-review-title">
      <div><p className="tamil-overline">REVISIT · மீள்பார்வை</p><h2 id="tamil-review-title">Ready for another look</h2><p>{dueReviews.length} saved {dueReviews.length === 1 ? 'lesson is' : 'lessons are'} due for review. A missed answer returns to this list immediately.</p></div>
      <ul>{dueReviews.slice(0, 6).map(item => <li key={item.id}><Link to={`/tamil/quiz/${encodeURIComponent(item.id)}`}><span lang="ta">{item.text}</span><span>Review <ArrowRight size={16} /></span></Link></li>)}</ul>
    </section>}
    <section className="tamil-saved-progress" aria-labelledby="tamil-progress-heading"><div><h2 id="tamil-progress-heading" lang="ta">உங்கள் முயற்சிகள்</h2><p>Saved learning and speech practice</p></div>{saved.loading ? <p role="status">Loading saved practice…</p> : saved.error ? <div className="tamil-progress-error"><p>Your practice history could not be loaded. You can still open a lesson.</p><button className="tamil-text-button" onClick={saved.refresh}>Retry history</button></div> : saved.progress && <><p className="tamil-mastery-note">Recognition mastery: {masteredItems.size} / {saved.progress.lesson_total ?? catalog.items.length} lessons ({masteryThreshold} correct answers per lesson).</p><dl className="tamil-progress-numbers"><div><dt>பதிவுகள் · Attempts</dt><dd>{saved.progress.total_attempts ?? 0}</dd></div><div><dt>அடையாளம் · Recognized</dt><dd>{saved.progress.recognition_correct ?? 0} / {saved.progress.recognition_attempts ?? 0}</dd></div><div><dt>ஒலி ஒப்பீட்டு சராசரி · Speech average</dt><dd>{Number.isFinite(saved.progress.average_score) ? `${Math.round(saved.progress.average_score)}%` : '—'}</dd></div></dl>{saved.progress.recent_attempts?.length > 0 ? <ul className="tamil-recent-attempts">{saved.progress.recent_attempts.slice(0, 5).map(attempt => <li key={attempt.id || attempt.request_id}><Link to={`/tamil/practice/${encodeURIComponent(attempt.item_id)}`} lang="ta">{attempt.text}<ArrowRight size={16} /></Link><span>{['catalog_recognition_v1', 'catalog_exercise_v1'].includes(attempt.score_method) ? attempt.correct ? 'Correct' : 'Review' : attempt.scorable === true && Number.isFinite(attempt.accuracy) ? `${Math.round(attempt.accuracy)} / 100` : 'Not scored'}</span></li>)}</ul> : <p className="tamil-empty" lang="ta">உங்கள் முதல் முயற்சியிலிருந்து தொடங்கலாம்.</p>}</>}<Link className="tamil-text-button" to="/progress">உயிரொலி பயிற்சியின் முன்னேற்றம் · Vowel Studio progress<ArrowRight size={17} /></Link></section>
  </div></VowelShell>
}
