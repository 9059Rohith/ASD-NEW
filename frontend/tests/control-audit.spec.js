import { expect, test } from '@playwright/test'

const USERS = {
  user: { id: 'audit-caregiver', email: 'caregiver@example.invalid', full_name: 'Audit Caregiver', child_name: 'Kavi', child_age: 7, language: 'Tamil', role: 'user', total_sessions: 12, total_stars: 180 },
  therapist: { id: 'audit-therapist', email: 'therapist@example.invalid', full_name: 'Audit Therapist', role: 'therapist' },
  admin: { id: 'audit-admin', email: 'admin@example.invalid', full_name: 'Audit Admin', role: 'admin' },
}

const PUBLIC_ROUTES = ['/', '/login', '/register', '/clinician-register', '/admin-login', '/forgot-password', '/verify-otp']
const CAREGIVER_ROUTES = [
  '/dashboard', '/training', '/assessment', '/letter-learning', '/videos', '/speech-analysis',
  '/tongue-tracking', '/games', '/progress', '/reports', '/achievements', '/rewards', '/calendar',
  '/notifications', '/appointments', '/parent', '/profile', '/settings', '/help', '/feedback', '/about',
  '/play', '/play/settings', '/play/arcade/breath-balloon', '/play/quest/river-rescue',
  '/play/mouth-mirror', '/play/pippin', '/play/together', '/therapy/3',
]
const THERAPIST_ROUTES = ['/therapist', '/reports', '/notifications', '/appointments', '/profile', '/settings', '/help', '/feedback', '/about']

const LESSON = { id: 3, symbol: 'ல', english: 'LA', phoneme: 'la', type: 'letter', difficulty: 2, image: '/assets/letters/la.png' }

async function mockApi(page, role) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') {
      if (!role) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Not authenticated"}' })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USERS[role]) })
    }
    if (path === '/api/therapy/lessons/3') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LESSON) })
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"control audit fixture"}' })
  })
}

async function auditRoutes(page, routes) {
  const report = []
  const issues = []
  for (const route of routes) {
    await page.goto(route)
    await page.locator('.app-loading').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
    await page.waitForTimeout(250)
    const result = await page.evaluate(() => {
      const isVisible = (element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
      }
      const elements = [...document.querySelectorAll('button, a[href], [role="button"]')].filter(isVisible)
      const controlIssues = elements.flatMap((element, index) => {
        const rect = element.getBoundingClientRect()
        const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent?.replace(/\s+/g, ' ').trim() || ''
        const disabled = element.matches(':disabled,[aria-disabled="true"]')
        const href = element.tagName === 'A' ? element.getAttribute('href') : null
        const found = []
        const label = `${element.tagName.toLowerCase()} ${name || `#${index + 1}`}`
        if (!name) found.push(`${label}: missing accessible name`)
        // Inactive ARIA tabs use arrow keys within a tablist (roving tabindex).
        // The Tamil browser suite exercises that keyboard behavior explicitly.
        const rovingTab = element.matches('[role="tab"][aria-selected="false"]')
          && element.closest('[role="tablist"]')?.querySelector('[role="tab"][aria-selected="true"][tabindex="0"]')
        if (!disabled && element.tabIndex < 0 && !rovingTab) found.push(`${label}: not keyboard focusable`)
        if (element.tagName === 'BUTTON' && !disabled && (rect.width < 32 || rect.height < 32)) found.push(`${label}: ${Math.round(rect.width)}×${Math.round(rect.height)} target`)
        if (href === '#' || href?.startsWith('javascript:')) found.push(`${label}: dead link ${href}`)
        return found
      })
      return {
        count: elements.length,
        issues: controlIssues,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        title: document.querySelector('h1, h2')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      }
    })
    report.push({ route, controls: result.count, title: result.title })
    issues.push(...result.issues.map((issue) => `${route} — ${issue}`))
    if (result.overflow) issues.push(`${route} — horizontal page overflow`)
    expect(new URL(page.url()).pathname, `${route} should remain reachable`).toBe(route)
  }
  return { report, issues }
}

test.describe('complete route control audit', () => {
  test.setTimeout(180_000)

  test('public and authentication routes', async ({ page }, testInfo) => {
    await mockApi(page, null)
    const audit = await auditRoutes(page, PUBLIC_ROUTES)
    await testInfo.attach('public-control-inventory', { body: JSON.stringify(audit.report, null, 2), contentType: 'application/json' })
    expect(audit.issues).toEqual([])
  })

  test('caregiver, therapy, and interactive routes', async ({ page }, testInfo) => {
    await mockApi(page, 'user')
    const audit = await auditRoutes(page, CAREGIVER_ROUTES)
    await testInfo.attach('caregiver-control-inventory', { body: JSON.stringify(audit.report, null, 2), contentType: 'application/json' })
    expect(audit.issues).toEqual([])
  })

  test('therapist routes', async ({ page }, testInfo) => {
    await mockApi(page, 'therapist')
    const audit = await auditRoutes(page, THERAPIST_ROUTES)
    await testInfo.attach('therapist-control-inventory', { body: JSON.stringify(audit.report, null, 2), contentType: 'application/json' })
    expect(audit.issues).toEqual([])
  })

  test('admin route', async ({ page }, testInfo) => {
    await mockApi(page, 'admin')
    const audit = await auditRoutes(page, ['/admin'])
    await testInfo.attach('admin-control-inventory', { body: JSON.stringify(audit.report, null, 2), contentType: 'application/json' })
    expect(audit.issues).toEqual([])
  })
})
