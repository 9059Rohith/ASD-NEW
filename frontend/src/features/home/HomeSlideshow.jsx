import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react'
import { createSlideshowClock } from './slideshowClock'
import useComfortMotion from './useComfortMotion'

export const HOME_SLIDES = [
  { id: 'vowels', title: 'ஒலியிலிருந்து தொடங்கலாம்', english: 'Begin with a little sound.', sample: 'அ ஆ', label: 'உயிரெழுத்துகள்', detail: '12 Tamil vowels. One gentle beginning.', to: '/tamil?kind=vowel', action: 'உயிரெழுத்துகள் பயிலலாம்', image: 'pippin-garden.png' },
  { id: 'words', title: 'சொல்லிச் சொல்லிப் பழகலாம்', english: 'Make room for a new word.', sample: 'அம்மா', label: 'சொற்கள்', detail: 'Familiar Tamil words, at your own pace.', to: '/tamil?kind=word', action: 'சொற்கள் பயிலலாம்', image: 'pippin-guide.png' },
  { id: 'sentences', title: 'சிறிய வாக்கியம். புதிய தொடக்கம்.', english: 'A small sentence. A new beginning.', sample: 'அம்மா, வா.', label: 'வாக்கியங்கள்', detail: 'Bring familiar words together with Pippin.', to: '/tamil?kind=sentence', action: 'வாக்கியங்கள் பயிலலாம்', image: 'pippin-guide.png' },
]

export default function HomeSlideshow() {
  const reduced = useComfortMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const clock = useRef(null)
  const slide = HOME_SLIDES[index]
  const running = !paused && !reduced && !hovered && !focused && !hidden

  useEffect(() => { if (reduced) setPaused(true) }, [reduced])

  useEffect(() => {
    clock.current = createSlideshowClock(() => setIndex(current => (current + 1) % HOME_SLIDES.length))
    const onVisibility = () => setHidden(document.hidden)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = event => { if (event.matches) setPaused(true) }
    document.addEventListener('visibilitychange', onVisibility)
    media.addEventListener?.('change', onMotion)
    return () => { clock.current.dispose(); document.removeEventListener('visibilitychange', onVisibility); media.removeEventListener?.('change', onMotion) }
  }, [])
  useEffect(() => { clock.current?.update(running); return () => clock.current?.update(false) }, [running, index])
  const go = value => setIndex((value + HOME_SLIDES.length) % HOME_SLIDES.length)
  const onKeyDown = event => {
    if (event.target.closest('a')) return
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    go(event.key === 'Home' ? 0 : event.key === 'End' ? HOME_SLIDES.length - 1 : index + (event.key === 'ArrowRight' ? 1 : -1))
  }

  return <section className="home-slideshow" aria-roledescription="carousel" aria-label="Explore Tamil learning" data-playing={running} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }} onKeyDown={onKeyDown}>
    <div className="home-slideshow-stage" aria-live={running ? 'off' : 'polite'} aria-atomic="true">
      <article key={slide.id} className={`home-slide home-slide-${slide.id}`} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${HOME_SLIDES.length}: ${slide.english}`}>
        <div className="home-slide-scene" aria-hidden="true"><span className="home-slide-orbit" /><span className="home-slide-orbit home-slide-orbit-outer" /><img src={`/assets/vowel-studio/${slide.image}`} alt="" width="700" height="700" fetchpriority={index === 0 ? 'high' : 'auto'} /><span className="home-slide-sample" lang="ta">{slide.sample}</span><span className="home-slide-petal home-slide-petal-one" /><span className="home-slide-petal home-slide-petal-two" /></div>
        <div className="home-slide-caption"><span className="home-slide-eyebrow" lang="ta">{slide.label}</span><h2 lang="ta">{slide.title}</h2><p>{slide.english} <span>{slide.detail}</span></p><Link to={slide.to}><span lang="ta">{slide.action}</span><ArrowRight size={18} aria-hidden="true" /></Link></div>
      </article>
    </div>
    <div className="home-slideshow-controls">
      <button type="button" className="home-slideshow-play" disabled={reduced} title={reduced ? 'Automatic slides are off while reduced motion is enabled.' : undefined} onClick={() => setPaused(value => !value)} aria-label={paused || reduced ? 'Play slideshow' : 'Pause slideshow'}>{paused || reduced ? <Play size={17} aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />}<span>{paused || reduced ? 'Play' : 'Pause'}</span></button>
      <div className="home-slideshow-dots" role="group" aria-label="Choose a slide">{HOME_SLIDES.map((item, itemIndex) => <button type="button" key={item.id} aria-label={`Show slide ${itemIndex + 1}: ${item.english}`} aria-current={index === itemIndex ? 'true' : undefined} onClick={() => go(itemIndex)}><span /></button>)}</div>
      <div className="home-slideshow-arrows"><button type="button" aria-label="Previous slide" onClick={() => go(index - 1)}><ArrowLeft size={18} aria-hidden="true" /></button><button type="button" aria-label="Next slide" onClick={() => go(index + 1)}><ArrowRight size={18} aria-hidden="true" /></button></div>
    </div>
    <p className="home-slideshow-hint">{reduced ? 'Motion reduced. Choose a slide with the arrows or dots.' : paused ? 'Your pace. Choose a slide when you’re ready.' : focused || hovered ? 'Paused while you explore.' : 'A new little beginning, every 8 seconds.'}</p>
  </section>
}
