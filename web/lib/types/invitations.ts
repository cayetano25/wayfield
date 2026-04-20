export interface LeaderInvitationData {
  invitation_id: number
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'removed'
  is_expired: boolean
  invited_email: string
  invited_first_name: string | null
  invited_last_name: string | null
  organization: {
    id: number
    name: string
    slug: string
  }
  workshop: {
    id: number
    title: string
    description: string
    start_date: string
    end_date: string
    timezone: string
    status: string
    location: { city: string | null; state_or_region: string | null }
    leaders_count: number
    sessions_count: number
  } | null
  sessions_assigned: Array<{
    session_id: number
    title: string
    start_at: string
    end_at: string
    location_display: string | null
  }>
}

export interface AcceptResult {
  message: string
  leader: {
    id: number
    first_name: string
    last_name: string
  }
  redirect: string
}

export interface DeclineResult {
  message: string
  organization_name: string | null
  workshop_title: string | null
}

export class InvitationNotFoundError extends Error {
  constructor() {
    super('Invitation not found')
    this.name = 'InvitationNotFoundError'
  }
}

export interface OrgInvitationData {
  invitation_id: number
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'removed'
  is_expired: boolean
  expires_at: string | null
  invited_email: string
  invited_first_name: string | null
  invited_last_name: string | null
  role: 'admin' | 'staff' | 'billing_admin'
  role_display: string
  organization: {
    id: number
    name: string
    slug: string
    workshops_count: number
    members_count: number
  }
}

export interface AcceptOrgResult {
  message: string
  organization: { id: number; name: string; slug: string }
  role: string
  role_display: string
  redirect: string
}

export interface DeclineOrgResult {
  message: string
  organization_name: string | null
}
