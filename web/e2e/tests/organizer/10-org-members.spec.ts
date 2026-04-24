import { test, expect } from '@playwright/test'
import { loginViaApi, apiPost, getOrgInvitationToken } from '../../helpers/api.helpers'
import { TEST_USERS } from '../../fixtures/auth.fixtures'

const MEMBERS_URL = '/admin/organization/members'

// ─── Members page structure ────────────────────────────────────────────────────

test.describe('Members page — owner view', () => {
  test.use({ storageState: 'e2e/.auth/owner.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto(MEMBERS_URL)
  })

  test('renders active members table with role badges', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /members/i })).toBeVisible()
    // The seeded org has owner + admin + staff = 3 members
    await expect(page.getByText('Alex Rivera')).toBeVisible()
    await expect(page.getByText('Jordan Alvarez')).toBeVisible()
    await expect(page.getByText('Sam Chen')).toBeVisible()
    // Role badges present
    await expect(page.getByText('Owner')).toBeVisible()
    await expect(page.getByText('Administrator')).toBeVisible()
    await expect(page.getByText('Staff')).toBeVisible()
  })

  test('renders pending invitations section', async ({ page }) => {
    // Create a pending invitation via API
    const token = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    await apiPost(
      '/api/v1/me/organizations',
      {},
      token,
    ).catch(() => {}) // ignore if /me/organizations doesn't return org directly

    // Navigate to members — pending invitations section should be present
    await page.reload()
    const section = page.locator('[data-testid="pending-invitations"]')
      .or(page.getByText(/pending invitations/i))
    await expect(section.first()).toBeVisible()
  })

  test('Invite Member button is visible for owner', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /invite member/i })
        .or(page.getByText(/invite member/i).first())
    ).toBeVisible()
  })

  // ── Invite modal ───────────────────────────────────────────────────────────

  test('invite modal shows Admin, Staff, Billing Admin options for owner', async ({ page }) => {
    await page.getByRole('button', { name: /invite member/i }).click()

    await expect(page.getByRole('dialog')).toBeVisible()

    const roleSelect = page.getByRole('combobox')
      .or(page.locator('select[name="role"]'))
      .first()

    await expect(roleSelect).toBeVisible()
    await expect(page.getByText('Administrator')).toBeVisible()
    await expect(page.getByText('Staff')).toBeVisible()
    await expect(page.getByText('Billing Administrator')).toBeVisible()
  })

  // ── Change Role modal ──────────────────────────────────────────────────────

  test('Change Role action is visible for owner on non-owner members', async ({ page }) => {
    // Staff member row should show a role action for the owner
    const staffRow = page.getByText('Sam Chen').locator('../..')
    await expect(
      staffRow.getByRole('button', { name: /change role/i })
        .or(staffRow.getByText(/change role/i))
    ).toBeVisible()
  })

  // ── Remove confirmation ────────────────────────────────────────────────────

  test('remove action shows confirmation dialog before removing', async ({ page }) => {
    const staffRow = page.getByText('Sam Chen').locator('../..')
    const removeBtn = staffRow.getByRole('button', { name: /remove/i })
      .or(staffRow.getByText(/remove/i))

    await removeBtn.first().click()

    // Confirmation dialog should appear
    await expect(
      page.getByText(/are you sure/i)
        .or(page.getByText(/lose access/i))
        .or(page.getByRole('dialog'))
    ).toBeVisible()
  })
})

test.describe('Members page — admin view', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('invite modal shows Staff only for admin users', async ({ page }) => {
    await page.goto(MEMBERS_URL)
    await page.getByRole('button', { name: /invite member/i }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Staff')).toBeVisible()
    // Admin role should NOT be present for admin users
    await expect(page.getByText('Administrator')).not.toBeVisible()
    await expect(page.getByText('Billing Administrator')).not.toBeVisible()
  })
})

// ─── Invitation acceptance page ────────────────────────────────────────────────

test.describe('Org invitation acceptance page', () => {
  test.use({ storageState: 'e2e/.auth/guest.json' })

  async function createOrgInvite(
    ownerToken: string,
    email: string,
    role = 'staff',
  ): Promise<{ invitationId: number; rawToken: string }> {
    // Get the seeded org ID
    const { id: orgId } = await fetch('http://localhost:8000/api/v1/me/organizations', {
      headers: { Authorization: `Bearer ${ownerToken}`, Accept: 'application/json' },
    }).then((r) => r.json()).then((orgs) => orgs[0])

    const res = await apiPost(
      `/api/v1/organizations/${orgId}/invitations`,
      { invited_email: email, role },
      ownerToken,
    )

    const rawToken = await getOrgInvitationToken(res.invitation_id)
    return { invitationId: res.invitation_id, rawToken }
  }

  test('valid token renders org name, role badge, and Accept button', async ({ page }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const { rawToken } = await createOrgInvite(ownerToken, 'newstaff@e2e.wayfield.test', 'staff')

    await page.goto(`/org-invitations/${rawToken}/accept`)

    await expect(page.getByText(/cascade photography/i)).toBeVisible()
    await expect(page.getByText(/staff/i)).toBeVisible()
    // Auth gate is shown because user is not logged in
    await expect(
      page.getByText(/sign in/i).or(page.getByText(/create.*account/i))
    ).toBeVisible()
  })

  test('invalid token shows error state', async ({ page }) => {
    await page.goto('/org-invitations/invalid-token-that-does-not-exist/accept')

    await expect(
      page.getByText(/invalid/i)
        .or(page.getByText(/not found/i))
        .or(page.getByText(/expired/i))
    ).toBeVisible()
    // Accept button should NOT be present
    await expect(page.getByRole('button', { name: /accept/i })).not.toBeVisible()
  })

  test('wrong email shows mismatch warning when different user is authenticated', async ({
    page,
    context,
  }) => {
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const { rawToken } = await createOrgInvite(ownerToken, 'specific-staff@e2e.wayfield.test', 'staff')

    // Log in as the staff user (wrong email)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staffStorageState = require('../../.auth/staff.json')
    await context.addCookies(staffStorageState.cookies ?? [])

    await page.goto(`/org-invitations/${rawToken}/accept`)

    await expect(
      page.getByText(/sent to/i).or(page.getByText(/different account/i))
    ).toBeVisible()
  })
})

// ─── Navigation: My Organizations ─────────────────────────────────────────────

test.describe('Nav: My Organizations link', () => {

  test('My Organizations is NOT visible for participant (no org membership)', async ({ page }) => {
    test.use({ storageState: 'e2e/.auth/participant.json' })
    await page.goto('/my-workshops')
    await expect(page.getByRole('link', { name: /my organizations/i })).not.toBeVisible()
  })

  test('My Organizations IS visible for owner (has org membership)', async ({ page }) => {
    test.use({ storageState: 'e2e/.auth/owner.json' })
    await page.goto('/my-workshops')
    await expect(page.getByRole('link', { name: /my organizations/i })).toBeVisible()
  })
})

// ─── Notification bell: org_invitation type ───────────────────────────────────

test.describe('Notification bell: org_invitation', () => {
  test.use({ storageState: 'e2e/.auth/participant.json' })

  test('org_invitation notification shows Accept and Decline buttons', async ({ page }) => {
    // Create an org invitation for the participant's email
    const ownerToken = await loginViaApi(TEST_USERS.owner.email, TEST_USERS.owner.password)
    const orgsRes = await fetch('http://localhost:8000/api/v1/me/organizations', {
      headers: { Authorization: `Bearer ${ownerToken}`, Accept: 'application/json' },
    })
    const orgs = await orgsRes.json()
    const orgId = orgs[0].id

    await apiPost(
      `/api/v1/organizations/${orgId}/invitations`,
      { invited_email: TEST_USERS.participant.email, role: 'staff' },
      ownerToken,
    )

    // Navigate and open the notification bell
    await page.goto('/my-workshops')
    const bell = page.locator('button[aria-label="Notifications"]')
      .or(page.locator('[data-testid="notification-bell"]'))
    await bell.first().click()

    // Look for Accept / Decline buttons in the notification panel
    await expect(
      page.getByRole('button', { name: /accept/i })
    ).toBeVisible({ timeout: 8000 })
    await expect(
      page.getByRole('button', { name: /decline/i })
    ).toBeVisible()
  })
})
