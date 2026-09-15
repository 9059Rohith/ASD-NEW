import { expect, test } from '@playwright/test'

const USER = { id: 'notifications-user', email: 'parent@example.invalid', full_name: 'Parent', role: 'user' }
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

test('notifications and preferences use saved account data', async ({ page }) => {
  const createdAt = new Date().toISOString()
  const items = [
    { id: 'first', title: 'Real reminder', body: 'Practice the next Tamil word.', category: 'reminder', read: false, created_at: createdAt },
    { id: 'second', title: 'Appointment changed', body: 'Your appointment was updated.', category: 'appointment', read: true, created_at: createdAt },
  ]
  const writes = []
  const settings = { notifications: { email: true, push: true }, sound_enabled: false }
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path === '/api/auth/me') return route.fulfill(json(USER))
    if (path === '/api/notifications' && method === 'GET') {
      return route.fulfill(json({ items, total: items.length, page: 1, limit: 20, pages: 1 }))
    }
    if (path === '/api/notifications/unread-count') {
      return route.fulfill(json({ unread: items.filter((item) => !item.read).length }))
    }
    if (path === '/api/settings' && method === 'GET') return route.fulfill(json(settings))
    if (path === '/api/notifications/first/read' && method === 'PATCH') {
      writes.push({ method, path })
      items[0].read = true
      return route.fulfill(json({ message: 'Marked as read' }))
    }
    if (path === '/api/notifications/second' && method === 'DELETE') {
      writes.push({ method, path })
      items.splice(1, 1)
      return route.fulfill(json({ message: 'Deleted' }))
    }
    if (path === '/api/settings' && method === 'PUT') {
      writes.push({ method, path, payload: route.request().postDataJSON() })
      Object.assign(settings.notifications, route.request().postDataJSON().notifications || {})
      return route.fulfill(json(settings))
    }
    return route.fulfill(json({ detail: 'unavailable' }, 503))
  })

  await page.goto('/notifications')
  await expect(page.getByText('Real reminder')).toBeVisible()
  await expect(page.getByText('Appointment changed')).toBeVisible()
  await expect(page.getByText('Dr. Anitha Raman')).toHaveCount(0)
  await page.getByRole('article', { name: 'Real reminder' }).getByRole('button', { name: 'Mark read' }).click()
  await expect.poll(() => writes.some((write) => write.path === '/api/notifications/first/read')).toBe(true)
  await expect(page.getByText('0 unread updates')).toBeVisible()
  await page.getByRole('article', { name: 'Appointment changed' }).getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByText('Appointment changed')).toHaveCount(0)
  await page.getByRole('button', { name: 'Email Alerts notifications' }).click()
  await expect.poll(() => writes.find((write) => write.method === 'PUT')?.payload).toEqual({ notifications: { email: false } })
})

test('notification API errors show a retry state without fabricated updates', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill(path === '/api/auth/me' ? json(USER) : json({ detail: 'unavailable' }, 503))
  })
  await page.goto('/notifications')
  await expect(page.getByText('Notifications could not be loaded.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry notifications' })).toBeVisible()
  await expect(page.getByText('New Badge Unlocked!')).toHaveCount(0)
})
