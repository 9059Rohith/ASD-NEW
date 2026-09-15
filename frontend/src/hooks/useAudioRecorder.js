import { useState, useRef, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { MicrophoneSession } from '../utils/microphoneSession'

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [duration, setDuration] = useState(0)
  const [transcript, setTranscript] = useState('')
  const analyserRef = useRef(null)
  const recognitionRef = useRef(null)
  const captureRef = useRef(null)
  if (!captureRef.current) {
    captureRef.current = new MicrophoneSession({
      onState: setIsRecording,
      onComplete: (blob, elapsed) => { setAudioBlob(blob); setDuration(elapsed) },
      onAnalyser: analyser => { analyserRef.current = analyser },
      onError: error => toast.error(error.message),
    })
  }
  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      recognition.onresult = null
      try { recognition.abort() } catch { /* Already stopped. */ }
    }
  }, [])
  const startRecording = useCallback(async (language = 'ta-IN', options = {}) => {
    if (captureRef.current.busy) return false
    setAudioBlob(null)
    setTranscript('')
    setDuration(0)
    window.speechSynthesis?.cancel()
    try {
      if (!await captureRef.current.start()) return false
    } catch (error) {
      const messages = {
        NotAllowedError: 'Microphone permission was denied. Allow it in your browser site settings.',
        NotFoundError: 'No microphone was found. Connect one and try again.',
        NotReadableError: 'The microphone is busy. Close other recording apps and retry.',
      }
      toast.error(messages[error.name] || error.message || 'Could not access the microphone.')
      return false
    }
    // Optional captions never determine phoneme scores or stop capture.
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (options.speechRecognition !== false && Recognition) {
      try {
        const recognition = new Recognition()
        recognitionRef.current = recognition
        recognition.lang = language
        recognition.interimResults = true
        recognition.onresult = event => {
          setTranscript(Array.from(event.results, result => result[0].transcript).join(' ').trim())
        }
        recognition.onerror = () => {}
        recognition.start()
      } catch { /* Local acoustic scoring does not require browser captions. */ }
    }
    return true
  }, [])
  const stopRecording = useCallback(() => {
    stopRecognition()
    captureRef.current.stop()
  }, [stopRecognition])
  const resetRecording = useCallback(() => {
    stopRecognition()
    captureRef.current.cancel()
    setAudioBlob(null)
    setTranscript('')
    setDuration(0)
  }, [stopRecognition])
  useEffect(() => {
    const capture = captureRef.current
    return () => { stopRecognition(); capture.cancel() }
  }, [stopRecognition])
  useEffect(() => { if (!isRecording) stopRecognition() }, [isRecording, stopRecognition])
  return { isRecording, audioBlob, duration, transcript, isRepeating: false,
    analyserRef, startRecording, stopRecording, resetRecording }
}
