import { test, expect } from '@playwright/test'
import { loginViaApi, apiPost, getInvitationToken } from '../../helpers/api.helpers'
import { TEST_USERS } from '../../fixtures/auth.fixtures'

test.use({ storageState: 'e2e/.auth/guest.json' })

test.describe('Leader Invitation Flow', () => {

  async function createLeaderInvite(ownerToken: string, email: string) {
    // simplified — get org ID from seeded data
    const inviteRes = await apiPost(
      `/api/v1/organizations/1/leaders/invitations`,
      { invited_email: email, invited_first_name: 'Test', invited_last_name: 'Leader' },
      ownerToken
    )
    return inviteRes
  }

  test('accept URL does not 404 — regression test for original bug', async ({ page }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const invite     = await createLeaderInvite(ownerToken, 'new-leader@e2e.wayfield.test')
    const rawToken   = await getInvitationToken(invite.invitation_id)

    await page.goto(`/leader-invitations/${rawToken}/accept`)

    await expect(page).not.toHaveURL(/404/)
    await expect(page.locator('text=404')).not.toBeVisible()
    await expect(page.locator('text=Page not found')).not.toBeVisible()
  })

  test('decline URL does not 404', async ({ page }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const invite     = await createLeaderInvite(ownerToken, 'new-leader2@e2e.wayfield.test')
    const rawToken   = await getInvitationToken(invite.invitation_id)

    await page.goto(`/leader-invitations/${rawToken}/decline`)

    await expect(page).not.toHaveURL(/404/)
    await expect(page.getByText(/decline this invitation/i)).toBeVisible()
  })

  test('accept page shows new user registration form for unknown email', async ({ page }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const invite     = await createLeaderInvite(ownerToken, 'unknown-leader@e2e.wayfield.test')
    const rawToken   = await getInvitationToken(invite.invitation_id)

    await page.goto(`/leader-invitations/${rawToken}/accept`)

    await expect(page.getByText(/create your.*account.*to accept/i)).toBeVisible()
    await expect(page.locator('[type="email"]')).not.toBeVisible()
    await expect(page.getByText('unknown-leader@e2e.wayfield.test')).toBeVisible()
  })

  test('accept page shows login form for existing user email', async ({ page }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const invite     = await createLeaderInvite(ownerToken, TEST_USERS.leader.email)
    const rawToken   = await getInvitationToken(invite.invitation_id)

    await page.goto(`/leader-invitations/${rawToken}/accept`)

    await expect(page.getByText(/sign in to accept/i)).toBeVisible()
    await expect(page.locator('[type="password"]')).toBeVisible()
    await expect(page.locator('[type="email"]')).not.toBeVisible()
  })

  test('email mismatch shows error when wrong user is logged in', async ({ page, context }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const invite     = await createLeaderInvite(ownerToken, 'specific-leader@e2e.wayfield.test')
    const rawToken   = await getInvitationToken(invite.invitation_id)

    // Log in as owner but use a leader invitation for different email
    await context.storageState({ path: 'e2e/.auth/owner.json' })
    await page.goto(`/leader-invitations/${rawToken}/accept`)

    await expect(page.getByText(/invitation was sent to/i)).toBeVisible()
    await expect(page.getByText('specific-leader@e2e.wayfield.test')).toBeVisible()
  })

  test('expired token shows expired state not a crash', async ({ page }) => {
    await page.goto('/leader-invitations/this-is-not-a-real-token-xyz/accept')
    await expect(
      page.getByText(/not found|expired|invalid/i)
    ).toBeVisible()
    await expect(page.locator('text=500')).not.toBeVisible()
  })

  test('decline page shows neutral confirmation after declining', async ({ page }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const invite     = await createLeaderInvite(ownerToken, 'decliner@e2e.wayfield.test')
    const rawToken   = await getInvitationToken(invite.invitation_id)

    await page.goto(`/leader-invitations/${rawToken}/decline`)
    await page.click('button:has-text("Decline")')
    await expect(page.getByText('Invitation declined')).toBeVisible()
  })

})
