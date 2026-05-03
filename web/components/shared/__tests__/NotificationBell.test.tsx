// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/client', () => ({
  apiGet:  vi.fn(),
  apiPatch: vi.fn().mockResolvedValue({}),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
  MaintenanceError: class MaintenanceError extends Error {},
}))

vi.mock('@/lib/api/notifications', () => ({
  fetchUnreadCount: vi.fn().mockResolvedValue({
    unread_count:        0,
    has_urgent_unread:   false,
    has_leader_unread:   false,
    has_support_replies: false,
  }),
  markNotificationRead:    vi.fn().mockResolvedValue(undefined),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/api/support', () => ({
  markTicketRead: vi.fn().mockResolvedValue(undefined),
  fetchMyTickets: vi.fn().mockResolvedValue([]),
  submitTicket:   vi.fn(),
}))

vi.mock('@/contexts/UserContext', () => ({
  useUser: vi.fn(() => ({
    user: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com', profile_image_url: null },
    logout: vi.fn(),
  })),
}))

vi.mock('@/lib/hooks/useNavContext', () => ({
  useNavContext: vi.fn(() => ({
    isAuthenticated: true,
    showMySessions: false,
    showMyOrganization: false,
  })),
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

vi.mock('@/components/nav/UserAvatar', () => ({
  UserAvatar: ({ firstName }: { firstName: string }) => <span>{firstName}</span>,
}))

vi.mock('@/components/nav/NavLink', () => ({
  NavLink: ({ label }: { label: string }) => <a>{label}</a>,
}))

import { TopBar } from '../TopBar'
import { apiGet } from '@/lib/api/client'
import { fetchUnreadCount } from '@/lib/api/notifications'

const mockApiGet = vi.mocked(apiGet)
const mockFetchUnreadCount = vi.mocked(fetchUnreadCount)

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Notification bell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue([]) // /me/notifications returns []
    mockFetchUnreadCount.mockResolvedValue({
      unread_count:        0,
      has_urgent_unread:   false,
      has_leader_unread:   false,
      has_support_replies: false,
    })
  })

  it('renders the bell button', async () => {
    render(<TopBar />)
    expect(screen.getByTitle('Notifications')).toBeInTheDocument()
  })

  it('shows unread badge when notifications are unread', async () => {
    mockApiGet.mockResolvedValue([
      {
        recipient_id: 1, notification_id: 10, title: 'New msg', message: 'Hello',
        notification_type: 'informational', read_at: null,
        created_at: new Date().toISOString(), workshop_context: null,
      },
    ])
    render(<TopBar />)
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
  })

  it('shows support reply entry in dropdown when has_support_replies is true', async () => {
    mockFetchUnreadCount.mockResolvedValue({
      unread_count:        0,
      has_urgent_unread:   false,
      has_leader_unread:   false,
      has_support_replies: true,
    })
    const user = userEvent.setup()
    render(<TopBar />)
    await waitFor(() => expect(mockFetchUnreadCount).toHaveBeenCalled())

    // Bell count should show 1 (1 support reply)
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())

    // Open dropdown
    await user.click(screen.getByTitle('Notifications'))
    expect(screen.getByText('Support reply received')).toBeInTheDocument()
  })

  it('clicking support reply entry navigates to /help', async () => {
    mockPush.mockClear()
    mockFetchUnreadCount.mockResolvedValue({
      unread_count: 0, has_urgent_unread: false, has_leader_unread: false, has_support_replies: true,
    })
    const user = userEvent.setup()
    render(<TopBar />)
    await waitFor(() => expect(mockFetchUnreadCount).toHaveBeenCalled())

    await user.click(screen.getByTitle('Notifications'))
    const supportEntry = await screen.findByText('Support reply received')
    await user.click(supportEntry)

    expect(mockPush).toHaveBeenCalledWith('/help')
  })
})
