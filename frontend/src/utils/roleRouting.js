const THERAPIST_PATHS = new Set([
  '/therapist',
  '/reports',
  '/appointments',
  '/profile',
  '/settings',
  '/help',
  '/feedback',
  '/about',
])

const CAREGIVER_PATHS = new Set([
  '/tamil',
  '/practice',
  '/evaluate',
  '/games',
  '/dashboard',
  '/training',
  '/progress',
  '/reports',
  '/parent',
  '/settings',
])


export function homeForRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'therapist') return '/therapist'
  if (role === 'user') return '/dashboard'
  return '/login'
}


export function canOpenRoleRoute(role, allowedRoles) {
  return Array.isArray(allowedRoles) && allowedRoles.includes(role)
}


export function navGroupsForRole(groups, role) {
  const filtered = groups.map((group) => {
    const items = group.items.filter((item) => {
      if (role === 'therapist') return THERAPIST_PATHS.has(item.path)
      if (role === 'admin') return item.path === '/settings' || item.path === '/help' || item.path === '/about'
      return CAREGIVER_PATHS.has(item.path)
    })
    return { ...group, items }
  })
  return filtered.filter((group) => group.items.length > 0)
}
