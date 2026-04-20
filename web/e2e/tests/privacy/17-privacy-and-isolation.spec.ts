import { test, expect } from '@playwright/test'
import { loginViaApi, apiGet } from '../../helpers/api.helpers'
import { TEST_USERS } from '../../fixtures/auth.fixtures'

const API = 'http://localhost:8000'

test.describe('Privacy and Tenant Isolation', () => {

  // These tests call the API directly to check raw responses

  test('participant API response never includes phone_number', async () => {
    const token = await loginViaApi(
      TEST_USERS.participant.email,
      TEST_USERS.participant.password
    )
    const session = await apiGet('/api/v1/sessions/1', token)
    for (const leader of session.leaders ?? []) {
      expect(leader.phone_visible).toBe(false)
      expect(leader.phone_number).toBeNull()
    }
  })

  test('owner API response includes phone_visible true for leaders', async () => {
    const token   = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const session = await apiGet('/api/v1/sessions/1', token)
    const leaders = session.leaders ?? []
    if (leaders.length > 0) {
      expect(leaders[0].phone_visible).toBe(true)
    }
  })

  test('public workshop endpoint never exposes meeting_url', async () => {
    const res = await fetch(`${API}/api/v1/public/workshops/cascade-photo-nlp2025`)
    const data = await res.json()
    const json = JSON.stringify(data)
    expect(json).not.toContain('"meeting_url"')
    expect(json).not.toContain('"meeting_passcode"')
  })

  test('public leader response never exposes address_line_1 or phone', async () => {
    const res  = await fetch(`${API}/api/v1/public/workshops/cascade-photo-nlp2025`)
    const data = await res.json()
    const json = JSON.stringify(data)
    expect(json).not.toContain('"address_line_1"')
    expect(json).not.toContain('"postal_code"')
    expect(json).not.toContain('"phone_number"')
  })

  test('participant cannot access the session roster via API', async () => {
    const token = await loginViaApi(
      TEST_USERS.participant.email,
      TEST_USERS.participant.password
    )
    const res = await fetch(`${API}/api/v1/sessions/1/roster`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.status).toBe(403)
  })

  test('participant cannot access admin dashboard page', async ({ page }) => {
    await page.context().storageState({ path: 'e2e/.auth/participant.json' })
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL('/dashboard')
  })

  test('leader cannot access admin dashboard page', async ({ page }) => {
    await page.context().storageState({ path: 'e2e/.auth/leader.json' })
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL('/dashboard')
  })

  test('only confirmed leaders appear on the public workshop page', async () => {
    const res    = await fetch(`${API}/api/v1/public/workshops/cascade-photo-nlp2025`)
    const data   = await res.json()
    const leaders = data.leaders ?? []
    for (const l of leaders) {
      expect(l.is_confirmed).toBe(true)
    }
  })

})
