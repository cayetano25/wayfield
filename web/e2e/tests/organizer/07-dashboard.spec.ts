import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/owner.json' })

test.describe('Organizer Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/dashboard')
  })

  test('dashboard loads without errors or blank page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
    await expect(page.locator('text=Something went wrong')).not.toBeVisible()
    await expect(page.locator('text=404')).not.toBeVisible()
  })

  test('all four KPI cards are visible', async ({ page }) => {
    await expect(page.getByText('TOTAL WORKSHOPS')).toBeVisible()
    await expect(page.getByText('TOTAL PARTICIPANTS')).toBeVisible()
    await expect(page.getByText('SESSIONS THIS MONTH')).toBeVisible()
    await expect(page.getByText('CHECKED IN TODAY')).toBeVisible()
  })

  test('Next Up workshop card shows published workshop', async ({ page }) => {
    await expect(page.getByText('Natural Light & Portraiture 2025')).toBeVisible()
    await expect(page.getByRole('button', { name: /manage workshop/i })).toBeVisible()
  })

  test('sidebar nav items are all present', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"]')
    await expect(sidebar.getByRole('link', { name: /workshops/i })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: /settings/i })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: /members/i })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: /billing/i })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: /reports/i })).toBeVisible()
  })

  test('bottom-left profile section is absent (removed in nav update)', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"]')
    // The old bottom-left user section should be gone
    await expect(sidebar.locator('[data-testid="sidebar-user-profile"]')).not.toBeVisible()
  })

  test('top-right dropdown has My Workshops and Sign Out', async ({ page }) => {
    await page.click('[data-testid="user-menu-trigger"]')
    await expect(page.getByRole('menuitem', { name: /my workshops/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible()
  })

  test('My Workshops navigates to participant view', async ({ page }) => {
    await page.click('[data-testid="user-menu-trigger"]')
    await page.click('[role="menuitem"]:has-text("My Workshops")')
    await expect(page).toHaveURL(/\/my-workshops/)
  })

  test('Sign Out clears session', async ({ page }) => {
    await page.click('[data-testid="user-menu-trigger"]')
    await page.click('[role="menuitem"]:has-text("Sign Out")')
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('analytics cards show real data for starter plan (not locked)', async ({ page }) => {
    await expect(page.getByText('ATTENDANCE RATE')).toBeVisible()
    // Locked cards have a specific data-testid
    const lockedAttendance = page.locator('[data-testid="locked-card"]').filter({
      hasText: 'ATTENDANCE RATE'
    })
    await expect(lockedAttendance).not.toBeVisible()
  })

  test('registration trend is locked for starter plan', async ({ page }) => {
    const lockedTrend = page.locator('[data-testid="locked-card"]').filter({
      hasText: /registration trend/i
    })
    await expect(lockedTrend).toBeVisible()
  })

  test('all three stub cards are visible', async ({ page }) => {
    await expect(page.getByText('Revenue')).toBeVisible()
    await expect(page.getByText('Satisfaction Score')).toBeVisible()
    await expect(page.getByText('Engagement Score')).toBeVisible()
    await expect(page.getByText('Coming soon').first()).toBeVisible()
  })

  test('staff cannot access billing page', async ({ page, context }) => {
    await context.storageState({ path: 'e2e/.auth/staff.json' })
    await page.goto('/admin/organization/billing')
    await expect(page.getByText(/payment method|invoice|stripe/i)).not.toBeVisible()
  })

})
