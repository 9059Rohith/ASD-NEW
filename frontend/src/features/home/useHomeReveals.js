import { useEffect } from 'react'

export default function useHomeReveals(reduced = false) {
  useEffect(() => {
    if (reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.IntersectionObserver) return
    const elements = [...document.querySelectorAll('.voice-home [data-home-reveal]')]
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('home-revealed'); observer.unobserve(entry.target) }
      })
    }, { threshold: .08 })
    elements.forEach(element => {
      if (element.getBoundingClientRect().top >= window.innerHeight) {
        element.classList.add('home-reveal-ready')
        observer.observe(element)
      }
    })
    return () => { observer.disconnect(); elements.forEach(element => element.classList.remove('home-reveal-ready', 'home-revealed')) }
  }, [reduced])
}
