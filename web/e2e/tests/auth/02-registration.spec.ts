import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/guest.json' })

const uniqueEmail = () => `reg-test-${Date.now()}@e2e.wayfield.test`

test.describe('Registration', () => {

  test('register page renders step 1 correctly', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByText('Create your account')).toBeVisible()
    await expect(page.locator('[name="first_name"]')).toBeVisible()
    await expect(page.locator('[name="last_name"]')).toBeVisible()
    await expect(page.locator('[type="email"]')).toBeVisible()
    await expect(page.locator('[id="password"]')).toBeVisible()
  })

  test('empty submit shows field errors', async ({ page }) => {
    await page.goto('/register')
    await page.click('button:has-text("Create Account")')
    await expect(page.getByText(/first name/i)).toBeVisible()
  })

  test('password mismatch shows error', async ({ page }) => {
    await page.goto('/register')
    await page.fill('[name="first_name"]', 'Test')
    await page.fill('[name="last_name"]', 'User')
    await page.fill('[type="email"]', uniqueEmail())
    await page.fill('[id="password"]', 'Testing!2024')
    await page.fill('[id="password_confirmation"]', 'Different!9999')
    await page.click('[data-testid="terms-checkbox"]')
    await page.click('button:has-text("Create Account")')
    await expect(page.getByText(/do not match/i)).toBeVisible()
  })

  test('terms must be accepted to submit', async ({ page }) => {
    await page.goto('/register')
    await page.fill('[name="first_name"]', 'Test')
    await page.fill('[name="last_name"]', 'User')
    await page.fill('[type="email"]', uniqueEmail())
    await page.fill('[id="password"]', 'Testing!2024')
    await page.fill('[id="password_confirmation"]', 'Testing!2024')
    // Not checking terms
    await page.click('button:has-text("Create Account")')
    await expect(page.getByText(/accept the terms/i)).toBeVisible()
  })

  test('valid registration advances to step 2', async ({ page }) => {
    await page.goto('/register')
    await page.fill('[name="first_name"]', 'Valid')
    await page.fill('[name="last_name"]', 'User')
    await page.fill('[type="email"]', uniqueEmail())
    await page.fill('[id="password"]', 'Testing!2024')
    await page.fill('[id="password_confirmation"]', 'Testing!2024')
    await page.click('[data-testid="terms-checkbox"]')
    await page.click('button:has-text("Create Account")')
    await expect(page.getByText(/tell us.*about yourself/i)).toBeVisible()
  })

  test('profile step skip advances to onboarding', async ({ page }) => {
    await page.goto('/register')
    await page.fill('[name="first_name"]', 'Skip')
    await page.fill('[name="last_name"]', 'Test')
    await page.fill('[type="email"]', uniqueEmail())
    await page.fill('[id="password"]', 'Testing!2024')
    await page.fill('[id="password_confirmation"]', 'Testing!2024')
    await page.click('[data-testid="terms-checkbox"]')
    await page.click('button:has-text("Create Account")')
    await expect(page.getByText(/tell us.*about yourself/i)).toBeVisible()
    await page.click('text=Skip for now')
    await expect(page).toHaveURL(/\/onboarding/)
  })

  test('all four intent cards visible on onboarding page', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page.getByText('Join a Workshop')).toBeVisible()
    await expect(page.getByText('Manage Workshops')).toBeVisible()
    await expect(page.getByText('Accept a Leader Invitation')).toBeVisible()
    await expect(page.getByText('Just Exploring')).toBeVisible()
  })

  test('Continue is disabled until intent selected', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page.getByRole('button', { name: /continue/i })).toBeDisabled()
    await page.click('text=Just Exploring')
    await expect(page.getByRole('button', { name: /continue/i })).toBeEnabled()
  })

})
