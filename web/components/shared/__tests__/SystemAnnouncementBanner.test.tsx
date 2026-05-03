// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the API client before the component is imported
vi.mock('@/lib/api/client', () => ({
  apiGet:  vi.fn(),
  apiPost: vi.fn().mockResolvedValue({}),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
  MaintenanceError: class MaintenanceError extends Error {
    constructor(message = 'System under maintenance') { super(message); this.name = 'MaintenanceError' }
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getToken:        vi.fn(() => 'fake-token'),
  clearToken:      vi.fn(),
  clearStoredUser: vi.fn(),
}))

import { SystemAnnouncementBanner } from '../SystemAnnouncementBanner'
import { apiGet, apiPost } from '@/lib/api/client'

const mockApiGet = vi.mocked(apiGet)
const mockApiPost = vi.mocked(apiPost)

type AnnouncementInput = {
  id: number; title: string; message: string;
  announcement_type: 'info' | 'warning' | 'maintenance' | 'outage' | 'update';
  severity: 'critical' | 'high' | 'medium' | 'low';
  is_dismissable: boolean; is_dismissed: boolean;
  ends_at: string | null; created_at: string;
}

type ResponseInput = {
  maintenance_mode: boolean;
  maintenance_message: string | null;
  maintenance_ends_at: string | null;
  announcements: AnnouncementInput[];
}

const emptyResponse: ResponseInput = {
  maintenance_mode:    false,
  maintenance_message: null,
  maintenance_ends_at: null,
  announcements:       [],
}

function makeResponse(overrides: Partial<ResponseInput> = {}): ResponseInput {
  return { ...emptyResponse, ...overrides }
}

describe('SystemAnnouncementBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue(emptyResponse)
    // Suppress localStorage errors in jsdom
    global.localStorage.clear()
  })

  it('fetches /system/announcements on mount', async () => {
    render(<SystemAnnouncementBanner />)
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/system/announcements')
    })
  })

  it('renders nothing when there are no announcements and no maintenance', async () => {
    mockApiGet.mockResolvedValue(emptyResponse)
    const { container } = render(<SystemAnnouncementBanner />)
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled())
    // After fetch: no visible content
    expect(container.firstChild).toBeNull()
  })

  it('shows maintenance banner when maintenance_mode is true', async () => {
    mockApiGet.mockResolvedValue(
      makeResponse({ maintenance_mode: true, maintenance_message: 'Scheduled maintenance tonight.' }),
    )
    render(<SystemAnnouncementBanner />)
    await waitFor(() =>
      expect(screen.getByText('Scheduled maintenance tonight.')).toBeInTheDocument(),
    )
  })

  it('shows default maintenance text when message is null', async () => {
    mockApiGet.mockResolvedValue(makeResponse({ maintenance_mode: true }))
    render(<SystemAnnouncementBanner />)
    await waitFor(() =>
      expect(screen.getByText('Wayfield is under scheduled maintenance.')).toBeInTheDocument(),
    )
  })

  it('renders info and warning banners with dismiss button', async () => {
    mockApiGet.mockResolvedValue(
      makeResponse({
        announcements: [
          {
            id: 1, title: 'Info title', message: 'Info message',
            announcement_type: 'info', severity: 'medium',
            is_dismissable: true, is_dismissed: false, ends_at: null, created_at: new Date().toISOString(),
          },
          {
            id: 2, title: 'Warning title', message: 'Warning message',
            announcement_type: 'warning', severity: 'high',
            is_dismissable: true, is_dismissed: false, ends_at: null, created_at: new Date().toISOString(),
          },
        ],
      }),
    )
    render(<SystemAnnouncementBanner />)
    await waitFor(() => expect(screen.getByText('Info title')).toBeInTheDocument())
    expect(screen.getByText('Warning title')).toBeInTheDocument()
    // Both have dismiss buttons
    const dismissButtons = screen.getAllByLabelText('Dismiss announcement')
    expect(dismissButtons).toHaveLength(2)
  })

  it('critical severity banner has NO dismiss button', async () => {
    mockApiGet.mockResolvedValue(
      makeResponse({
        announcements: [
          {
            id: 3, title: 'Critical alert', message: 'Something is very wrong.',
            announcement_type: 'outage', severity: 'critical',
            is_dismissable: false, is_dismissed: false, ends_at: null, created_at: new Date().toISOString(),
          },
        ],
      }),
    )
    render(<SystemAnnouncementBanner />)
    await waitFor(() => expect(screen.getByText('Critical alert')).toBeInTheDocument())
    expect(screen.queryByLabelText('Dismiss announcement')).toBeNull()
  })

  it('clicking dismiss calls the API and removes the banner', async () => {
    const user = userEvent.setup()
    mockApiPost.mockResolvedValue({})
    mockApiGet.mockResolvedValue(
      makeResponse({
        announcements: [
          {
            id: 4, title: 'Dismissable', message: 'You can dismiss this.',
            announcement_type: 'info', severity: 'low',
            is_dismissable: true, is_dismissed: false, ends_at: null, created_at: new Date().toISOString(),
          },
        ],
      }),
    )
    render(<SystemAnnouncementBanner />)
    await waitFor(() => expect(screen.getByText('Dismissable')).toBeInTheDocument())

    const btn = screen.getByLabelText('Dismiss announcement')
    await user.click(btn)

    // Banner removed immediately (optimistic)
    expect(screen.queryByText('Dismissable')).toBeNull()
    // API called
    expect(mockApiPost).toHaveBeenCalledWith('/system/announcements/4/dismiss')
  })

  it('already-dismissed (is_dismissed: true) banners are not shown on refetch', async () => {
    mockApiGet.mockResolvedValue(
      makeResponse({
        announcements: [
          {
            id: 5, title: 'Already gone', message: 'Server says dismissed.',
            announcement_type: 'info', severity: 'low',
            is_dismissable: true, is_dismissed: true, ends_at: null, created_at: new Date().toISOString(),
          },
        ],
      }),
    )
    const { container } = render(<SystemAnnouncementBanner />)
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('shows countdown timer when maintenance_ends_at is in the future', async () => {
    const future = new Date(Date.now() + 900_000).toISOString() // 15 minutes from now
    mockApiGet.mockResolvedValue(
      makeResponse({ maintenance_mode: true, maintenance_ends_at: future }),
    )
    render(<SystemAnnouncementBanner />)
    await waitFor(() => expect(screen.getByText(/Back in \d+m \d+s/)).toBeInTheDocument())
  })

  it('silently fails and renders nothing when fetch errors', async () => {
    mockApiGet.mockRejectedValue(new Error('network error'))
    const { container } = render(<SystemAnnouncementBanner />)
    // Wait a tick to let the async fetch settle
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(container.firstChild).toBeNull()
  })
})
