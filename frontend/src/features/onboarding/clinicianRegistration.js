export function buildClinicianRegistrationPayload(values) {
  return {
    full_name: values.fullName.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
  }
}


export function validateClinicianRegistration(values) {
  const password = values.password || ''
  const strong = password.length >= 10
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password)
  if (!strong) return 'Use at least 10 characters with upper, lower, number and symbol.'
  if (password !== values.confirmPassword) return 'Passwords do not match.'
  return null
}

