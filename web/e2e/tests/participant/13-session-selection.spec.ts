import { test, expect } from '@playwright/test'
import { TEST_WORKSHOP } from '../../fixtures/auth.fixtures'

// Use mobile viewport for this test — session selection is mobile-first
test.use({
  storageState: 'e2e/.auth/participant.json',
  viewport: { width: 390, height: 844 },
})

const WORKSHOP_ID = 1

test.describe('Session Selection (Mobile)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`/workshops/${WORKSHOP_ID}/select-sessions`)
  })

  test('session selection page loads without 404', async ({ page }) => {
    await expect(page).not.toHaveURL(/404/)
    await expect(page.getByText(/select sessions/i)).toBeVisible()
  })

  test('workshop context banner shows correct name', async ({ page }) => {
    await expect(page.getByText(TEST_WORKSHOP.title)).toBeVisible()
  })

  test('DONE button is disabled when nothing is selected', async ({ page }) => {
    const done = page.locator('button:has-text("DONE"), [data-testid="done-button"]')
    await expect(done).toBeDisabled()
  })

  test('tapping a session card selects it and updates the count', async ({ page }) => {
    const card = page.locator('[data-testid="session-card"]')
      .filter({ hasText: TEST_WORKSHOP.sessions.wildlife })
    await card.locator('[data-testid="selection-toggle"]').click()

    // Count badge should now show 1
    await expect(page.locator('[data-testid="selection-count-badge"]'))
      .toContainText('1')

    // Card should show selected state
    await expect(card).toHaveAttribute('data-state', 'selected')
  })

  test('selecting one session marks the overlapping session as conflicted', async ({ page }) => {
    // Golden Hour and Composition Theory overlap
    const goldenHour = page.locator('[data-testid="session-card"]')
      .filter({ hasText: TEST_WORKSHOP.sessions.goldenHour })
    await goldenHour.locator('[data-testid="selection-toggle"]').click()

    const conflictCard = page.locator('[data-testid="session-card"]')
      .filter({ hasText: TEST_WORKSHOP.sessions.compositionConflict })

    await expect(conflictCard).toHaveAttribute('data-state', 'conflicted')
    await expect(conflictCard.getByText(/conflicts with/i)).toBeVisible()
  })

  test('tapping a conflicted session does not change the count', async ({ page }) => {
    // Select one session
    await page.locator('[data-testid="session-card"]')
      .filter({ hasText: TEST_WORKSHOP.sessions.goldenHour })
      .locator('[data-testid="selection-toggle"]')
      .click()

    const countBefore = await page.locator('[data-testid="selection-count-badge"]')
      .textContent()

    // Try to tap the conflicting session
    await page.locator('[data-testid="session-card"]')
      .filter({ hasText: TEST_WORKSHOP.sessions.compositionConflict })
      .locator('[data-testid="selection-toggle"]')
      .click()

    const countAfter = await page.locator('[data-testid="selection-count-badge"]')
      .textContent()

    // Count must not have changed
    expect(countBefore).toBe(countAfter)
    // No dialog or alert should appear
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('View My Schedule opens the bottom sheet', async ({ page }) => {
    // Select first
    await page.locator('[data-testid="session-card"]')
      .filter({ hasText: TEST_WORKSHOP.sessions.wildlife })
      .locator('[data-testid="selection-toggle"]')
      .click()

    await page.click('[data-testid="view-schedule-btn"]')
    await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible()
    await expect(page.getByText('My Schedule')).toBeVisible()
    await expect(page.getByText(TEST_WORKSHOP.sessions.wildlife)).toBeVisible()
  })

  test('deselecting from the sheet updates the count', async ({ page }) => {
    await page.locator('[data-testid="session-card"]')
      .filter({ hasText: TEST_WORKSHOP.sessions.wildlife })
      .locator('[data-testid="selection-toggle"]')
      .click()

    await page.click('[data-testid="view-schedule-btn"]')

    await page.locator('[data-testid="schedule-sheet"]')
      .locator('[data-testid="deselect-btn"]')
      .first()
      .click()

    await expect(page.locator('[data-testid="selection-count-badge"]'))
      .toContainText('0')
  })

  test('confirming shows success state with session summary', async ({ page }) => {
    await page.locator('[data-testid="session-card"]')
      .filter({ hasText: TEST_WORKSHOP.sessions.wildlife })
      .locator('[data-testid="selection-toggle"]')
      .click()

    await page.click('[data-testid="view-schedule-btn"]')
    await page.click('button:has-text("Confirm")')

    await expect(page.getByText(/you're all set/i)).toBeVisible()
    await expect(page.getByText(TEST_WORKSHOP.sessions.wildlife)).toBeVisible()
  })

  test('organizer without registration cannot access this page', async ({ page, context }) => {
    await context.storageState({ path: 'e2e/.auth/owner.json' })
    await page.goto(`/workshops/${WORKSHOP_ID}/select-sessions`)
    await expect(page.getByText(/not registered/i)).toBeVisible()
  })

})
