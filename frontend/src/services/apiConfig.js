export function resolveApiBaseUrl({ isDevelopment, configuredUrl }) {
  if (isDevelopment) return '/api'
  const normalized = String(configuredUrl || '').trim()
  return normalized || '/api'
}
