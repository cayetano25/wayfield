import { test, expect } from '@playwright/test'

test.describe('Discover Page', () => {

  test('page loads without auth', async ({ page }) => {
    await page.context().storageState({ path: 'e2e/.auth/guest.json' })
    await page.goto('/discover')
    await expect(page).not.toHaveURL(/404/)
    await expect(page.getByText(/discover workshops/i)).toBeVisible()
  })

  test('no sidebar or admin nav exposed to guests', async ({ page }) => {
    await page.context().storageState({ path: 'e2e/.auth/guest.json' })
    await page.goto('/discover')
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
    await expect(page.getByRole('link', { name: /^dashboard$/i })).not.toBeVisible()
  })

  test('logged-in user sees personalised welcome hero', async ({ page }) => {
    await page.context().storageState({ path: 'e2e/.auth/participant.json' })
    await page.goto('/discover')
    await expect(page.getByText(/welcome to wayfield, maria/i)).toBeVisible()
    await expect(page.getByText('Join a Workshop')).toBeVisible()
  })

  test('guest does not see personalised welcome hero', async ({ page }) => {
    await page.context().storageState({ path: 'e2e/.auth/guest.json' })
    await page.goto('/discover')
    await expect(page.getByText(/welcome to wayfield/i)).not.toBeVisible()
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  test('category filter does not crash the page', async ({ page }) => {
    await page.context().storageState({ path: 'e2e/.auth/guest.json' })
    await page.goto('/discover')
    await page.click('button:has-text("Photography")')
    await expect(page.locator('text=404')).not.toBeVisible()
    await expect(page.locator('text=Something went wrong')).not.toBeVisible()
  })

})
