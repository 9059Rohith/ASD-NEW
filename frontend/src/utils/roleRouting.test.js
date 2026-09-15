import { describe, expect, it } from 'vitest'

import { canOpenRoleRoute, homeForRole, navGroupsForRole } from './roleRouting'


const groups = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Parent Hub', path: '/parent' },
      { label: 'Therapist Hub', path: '/therapist' },
      { label: 'Reports', path: '/reports' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Settings', path: '/settings' },
      { label: 'Help', path: '/help' },
    ],
  },
]


describe('role home routing', () => {
  it('sends each authenticated role to its own workspace', () => {
    expect(homeForRole('user')).toBe('/dashboard')
    expect(homeForRole('therapist')).toBe('/therapist')
    expect(homeForRole('admin')).toBe('/admin')
  })

  it('uses the public login for missing roles', () => {
    expect(homeForRole()).toBe('/login')
  })
})


describe('role access', () => {
  it('permits only explicitly allowed roles', () => {
    expect(canOpenRoleRoute('therapist', ['therapist', 'admin'])).toBe(true)
    expect(canOpenRoleRoute('admin', ['therapist', 'admin'])).toBe(true)
    expect(canOpenRoleRoute('user', ['therapist', 'admin'])).toBe(false)
  })
})


describe('role navigation', () => {
  it('keeps the therapist workspace and removes caregiver-only hubs', () => {
    const paths = navGroupsForRole(groups, 'therapist').flatMap((group) => group.items.map((item) => item.path))

    expect(paths).toContain('/therapist')
    expect(paths).toContain('/reports')
    expect(paths).not.toContain('/dashboard')
    expect(paths).not.toContain('/parent')
  })

  it('keeps caregiver navigation and removes the therapist workspace', () => {
    const paths = navGroupsForRole(groups, 'user').flatMap((group) => group.items.map((item) => item.path))

    expect(paths).toContain('/dashboard')
    expect(paths).toContain('/parent')
    expect(paths).not.toContain('/therapist')
  })
})
