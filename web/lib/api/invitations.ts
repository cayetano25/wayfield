import { ApiError } from './client'
import { getToken } from '@/lib/auth/session'
import type { LeaderInvitationData, AcceptResult, DeclineResult } from '@/lib/types/invitations'
import { InvitationNotFoundError } from '@/lib/types/invitations'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

/**
 * GET /api/v1/leader-invitations/{token}
 * Public — no auth header needed.
 * Throws InvitationNotFoundError if 404.
 */
export async function resolveLeaderInvitation(token: string): Promise<LeaderInvitationData> {
  const res = await fetch(`${BASE_URL}/leader-invitations/${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
  })

  if (res.status === 404) {
    throw new InvitationNotFoundError()
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const json = await res.json()
      message = json.message ?? message
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message)
  }

  return res.json() as Promise<LeaderInvitationData>
}

/**
 * POST /api/v1/leader-invitations/{token}/accept
 * Requires auth header.
 */
export async function acceptLeaderInvitation(token: string): Promise<AcceptResult> {
  const authToken = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const res = await fetch(`${BASE_URL}/leader-invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    headers,
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    let errors: Record<string, string[]> | undefined
    try {
      const json = await res.json()
      message = json.message ?? message
      errors = json.errors
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message, errors)
  }

  return res.json() as Promise<AcceptResult>
}

/**
 * POST /api/v1/leader-invitations/{token}/decline
 * No auth required.
 */
export async function declineLeaderInvitation(token: string): Promise<DeclineResult> {
  const authToken = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const res = await fetch(`${BASE_URL}/leader-invitations/${encodeURIComponent(token)}/decline`, {
    method: 'POST',
    headers,
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    let errors: Record<string, string[]> | undefined
    try {
      const json = await res.json()
      message = json.message ?? message
      errors = json.errors
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message, errors)
  }

  return res.json() as Promise<DeclineResult>
}

/**
 * GET /api/v1/auth/check-email?email={email}
 * Public. Returns account_exists boolean.
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  const res = await fetch(
    `${BASE_URL}/auth/check-email?email=${encodeURIComponent(email)}`,
    { headers: { Accept: 'application/json' } },
  )

  if (!res.ok) return false

  const json = (await res.json()) as { account_exists: boolean }
  return json.account_exists === true
}
