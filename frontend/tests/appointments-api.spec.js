import { expect, test } from '@playwright/test'

const USER = { id: 'appointments-user', email: 'parent@example.invalid', full_name: 'Parent', child_name: 'Maya', role: 'user' }
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

test('booking and cancellation persist through appointment APIs', async ({ page }) => {
  const appointments = []
  const writes = []
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path === '/api/auth/me') return route.fulfill(json(USER))
    if (path === '/api/appointments/available-therapists') return route.fulfill(json([{ id: 'therapist-1', full_name: 'Dr. Mira' }]))
    if (path === '/api/appointments' && method === 'GET') {
      const upcoming = route.request().url().includes('upcoming=true')
      const items = upcoming ? appointments.filter((item) => item.status === 'pending') : appointments
      return route.fulfill(json({ items, total: items.length, page: 1, pages: 1 }))
    }
    if (path === '/api/appointments' && method === 'POST') {
      const payload = route.request().postDataJSON()
      writes.push({ method, payload })
      const booked = { id: 'booked', therapist_name: 'Dr. Mira', child_name: 'Maya', status: 'pending', ...payload }
      appointments.push(booked)
      return route.fulfill(json(booked))
    }
    if (path === '/api/appointments/booked' && method === 'DELETE') {
      writes.push({ method, path })
      appointments[0].status = 'cancelled'
      return route.fulfill(json({ message: 'Appointment cancelled' }))
    }
    return route.fulfill(json({ detail: 'unavailable' }, 503))
  })

  await page.goto('/appointments')
  await expect(page.getByText('No upcoming appointments are scheduled.')).toBeVisible()
  await page.getByRole('button', { name: 'Book New' }).click()
  const future = new Date()
  future.setDate(future.getDate() + 8)
  const date = [future.getFullYear(), String(future.getMonth() + 1).padStart(2, '0'), String(future.getDate()).padStart(2, '0')].join('-')
  await page.getByLabel('Date').fill(date)
  await page.getByLabel('Time').fill('14:15')
  await page.getByLabel('Reason').fill('Speech practice')
  await page.getByRole('button', { name: 'Confirm Booking' }).click()
  await expect.poll(() => writes[0]?.payload).toMatchObject({
    therapist_id: 'therapist-1', mode: 'online', duration_min: 30, reason: 'Speech practice',
  })
  await expect(page.getByRole('button', { name: 'Cancel appointment with Dr. Mira' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel appointment with Dr. Mira' }).click()
  await expect(page.getByText('No upcoming appointments are scheduled.')).toBeVisible()
  expect(writes[1]).toEqual({ method: 'DELETE', path: '/api/appointments/booked' })
})

test('appointment API failures show retry states without fabricated profiles or notes', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill(path === '/api/auth/me' ? json(USER) : json({ detail: 'unavailable' }, 503))
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/appointments')
  await expect(page.getByText('Appointments could not be loaded.').first()).toBeVisible()
  await expect(page.getByText('Therapists could not be loaded.')).toBeVisible()
  await expect(page.getByText('Dr. Anitha Raman')).toHaveCount(0)
  await expect(page.getByText('Practised clear initial sounds and slow syllable pacing.')).toHaveCount(0)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
