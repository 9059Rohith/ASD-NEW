import './TamilLessonVisual.css'

const PICTURES = {
  'word-amma': 'amma.png', 'word-appa': 'appa.png', 'word-maram': 'maram.png',
  'word-naai': 'naai.svg', 'word-yaanai': 'yaanai.svg', 'word-pazham': 'pazham.png',
  'word-aadu': 'aadu.svg', 'word-ilai': 'ilai.svg', 'word-uppu': 'uppu.svg', 'word-eli': 'eli.svg',
  'sentence-amma-veettil': 'amma.png', 'sentence-naai-odugiradhu': 'naai.svg',
  'sentence-amma-vaa': 'amma.png', 'sentence-appa-vaa': 'appa.png',
  'sentence-idhu-maram': 'maram.png', 'sentence-idhu-pazham': 'pazham.png',
  'sentence-appa-maram': 'maram.png',
}
const PALETTES = [
  ['#f9ebcd', '#d68d69', '#855947'], ['#e6f0d9', '#83a962', '#4e7550'],
  ['#e0eff0', '#6aa8b5', '#476f83'], ['#efe4ef', '#b285b4', '#795f93'],
  ['#f5e9d4', '#dab45f', '#94723c'], ['#e6e6f3', '#8e9dc6', '#596c9e'],
]
const MOTIFS = ['flower', 'leaf', 'sun', 'wave', 'star', 'kite', 'hill', 'cloud']

export default function TamilLessonVisual({ item, large = false, mood = 'idle' }) {
  const picture = PICTURES[item.id]
  if (picture) return <img className={`tamil-lesson-picture ${large ? 'is-large' : ''}`} src={`/assets/words/${picture}`} alt={item.meaning || `Picture for ${item.text}`} loading={large ? 'eager' : 'lazy'} />
  const index = Number.isFinite(item.display_order) ? item.display_order : Array.from(item.id).reduce((sum, c) => sum + c.charCodeAt(0), 0)
  const [paper, accent, ink] = PALETTES[index % PALETTES.length]
  const motif = MOTIFS[index % MOTIFS.length]
  const gradientId = `tamil-scene-${item.id.replace(/[^a-z0-9-]/gi, '')}`
  return <svg className={`tamil-letter-scene ${large ? 'is-large' : ''}`} data-mood={mood} viewBox="0 0 260 210" role="img" aria-label={`Illustrated Tamil letter ${item.text}`}>
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop stopColor={paper} /><stop offset="1" stopColor="#fffdf4" /></linearGradient></defs>
    <rect x="2" y="2" width="256" height="206" rx="34" fill={`url(#${gradientId})`} />
    <path d={`M5 ${155 + index % 15}Q65 140 132 165T257 147V210H5Z`} fill={accent} opacity=".14" />
    {motif === 'flower' && <g className="tamil-scene-motif" fill={accent} opacity=".72">{Array.from({ length: 6 }, (_, n) => <ellipse key={n} cx="211" cy="43" rx="11" ry="22" transform={`rotate(${n * 60} 211 62)`} />)}<circle cx="211" cy="62" r="10" fill="#f7cf7b" /></g>}
    {motif === 'leaf' && <g className="tamil-scene-motif"><path d="M182 37Q233 27 220 83Q194 93 182 37Z" fill={accent} opacity=".72"/><path d="M186 39Q200 65 221 79" stroke={ink} strokeWidth="2" fill="none" /></g>}
    {motif === 'sun' && <g className="tamil-scene-motif"><circle cx="209" cy="54" r="24" fill={accent} opacity=".7"/><circle cx="209" cy="54" r="34" stroke={accent} strokeDasharray="4 8" strokeWidth="3" fill="none" /></g>}
    {motif === 'wave' && <g className="tamil-scene-motif" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round"><path d="M172 56q13-17 27 0t27 0"/><path d="M180 73q13-17 27 0t27 0"/></g>}
    {motif === 'star' && <path className="tamil-scene-motif" d="m208 30 7 20 22 2-17 13 6 21-18-12-18 12 6-21-17-13 22-2z" fill={accent} opacity=".75" />}
    {motif === 'kite' && <g className="tamil-scene-motif"><path d="m209 24 24 27-24 32-23-32z" fill={accent} opacity=".75"/><path d="M209 83q-20 17-10 36" fill="none" stroke={ink} strokeWidth="2" /></g>}
    {motif === 'hill' && <g className="tamil-scene-motif"><path d="M168 84q29-71 61 0z" fill={accent} opacity=".6"/><circle cx="228" cy="36" r="11" fill="#f5d68a" /></g>}
    {motif === 'cloud' && <g className="tamil-scene-motif" fill={accent} opacity=".7"><circle cx="191" cy="56" r="15"/><circle cx="211" cy="47" r="21"/><circle cx="231" cy="58" r="14"/><rect x="180" y="55" width="62" height="16" rx="8"/></g>}
    <circle cx="48" cy="42" r={8 + index % 5} fill={accent} opacity=".23"/>
    <circle cx="232" cy="153" r={6 + index % 8} fill={accent} opacity=".24"/>
    <path d="M34 162q15-19 31 0m128-17q15-19 31 0" fill="none" stroke={ink} strokeWidth="3" opacity=".28" strokeLinecap="round" />
    <text x="130" y="133" textAnchor="middle" fill={ink} fontSize={item.text.length > 2 ? 69 : 89} fontFamily="Noto Sans Tamil, Latha, sans-serif" fontWeight="650">{item.text}</text>
    <path className="tamil-scene-trace" d="M66 172q64 23 128 0" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
  </svg>
}
