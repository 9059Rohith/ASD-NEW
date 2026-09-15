import './InteractiveBunny.css'

const MOOD_LABELS = {
  idle: 'ready',
  happy: 'happy',
  listen: 'listening',
  listening: 'listening',
  thinking: 'thinking',
  encourage: 'encouraging you',
  celebrate: 'celebrating',
}

const clampLevel = (value) => Math.min(1, Math.max(0, Number(value) || 0))

export default function InteractiveBunny({
  mood = 'idle',
  audioLevel = 0,
  size = 360,
  showBubble = false,
  message = '',
  className = '',
}) {
  const safeMood = MOOD_LABELS[mood] ? mood : 'idle'
  const level = clampLevel(audioLevel)
  const description = `Bunny companion is ${MOOD_LABELS[safeMood]}.${message ? ` ${message}` : ''}`

  return (
    <div
      className={`interactive-bunny interactive-bunny--${safeMood} ${className}`.trim()}
      data-testid="interactive-bunny"
      data-mood={safeMood}
      data-audio-level={level}
      role="img"
      aria-label={description}
      style={{ height: `${size}px`, '--bunny-audio': level }}
    >
      {showBubble && message ? (
        <div className="interactive-bunny__bubble" aria-hidden="true">
          {message}
        </div>
      ) : null}

      <div className="interactive-bunny__float" aria-hidden="true">
        <svg viewBox="0 0 420 520" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bunny-green" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#d9ff72" />
              <stop offset="0.48" stopColor="#99e936" />
              <stop offset="1" stopColor="#55b91f" />
            </linearGradient>
            <linearGradient id="bunny-green-dark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a9ef42" />
              <stop offset="1" stopColor="#4fae1c" />
            </linearGradient>
            <radialGradient id="bunny-fur" cx="42%" cy="30%" r="70%">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.72" stopColor="#fffdf7" />
              <stop offset="1" stopColor="#e8e8df" />
            </radialGradient>
            <radialGradient id="bunny-cheek">
              <stop offset="0" stopColor="#ff9b9f" stopOpacity=".72" />
              <stop offset="1" stopColor="#ffb8b8" stopOpacity="0" />
            </radialGradient>
            <filter id="bunny-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx="0" dy="12" stdDeviation="13" floodColor="#123b2b" floodOpacity=".2" />
            </filter>
          </defs>

          <ellipse className="bunny-ground" cx="211" cy="481" rx="126" ry="20" fill="#173f31" opacity=".18" />

          <g className="bunny-ear bunny-ear--left">
            <path d="M125 166C75 122 75 24 115 17c37-6 54 100 47 157Z" fill="url(#bunny-fur)" stroke="#82ca2b" strokeWidth="10" />
            <path d="M119 139c-23-36-25-88-8-101 18 6 27 64 24 103Z" fill="#ffc4c6" />
          </g>
          <g className="bunny-ear bunny-ear--right">
            <path d="M272 171c-5-60 22-154 61-145 39 10 22 111-25 153Z" fill="url(#bunny-fur)" stroke="#82ca2b" strokeWidth="10" />
            <path d="M298 146c2-42 16-94 34-99 13 17 2 68-20 100Z" fill="#ffc4c6" />
          </g>

          <g className="bunny-body" filter="url(#bunny-shadow)">
            <circle cx="337" cy="385" r="43" fill="url(#bunny-fur)" />
            <path d="M111 326c10-70 55-103 100-103s93 31 103 103l18 118c3 22-14 40-36 40H126c-23 0-40-20-35-43Z" fill="url(#bunny-green-dark)" stroke="#499e20" strokeWidth="4" />
            <path d="M187 254h49l19 55-44 26-44-26Z" fill="#d9ff72" opacity=".78" />
            <path d="M124 381c25 22 149 22 177 0v52c-37 16-139 16-177 0Z" fill="#71c927" opacity=".62" />
            <path d="M235 368h49v43c-8 10-39 10-49 0Z" fill="none" stroke="#d9ff72" strokeWidth="4" strokeLinejoin="round" />
            <path d="M142 474c-2-25 17-39 49-36 24 3 30 22 20 40Z" fill="#72ca28" />
            <path d="M213 478c-8-21 7-39 38-40 31-1 48 14 46 38Z" fill="#72ca28" />
          </g>

          <g className="bunny-arm bunny-arm--left">
            <path d="M125 326c-25 9-41 47-27 79 10 23 36 21 54 2l38-43c12-15 2-42-18-43Z" fill="url(#bunny-green)" stroke="#4da91d" strokeWidth="4" />
            <ellipse cx="181" cy="363" rx="28" ry="24" fill="url(#bunny-fur)" transform="rotate(-18 181 363)" />
          </g>
          <g className="bunny-arm bunny-arm--right">
            <path d="M295 324c30 11 43 53 25 82-13 22-40 16-55-5l-31-43c-10-16 3-39 22-38Z" fill="url(#bunny-green)" stroke="#4da91d" strokeWidth="4" />
            <ellipse cx="242" cy="360" rx="28" ry="24" fill="url(#bunny-fur)" transform="rotate(19 242 360)" />
          </g>

          <g className="bunny-head">
            <path d="M94 151c7-69 67-102 121-99 64 3 117 41 119 112l-15 113H103Z" fill="url(#bunny-green)" stroke="#62b921" strokeWidth="5" />
            <ellipse cx="211" cy="219" rx="113" ry="100" fill="url(#bunny-fur)" />
            <path d="M98 193c9-91 67-121 117-117 60 4 111 45 117 119-22-42-54-68-120-68-57 0-92 23-114 66Z" fill="url(#bunny-green)" />

            <g className="bunny-eye bunny-eye--left">
              <ellipse cx="165" cy="211" rx="22" ry="30" fill="#17211d" />
              <ellipse cx="157" cy="199" rx="7" ry="10" fill="#fff" />
              <ellipse cx="174" cy="218" rx="4" ry="6" fill="#fff" opacity=".82" />
              <ellipse className="bunny-eyelid" cx="165" cy="191" rx="27" ry="26" fill="#fffdf7" />
            </g>
            <g className="bunny-eye bunny-eye--right">
              <ellipse cx="258" cy="211" rx="22" ry="30" fill="#17211d" />
              <ellipse cx="250" cy="199" rx="7" ry="10" fill="#fff" />
              <ellipse cx="267" cy="218" rx="4" ry="6" fill="#fff" opacity=".82" />
              <ellipse className="bunny-eyelid" cx="258" cy="191" rx="27" ry="26" fill="#fffdf7" />
            </g>

            <ellipse cx="136" cy="251" rx="39" ry="25" fill="url(#bunny-cheek)" />
            <ellipse cx="286" cy="251" rx="39" ry="25" fill="url(#bunny-cheek)" />
            <path d="M202 239q10-10 20 0-2 15-10 15t-10-15Z" fill="#ff9b81" />
            <path d="M212 253v9" fill="none" stroke="#7a554c" strokeWidth="3" strokeLinecap="round" />
            <path className="bunny-mouth" d="M181 263q15 24 31 2 17 22 33-2" fill="none" stroke="#6d443d" strokeWidth="4" strokeLinecap="round" />

            <g className="bunny-flower" transform="translate(121 116) rotate(-14)">
              {[0, 72, 144, 216, 288].map((rotation) => (
                <ellipse key={rotation} cx="0" cy="-13" rx="8" ry="14" fill="#fff" transform={`rotate(${rotation})`} />
              ))}
              <circle r="8" fill="#ffd84d" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  )
}
