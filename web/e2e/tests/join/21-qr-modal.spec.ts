import { test, expect, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:8000/api/v1';
const WORKSHOP_ID = '42';

const PUBLISHED_WORKSHOP = {
  id: 42,
  title: 'Landscape Photography Workshop',
  status: 'published',
  workshop_type: 'session_based',
  start_date: '2026-05-03',
  end_date: '2026-05-05',
  timezone: 'America/New_York',
  join_code: 'ABC123',
  public_page_enabled: true,
  header_image_url: null,
  sessions_count: 3,
  participants_count: 12,
  confirmed_leaders: [],
  logistics: null,
};

const DRAFT_WORKSHOP = {
  ...PUBLISHED_WORKSHOP,
  status: 'draft',
};

async function setupWorkshopPage(page: Page, workshop: typeof PUBLISHED_WORKSHOP) {
  await page.route(`${API_BASE}/workshops/${WORKSHOP_ID}`, (route) =>
    route.fulfill({ json: workshop }),
  );
  await page.route(`${API_BASE}/workshops/${WORKSHOP_ID}/sessions`, (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto(`/workshops/${WORKSHOP_ID}`);
  // Wait for the join code to be visible (workshop data loaded)
  await expect(page.getByText(workshop.join_code)).toBeVisible({ timeout: 10_000 });
}

test.describe('QR modal — published workshop', () => {
  test('camera icon is enabled and opens modal', async ({ page }) => {
    await setupWorkshopPage(page, PUBLISHED_WORKSHOP);

    const cameraBtn = page.getByTestId('qr-camera-btn');
    await expect(cameraBtn).not.toBeDisabled();
    await expect(cameraBtn).not.toHaveClass(/opacity-40/);
    await expect(cameraBtn).not.toHaveClass(/cursor-not-allowed/);

    await cameraBtn.click();
    const modal = page.getByTestId('qr-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Workshop QR Code')).toBeVisible();
    await expect(modal.getByText('Landscape Photography Workshop')).toBeVisible();
  });

  test('QR code SVG value encodes wayfield.app join URL', async ({ page }) => {
    await setupWorkshopPage(page, PUBLISHED_WORKSHOP);
    await page.getByTestId('qr-camera-btn').click();
    await expect(page.getByTestId('qr-modal')).toBeVisible();

    const modal = page.getByTestId('qr-modal');
    // The visible URL hint shows the correct domain
    await expect(modal.getByText(/wayfield\.app\/j\/ABC123/)).toBeVisible();

    // Verify no alternative domain appears
    const modalText = await modal.textContent();
    expect(modalText).not.toContain('wayfieldapp.com');
  });

  test('Copy Link copies the wayfield.app join URL', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setupWorkshopPage(page, PUBLISHED_WORKSHOP);
    await page.getByTestId('qr-camera-btn').click();

    await page.getByTestId('copy-link-btn').click();
    await expect(page.getByText('Copied ✓')).toBeVisible();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe('https://wayfield.app/j/ABC123');
  });

  test('Copy Link button resets to "Copy Link" after 2 seconds', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setupWorkshopPage(page, PUBLISHED_WORKSHOP);
    await page.getByTestId('qr-camera-btn').click();

    await page.getByTestId('copy-link-btn').click();
    await expect(page.getByText('Copied ✓')).toBeVisible();
    await expect(page.getByText('Copy Link')).toBeVisible({ timeout: 3000 });
  });

  test('Download button triggers PNG download named wayfield-qr-{code}.png', async ({ page }) => {
    await setupWorkshopPage(page, PUBLISHED_WORKSHOP);
    await page.getByTestId('qr-camera-btn').click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-btn').click(),
    ]);
    expect(download.suggestedFilename()).toBe('wayfield-qr-ABC123.png');
  });

  test('Escape key closes modal when not in full-screen', async ({ page }) => {
    await setupWorkshopPage(page, PUBLISHED_WORKSHOP);
    await page.getByTestId('qr-camera-btn').click();
    await expect(page.getByTestId('qr-modal')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('qr-modal')).not.toBeVisible();
  });
});

test.describe('QR modal — full-screen mode', () => {
  test('Full Screen button shows full-screen overlay with enlarged QR', async ({ page }) => {
    await setupWorkshopPage(page, PUBLISHED_WORKSHOP);
    await page.getByTestId('qr-camera-btn').click();

    await page.getByTestId('fullscreen-btn').click();
    await expect(page.getByTestId('qr-fullscreen')).toBeVisible();

    // Modal chrome should be gone
    await expect(page.getByTestId('qr-modal')).not.toBeVisible();

    // Join code still visible
    await expect(page.getByText('ABC123').first()).toBeVisible();

    // "Tap to exit" hint visible
    await expect(page.getByText('Tap anywhere to exit')).toBeVisible();
  });

  test('Clicking full-screen overlay exits full-screen', async ({ page }) => {
    await setupWorkshopPage(page, PUBLISHED_WORKSHOP);
    await page.getByTestId('qr-camera-btn').click();
    await page.getByTestId('fullscreen-btn').click();

    await expect(page.getByTestId('qr-fullscreen')).toBeVisible();
    await page.getByTestId('qr-fullscreen').click();

    await expect(page.getByTestId('qr-fullscreen')).not.toBeVisible();
    await expect(page.getByTestId('qr-modal')).toBeVisible();
  });

  test('Escape key exits full-screen (not modal) on first press', async ({ page }) => {
    await setupWorkshopPage(page, PUBLISHED_WORKSHOP);
    await page.getByTestId('qr-camera-btn').click();
    await page.getByTestId('fullscreen-btn').click();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('qr-fullscreen')).not.toBeVisible();
    // Modal should still be open
    await expect(page.getByTestId('qr-modal')).toBeVisible();
  });

  test('Wake lock is requested when entering full-screen (API mocked)', async ({ page }) => {
    let wakeLockRequested = false;
    await page.addInitScript(() => {
      // Stub navigator.wakeLock
      Object.defineProperty(navigator, 'wakeLock', {
        value: {
          request: async (_type: string) => {
            (window as unknown as Record<string, boolean>).__wakeLockRequested = true;
            return { release: () => { (window as unknown as Record<string, boolean>).__wakeLockReleased = true; } };
          },
        },
        configurable: true,
      });
    });

    await setupWorkshopPage(page, PUBLISHED_WORKSHOP);
    await page.getByTestId('qr-camera-btn').click();
    await page.getByTestId('fullscreen-btn').click();

    wakeLockRequested = await page.evaluate(
      () => !!(window as unknown as Record<string, boolean>).__wakeLockRequested,
    );
    expect(wakeLockRequested).toBe(true);
  });

  test('Wake lock is released when exiting full-screen', async ({ page }) => {
    await page.addInitScript(() => {
      let sentinel: { release: () => void } | null = null;
      Object.defineProperty(navigator, 'wakeLock', {
        value: {
          request: async (_type: string) => {
            sentinel = {
              release: () => {
                (window as unknown as Record<string, boolean>).__wakeLockReleased = true;
              },
            };
            return sentinel;
          },
        },
        configurable: true,
      });
    });

    await setupWorkshopPage(page, PUBLISHED_WORKSHOP);
    await page.getByTestId('qr-camera-btn').click();
    await page.getByTestId('fullscreen-btn').click();
    await expect(page.getByTestId('qr-fullscreen')).toBeVisible();

    await page.getByTestId('qr-fullscreen').click();

    const released = await page.evaluate(
      () => !!(window as unknown as Record<string, boolean>).__wakeLockReleased,
    );
    expect(released).toBe(true);
  });
});

test.describe('QR modal — draft workshop', () => {
  test('camera icon is disabled for draft workshop', async ({ page }) => {
    await setupWorkshopPage(page, DRAFT_WORKSHOP);

    const cameraBtn = page.getByTestId('qr-camera-btn');
    await expect(cameraBtn).toBeDisabled();
    await expect(cameraBtn).toHaveClass(/opacity-40/);
  });

  test('camera icon shows "Publish" tooltip for draft workshop', async ({ page }) => {
    await setupWorkshopPage(page, DRAFT_WORKSHOP);
    const cameraBtn = page.getByTestId('qr-camera-btn');
    await expect(cameraBtn).toHaveAttribute('title', 'Publish this workshop to enable the QR code');
  });

  test('clicking disabled camera icon does not open modal', async ({ page }) => {
    await setupWorkshopPage(page, DRAFT_WORKSHOP);
    await page.getByTestId('qr-camera-btn').click({ force: true });
    await expect(page.getByTestId('qr-modal')).not.toBeVisible();
  });
});
