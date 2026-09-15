import mothWingSource from './moth-wing.svg?raw'
import './MothWings.css'

export function getRandomColor() {
  const letters = '0123456789ABCDEF'
  let color = '#'
  for (let index = 0; index < 6; index += 1) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

export default function MothWings({ color }) {
  const wing = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(mothWingSource.replace('#1cb1f2', color))}`
  return <span className="moth-wings">
    <span className="moth-wing-panel moth-wing-panel-left"><img className="moth-wing moth-wing-left" src={wing} alt="" draggable="false" loading="lazy" /></span>
    <span className="moth-wing-panel moth-wing-panel-right"><img className="moth-wing moth-wing-right" src={wing} alt="" draggable="false" loading="lazy" /></span>
    <span className="moth-body" />
  </span>
}
