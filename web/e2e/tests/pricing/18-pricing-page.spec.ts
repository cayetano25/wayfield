import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/owner.json' })

test.describe('Pricing and Billing Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/organization/billing')
  })

  test('billing page loads without 404', async ({ page }) => {
    await expect(page).not.toHaveURL(/404/)
    await expect(page.getByText(/plans|pricing|billing/i).first()).toBeVisible()
  })

  test('current plan shows Creator display name (not starter)', async ({ page }) => {
    // Seeded org is on starter plan — must display as Creator
    await expect(page.getByText('Creator')).toBeVisible()
    // The internal code should not appear as visible heading text
    const headings = page.locator('h1, h2, h3, [data-testid="current-plan-name"]')
    for (const h of await headings.all()) {
      const text = await h.textContent()
      expect(text?.toLowerCase()).not.toBe('starter')
    }
  })

  test('all four plan cards render', async ({ page }) => {
    await expect(page.getByText('Foundation')).toBeVisible()
    await expect(page.getByText('Creator')).toBeVisible()
    await expect(page.getByText('Studio')).toBeVisible()
    await expect(page.getByText('Enterprise')).toBeVisible()
  })

  test('Creator card does NOT mention custom branding', async ({ page }) => {
    const creatorCard = page.locator('[data-testid="plan-card-starter"]')
    await expect(creatorCard.getByText(/custom branding/i)).not.toBeVisible()
    await expect(creatorCard.getByText(/custom domain/i)).not.toBeVisible()
  })

  test('Studio card DOES mention custom branding', async ({ page }) => {
    const studioCard = page.locator('[data-testid="plan-card-pro"]')
    await expect(studioCard.getByText(/custom branding/i)).toBeVisible()
  })

  test('billing toggle changes displayed prices', async ({ page }) => {
    const monthlyPrice = await page.locator('[data-testid="creator-price"]').textContent()
    await page.click('button:has-text("Annual")')
    const annualPrice = await page.locator('[data-testid="creator-price"]').textContent()
    expect(monthlyPrice).not.toBe(annualPrice)
  })

  test('annual toggle shows Save 15% badge', async ({ page }) => {
    await page.click('button:has-text("Annual")')
    await expect(page.getByText(/save 15%/i)).toBeVisible()
  })

  test('FAQ has at least 10 questions', async ({ page }) => {
    const items = page.locator('[data-testid="faq-item"]')
    const count = await items.count()
    expect(count).toBeGreaterThanOrEqual(10)
  })

  test('FAQ accordion opens and closes', async ({ page }) => {
    const first = page.locator('[data-testid="faq-item"]').first()
    await first.click()
    await expect(first.locator('[data-testid="faq-answer"]')).toBeVisible()
    await first.click()
    await expect(first.locator('[data-testid="faq-answer"]')).not.toBeVisible()
  })

  test('success param shows toast and clears from URL', async ({ page }) => {
    await page.goto('/admin/organization/billing?success=1')
    await expect(page.getByText(/plan upgraded successfully/i)).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/organization\/billing$/)
  })

  test('canceled param shows informational toast', async ({ page }) => {
    await page.goto('/admin/organization/billing?canceled=1')
    await expect(page.getByText(/checkout canceled/i)).toBeVisible()
  })

})
