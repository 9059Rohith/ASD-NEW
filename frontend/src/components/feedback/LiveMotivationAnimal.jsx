import { memo } from 'react'
import { getFeedbackProfile } from '../../features/feedback/feedbackPolicy'
import './feedback.css'

export const MOTIVATION_ANIMALS = Object.freeze([
  { id: 'puppy', name: 'Puppy', color: '#d99a63', patch: '#fff0d1', ears: 'flop' },
  { id: 'kitten', name: 'Kitten', color: '#f3a66d', patch: '#fff0d1', ears: 'point' },
  { id: 'rabbit', name: 'Rabbit', color: '#eee8f2', patch: '#ffffff', ears: 'tall' },
  { id: 'panda', name: 'Panda', color: '#f7f7f4', patch: '#30333d', ears: 'round' },
  { id: 'fox', name: 'Fox', color: '#ef8450', patch: '#fff4df', ears: 'point' },
  { id: 'penguin', name: 'Penguin', color: '#34465b', patch: '#f7fbff', ears: 'none' },
  { id: 'chick', name: 'Chick', color: '#ffd85a', patch: '#fff1a9', ears: 'none' },
  { id: 'lion', name: 'Lion Cub', color: '#e9a84e', patch: '#ffe4a6', ears: 'round' },
  { id: 'koala', name: 'Koala', color: '#9eabb4', patch: '#dce4e8', ears: 'round' },
  { id: 'baby-panda', name: 'Baby Panda', color: '#ffffff', patch: '#252a35', ears: 'round' },
])

function Ears({ kind, patch }) {
  if (kind === 'none') return null
  if (kind === 'tall') return <><ellipse cx="64" cy="35" rx="18" ry="36" fill={patch} stroke="#58475b" strokeWidth="5" /><ellipse cx="136" cy="35" rx="18" ry="36" fill={patch} stroke="#58475b" strokeWidth="5" /></>
  if (kind === 'round') return <><circle cx="55" cy="55" r="24" fill={patch} stroke="#58475b" strokeWidth="5" /><circle cx="145" cy="55" r="24" fill={patch} stroke="#58475b" strokeWidth="5" /></>
  if (kind === 'flop') return <><path d="M63 68Q25 68 30 112q34 7 46-25" fill={patch} stroke="#58475b" strokeWidth="5" /><path d="M137 68q38 0 33 44-34 7-46-25" fill={patch} stroke="#58475b" strokeWidth="5" /></>
  return <><path d="M55 75 48 24l43 37" fill={patch} stroke="#58475b" strokeWidth="5" strokeLinejoin="round" /><path d="m145 75 7-51-43 37" fill={patch} stroke="#58475b" strokeWidth="5" strokeLinejoin="round" /></>
}

function LiveMotivationAnimal({ active = false, state = 'listening', accuracy = 0, seed = 0, className = '' }) {
  if (!active) return null
  const animal = MOTIVATION_ANIMALS[Math.abs(Math.trunc(seed)) % MOTIVATION_ANIMALS.length]
  const profile = getFeedbackProfile(accuracy, seed)
  const resolvedState = ['listening', 'evaluating', 'celebrating'].includes(state) ? state : 'listening'
  return (
    <figure className={`motivation-animal ${className}`} data-testid="live-motivation-animal" data-state={resolvedState} data-animal={animal.id} data-action={profile.animalAction}>
      <svg viewBox="0 0 200 230" role="img" aria-label={`${animal.name} is ${resolvedState === 'listening' ? 'listening and smiling' : 'cheering for you'}`}>
        <g className="animal-tail"><path d="M154 174q53 3 32-48" fill="none" stroke={animal.color} strokeWidth="18" strokeLinecap="round" /></g>
        <g className="animal-body"><ellipse cx="100" cy="169" rx="61" ry="53" fill={animal.color} stroke="#58475b" strokeWidth="5" /><ellipse cx="100" cy="174" rx="33" ry="31" fill={animal.patch} opacity=".78" /></g>
        <g className="animal-head"><Ears kind={animal.ears} patch={animal.id.includes('panda') ? '#252a35' : animal.color} /><circle cx="100" cy="99" r="65" fill={animal.color} stroke="#58475b" strokeWidth="5" />
          {animal.id.includes('panda') ? <><ellipse cx="71" cy="92" rx="20" ry="25" fill="#252a35" transform="rotate(25 71 92)" /><ellipse cx="129" cy="92" rx="20" ry="25" fill="#252a35" transform="rotate(-25 129 92)" /></> : null}
          <g className="animal-eyes"><ellipse cx="74" cy="94" rx="9" ry="12" fill="#2f3040" /><ellipse cx="126" cy="94" rx="9" ry="12" fill="#2f3040" /><circle cx="77" cy="90" r="3" fill="white" /><circle cx="129" cy="90" r="3" fill="white" /></g>
          <path d="m92 112 8 7 8-7" fill="#d66d79" stroke="#58475b" strokeWidth="3" strokeLinejoin="round" />
          <path className="animal-smile" d="M100 120q-3 17-20 12m20-12q3 17 20 12" fill="none" stroke="#58475b" strokeWidth="4" strokeLinecap="round" />
          <circle cx="63" cy="120" r="8" fill="#f78a9b" opacity=".45" /><circle cx="137" cy="120" r="8" fill="#f78a9b" opacity=".45" />
        </g>
        <g className="animal-paws" fill={animal.color} stroke="#58475b" strokeWidth="5"><ellipse cx="61" cy="181" rx="18" ry="28" /><ellipse cx="139" cy="181" rx="18" ry="28" /></g>
        <g className="animal-listen-lines" fill="none" stroke="#44b9c8" strokeWidth="5" strokeLinecap="round"><path d="M166 83q17 14 0 29" /><path d="M177 73q29 25 0 50" /></g>
      </svg>
      <figcaption>{resolvedState === 'listening' ? `${animal.name} is listening` : profile.heading}</figcaption>
    </figure>
  )
}

export default memo(LiveMotivationAnimal)
