import { expect, test } from '@playwright/test'

const USER = { id: 'calendar-rewards-user', email: 'caregiver@example.invalid', full_name: 'Caregiver', child_name: 'Maya', role: 'user' }
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

test('calendar renders server events and saves and completes a real calendar event', async ({ page }) => {
  const now = new Date()
  const day = now.getDate()
  const start = new Date(now.getFullYear(), now.getMonth(), day, 16, 0).toISOString()
  const events = [{ id: 'existing', title: 'Recorded session', type: 'practice', start, done: false }]
  const writes = []
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path === '/api/auth/me') return route.fulfill(json(USER))
    if (path === '/api/calendar/events' && method === 'GET') return route.fulfill(json({ events }))
    if (path === '/api/calendar/events' && method === 'POST') {
      const payload = route.request().postDataJSON()
      writes.push({ method, payload })
      events.push({ id: 'new-event', ...payload, done: false })
      return route.fulfill(json(events.at(-1)))
    }
    if (path === '/api/calendar/events/existing' && method === 'PATCH') {
      const payload = route.request().postDataJSON()
      writes.push({ method, payload })
      events[0].done = payload.done
      return route.fulfill(json(events[0]))
    }
    return route.fulfill(json({ detail: 'unavailable' }, 503))
  })

  await page.goto('/calendar')
  await expect(page.getByText('Recorded session')).toBeVisible()
  await expect(page.getByText('Dr. Anitha Raman')).toHaveCount(0)
  await page.getByRole('button', { name: 'Mark done' }).click()
  await expect(page.getByRole('button', { name: 'Mark not done' })).toBeVisible()

  await page.getByRole('button', { name: 'Add event' }).click()
  await page.getByLabel('Event title').fill('Bring headphones')
  await page.getByRole('button', { name: 'Save event' }).click()
  await expect(page.getByText('Bring headphones')).toBeVisible()
  expect(writes).toMatchObject([
    { method: 'PATCH', payload: { done: true } },
    { method: 'POST', payload: { title: 'Bring headphones', type: 'personal' } },
  ])
})

test('rewards uses the wallet, shop and inventory APIs for purchase and equip', async ({ page }) => {
  const calls = []
  const wallet = { coins: 150, gems: 2, stars: 5, xp: 150, level: 2, level_progress: 33, next_level_xp: 250 }
  const item = { slug: 'sticker-star', name: 'Star Sticker Pack', type: 'sticker', price_coins: 50, price_gems: 0, icon: '⭐', owned: false }
  const inventory = []
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path === '/api/auth/me') return route.fulfill(json(USER))
    if (path === '/api/wallet' && method === 'GET') return route.fulfill(json(wallet))
    if (path === '/api/wallet/shop' && method === 'GET') return route.fulfill(json({ items: [item] }))
    if (path === '/api/wallet/inventory' && method === 'GET') return route.fulfill(json({ items: inventory }))
    if (path === '/api/streaks') return route.fulfill(json({ current_streak: 2, longest_streak: 4 }))
    if (path === '/api/streaks/heatmap') return route.fulfill(json({ heatmap: [] }))
    if (path === '/api/social/leaderboard/global') return route.fulfill(json({ leaderboard: [] }))
    if (path === '/api/wallet/shop/sticker-star/buy' && method === 'POST') {
      calls.push(path)
      wallet.coins -= 50
      item.owned = true
      inventory.push({ item_slug: item.slug, name: item.name, type: item.type, equipped: false })
      return route.fulfill(json({ message: 'Purchase successful' }))
    }
    if (path === '/api/wallet/inventory/sticker-star/equip' && method === 'POST') {
      calls.push(path)
      inventory[0].equipped = true
      return route.fulfill(json({ message: 'Equipped' }))
    }
    return route.fulfill(json({ detail: 'unavailable' }, 503))
  })

  await page.goto('/rewards')
  await expect(page.getByText('150', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Star Sticker Pack').first()).toBeVisible()
  await expect(page.getByText('Nothing here yet.')).toHaveCount(2)
  await page.getByRole('button', { name: 'Buy' }).click()
  await expect(page.getByRole('button', { name: 'Owned' })).toBeVisible()
  await expect(page.getByText('100', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Equip', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Equipped' })).toBeVisible()
  expect(calls).toEqual(['/api/wallet/shop/sticker-star/buy', '/api/wallet/inventory/sticker-star/equip'])
})

test('failed calendar and rewards requests show errors without sample data', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill(path === '/api/auth/me' ? json(USER) : json({ detail: 'service unavailable' }, 503))
  })
  await page.goto('/calendar')
  await expect(page.getByText('Calendar events could not be loaded.')).toBeVisible()
  await expect(page.getByText('Dr. Anitha Raman')).toHaveCount(0)
  await page.goto('/rewards')
  await expect(page.getByRole('heading', { name: 'My Wallet' })).toBeVisible()
  await expect(page.getByText('1,240')).toHaveCount(0)
  await expect(page.getByText('Arjun K.')).toHaveCount(0)
  await expect(page.getByRole('alert').first()).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  for (const route of ['/calendar', '/rewards']) {
    await page.goto(route)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `${route} should not scroll horizontally`).toBeLessThanOrEqual(1)
  }
})
