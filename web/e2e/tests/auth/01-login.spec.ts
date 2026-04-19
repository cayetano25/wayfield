import { test, expect } from '@playwright/test'
import { TEST_USERS } from '../../fixtures/auth.fixtures'

test.use({ storageState: 'e2e/.auth/guest.json' })

test.describe('Login Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  // -- Rendering ------------------------------------------------

  test('login page renders all required elements', async ({ page }) => {
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.locator('[type="email"]')).toBeVisible()
    await expect(page.locator('[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /facebook/i })).toBeVisible()
    await expect(page.getByText(/create your account/i)).toBeVisible()
    // Right marketing panel
    await expect(page.getByText('Every workshop,')).toBeVisible()
    await expect(page.getByText('perfectly')).toBeVisible()
  })

  // -- Validation -----------------------------------------------

  test('empty submit shows email required error', async ({ page }) => {
    await page.click('button:has-text("Sign in")')
    await expect(page.getByText(/email.*required/i)).toBeVisible()
  })

  test('invalid email format shows format error', async ({ page }) => {
    await page.fill('[type="email"]', 'notanemail')
    await page.fill('[type="password"]', 'anything')
    await page.click('[type="email"]')
    await page.keyboard.press('Tab')
    await expect(page.getByText(/valid email/i)).toBeVisible()
  })

  test('wrong password shows auth error', async ({ page }) => {
    await page.fill('[type="email"]', TEST_USERS.owner.email)
    await page.fill('[type="password"]', 'WrongPassword999')
    await page.click('button:has-text("Sign in")')
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible()
  })

  // -- Password toggle ------------------------------------------

  test('show/hide password toggle works', async ({ page }) => {
    await page.fill('[type="password"]', 'mypassword')
    await page.click('[data-testid="password-toggle"]')
    await expect(page.locator('[name="password"][type="text"]')).toBeVisible()
    await page.click('[data-testid="password-toggle"]')
    await expect(page.locator('[name="password"][type="password"]')).toBeVisible()
  })

  // -- Post-login routing ---------------------------------------

  test('organizer lands on admin dashboard', async ({ page }) => {
    await page.fill('[type="email"]', TEST_USERS.owner.email)
    await page.fill('[type="password"]', TEST_USERS.owner.password)
    await page.click('button:has-text("Sign in")')
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 })
  })

  test('participant lands on my-workshops', async ({ page }) => {
    await page.fill('[type="email"]', TEST_USERS.participant.email)
    await page.fill('[type="password"]', TEST_USERS.participant.password)
    await page.click('button:has-text("Sign in")')
    await expect(page).toHaveURL(/\/my-workshops/, { timeout: 10000 })
  })

  test('leader lands on leader dashboard', async ({ page }) => {
    await page.fill('[type="email"]', TEST_USERS.leader.email)
    await page.fill('[type="password"]', TEST_USERS.leader.password)
    await page.click('button:has-text("Sign in")')
    await expect(page).toHaveURL(/\/leader\/dashboard/, { timeout: 10000 })
  })

  // -- Navigation -----------------------------------------------

  test('forgot password navigates correctly', async ({ page }) => {
    await page.click('text=Forgot password?')
    await expect(page).toHaveURL(/forgot-password/)
  })

  test('create account navigates to register', async ({ page }) => {
    await page.click('text=Create your account')
    await expect(page).toHaveURL(/\/register/)
  })

})
