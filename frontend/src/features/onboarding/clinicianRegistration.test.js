import { describe, expect, it } from 'vitest'

import { buildClinicianRegistrationPayload, validateClinicianRegistration } from './clinicianRegistration'


describe('clinician registration', () => {
  it('normalizes the API payload', () => {
    expect(buildClinicianRegistrationPayload({
      fullName: '  Dr. Kala  ',
      email: ' KALA@EXAMPLE.COM ',
      password: 'Strong@123',
    })).toEqual({
      full_name: 'Dr. Kala',
      email: 'kala@example.com',
      password: 'Strong@123',
    })
  })

  it('requires a strong password and matching confirmation', () => {
    expect(validateClinicianRegistration({ password: 'short', confirmPassword: 'short' })).toBe('Use at least 10 characters with upper, lower, number and symbol.')
    expect(validateClinicianRegistration({ password: 'Strong@123', confirmPassword: 'Strong@124' })).toBe('Passwords do not match.')
    expect(validateClinicianRegistration({ password: 'Strong@123', confirmPassword: 'Strong@123' })).toBe(null)
  })
})
