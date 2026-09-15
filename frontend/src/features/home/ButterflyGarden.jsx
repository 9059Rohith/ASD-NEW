import { useEffect, useState } from 'react'
import useComfortMotion from './useComfortMotion'
import MothWings, { getRandomColor } from './MothWings'
import './ButterflyGarden.css'

const BUTTERFLIES = [
  { id: 'coral', size: 116 },
  { id: 'gold', size: 104 },
  { id: 'blue', size: 96 },
  { id: 'lilac', size: 94 },
  { id: 'mint', size: 98 },
  { id: 'rose', size: 108 },
]

const STARTS = [[9, 14], [84, 12], [22, 67], [78, 72], [7, 45], [91, 52]]
const between = (low, high) => low + Math.random() * (high - low)
const viewport = value => `${value.toFixed(1)}vw`
const height = value => `${value.toFixed(1)}vh`

function createFlights() {
  return BUTTERFLIES.map((butterfly, index) => {
    const [baseX, baseY] = STARTS[index]
    const x = Math.max(3, Math.min(92, baseX + between(-7, 7)))
    const y = Math.max(7, Math.min(86, baseY + between(-9, 9)))
    const destinations = Array.from({ length: 3 }, () => [between(4, 91), between(7, 86)])
    return {
      ...butterfly,
      color: getRandomColor(),
      style: {
        '--start-x': viewport(x),
        '--start-y': height(y),
        '--dx-1': viewport(destinations[0][0] - x),
        '--dy-1': height(destinations[0][1] - y),
        '--dx-2': viewport(destinations[1][0] - x),
        '--dy-2': height(destinations[1][1] - y),
        '--dx-3': viewport(destinations[2][0] - x),
        '--dy-3': height(destinations[2][1] - y),
        '--flight-time': `${between(62, 92).toFixed(1)}s`,
        '--flight-delay': `${between(-80, 0).toFixed(1)}s`,
        '--butterfly-size': `${butterfly.size}px`,
      },
    }
  })
}

function Butterfly({ butterfly }) {
  const [color, setColor] = useState(butterfly.color)
  const changeColor = event => {
    if (event.target === event.currentTarget && event.animationName === 'app-butterfly-flight') {
      setColor(getRandomColor())
    }
  }
  return <span className={`app-butterfly app-butterfly-${butterfly.id}`} style={butterfly.style} onAnimationIteration={changeColor}>
    <MothWings color={color} />
  </span>
}

export default function ButterflyGarden() {
  const reduced = useComfortMotion()
  const [flights] = useState(createFlights)
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)

  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  return <div className="app-butterfly-garden" aria-hidden="true" data-playing={!reduced && visible}>
    {flights.map(butterfly => <Butterfly butterfly={butterfly} key={butterfly.id} />)}
  </div>
}
