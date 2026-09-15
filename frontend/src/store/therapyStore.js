import { create } from 'zustand'

export const useTherapyStore = create((set) => ({
  currentLesson: null,
  currentSlide: 1,
  sessionResults: [],
  
  setCurrentLesson: (lesson) => set({ currentLesson: lesson, currentSlide: 1, sessionResults: [] }),
  
  setCurrentSlide: (slide) => set({ currentSlide: slide }),
  
  nextSlide: () => set((state) => {
    let nextSlide = state.currentSlide + 1
    // Skip slide 4 (candle test) for letter-type lessons
    if (nextSlide === 4 && state.currentLesson?.type === 'letter') {
      nextSlide = 5
    }
    return { currentSlide: nextSlide }
  }),
  
  prevSlide: () => set((state) => {
    let prevSlide = Math.max(1, state.currentSlide - 1)
    // Skip slide 4 (candle test) when going back for letter-type lessons
    if (prevSlide === 4 && state.currentLesson?.type === 'letter') {
      prevSlide = 3
    }
    return { currentSlide: prevSlide }
  }),
  
  addSessionResult: (result) => set((state) => ({
    sessionResults: [...state.sessionResults, result]
  })),
  
  resetSession: () => set({ 
    currentLesson: null, 
    currentSlide: 1, 
    sessionResults: [] 
  })
}))
