import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/owner.json' })

test.describe('Reports Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/reports')
  })

  test('reports page loads without 404', async ({ page }) => {
    await expect(page).not.toHaveURL(/404/)
    await expect(page.getByText(/reports/i).first()).toBeVisible()
  })

  test('all four tabs render', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /attendance/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /workshops/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /participants/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /registration trend/i })).toBeVisible()
  })

  test('attendance tab shows summary data', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Attendance")')
    await expect(page.getByText(/total registered/i)).toBeVisible()
    await expect(page.getByText(/attendance rate/i)).toBeVisible()
  })

  test('registration trend is locked for starter plan', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Registration Trend")')
    await expect(page.getByText(/available on the pro plan/i)).toBeVisible()
  })

  test('participants tab prompts for workshop selection', async ({ page }) => {
    await page.click('[role="tab"]:has-text("Participants")')
    await expect(page.getByText(/select a workshop/i)).toBeVisible()
  })

  test('sidebar reports link navigates here', async ({ page }) => {
    await page.goto('/dashboard')
    await page.locator('[data-testid="sidebar"]').getByRole('link', { name: /reports/i }).click()
    await expect(page).toHaveURL(/\/reports/)
  })

  test('View Reports button on dashboard navigates here', async ({ page }) => {
    await page.goto('/dashboard')
    await page.click('button:has-text("View Reports")')
    await expect(page).toHaveURL(/\/reports/)
  })

})
