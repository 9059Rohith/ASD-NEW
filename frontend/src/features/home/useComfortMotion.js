import { useEffect, useState } from 'react'
import { useInteractionSettingsStore } from '../../store/interactionSettingsStore'

export default function useComfortMotion() {
  const motionLevel = useInteractionSettingsStore(state => state.preferences.motionLevel)
  const [systemReduced, setSystemReduced] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReduced(Boolean(media?.matches))
    media?.addEventListener?.('change', update)
    return () => media?.removeEventListener?.('change', update)
  }, [])
  return systemReduced || motionLevel !== 'full'
}
