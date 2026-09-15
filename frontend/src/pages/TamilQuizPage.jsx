import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import VowelShell from '../components/layout/VowelShell'
import TamilRecognitionQuiz from '../features/tamil/TamilRecognitionQuiz'
import { itemsForTamilKind, tamilPracticeHref } from '../features/tamil/tamilLearning'
import { useTamilCatalog } from '../features/tamil/useTamilLearning'
import '../features/tamil/tamilLearning.css'

export default function TamilQuizPage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const catalog = useTamilCatalog()
  const item = catalog.items.find(candidate => candidate.id === itemId)
  const peers = item ? itemsForTamilKind(catalog.items, item.kind) : []
  const next = peers[peers.findIndex(candidate => candidate.id === itemId) + 1]
  return <VowelShell footer={false} className="tamil-world"><div className="tamil-practice-page tamil-quiz-page">
    <Link className="tamil-text-button" to={item ? tamilPracticeHref(item) : '/tamil'}><ArrowLeft size={17} /> Back to lesson</Link>
    {catalog.loading ? <p className="tamil-loading" role="status">Loading recognition challenge…</p>
      : catalog.error ? <div className="tamil-notice" role="alert"><p>{catalog.error}</p><button className="tamil-button" onClick={catalog.retry}>Retry</button></div>
      : item ? <><p className="tamil-quiz-context">{item.kind === 'uyirmei' ? 'Combined letters' : item.kind.charAt(0).toUpperCase() + item.kind.slice(1)} · Recognition challenge</p><TamilRecognitionQuiz item={item} catalog={catalog.items} onNext={next ? () => navigate(tamilPracticeHref(next)) : null} />{!next && <Link className="tamil-text-button" to={`/tamil?kind=${item.kind}`}>Explore more {item.kind} lessons <ArrowRight size={17} /></Link>}</>
      : <div className="tamil-notice" role="alert"><p>This recognition challenge was not found.</p><Link className="tamil-button" to="/tamil">Open Tamil lessons</Link></div>}
  </div></VowelShell>
}
