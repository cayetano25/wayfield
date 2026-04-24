import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8000/api/v1';

const VALID_WORKSHOP_RESPONSE = {
  join_code: { code: 'ABC123', is_valid: true },
  workshop: {
    id: 42,
    title: 'Landscape Photography Workshop',
    workshop_type: 'session_based',
    start_date: '2026-05-03',
    end_date: '2026-05-05',
    timezone: 'America/New_York',
    public_summary: 'A hands-on landscape photography workshop in the mountains.',
    description: 'A hands-on landscape photography workshop in the mountains. Join us for three days.',
    social_share_image_url: null,
    default_location: { city: 'Asheville', state_or_region: 'NC' },
  },
  user_state: { is_authenticated: false, is_already_registered: false },
};

const INVALID_CODE_RESPONSE = {
  join_code: { code: 'BADCODE', is_valid: false },
  error: 'This join code is not valid or the workshop is no longer active.',
};

test.describe('Well-known files', () => {
  test('apple-app-site-association returns 200 with Content-Type: application/json', async ({ request }) => {
    const res = await request.get('/.well-known/apple-app-site-association');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    expect(body).toHaveProperty('applinks');
    expect(body.applinks.details[0].paths).toContain('/j/*');
  });

  test('assetlinks.json returns 200 with Content-Type: application/json', async ({ request }) => {
    const res = await request.get('/.well-known/assetlinks.json');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty('target');
    expect(body[0].target.package_name).toBe('com.wayfield.mobile');
  });
});

test.describe('/j/[code] — valid join code', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${API_BASE}/join/ABC123`, (route) =>
      route.fulfill({ json: VALID_WORKSHOP_RESPONSE }),
    );
  });

  test('renders workshop title and Join button', async ({ page }) => {
    await page.goto('/j/ABC123');
    await expect(page.getByRole('heading', { name: 'Landscape Photography Workshop' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Join Workshop' })).toBeVisible();
  });

  test('shows date range and location', async ({ page }) => {
    await page.goto('/j/ABC123');
    await expect(page.getByRole('heading', { name: 'Landscape Photography Workshop' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/May 3.*May 5.*2026/)).toBeVisible();
    await expect(page.getByText('Asheville, NC')).toBeVisible();
  });

  test('shows public_summary in description', async ({ page }) => {
    await page.goto('/j/ABC123');
    await expect(page.getByRole('heading', { name: 'Landscape Photography Workshop' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('A hands-on landscape photography workshop in the mountains.')).toBeVisible();
  });

  test('robots noindex meta tag is present', async ({ page }) => {
    await page.goto('/j/ABC123');
    // noindex is set in generateMetadata regardless of API response
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex/);
  });

  test('app store download links are visible', async ({ page }) => {
    await page.goto('/j/ABC123');
    await expect(page.getByRole('heading', { name: 'Landscape Photography Workshop' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('App Store').first()).toBeVisible();
    await expect(page.getByText('Google Play').first()).toBeVisible();
  });
});

test.describe('/j/[code] — invalid join code', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${API_BASE}/join/BADCODE`, (route) =>
      route.fulfill({ json: INVALID_CODE_RESPONSE }),
    );
  });

  test('renders error state with Invalid Join Code heading', async ({ page }) => {
    await page.goto('/j/BADCODE');
    await expect(page.getByRole('heading', { name: 'Invalid Join Code' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Contact your workshop organizer for a valid code.')).toBeVisible();
  });

  test('robots noindex is present on error page', async ({ page }) => {
    await page.goto('/j/BADCODE');
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex/);
  });

  test('no Join Workshop button on error page', async ({ page }) => {
    await page.goto('/j/BADCODE');
    await expect(page.getByRole('heading', { name: 'Invalid Join Code' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Join Workshop' })).not.toBeVisible();
  });
});

test.describe('/j/[code] — unauthenticated join flow', () => {
  // These tests simulate a user with no auth token. Clear stored cookies so
  // the Next.js middleware does not redirect /login → /dashboard.
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('Join button stores pendingJoin in sessionStorage and redirects to login', async ({ page }) => {
    await page.route(`${API_BASE}/join/ABC123`, (route) =>
      route.fulfill({ json: VALID_WORKSHOP_RESPONSE }),
    );

    await page.goto('/j/ABC123');
    await expect(page.getByRole('button', { name: 'Join Workshop' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Join Workshop' }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });

    const stored = await page.evaluate(() => sessionStorage.getItem('pendingJoin'));
    expect(stored).toBe('/j/ABC123');
  });

  test('after login, pendingJoin in sessionStorage is consumed and user redirected back', async ({ page }) => {
    await page.route(`${API_BASE}/auth/login`, (route) =>
      route.fulfill({
        json: {
          token: 'fake-token',
          user: {
            id: 1,
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            email_verified: true,
            is_active: true,
            profile_image_url: null,
            onboarding_intent: 'participant',
            onboarding_completed_at: '2026-01-01T00:00:00Z',
            organizations: [],
          },
        },
      }),
    );
    await page.route(`${API_BASE}/join/ABC123`, (route) =>
      route.fulfill({ json: VALID_WORKSHOP_RESPONSE }),
    );

    // Navigate to login directly (no auth cookie — middleware won't redirect)
    await page.goto('/login');
    await page.evaluate(() => sessionStorage.setItem('pendingJoin', '/j/ABC123'));

    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should redirect to the pending join URL
    await expect(page).toHaveURL(/\/j\/ABC123/, { timeout: 8000 });

    const stored = await page.evaluate(() => sessionStorage.getItem('pendingJoin'));
    expect(stored).toBeNull();
  });
});

test.describe('/j/[code] — mobile banner', () => {
  test('mobile banner is visible on mobile UA', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.route(`${API_BASE}/join/ABC123`, (route) =>
      route.fulfill({ json: VALID_WORKSHOP_RESPONSE }),
    );

    await page.goto('/j/ABC123');
    await expect(page.getByRole('heading', { name: 'Landscape Photography Workshop' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Get the Wayfield app for the best experience')).toBeVisible();
    await context.close();
  });

  test('mobile banner can be dismissed', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.route(`${API_BASE}/join/ABC123`, (route) =>
      route.fulfill({ json: VALID_WORKSHOP_RESPONSE }),
    );

    await page.goto('/j/ABC123');
    await expect(page.getByRole('heading', { name: 'Landscape Photography Workshop' })).toBeVisible({ timeout: 10_000 });
    await page.getByText('Continue in browser →').click();
    await expect(page.getByText('Get the Wayfield app for the best experience')).not.toBeVisible();
    await context.close();
  });
});
