import { test, expect } from '@playwright/test'
import { loginViaApi, apiPost, getOrgInvitationToken } from '../../helpers/api.helpers'
import { TEST_USERS } from '../../fixtures/auth.fixtures'

test.use({ storageState: 'e2e/.auth/guest.json' })

// Helper: creates a pending org invitation and returns the raw accept token.
async function createOrgInvitation(
  ownerToken: string,
  email: string,
  role = 'staff',
): Promise<{ invitationId: number; rawToken: string }> {
  const orgsRes = await fetch('http://localhost:8000/api/v1/me/organizations', {
    headers: { Authorization: `Bearer ${ownerToken}`, Accept: 'application/json' },
  })
  const orgs = await orgsRes.json()
  const orgId: number = orgs[0].id

  const res = await apiPost(
    `/api/v1/organizations/${orgId}/invitations`,
    { invited_email: email, role },
    ownerToken,
  )

  const rawToken = await getOrgInvitationToken(res.invitation_id as number)
  return { invitationId: res.invitation_id as number, rawToken }
}

test.describe('Org Member Invitation — acceptance page', () => {

  test('accept page URL does not 404', async ({ page }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const { rawToken } = await createOrgInvitation(ownerToken, 'new-org-member@e2e.wayfield.test')

    await page.goto(`/org-invitations/${rawToken}/accept`)

    await expect(page).not.toHaveURL(/404/)
    await expect(page.locator('text=404')).not.toBeVisible()
    await expect(page.locator('text=Page not found')).not.toBeVisible()
  })

  test('valid token renders org name and role', async ({ page }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const { rawToken } = await createOrgInvitation(ownerToken, 'staff-invite@e2e.wayfield.test', 'staff')

    await page.goto(`/org-invitations/${rawToken}/accept`)

    await expect(page.getByText(/cascade photography/i)).toBeVisible()
    await expect(page.getByText(/staff/i)).toBeVisible()
  })

  test('invalid token shows error state with no Accept button', async ({ page }) => {
    await page.goto('/org-invitations/completely-invalid-token-abc123/accept')

    await expect(
      page.getByText(/invalid/i)
        .or(page.getByText(/not found/i))
        .or(page.getByText(/expired/i))
    ).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /accept/i })).not.toBeVisible()
  })

  test('accept page for unknown email shows registration form', async ({ page }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const { rawToken } = await createOrgInvitation(ownerToken, 'unknown-org-member@e2e.wayfield.test')

    await page.goto(`/org-invitations/${rawToken}/accept`)

    // Auth gate renders because the user is not logged in
    await expect(
      page.getByText(/create.*account/i)
        .or(page.getByText(/sign in/i))
    ).toBeVisible()
    await expect(page.getByText('unknown-org-member@e2e.wayfield.test')).toBeVisible()
  })

  test('accept page for known email shows login form', async ({ page }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const { rawToken } = await createOrgInvitation(ownerToken, TEST_USERS.staff.email, 'billing_admin')

    await page.goto(`/org-invitations/${rawToken}/accept`)

    await expect(
      page.getByText(/sign in/i).or(page.getByText(/log in/i))
    ).toBeVisible()
    await expect(page.locator('[type="password"]')).toBeVisible()
  })

  test('wrong authenticated user sees mismatch warning', async ({ page, context }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const { rawToken } = await createOrgInvitation(ownerToken, 'mismatch-target@e2e.wayfield.test')

    // Use the owner storage state (different email from invited address)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ownerState = require('../../.auth/owner.json')
    if (ownerState.cookies?.length) await context.addCookies(ownerState.cookies)
    if (ownerState.origins?.length) await context.addInitScript(() => {
      // Inject localStorage from state
    })

    await page.goto(`/org-invitations/${rawToken}/accept`)

    await expect(
      page.getByText(/sent to/i)
        .or(page.getByText(/different account/i))
        .or(page.getByText(/mismatch/i))
    ).toBeVisible({ timeout: 8000 })
  })
})
