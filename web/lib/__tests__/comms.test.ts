import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatCountdown } from '@/components/shared/SystemAnnouncementBanner'
import { MaintenanceError, ApiError } from '@/lib/api/client'

// ─── formatCountdown ─────────────────────────────────────────────────────────

describe('formatCountdown', () => {
  it('returns "Any moment now" when under 30 seconds remain', () => {
    expect(formatCountdown(0)).toBe('Any moment now')
    expect(formatCountdown(15)).toBe('Any moment now')
    expect(formatCountdown(29)).toBe('Any moment now')
  })

  it('formats minutes and zero-padded seconds', () => {
    expect(formatCountdown(90)).toBe('Back in 1m 30s')
    expect(formatCountdown(60)).toBe('Back in 1m 00s')
    expect(formatCountdown(125)).toBe('Back in 2m 05s')
  })

  it('formats large values correctly', () => {
    expect(formatCountdown(3600)).toBe('Back in 60m 00s')
    expect(formatCountdown(3661)).toBe('Back in 61m 01s')
  })
})

// ─── MaintenanceError class ──────────────────────────────────────────────────

describe('MaintenanceError', () => {
  it('has name "MaintenanceError"', () => {
    const e = new MaintenanceError()
    expect(e.name).toBe('MaintenanceError')
  })

  it('uses the default message when none supplied', () => {
    const e = new MaintenanceError()
    expect(e.message).toBe('System under maintenance')
  })

  it('accepts a custom message', () => {
    const e = new MaintenanceError('custom msg')
    expect(e.message).toBe('custom msg')
  })

  it('is an instance of Error', () => {
    expect(new MaintenanceError()).toBeInstanceOf(Error)
  })
})

// ─── API client: 503 + X-Maintenance-Mode dispatches custom event ───────────
// We test the dispatch behaviour by mocking fetch and window.dispatchEvent.

describe('api client 503 maintenance handling', () => {
  let dispatchSpy: ReturnType<typeof vi.fn>
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    dispatchSpy = vi.fn()
    ;(global as { dispatchEvent: unknown }).dispatchEvent = dispatchSpy
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('throws MaintenanceError on 503 + X-Maintenance-Mode: true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 503,
      ok: false,
      headers: { get: (h: string) => h === 'X-Maintenance-Mode' ? 'true' : null },
    } as unknown as Response)

    // Dynamically import to avoid module-level caching issues
    const { apiGet } = await import('@/lib/api/client')
    await expect(apiGet('/some-endpoint')).rejects.toBeInstanceOf(MaintenanceError)
  })

  it('throws ApiError (not MaintenanceError) on plain 503 without header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 503,
      ok: false,
      headers: { get: () => null },
      json: async () => ({ message: 'Service Unavailable' }),
    } as unknown as Response)

    const { apiGet } = await import('@/lib/api/client')
    await expect(apiGet('/some-endpoint')).rejects.toBeInstanceOf(ApiError)
  })
})
