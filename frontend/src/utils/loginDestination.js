import { homeForRole } from './roleRouting'

// Restore an intended learning page after cookie authentication, without open redirects.
export function loginDestination(role, from) {
  if (!['user', 'admin'].includes(role) || typeof from !== 'string') return homeForRole(role)
  const path = from.split('?')[0]
  if (['/tamil', '/practice', '/training', '/evaluate', '/assessment', '/games', '/progress'].includes(path)
      || /^\/tamil\/practice\/[a-z0-9-]+$/.test(path)
      || /^\/games\/vowels\/[a-z-]+$/.test(path)) return from
  return homeForRole(role)
}
