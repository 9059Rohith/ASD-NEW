import { memo } from 'react'
import { getFeedbackProfile } from '../../features/feedback/feedbackPolicy'
import MothWings, { getRandomColor } from '../../features/home/MothWings'
import './feedback.css'

const PARTICLES = Object.freeze(Array.from({ length: 36 }, (_, index) => index))
const SMALL_PARTICLES = Object.freeze(PARTICLES.slice(0, 14))
const FLOATERS = Object.freeze(PARTICLES.slice(0, 8))
const BUTTERFLY_COLORS = Object.freeze(Array.from({ length: 4 }, getRandomColor))

function ParticleField({ name, symbols, count = 14 }) {
  return (
    <div className={`celebration-effect celebration-${name}`} data-effect={name} aria-hidden="true">
      {PARTICLES.slice(0, count).map((index) => (
        <i
          key={index}
          style={{
            '--i': index,
            '--x': `${(index * 37) % 100}%`,
            '--delay': `${(index % 9) * -0.18}s`,
            '--hue': `${(index * 47) % 360}`,
          }}
        >{symbols[index % symbols.length]}</i>
      ))}
    </div>
  )
}

function ButterflyField() {
  return (
    <div className="celebration-effect celebration-butterflies" data-effect="butterflies" aria-hidden="true">
      {FLOATERS.slice(0, 4).map((index) => (
        <span key={index} style={{ '--i': index, '--delay': `${index * -1.1}s` }}>
          <MothWings color={BUTTERFLY_COLORS[index]} />
        </span>
      ))}
    </div>
  )
}

function Rainbow() {
  return <div className="celebration-effect celebration-rainbow" data-effect="rainbow" aria-hidden="true"><span /><span /><span /><span /></div>
}

function Fireworks() {
  return (
    <div className="celebration-effect celebration-fireworks" data-effect="fireworks" aria-hidden="true">
      {[0, 1, 2].map((burst) => <span key={burst} style={{ '--burst': burst }}>{SMALL_PARTICLES.slice(0, 10).map((ray) => <i key={ray} style={{ '--ray': ray }} />)}</span>)}
    </div>
  )
}

function Trophy({ crown = false, coins = false }) {
  return (
    <div className="celebration-effect celebration-prize" data-effect="trophy" aria-hidden="true">
      {crown ? <span className="celebration-crown" data-effect="crown">♛</span> : null}
      <span className="celebration-trophy">🏆</span>
      {coins ? <span className="celebration-coins" data-effect="coins">✦ ✦ ✦</span> : null}
    </div>
  )
}

function CelebrationStage({ accuracy = 0, active = false, reducedMotion = false, className = '' }) {
  if (!active) return null
  const profile = getFeedbackProfile(accuracy, 0)
  const enabled = new Set(reducedMotion ? profile.effects.filter((effect) => ['sparkles', 'stars', 'gold', 'trophy', 'crown', 'coins'].includes(effect)) : profile.effects)
  return (
    <div
      className={`celebration-stage ${className}`}
      data-feedback-tier={profile.id}
      data-motion={reducedMotion ? 'reduced' : 'full'}
      aria-label={`${profile.heading} ${profile.message}`}
      role="img"
    >
      {enabled.has('rainbow') ? <Rainbow /> : null}
      {enabled.has('sparkles') ? <ParticleField name="sparkles" symbols={['✦', '·', '✧']} count={14} /> : null}
      {enabled.has('stars') ? <ParticleField name="stars" symbols={['★', '☆']} count={10} /> : null}
      {enabled.has('bubbles') ? <ParticleField name="bubbles" symbols={['○', '◌']} count={12} /> : null}
      {enabled.has('butterflies') ? <ButterflyField /> : null}
      {enabled.has('confetti') ? <ParticleField name="confetti" symbols={['▰', '●', '◆']} count={36} /> : null}
      {enabled.has('balloons') ? <ParticleField name="balloons" symbols={['●']} count={8} /> : null}
      {enabled.has('hearts') ? <ParticleField name="hearts" symbols={['♥']} count={8} /> : null}
      {enabled.has('flowers') ? <ParticleField name="flowers" symbols={['✿', '❀']} count={8} /> : null}
      {enabled.has('gold') ? <ParticleField name="gold" symbols={['✦', '★']} count={16} /> : null}
      {enabled.has('fireworks') ? <Fireworks /> : null}
      {enabled.has('trophy') ? <Trophy crown={enabled.has('crown')} coins={enabled.has('coins')} /> : null}
    </div>
  )
}

export default memo(CelebrationStage)
